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

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const client = url.startsWith("https") ? https : http;
    client
      .get(url, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          file.close();
          try {
            fs.unlinkSync(dest);
          } catch {}
          return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        }
        if (response.statusCode !== 200) {
          file.close();
          try {
            fs.unlinkSync(dest);
          } catch {}
          return reject(new Error(`Download failed: HTTP ${response.statusCode}`));
        }
        response.pipe(file);
        file.on("finish", () => {
          file.close(resolve);
        });
      })
      .on("error", (err) => {
        file.close();
        try {
          if (fs.existsSync(dest)) fs.unlinkSync(dest);
        } catch {}
        reject(err);
      });
  });
}

function runFFmpeg(args) {
  return new Promise((resolve, reject) => {
    execFile("ffmpeg", args, { timeout: 120000 }, (error, stdout, stderr) => {
      if (error) return reject(new Error(stderr || error.message));
      resolve({ stdout, stderr });
    });
  });
}

app.post("/api/reformat", async (req, res) => {
  const { videoUrl, width, height, name } = req.body;

  if (!videoUrl || !width || !height) {
    return res.status(400).json({ error: "videoUrl, width, and height are required" });
  }

  const tmpDir = os.tmpdir();
  const inputPath = path.join(tmpDir, `input-${Date.now()}.mp4`);
  const outputPath = path.join(tmpDir, `output-${Date.now()}.mp4`);

  try {
    await downloadFile(videoUrl, inputPath);

    const probeResult = await new Promise((resolve, reject) => {
      execFile(
        "ffprobe",
        ["-v", "quiet", "-print_format", "json", "-show_streams", inputPath],
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

    const videoStream = probeResult.streams.find((s) => s.codec_type === "video");
    const srcW = videoStream ? videoStream.width : 1080;
    const srcH = videoStream ? videoStream.height : 1920;

    const w = Number(width);
    const h = Number(height);
    const srcAspect = srcW / srcH;
    const tgtAspect = w / h;

    let filterComplex;

    if (Math.abs(srcAspect - tgtAspect) < 0.05) {
      // Same aspect ratio — just scale directly
      filterComplex = `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:black`;
    } else {
      // Different aspect ratio — blurred background + centered original
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

    await runFFmpeg(ffmpegArgs);

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
    readStream.on("error", () => {
      try {
        fs.unlinkSync(inputPath);
      } catch {}
      try {
        fs.unlinkSync(outputPath);
      } catch {}
      if (!res.headersSent) res.status(500).json({ error: "Failed to send file" });
    });
  } catch (err) {
    try {
      fs.unlinkSync(inputPath);
    } catch {}
    try {
      fs.unlinkSync(outputPath);
    } catch {}
    console.error("Reformat error:", err.message);
    res.status(500).json({ error: err.message || "Reformatting failed" });
  }
});

app.use(express.static(path.join(__dirname, "dist")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Intake Breathing server running on port ${PORT}`);
});
