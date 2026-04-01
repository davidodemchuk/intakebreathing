import express from "express";
import fs from "fs";
import path from "path";
import os from "os";
import https from "https";
import http from "http";
import { fileURLToPath } from "url";
import { execFile } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try bundled FFmpeg first, fall back to system install
let FFMPEG_PATH = "ffmpeg";
let FFPROBE_PATH = "ffprobe";
try {
  const ffmpegInstaller = await import("@ffmpeg-installer/ffmpeg");
  const ffprobeInstaller = await import("@ffprobe-installer/ffprobe");
  FFMPEG_PATH = ffmpegInstaller.default?.path || ffmpegInstaller.path || "ffmpeg";
  FFPROBE_PATH = ffprobeInstaller.default?.path || ffprobeInstaller.path || "ffprobe";
  console.log(`[init] Using bundled FFmpeg: ${FFMPEG_PATH}`);
  console.log(`[init] Using bundled FFprobe: ${FFPROBE_PATH}`);
} catch (e) {
  console.log(`[init] Bundled FFmpeg not found, using system install: ${e.message}`);
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "50mb" }));

// ── Health check ──
app.get("/api/health", async (req, res) => {
  let ffmpegOk = false;
  let ffmpegVersion = "";
  try {
    const out = await new Promise((resolve, reject) => {
      execFile(FFMPEG_PATH, ["-version"], { timeout: 5000 }, (error, stdout) => {
        if (error) return reject(error);
        resolve(stdout);
      });
    });
    ffmpegOk = true;
    ffmpegVersion = out.split("\n")[0] || "";
  } catch {}

  let ffprobeOk = false;
  try {
    await new Promise((resolve, reject) => {
      execFile(FFPROBE_PATH, ["-version"], { timeout: 5000 }, (error, stdout) => {
        if (error) return reject(error);
        resolve(stdout);
      });
    });
    ffprobeOk = true;
  } catch {}

  res.json({
    status: "ok",
    ffmpeg: ffmpegOk,
    ffprobe: ffprobeOk,
    ffmpegPath: FFMPEG_PATH,
    ffprobePath: FFPROBE_PATH,
    ffmpegVersion,
    node: process.version,
    uptime: Math.round(process.uptime()),
  });
});

// ── Download helper ──
function downloadFile(url, dest, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) return reject(new Error("Too many redirects"));
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
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Referer: "https://www.tiktok.com/",
        Accept: "*/*",
        "Accept-Encoding": "identity",
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
          return reject(new Error(`Download HTTP ${response.statusCode} from ${parsedUrl.hostname}`));
        }
        response.pipe(file);
        file.on("finish", () => file.close(resolve));
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

// ── FFmpeg runner ──
function runFFmpeg(args) {
  return new Promise((resolve, reject) => {
    execFile(FFMPEG_PATH, args, { timeout: 300000, maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
      if (error) {
        console.error("[ffmpeg] stderr:", stderr?.substring(0, 500));
        return reject(new Error(stderr || error.message));
      }
      resolve({ stdout, stderr });
    });
  });
}

// ── FFprobe runner ──
function runFFprobe(inputPath) {
  return new Promise((resolve, reject) => {
    execFile(FFPROBE_PATH, ["-v", "quiet", "-print_format", "json", "-show_streams", inputPath], { timeout: 15000, maxBuffer: 1024 * 1024 }, (error, stdout) => {
      if (error) return reject(error);
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        reject(e);
      }
    });
  });
}

// ── Reformat endpoint ──
app.post("/api/reformat", async (req, res) => {
  const { videoUrl, width, height, name } = req.body;
  console.log(`[reformat] Starting: ${width}x${height} from ${videoUrl?.substring(0, 80)}...`);

  if (!videoUrl || !width || !height) {
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

    if (inputSize < 1000) {
      throw new Error("Downloaded file too small — URL may have expired. Re-fetch the video.");
    }

    // Probe dimensions
    let srcW = 1080,
      srcH = 1920;
    try {
      const probe = await runFFprobe(inputPath);
      const vs = probe.streams?.find((s) => s.codec_type === "video");
      if (vs) {
        srcW = vs.width || 1080;
        srcH = vs.height || 1920;
      }
      console.log(`[reformat] Source: ${srcW}x${srcH}`);
    } catch (probeErr) {
      console.log(`[reformat] ffprobe failed, using defaults: ${probeErr.message}`);
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
    ffmpegArgs.push("-c:v", "libx264", "-preset", "fast", "-crf", "23", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-y", outputPath);

    console.log(`[reformat] Processing to ${w}x${h}...`);
    await runFFmpeg(ffmpegArgs);
    const outputSize = fs.statSync(outputPath).size;
    console.log(`[reformat] Done: ${(outputSize / 1024 / 1024).toFixed(1)}MB`);

    const safeName = (name || "reformatted").replace(/[^a-zA-Z0-9_-]/g, "_");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}_${w}x${h}.mp4"`);
    res.setHeader("Content-Type", "video/mp4");
    const stream = fs.createReadStream(outputPath);
    stream.pipe(res);
    stream.on("end", () => {
      try {
        fs.unlinkSync(inputPath);
      } catch {}
      try {
        fs.unlinkSync(outputPath);
      } catch {}
    });
    stream.on("error", () => {
      try {
        fs.unlinkSync(inputPath);
      } catch {}
      try {
        fs.unlinkSync(outputPath);
      } catch {}
      if (!res.headersSent) res.status(500).json({ error: "Stream failed" });
    });
  } catch (err) {
    console.error(`[reformat] ERROR:`, err.message);
    try {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    } catch {}
    try {
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    } catch {}
    if (!res.headersSent) res.status(500).json({ error: err.message || "Reformatting failed" });
  }
});

// Serve static + SPA fallback
app.use(express.static(path.join(__dirname, "dist")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Intake server on port ${PORT} | FFmpeg: ${FFMPEG_PATH} | FFprobe: ${FFPROBE_PATH}`);
});
