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

// ── Resolve FFmpeg path: bundled npm package first, system fallback ──
let FFMPEG = "ffmpeg";
let FFPROBE = "ffprobe";
try {
  const fp = await import("@ffmpeg-installer/ffmpeg");
  FFMPEG = fp.default?.path || fp.path || "ffmpeg";
} catch {}
try {
  const pp = await import("@ffprobe-installer/ffprobe");
  FFPROBE = pp.default?.path || pp.path || "ffprobe";
} catch {}

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json({ limit: "50mb" }));

// ── Health ──
app.get("/api/health", async (req, res) => {
  let ffOk = false, fpOk = false, ffVer = "";
  try {
    ffVer = await new Promise((ok, no) => execFile(FFMPEG, ["-version"], { timeout: 5000 }, (e, o) => e ? no(e) : ok(o)));
    ffOk = true;
    ffVer = ffVer.split("\n")[0];
  } catch {}
  try { await new Promise((ok, no) => execFile(FFPROBE, ["-version"], { timeout: 5000 }, (e, o) => e ? no(e) : ok(o))); fpOk = true; } catch {}
  res.json({ status: "ok", ffmpeg: ffOk, ffprobe: fpOk, ffmpegPath: FFMPEG, version: ffVer, node: process.version, uptime: Math.round(process.uptime()) });
});

// ── Download with proper headers + redirect following ──
function download(url, dest, depth = 0) {
  return new Promise((resolve, reject) => {
    if (depth > 6) return reject(new Error("Too many redirects"));
    let parsedUrl;
    try { parsedUrl = new URL(url); } catch { return reject(new Error("Invalid URL")); }
    const client = parsedUrl.protocol === "https:" ? https : http;
    const file = fs.createWriteStream(dest);
    client.get({
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Referer": "https://www.tiktok.com/",
        "Accept": "*/*",
        "Accept-Encoding": "identity",
      },
    }, (resp) => {
      if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
        file.close();
        try { fs.unlinkSync(dest); } catch {}
        const next = /^https?:\/\//i.test(resp.headers.location) ? resp.headers.location : new URL(resp.headers.location, url).href;
        return download(next, dest, depth + 1).then(resolve).catch(reject);
      }
      if (resp.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(dest); } catch {}
        return reject(new Error(`HTTP ${resp.statusCode}`));
      }
      resp.pipe(file);
      file.on("finish", () => file.close(resolve));
    }).on("error", (e) => { file.close(); try { fs.unlinkSync(dest); } catch {} reject(e); });
  });
}

// ── Reformat ──
app.post("/api/reformat", async (req, res) => {
  const { videoUrl, width, height, name } = req.body;
  if (!videoUrl || !width || !height) return res.status(400).json({ error: "Missing videoUrl, width, or height" });
  
  const w = Number(width), h = Number(height);
  const tmp = os.tmpdir();
  const inp = path.join(tmp, `in-${Date.now()}.mp4`);
  const out = path.join(tmp, `out-${Date.now()}.mp4`);
  const cleanup = () => { try { fs.unlinkSync(inp); } catch {} try { fs.unlinkSync(out); } catch {} };

  try {
    console.log(`[reformat] ${w}x${h} from ${videoUrl.substring(0, 60)}...`);
    
    // Download
    await download(videoUrl, inp);
    const sz = fs.statSync(inp).size;
    console.log(`[reformat] Downloaded ${(sz / 1048576).toFixed(1)}MB`);
    if (sz < 5000) throw new Error("Download too small — video URL may have expired. Re-fetch the video and try again.");

    // Probe
    let srcW = 1080, srcH = 1920;
    try {
      const probe = await new Promise((ok, no) => execFile(FFPROBE, ["-v", "quiet", "-print_format", "json", "-show_streams", inp], { timeout: 15000, maxBuffer: 2097152 }, (e, o) => e ? no(e) : ok(JSON.parse(o))));
      const vs = probe.streams?.find(s => s.codec_type === "video");
      if (vs) { srcW = vs.width || 1080; srcH = vs.height || 1920; }
    } catch (e) { console.log("[reformat] probe fallback:", e.message); }

    // Build filter
    const srcA = srcW / srcH, tgtA = w / h;
    let vf;
    if (Math.abs(srcA - tgtA) < 0.05) {
      vf = ["-vf", `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:black`];
    } else {
      vf = ["-filter_complex", `[0:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},boxblur=20:20[bg];[0:v]scale=${w}:${h}:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2`];
    }

    // Run FFmpeg
    console.log("[reformat] Processing...");
    await new Promise((ok, no) => {
      execFile(FFMPEG, ["-i", inp, ...vf, "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-y", out],
        { timeout: 300000, maxBuffer: 10485760 },
        (e, _, stderr) => e ? no(new Error(stderr?.substring(0, 200) || e.message)) : ok());
    });

    const outSz = fs.statSync(out).size;
    console.log(`[reformat] Done ${(outSz / 1048576).toFixed(1)}MB`);

    const safeName = (name || "video").replace(/[^a-zA-Z0-9_-]/g, "_");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}_${w}x${h}.mp4"`);
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Length", outSz);
    const stream = fs.createReadStream(out);
    stream.pipe(res);
    stream.on("close", cleanup);
    stream.on("error", () => { cleanup(); if (!res.headersSent) res.status(500).json({ error: "Stream error" }); });
  } catch (e) {
    cleanup();
    console.error("[reformat] ERROR:", e.message);
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
});

// ── Proxy download (passes video through server to avoid CORS) ──
app.post("/api/proxy-download", async (req, res) => {
  const { videoUrl, filename } = req.body;
  if (!videoUrl) return res.status(400).json({ error: "Missing videoUrl" });
  
  const tmp = path.join(os.tmpdir(), `proxy-${Date.now()}.mp4`);
  try {
    await download(videoUrl, tmp);
    const sz = fs.statSync(tmp).size;
    if (sz < 5000) throw new Error("Download too small — URL may have expired.");
    res.setHeader("Content-Disposition", `attachment; filename="${filename || "video"}.mp4"`);
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Length", sz);
    const stream = fs.createReadStream(tmp);
    stream.pipe(res);
    stream.on("close", () => { try { fs.unlinkSync(tmp); } catch {} });
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch {}
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
});

// Static + SPA
app.use(express.static(path.join(__dirname, "dist")));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "dist", "index.html")));

app.listen(PORT, "0.0.0.0", () => console.log(`Server :${PORT} | FFmpeg: ${FFMPEG}`));
