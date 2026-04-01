import express from "express";
import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import https from "https";
import http from "http";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

function downloadFile(url, dest, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      return reject(new Error("Too many redirects"));
    }
    const file = fs.createWriteStream(dest);
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch (e) {
      file.close();
      try {
        fs.unlinkSync(dest);
      } catch {}
      return reject(new Error(`Invalid URL: ${url}`));
    }
    const client = parsedUrl.protocol === "https:" ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://www.tiktok.com/",
        Accept: "*/*",
      },
    };

    client
      .get(options, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          file.close();
          try {
            fs.unlinkSync(dest);
          } catch {}
          const nextUrl = /^https?:\/\//i.test(response.headers.location)
            ? response.headers.location
            : new URL(response.headers.location, url).href;
          return downloadFile(nextUrl, dest, redirectCount + 1).then(resolve).catch(reject);
        }
        if (response.statusCode !== 200) {
          file.close();
          try {
            fs.unlinkSync(dest);
          } catch {}
          return reject(new Error(`Download failed: HTTP ${response.statusCode} from ${parsedUrl.hostname}`));
        }
        response.pipe(file);
        file.on("finish", () => {
          file.close(resolve);
        });
      })
      .on("error", (err) => {
        file.close();
        try {
          fs.unlinkSync(dest);
        } catch {}
        reject(err);
      });
  });
}

function runFFmpeg(args) {
  return new Promise((resolve, reject) => {
    execFile(
      "ffmpeg",
      args,
      { timeout: 300000, maxBuffer: 1024 * 1024 * 10 },
      (error, stdout, stderr) => {
        if (error) {
          console.error("[ffmpeg] stderr:", stderr?.substring(0, 500));
          return reject(new Error(stderr || error.message));
        }
        resolve({ stdout, stderr });
      }
    );
  });
}

app.get("/api/health", async (req, res) => {
  let ffmpegOk = false;
  try {
    await new Promise((resolve, reject) => {
      execFile("ffmpeg", ["-version"], { timeout: 5000 }, (error, stdout) => {
        if (error) return reject(error);
        ffmpegOk = true;
        resolve(stdout);
      });
    });
  } catch {}

  res.json({
    status: "ok",
    ffmpeg: ffmpegOk,
    node: process.version,
    uptime: process.uptime(),
  });
});

app.post("/api/reformat", async (req, res) => {
  const { videoUrl, width, height, name } = req.body;
  console.log(`[reformat] Starting: ${width}x${height} from ${videoUrl?.substring(0, 80)}...`);

  if (!videoUrl || !width || !height) {
    console.error("[reformat] Validation failed: missing videoUrl, width, or height");
    return res.status(400).json({ error: "videoUrl, width, and height are required" });
  }

  const tmpDir = os.tmpdir();
  const inputPath = path.join(tmpDir, `input-${Date.now()}.mp4`);
  const outputPath = path.join(tmpDir, `output-${Date.now()}.mp4`);

  try {
    console.log(`[reformat] Downloading video...`);
    await downloadFile(videoUrl, inputPath);
    const inputSize = fs.statSync(inputPath).size;
    console.log(`[reformat] Downloaded: ${(inputSize / 1024 / 1024).toFixed(1)}MB`);

    let srcW = 1080;
    let srcH = 1920; // Safe defaults (assume vertical video)

    try {
      const probeResult = await new Promise((resolve, reject) => {
        execFile(
          "ffprobe",
          ["-v", "quiet", "-print_format", "json", "-show_streams", inputPath],
          { timeout: 15000, maxBuffer: 1024 * 1024 },
          (error, stdout) => {
            if (error) return reject(error);
            try {
              resolve(JSON.parse(stdout));
            } catch (e) {
              reject(e);
            }
          }
        );
      });
      const videoStream = probeResult.streams?.find((s) => s.codec_type === "video");
      if (videoStream) {
        srcW = videoStream.width || 1080;
        srcH = videoStream.height || 1920;
      }
    } catch (probeErr) {
      console.log("[reformat] ffprobe failed, using defaults:", probeErr.message);
      // Continue with defaults — FFmpeg can still process without knowing exact dimensions
    }

    const w = Number(width);
    const h = Number(height);
    const srcAspect = srcW / srcH;
    const tgtAspect = w / h;

    let filterComplex;

    if (Math.abs(srcAspect - tgtAspect) < 0.05) {
      filterComplex = `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:black`;
    } else {
      filterComplex = [
        `[0:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},boxblur=20:20[bg]`,
        `[0:v]scale=${w}:${h}:force_original_aspect_ratio=decrease[fg]`,
        `[bg][fg]overlay=(W-w)/2:(H-h)/2`,
      ].join(";");
    }

    const ffmpegArgs = ["-i", inputPath];

    if (filterComplex.includes("[")) {
      ffmpegArgs.push("-filter_complex", filterComplex);
    } else {
      ffmpegArgs.push("-vf", filterComplex);
    }

    ffmpegArgs.push(
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "23",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      "-y",
      outputPath
    );

    console.log(`[reformat] FFmpeg starting...`);
    await runFFmpeg(ffmpegArgs);
    const outputSize = fs.statSync(outputPath).size;
    console.log(`[reformat] FFmpeg done: ${(outputSize / 1024 / 1024).toFixed(1)}MB output`);

    const safeName = (name || "reformatted").replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = `${safeName}_${w}x${h}.mp4`;

    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Type", "video/mp4");

    const readStream = fs.createReadStream(outputPath);
    readStream.pipe(res);
    readStream.on("end", () => {
      try {
        fs.unlinkSync(inputPath);
      } catch {}
      try {
        fs.unlinkSync(outputPath);
      } catch {}
    });
    readStream.on("error", (err) => {
      console.error("[reformat] Stream error:", err.message);
      try {
        fs.unlinkSync(inputPath);
      } catch {}
      try {
        fs.unlinkSync(outputPath);
      } catch {}
      if (!res.headersSent) res.status(500).json({ error: "Failed to send file" });
    });
  } catch (err) {
    console.error(`[reformat] ERROR:`, err.message);
    try {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    } catch {}
    try {
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    } catch {}
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || "Reformatting failed" });
    }
  }
});

app.use(express.static(path.join(__dirname, "dist")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Intake Breathing server running on port ${PORT}`);
});
