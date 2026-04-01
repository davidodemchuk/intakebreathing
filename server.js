import express from "express";
import fs from "fs";
import path from "path";
import os from "os";
import https from "https";
import http from "http";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import archiver from "archiver";

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

// ── Download with proper headers + redirect following + hard timeouts ──
function download(url, dest, depth = 0) {
  return new Promise((resolve, reject) => {
    if (depth > 6) return reject(new Error("Too many redirects"));

    const timeout = setTimeout(() => {
      try { fs.unlinkSync(dest); } catch {}
      reject(new Error("Download timed out after 30 seconds"));
    }, 30000);

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      clearTimeout(timeout);
      return reject(new Error("Invalid URL"));
    }

    const client = parsedUrl.protocol === "https:" ? https : http;
    const file = fs.createWriteStream(dest);
    const referer = parsedUrl.hostname.includes("tiktok")
      ? "https://www.tiktok.com/"
      : parsedUrl.hostname.includes("instagram")
        ? "https://www.instagram.com/"
        : "";

    const req = client.get(
      {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Referer: referer,
          Accept: "*/*",
          "Accept-Encoding": "identity",
          Connection: "keep-alive",
        },
        timeout: 30000,
      },
      (resp) => {
        if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
          clearTimeout(timeout);
          file.close();
          try { fs.unlinkSync(dest); } catch {}
          const next = /^https?:\/\//i.test(resp.headers.location)
            ? resp.headers.location
            : new URL(resp.headers.location, url).href;
          return download(next, dest, depth + 1).then(resolve).catch(reject);
        }
        if (resp.statusCode !== 200) {
          clearTimeout(timeout);
          file.close();
          try { fs.unlinkSync(dest); } catch {}
          return reject(new Error(`HTTP ${resp.statusCode} from ${parsedUrl.hostname}`));
        }
        resp.pipe(file);
        resp.on("error", (e) => {
          clearTimeout(timeout);
          file.close();
          try { fs.unlinkSync(dest); } catch {}
          reject(e);
        });
        file.on("finish", () => {
          clearTimeout(timeout);
          resolve();
        });
      },
    );

    req.on("error", (e) => {
      clearTimeout(timeout);
      file.close();
      try { fs.unlinkSync(dest); } catch {}
      reject(e);
    });
    req.on("timeout", () => {
      req.destroy();
      clearTimeout(timeout);
      file.close();
      try { fs.unlinkSync(dest); } catch {}
      reject(new Error("Connection timed out"));
    });
  });
}

async function downloadWithRetry(urls, dest) {
  const errors = [];
  const list = [...new Set((urls || []).filter(Boolean))];
  for (const u of list) {
    try {
      console.log(`[download] Trying: ${u.substring(0, 80)}...`);
      await download(u, dest);
      const sz = fs.statSync(dest).size;
      if (sz > 5000) {
        console.log(`[download] Success: ${(sz / 1048576).toFixed(1)}MB`);
        return;
      }
      try { fs.unlinkSync(dest); } catch {}
      errors.push(`URL returned tiny file (${sz} bytes)`);
    } catch (e) {
      errors.push(`${e.message} (${u.substring(0, 50)}...)`);
      try { fs.unlinkSync(dest); } catch {}
    }
  }
  throw new Error(`All download URLs failed: ${errors.join("; ")}`);
}

// ── Video cache (download once, reuse for reformats) ──
const videoCache = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of videoCache) {
    if (now - entry.cachedAt > 600000) {
      try { fs.unlinkSync(entry.filePath); } catch {}
      videoCache.delete(id);
    }
  }
}, 300000);

app.post("/api/cache-video", async (req, res) => {
  const { videoUrl, videoUrls, filename } = req.body;
  const urls = (Array.isArray(videoUrls) && videoUrls.length > 0
    ? [...new Set(videoUrls.filter(Boolean))]
    : videoUrl
      ? [videoUrl]
      : []);
  if (urls.length === 0) return res.status(400).json({ error: "Missing videoUrl" });

  const cacheId = "cache-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
  const filePath = path.join(os.tmpdir(), `${cacheId}.mp4`);

  try {
    console.log(`[cache] Downloading (${urls.length} URL(s) to try)...`);
    await downloadWithRetry(urls, filePath);
    const sz = fs.statSync(filePath).size;
    console.log(`[cache] Cached ${(sz / 1048576).toFixed(1)}MB as ${cacheId}`);

    let width = 0, height = 0, duration = 0;
    try {
      const probe = await new Promise((ok, no) => execFile(FFPROBE, ["-v", "quiet", "-print_format", "json", "-show_streams", "-show_format", filePath], { timeout: 15000, maxBuffer: 2097152 }, (e, o) => e ? no(e) : ok(JSON.parse(o))));
      const vs = probe.streams?.find((s) => s.codec_type === "video");
      if (vs) { width = vs.width || 0; height = vs.height || 0; }
      duration = Math.round(Number(probe.format?.duration || 0));
    } catch {}

    videoCache.set(cacheId, { filePath, originalUrl: urls[0], cachedAt: Date.now(), filename: filename || "video" });

    res.json({ cacheId, size: sz, width, height, duration });
  } catch (e) {
    try { fs.unlinkSync(filePath); } catch {}
    console.error("[cache] ERROR:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Reformat ──
app.post("/api/reformat", async (req, res) => {
  const { videoUrl, videoUrls, cacheId, width, height, name } = req.body;
  const urlList =
    Array.isArray(videoUrls) && videoUrls.length > 0
      ? [...new Set(videoUrls.filter(Boolean))]
      : videoUrl
        ? [videoUrl]
        : [];
  if ((!urlList.length && !cacheId) || width == null || height == null) return res.status(400).json({ error: "Missing videoUrl/cacheId, width, or height" });

  const w = Number(width), h = Number(height);
  const tmp = os.tmpdir();
  let inp;
  let needsCleanupInp = false;

  if (cacheId && videoCache.has(cacheId)) {
    inp = videoCache.get(cacheId).filePath;
    console.log(`[reformat] Using cached video ${cacheId}`);
  } else if (urlList.length) {
    inp = path.join(tmp, `in-${Date.now()}.mp4`);
    needsCleanupInp = true;
    console.log(`[reformat] ${w}x${h} from ${urlList.length} URL(s) to try...`);
    try {
      await downloadWithRetry(urlList, inp);
      const sz = fs.statSync(inp).size;
      console.log(`[reformat] Downloaded ${(sz / 1048576).toFixed(1)}MB`);
      if (sz < 5000) {
        try { fs.unlinkSync(inp); } catch {}
        if (!res.headersSent) return res.status(500).json({ error: "Download too small — video URL may have expired. Re-fetch the video." });
        return;
      }
    } catch (e) {
      try { fs.unlinkSync(inp); } catch {}
      if (!res.headersSent) return res.status(500).json({ error: e.message });
      return;
    }
  } else {
    return res.status(400).json({ error: "Video not found in cache. Re-fetch the video." });
  }

  const out = path.join(tmp, `out-${Date.now()}.mp4`);
  const cleanup = () => {
    if (needsCleanupInp) try { fs.unlinkSync(inp); } catch {}
    try { fs.unlinkSync(out); } catch {}
  };

  try {
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
  const { videoUrl, videoUrls, cacheId, filename } = req.body;
  const urlList =
    Array.isArray(videoUrls) && videoUrls.length > 0
      ? [...new Set(videoUrls.filter(Boolean))]
      : videoUrl
        ? [videoUrl]
        : [];

  let filePath;
  let needsCleanup = false;

  if (cacheId && videoCache.has(cacheId)) {
    filePath = videoCache.get(cacheId).filePath;
  } else if (urlList.length) {
    filePath = path.join(os.tmpdir(), `proxy-${Date.now()}.mp4`);
    needsCleanup = true;
    try {
      await downloadWithRetry(urlList, filePath);
      const sz = fs.statSync(filePath).size;
      if (sz < 5000) {
        try { fs.unlinkSync(filePath); } catch {}
        throw new Error("Download too small.");
      }
    } catch (e) {
      try { fs.unlinkSync(filePath); } catch {}
      if (!res.headersSent) res.status(500).json({ error: e.message });
      return;
    }
  } else {
    return res.status(400).json({ error: "No video source" });
  }

  try {
    const sz = fs.statSync(filePath).size;
    res.setHeader("Content-Disposition", `attachment; filename="${filename || "video"}.mp4"`);
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Length", sz);
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
    stream.on("close", () => { if (needsCleanup) try { fs.unlinkSync(filePath); } catch {} });
    stream.on("error", () => { if (needsCleanup) try { fs.unlinkSync(filePath); } catch {} });
  } catch (e) {
    if (needsCleanup) try { fs.unlinkSync(filePath); } catch {}
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
});

// ── Batch reformat — all 4 ad ratios in a ZIP ──
app.post("/api/reformat-all", async (req, res) => {
  const { videoUrl, videoUrls, cacheId, authorHandle } = req.body;
  const urlList =
    Array.isArray(videoUrls) && videoUrls.length > 0
      ? [...new Set(videoUrls.filter(Boolean))]
      : videoUrl
        ? [videoUrl]
        : [];
  if (!urlList.length && !cacheId) return res.status(400).json({ error: "Missing video source" });

  const formats = [
    { name: "1x1_Square", width: 1080, height: 1080 },
    { name: "4x5_Feed", width: 1080, height: 1350 },
    { name: "9x16_Story", width: 1080, height: 1920 },
    { name: "16x9_Landscape", width: 1920, height: 1080 },
  ];

  const tmp = os.tmpdir();
  let inp;
  let needsCleanupInp = false;
  const outputFiles = [];

  if (cacheId && videoCache.has(cacheId)) {
    inp = videoCache.get(cacheId).filePath;
  } else if (urlList.length) {
    inp = path.join(tmp, `batch-in-${Date.now()}.mp4`);
    needsCleanupInp = true;
    try {
      await downloadWithRetry(urlList, inp);
      const sz = fs.statSync(inp).size;
      if (sz < 5000) throw new Error("Download too small — video URL may have expired.");
    } catch (e) {
      if (needsCleanupInp) try { fs.unlinkSync(inp); } catch {}
      return res.status(500).json({ error: e.message });
    }
  } else {
    return res.status(400).json({ error: "Video not found in cache. Re-fetch the video." });
  }

  let srcW = 1080;
  let srcH = 1920;
  try {
    const probe = await new Promise((ok, no) =>
      execFile(FFPROBE, ["-v", "quiet", "-print_format", "json", "-show_streams", inp], { timeout: 15000, maxBuffer: 2097152 }, (e, o) => (e ? no(e) : ok(JSON.parse(o)))),
    );
    const vs = probe.streams?.find((s) => s.codec_type === "video");
    if (vs) {
      srcW = vs.width || 1080;
      srcH = vs.height || 1920;
    }
  } catch {}

  const prefix = (authorHandle || "video").replace(/[^a-zA-Z0-9_-]/g, "_");
  const ts = Date.now();

  try {
    console.log(`[batch] Processing ${formats.length} formats from ${inp.split("/").pop()}...`);

    for (let i = 0; i < formats.length; i++) {
      const fmt = formats[i];
      const outPath = path.join(tmp, `${prefix}_${fmt.name}_${ts}_${i}.mp4`);
      const w = fmt.width;
      const h = fmt.height;
      const srcA = srcW / srcH;
      const tgtA = w / h;

      let vf;
      if (Math.abs(srcA - tgtA) < 0.05) {
        vf = ["-vf", `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:black`];
      } else {
        vf = [
          "-filter_complex",
          `[0:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},boxblur=20:20[bg];[0:v]scale=${w}:${h}:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2`,
        ];
      }

      console.log(`[batch] ${fmt.name} (${w}x${h})...`);
      const formatTimeout = 120000;
      await Promise.race([
        new Promise((ok, no) => {
          execFile(
            FFMPEG,
            ["-i", inp, ...vf, "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-y", outPath],
            { timeout: formatTimeout, maxBuffer: 10485760 },
            (e, _, stderr) => (e ? no(new Error(stderr?.substring(0, 200) || e.message)) : ok()),
          );
        }),
        new Promise((_, no) =>
          setTimeout(() => no(new Error(`Timed out processing ${fmt.name} (${formatTimeout / 1000}s)`)), formatTimeout),
        ),
      ]);

      outputFiles.push({ path: outPath, name: `${prefix}_${fmt.name}.mp4` });
      console.log(`[batch] ${fmt.name} done.`);
    }

    const zipName = `${prefix}_all_formats.zip`;
    res.setHeader("Content-Disposition", `attachment; filename="${zipName}"`);
    res.setHeader("Content-Type", "application/zip");

    const archive = archiver("zip", { zlib: { level: 1 } });
    archive.on("error", (e) => {
      console.error("[batch] Archive error:", e);
      if (!res.headersSent) res.status(500).json({ error: "ZIP creation failed" });
    });

    const cleanupBatch = () => {
      for (const f of outputFiles) {
        try {
          fs.unlinkSync(f.path);
        } catch {}
      }
      if (needsCleanupInp) {
        try {
          fs.unlinkSync(inp);
        } catch {}
      }
      console.log("[batch] ZIP finished, temp files cleaned.");
    };

    res.on("finish", cleanupBatch);

    archive.pipe(res);
    for (const f of outputFiles) {
      archive.file(f.path, { name: f.name });
    }

    await archive.finalize();
  } catch (e) {
    for (const f of outputFiles) {
      try {
        fs.unlinkSync(f.path);
      } catch {}
    }
    if (needsCleanupInp) {
      try {
        fs.unlinkSync(inp);
      } catch {}
    }
    console.error("[batch] ERROR:", e.message);
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
});

// ── Google Sheets proxy (formatted values = formula results as shown in Sheets) ──
const GOOGLE_SHEETS_ID = process.env.GOOGLE_SHEETS_ID || "1aM51vSoGUhuhDJu8VyukeIp59XS2G_yv3alJxTJ2Aak";
const GOOGLE_SHEETS_API_KEY = process.env.GOOGLE_SHEETS_API_KEY || "AIzaSyBdTkuWEXGuuoxKPzyTteD7EBOQcg5wkCc";
const sheetsCache = new Map();
const SHEETS_CACHE_TTL = 120000;

function sheetsEncodeRange(tabName) {
  const safe = String(tabName).replace(/'/g, "''");
  return encodeURIComponent(`'${safe}'`);
}

app.get("/api/sheets/:tab", async (req, res) => {
  const tab = decodeURIComponent(req.params.tab);
  const cached = sheetsCache.get(tab);
  if (cached && Date.now() - cached.fetchedAt < SHEETS_CACHE_TTL) {
    return res.json(cached.data);
  }

  try {
    const range = sheetsEncodeRange(tab);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_ID}/values/${range}?key=${GOOGLE_SHEETS_API_KEY}&valueRenderOption=FORMATTED_VALUE`;
    const resp = await fetch(url);
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      console.error("[sheets] API error:", err.error?.message || resp.status);
      return res.status(resp.status).json({ error: err.error?.message || `HTTP ${resp.status}` });
    }

    const data = await resp.json();
    const result = {
      tab,
      rows: data.values || [],
      rowCount: (data.values || []).length,
      fetchedAt: new Date().toISOString(),
    };

    sheetsCache.set(tab, { data: result, fetchedAt: Date.now() });
    console.log(`[sheets] Fetched "${tab}": ${result.rowCount} rows`);
    res.json(result);
  } catch (e) {
    console.error("[sheets] Fetch error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/sheets-tabs", async (req, res) => {
  const cached = sheetsCache.get("__tabs__");
  if (cached && Date.now() - cached.fetchedAt < SHEETS_CACHE_TTL) {
    return res.json(cached.data);
  }

  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_ID}?key=${GOOGLE_SHEETS_API_KEY}&fields=sheets.properties.title`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const tabs = (data.sheets || []).map((s) => s.properties.title);
    const payload = { tabs };
    sheetsCache.set("__tabs__", { data: payload, fetchedAt: Date.now() });
    res.json(payload);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/sheets-refresh", (req, res) => {
  sheetsCache.clear();
  res.json({ status: "ok", message: "Cache cleared" });
});

// Static + SPA
app.use(express.static(path.join(__dirname, "dist")));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "dist", "index.html")));

app.listen(PORT, "0.0.0.0", () => console.log(`Server :${PORT} | FFmpeg: ${FFMPEG}`));
