import express from "express";
import fs from "fs";
import path from "path";
import os from "os";
import https from "https";
import http from "http";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import archiver from "archiver";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";
import multer from "multer";

const __filename = fileURLToPath(import.meta.url);
const SUPABASE_URL = "https://qaokxufufwbilfultgrk.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhb2t4dWZ1ZndiaWxmdWx0Z3JrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNDUxMzgsImV4cCI6MjA5MDYyMTEzOH0.TdATJK9H51dQvEu1ubWri-QiMgmJTMOF1L45MDRhFbs";
const supabaseServer = createClient(SUPABASE_URL, SUPABASE_KEY);
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

// ── Thumbnail from cached video ──
app.get("/api/cache-thumbnail/:cacheId", async (req, res) => {
  const entry = videoCache.get(req.params.cacheId);
  if (!entry) return res.status(404).json({ error: "Not cached" });
  const thumbPath = entry.filePath + ".thumb.jpg";
  try {
    if (!fs.existsSync(thumbPath)) {
      await new Promise((ok, no) => {
        execFile(FFMPEG, ["-i", entry.filePath, "-ss", "00:00:01", "-vframes", "1", "-vf", "scale=360:-1", "-q:v", "5", "-y", thumbPath],
          { timeout: 10000 }, (e) => e ? no(e) : ok());
      });
    }
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=600");
    fs.createReadStream(thumbPath).pipe(res);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});



// ── Store thumbnails permanently in Supabase Storage ──
app.post("/api/store-thumbnails", async (req, res) => {
  const { creatorHandle, videos } = req.body;
  if (!creatorHandle || !Array.isArray(videos) || !videos.length) {
    return res.status(400).json({ error: "Missing creatorHandle or videos" });
  }

  const handle = String(creatorHandle).replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 30);
  const results = [];
  let stored = 0;
  console.log("[thumbs] Processing " + videos.length + " thumbnails for @" + handle);

  for (let i = 0; i < videos.length; i++) {
    const v = videos[i];
    const coverUrl = v.cover || v.coverUrl || "";
    const playUrl = v.playUrl || v.videoUrl || "";

    if (coverUrl && coverUrl.includes("supabase.co")) { results.push({ index: i, url: coverUrl }); continue; }

    const storagePath = handle + "/" + (v.id || "v" + i) + ".jpg";

    // Strategy 1: For non-TikTok covers (Instagram), try direct download
    if (coverUrl && !coverUrl.includes("tiktok") && !coverUrl.includes("tiktokcdn")) {
      const tmpCover = path.join(os.tmpdir(), "thumb_cover_" + Date.now() + "_" + i + ".jpg");
      try {
        await downloadWithRetry([coverUrl], tmpCover);
        const sz = fs.statSync(tmpCover).size;
        if (sz > 500) {
          const buf = fs.readFileSync(tmpCover); fs.unlinkSync(tmpCover);
          const { error: upErr } = await supabaseServer.storage.from("thumbnails").upload(storagePath, buf, { contentType: "image/jpeg", upsert: true });
          if (!upErr) { const { data } = supabaseServer.storage.from("thumbnails").getPublicUrl(storagePath); results.push({ index: i, url: data.publicUrl }); stored++; console.log("[thumbs] Stored cover for " + v.id); continue; }
          else { console.error("[thumbs] Upload failed for " + v.id + ":", upErr.message); }
        } else { try { fs.unlinkSync(tmpCover); } catch {} }
      } catch (e) { console.log("[thumbs] Cover download failed for " + v.id + ":", e.message); try { fs.unlinkSync(tmpCover); } catch {} }
    }

    // Strategy 2: For TikTok — get real download URL from ScrapeCreators, then extract frame
    if ((coverUrl && (coverUrl.includes("tiktok") || coverUrl.includes("tiktokcdn"))) || (playUrl && playUrl.includes("tiktok"))) {
      const { data: keyData } = await supabaseServer.from("app_settings").select("value").eq("key", "scrapecreators-api-key").maybeSingle();
      const scrapeKey = keyData?.value;
      if (scrapeKey && v.url) {
        const tmpVideo = path.join(os.tmpdir(), "thumb_vid_" + Date.now() + "_" + i + ".mp4");
        const tmpFrame = path.join(os.tmpdir(), "thumb_frame_" + Date.now() + "_" + i + ".jpg");
        try {
          console.log("[thumbs] Getting download URL from ScrapeCreators for " + v.id);
          const scRes = await fetch("https://api.scrapecreators.com/v2/tiktok/video?url=" + encodeURIComponent(v.url), { headers: { "x-api-key": scrapeKey } });
          if (scRes.ok) {
            const scData = await scRes.json();
            const ad = scData.aweme_detail || scData.data?.aweme_detail || scData;
            const vd = ad?.video;
            const videoUrls = [];
            if (scData.video_url) videoUrls.push(scData.video_url);
            if (scData.download_url) videoUrls.push(scData.download_url);
            if (scData.nwm_video_url) videoUrls.push(scData.nwm_video_url);
            if (ad?.download_url) videoUrls.push(ad.download_url);
            if (vd?.play_addr?.url_list) videoUrls.push(...vd.play_addr.url_list);
            const uniqueUrls = [...new Set(videoUrls.filter(Boolean))];
            console.log("[thumbs] Got " + uniqueUrls.length + " download URLs for " + v.id);
            if (uniqueUrls.length > 0) {
              await downloadWithRetry(uniqueUrls, tmpVideo);
              console.log("[thumbs] Video downloaded: " + (fs.statSync(tmpVideo).size / 1048576).toFixed(1) + "MB");
              await new Promise((ok, no) => { execFile(FFMPEG, ["-i", tmpVideo, "-ss", "00:00:01", "-vframes", "1", "-vf", "scale=360:-1", "-q:v", "5", "-y", tmpFrame], { timeout: 15000, maxBuffer: 10485760 }, (e) => e ? no(e) : ok()); });
              const frameBuf = fs.readFileSync(tmpFrame);
              if (frameBuf.length > 500) {
                const { error: upErr } = await supabaseServer.storage.from("thumbnails").upload(storagePath, frameBuf, { contentType: "image/jpeg", upsert: true });
                if (!upErr) { const { data } = supabaseServer.storage.from("thumbnails").getPublicUrl(storagePath); results.push({ index: i, url: data.publicUrl }); stored++; console.log("[thumbs] Stored frame for " + v.id); }
                else { results.push({ index: i, url: null }); }
              } else { results.push({ index: i, url: null }); }
            } else { results.push({ index: i, url: null }); }
          } else { console.error("[thumbs] ScrapeCreators error for " + v.id + ":", scRes.status); results.push({ index: i, url: null }); }
        } catch (e) { console.error("[thumbs] TikTok thumbnail failed for " + v.id + ":", e.message); results.push({ index: i, url: null }); }
        finally { try { fs.unlinkSync(tmpVideo); } catch {} try { fs.unlinkSync(tmpFrame); } catch {} }
        continue;
      }
    }

    // Strategy 2b: Non-TikTok video with playUrl — try direct download
    if (playUrl && !playUrl.includes("tiktok")) {
      const tmpVideo = path.join(os.tmpdir(), "thumb_vid_" + Date.now() + "_" + i + ".mp4");
      const tmpFrame = path.join(os.tmpdir(), "thumb_frame_" + Date.now() + "_" + i + ".jpg");
      try {
        await downloadWithRetry([playUrl], tmpVideo);
        if (fs.statSync(tmpVideo).size > 5000) {
          await new Promise((ok, no) => { execFile(FFMPEG, ["-i", tmpVideo, "-ss", "00:00:01", "-vframes", "1", "-vf", "scale=360:-1", "-q:v", "5", "-y", tmpFrame], { timeout: 15000, maxBuffer: 10485760 }, (e) => e ? no(e) : ok()); });
          const frameBuf = fs.readFileSync(tmpFrame);
          if (frameBuf.length > 500) {
            const { error: upErr } = await supabaseServer.storage.from("thumbnails").upload(storagePath, frameBuf, { contentType: "image/jpeg", upsert: true });
            if (!upErr) { const { data } = supabaseServer.storage.from("thumbnails").getPublicUrl(storagePath); results.push({ index: i, url: data.publicUrl }); stored++; } else { results.push({ index: i, url: null }); }
          } else { results.push({ index: i, url: null }); }
        } else { results.push({ index: i, url: null }); }
      } catch (e) { results.push({ index: i, url: null }); }
      finally { try { fs.unlinkSync(tmpVideo); } catch {} try { fs.unlinkSync(tmpFrame); } catch {} }
      continue;
    }

    // Strategy 3: Last resort — try cover URL with downloadWithRetry
    if (coverUrl) {
      const tmpLast = path.join(os.tmpdir(), "thumb_last_" + Date.now() + "_" + i + ".jpg");
      try {
        await downloadWithRetry([coverUrl], tmpLast);
        const sz = fs.statSync(tmpLast).size;
        if (sz > 500) {
          const buf = fs.readFileSync(tmpLast); fs.unlinkSync(tmpLast);
          const { error: upErr } = await supabaseServer.storage.from("thumbnails").upload(storagePath, buf, { contentType: "image/jpeg", upsert: true });
          if (!upErr) { const { data } = supabaseServer.storage.from("thumbnails").getPublicUrl(storagePath); results.push({ index: i, url: data.publicUrl }); stored++; continue; }
        } else { try { fs.unlinkSync(tmpLast); } catch {} }
      } catch (e) { console.log("[thumbs] Last resort failed for " + v.id + ":", e.message); try { fs.unlinkSync(tmpLast); } catch {} }
    }

    results.push({ index: i, url: null });
  }

  console.log("[thumbs] DONE: Stored " + stored + "/" + videos.length + " for @" + handle);
  res.json({ results, stored });
});

// ── Thumbnail pipeline diagnostic ──
app.get("/api/test-thumbnail-pipeline", async (req, res) => {
  const testVideoUrl = req.query.url || "";
  const results = { steps: [] };
  try {
    const { data, error } = await supabaseServer.storage.from("thumbnails").list("_test", { limit: 1 });
    results.steps.push({ step: "supabase_storage", ok: !error, error: error?.message || null });
  } catch (e) { results.steps.push({ step: "supabase_storage", ok: false, error: e.message }); }
  if (testVideoUrl) {
    const tmpV = path.join(os.tmpdir(), "test_vid_" + Date.now() + ".mp4");
    const tmpF = path.join(os.tmpdir(), "test_frame_" + Date.now() + ".jpg");
    try {
      await downloadWithRetry([testVideoUrl], tmpV);
      results.steps.push({ step: "download", ok: true, size: fs.statSync(tmpV).size });
      await new Promise((ok, no) => { execFile(FFMPEG, ["-i", tmpV, "-ss", "00:00:01", "-vframes", "1", "-vf", "scale=360:-1", "-q:v", "5", "-y", tmpF], { timeout: 15000 }, (e) => e ? no(e) : ok()); });
      const buf = fs.readFileSync(tmpF);
      results.steps.push({ step: "ffmpeg_extract", ok: buf.length > 500, size: buf.length });
      const fp = "_test/test_" + Date.now() + ".jpg";
      const { error: upErr } = await supabaseServer.storage.from("thumbnails").upload(fp, buf, { contentType: "image/jpeg", upsert: true });
      results.steps.push({ step: "upload", ok: !upErr, error: upErr?.message || null });
      if (!upErr) { const { data } = supabaseServer.storage.from("thumbnails").getPublicUrl(fp); results.steps.push({ step: "url", url: data.publicUrl }); await supabaseServer.storage.from("thumbnails").remove([fp]); }
    } catch (e) { results.steps.push({ step: "test_failed", ok: false, error: e.message }); }
    finally { try { fs.unlinkSync(tmpV); } catch {} try { fs.unlinkSync(tmpF); } catch {} }
  } else { results.steps.push({ step: "info", message: "Pass ?url=VIDEO_URL to test frame extraction" }); }
  results.success = results.steps.every(s => s.ok !== false);
  res.json(results);
});

// ── Import TTS data from Google Sheets ──
app.post("/api/import-tts-from-sheets", async (req, res) => {
  try {
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: "1aM51vSoGUhuhDJu8VyukeIp59XS2G_yv3alJxTJ2Aak",
      range: "TTS Weekly!A1:Z200",
    });
    const rows = response.data.values || [];
    if (rows.length < 2) return res.json({ imported: 0, skipped: 0, total: 0, message: "No data found" });

    const headers = rows[0].map(h => String(h).trim());
    console.log("[import-tts] Headers:", headers.join(" | "));

    const parseNum = (val) => {
      if (val == null || val === "") return 0;
      const cleaned = String(val).replace(/[$,%]/g, "").replace(/,/g, "").trim();
      const n = Number(cleaned);
      return isNaN(n) ? 0 : n;
    };

    const parseWeekDates = (val) => {
      if (!val) return null;
      const parts = String(val).split(/\s*[-\u2013]\s*/);
      const first = parts[0].trim();
      const match = first.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
      if (!match) return null;
      let year = Number(match[3]);
      if (year < 100) year += 2000;
      const start = year + "-" + String(match[1]).padStart(2, "0") + "-" + String(match[2]).padStart(2, "0");
      let end;
      if (parts[1]) {
        const m2 = parts[1].trim().match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
        if (m2) {
          let y2 = Number(m2[3]);
          if (y2 < 100) y2 += 2000;
          end = y2 + "-" + String(m2[1]).padStart(2, "0") + "-" + String(m2[2]).padStart(2, "0");
        }
      }
      if (!end) {
        const d = new Date(start);
        d.setDate(d.getDate() + 6);
        end = d.toISOString().split("T")[0];
      }
      return { start, end };
    };

    const results = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row[0]) continue;
      const dates = parseWeekDates(row[0]);
      if (!dates) { console.log("[import-tts] Skipping row", i, "bad date:", row[0]); continue; }

      // Column mapping by index from actual sheet:
      // A=0:Weekly B=1:SF Tr C=2:% D=3:Sample Requests E=4:Samples Shipped F=5:Posted G=6:Sample Cost
      // H=7:S/V Ratio I=8:CPVideo J=9:Impressions K=10:Organic Impressions L=11:Ad Impressions
      // M=12:TTS GMV N=13:Ad Spend O=14:CPV Ad Spend P=15:Net Per Video
      // Skip any dates before 2024 — likely bad data or test rows
      if (dates.start < "2024-01-01") {
        console.log("[import-tts] Skipping pre-2024 row:", dates.start, "from", row[0]);
        continue;
      }
      results.push({
        week_start: dates.start,
        week_end: dates.end,
        superfiliate_invites: parseNum(row[1]),
        sample_requests: parseNum(row[3]),
        samples_posted: parseNum(row[4]),
        videos_posted: parseNum(row[5]),
        sample_cost: parseNum(row[6]),
        impressions: parseNum(row[9]),
        organic_impressions: parseNum(row[10]),
        tts_gmv: parseNum(row[12]),
        ad_spend: parseNum(row[13]),
        notes: "",
        gmv_source: "google_sheets_import",
      });
    }

    let imported = 0, skipped = 0;
    for (const entry of results) {
      const { data: existing } = await supabaseServer.from("tts_weekly").select("id").eq("week_start", entry.week_start).maybeSingle();
      if (existing) { skipped++; continue; }
      const { error } = await supabaseServer.from("tts_weekly").insert(entry);
      if (error) { console.error("[import-tts] Error:", entry.week_start, error.message); }
      else { imported++; }
    }

    console.log("[import-tts] Done:", imported, "imported,", skipped, "skipped,", results.length, "parsed");
    res.json({ imported, skipped, total: results.length, headers });
  } catch (e) {
    console.error("[import-tts] Error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── TTS API update (respects manual overrides) ──
app.post("/api/tts-api-update", async (req, res) => {
  const { week_start, fields } = req.body;
  if (!week_start || !fields) return res.status(400).json({ error: "Missing week_start or fields" });
  const { data: existing } = await supabaseServer.from("tts_weekly").select("*").eq("week_start", week_start).maybeSingle();
  if (!existing) return res.status(404).json({ error: "Week not found" });
  const overrides = existing.overrides || {};
  const updates = {};
  const skipped = [];
  for (const [key, value] of Object.entries(fields)) {
    if (overrides[key]) { skipped.push(key); continue; }
    updates[key] = value;
  }
  if (Object.keys(updates).length > 0) {
    const { error } = await supabaseServer.from("tts_weekly").update(updates).eq("id", existing.id);
    if (error) return res.status(500).json({ error: error.message });
  }
  console.log("[tts-api] Updated", Object.keys(updates).length, "fields for", week_start, "| Skipped:", skipped.join(", ") || "none");
  res.json({ updated: Object.keys(updates), skipped, week_start });
});

// ── Slack notifications (webhook) ──
app.post("/api/slack-notify", async (req, res) => {
  const { type, data } = req.body;
  if (!type || !data) return res.status(400).json({ error: "Missing type or data" });
  const { data: setting } = await supabaseServer.from("app_settings").select("value").eq("key", "slack-webhook-url").maybeSingle();
  const webhookUrl = setting?.value;
  if (!webhookUrl) return res.json({ sent: false, reason: "No Slack webhook URL configured" });

  let text = "";
  if (type === "message_sent") text = ":speech_balloon: *Message sent to @" + (data.creatorHandle || "creator") + "*\n" + (data.channel ? "Via: " + data.channel + "\n" : "") + (data.subject ? "Subject: " + data.subject + "\n" : "") + (data.sentBy ? "Sent by: " + data.sentBy + "\n" : "") + (data.aiGenerated ? ":robot_face: _AI-drafted_\n" : "") + "<https://www.intakecreators.com/creator/" + (data.creatorHandle || "") + "|View conversation>";
  else if (type === "campaign_live") text = ":mega: *Campaign launched: " + (data.campaignName || "Untitled") + "*\nCreators invited: " + (data.creatorCount || 0) + "\nProduct: " + (data.product || "N/A") + "\n<https://www.intakecreators.com/campaigns|View campaign>";
  else if (type === "campaign_invites_generated") text = ":sparkles: *" + (data.count || 0) + " AI invites generated for " + (data.campaignName || "campaign") + "*\nReview drafts in each creator's Messages tab\n<https://www.intakecreators.com/messaging|Open Messaging Hub>";
  else if (type === "creator_replied") text = ":incoming_envelope: *@" + (data.creatorHandle || "creator") + " replied!*\n<https://www.intakecreators.com/creator/" + (data.creatorHandle || "") + "|View conversation>";
  else if (type === "draft_ready") text = ":pencil2: *AI draft ready for @" + (data.creatorHandle || "creator") + "*\n<https://www.intakecreators.com/creator/" + (data.creatorHandle || "") + "|Review and send>";
  else if (type === "new_creator_signup") text = data.text || ":tada: New creator signed up!";
  else if (type === "creator_onboarded") text = data.text || ":white_check_mark: Creator onboarding complete!";
  else if (type === "test") text = data.text || ":white_check_mark: *Intake Creators Bot connected!*\nSlack notifications are working.";
  else text = data.text || ":bell: Notification from Intake Creators";

  try {
    const slackRes = await fetch(webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
    if (slackRes.ok) { console.log("[slack-notify] Posted:", type); res.json({ sent: true }); }
    else { const errText = await slackRes.text(); console.error("[slack-notify] Webhook error:", slackRes.status, errText); res.json({ sent: false, reason: errText }); }
  } catch (e) { console.error("[slack-notify] Error:", e.message); res.status(500).json({ error: e.message }); }
});

// ── Notify creator owners via Slack DM ──
app.post("/api/notify-owners", async (req, res) => {
  const { creatorId, creatorHandle, messageType, subject, sentByName, campaignName } = req.body;
  if (!creatorId) return res.status(400).json({ error: "Missing creatorId" });
  try {
    const { data: assignments } = await supabaseServer.from("creator_assignments").select("team_member_id").eq("creator_id", creatorId);
    if (!assignments?.length) return res.json({ notified: 0, reason: "No owners assigned" });
    const { data: members } = await supabaseServer.from("team_members").select("id, name, slack_id").in("id", assignments.map(a => a.team_member_id));
    if (!members?.length) return res.json({ notified: 0, reason: "No team members found" });
    const { data: tkSetting } = await supabaseServer.from("app_settings").select("value").eq("key", "slack-bot-token").maybeSingle();
    if (!tkSetting?.value) return res.json({ notified: 0, reason: "No Slack bot token" });
    const botToken = tkSetting.value;
    const handle = creatorHandle || "creator";
    const link = "https://www.intakecreators.com/creator/" + handle;
    let notified = 0;
    for (const m of members) {
      if (!m.slack_id) continue;
      let text = "";
      if (messageType === "message_sent") text = ":speech_balloon: *Message sent to @" + handle + "*" + (subject ? "\nSubject: " + subject : "") + (sentByName ? "\nSent by: " + sentByName : "") + "\n<" + link + "|View conversation>";
      else if (messageType === "campaign_invite") text = ":mega: *@" + handle + " invited to: " + (campaignName || "campaign") + "*\n<" + link + "|View profile>";
      else if (messageType === "creator_replied") text = ":incoming_envelope: *@" + handle + " replied!*\n<" + link + "|View conversation>";
      else if (messageType === "draft_ready") text = ":pencil2: *AI draft ready for @" + handle + "*\n<" + link + "|Open profile>";
      else text = ":bell: Update for @" + handle + "\n<" + link + "|View>";
      try {
        const sr = await fetch("https://slack.com/api/chat.postMessage", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + botToken }, body: JSON.stringify({ channel: m.slack_id, text, unfurl_links: false }) });
        const sd = await sr.json();
        if (sd.ok) { notified++; console.log("[notify] DMed " + m.name + " about @" + handle); }
        else console.error("[notify] DM failed for " + m.name + ":", sd.error);
      } catch (e) { console.error("[notify] DM error:", e.message); }
    }
    res.json({ notified, total: members.length });
  } catch (e) { console.error("[notify] Error:", e.message); res.status(500).json({ error: e.message }); }
});

// ── Stream cached video for browser playback ──
app.get("/api/cache-video/:cacheId", (req, res) => {
  const entry = videoCache.get(req.params.cacheId);
  if (!entry || !fs.existsSync(entry.filePath)) return res.status(404).json({ error: "Not cached" });
  const stat = fs.statSync(entry.filePath);
  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    res.writeHead(206, {
      "Content-Range": "bytes " + start + "-" + end + "/" + stat.size,
      "Accept-Ranges": "bytes",
      "Content-Length": end - start + 1,
      "Content-Type": "video/mp4",
    });
    fs.createReadStream(entry.filePath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { "Content-Length": stat.size, "Content-Type": "video/mp4" });
    fs.createReadStream(entry.filePath).pipe(res);
  }
});

// ── Reformat helpers ──
const reformatUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

/**
 * Build FFmpeg args for the background fill + foreground overlay.
 * Returns { extraInputs: [], filterArgs: [...], cleanup: [] }
 * extraInputs = additional -i paths (for image templates)
 * filterArgs  = the -vf or -filter_complex args
 * cleanup     = temp files to delete after encoding
 */
async function buildReformatFilter(template, w, h, srcW, srcH) {
  const srcA = srcW / srcH;
  const tgtA = w / h;
  const sameRatio = Math.abs(srcA - tgtA) < 0.05;

  if (sameRatio) {
    // No pillarbox needed — just scale
    return { extraInputs: [], filterArgs: ["-vf", `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:black`], cleanup: [] };
  }

  const type = template?.type || "blur";

  // Support fully custom filter string
  if (template?.custom_ffmpeg_filter) {
    return { extraInputs: [], filterArgs: ["-filter_complex", template.custom_ffmpeg_filter.replace(/{W}/g, w).replace(/{H}/g, h)], cleanup: [] };
  }

  if (type === "solid") {
    const color = (template?.color_primary || "#000000").replace(/^#/, "");
    const fc = `color=c=0x${color}:size=${w}x${h}:rate=30,setsar=1[bg];[0:v]scale=${w}:${h}:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2`;
    return { extraInputs: [], filterArgs: ["-filter_complex", fc], cleanup: [] };
  }

  if (type === "gradient") {
    const c1 = (template?.color_primary || "#0d0d1a").replace(/^#/, "");
    const c2 = (template?.color_secondary || "#1a1a2e").replace(/^#/, "");
    const fc = `color=c=0x${c1}:size=${w}x${h}:rate=30[top];color=c=0x${c2}:size=${w}x${h}:rate=30[bot];[top][bot]blend=all_expr='A*(1-Y/H)+B*(Y/H)',setsar=1[bg];[0:v]scale=${w}:${h}:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2`;
    return { extraInputs: [], filterArgs: ["-filter_complex", fc], cleanup: [] };
  }

  if (type === "image" && template?.image_url) {
    // Download image to a temp file and use as second input
    const imgPath = path.join(os.tmpdir(), `tmpl-bg-${Date.now()}.png`);
    try {
      await downloadWithRetry([template.image_url], imgPath);
      const fc = `[1:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}:(iw-ow)/2:(ih-oh)/2,setsar=1[bg];[0:v]scale=${w}:${h}:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2`;
      return { extraInputs: [imgPath], filterArgs: ["-filter_complex", fc], cleanup: [imgPath] };
    } catch {
      // Fall through to blur if image download fails
    }
  }

  // Default / blur: downscale → blur → darken → upscale (9x faster, visually identical)
  const sigma = template?.blur_sigma || 50;
  const darken = template?.darken_opacity != null ? (1 - template.darken_opacity).toFixed(2) : "0.55";
  const blurW = Math.round(w / 3);
  const blurH = Math.round(h / 3);
  const blurSigmaScaled = Math.round(sigma / 3); // sigma scales with resolution
  const fc = [
    `[0:v]scale=${blurW}:${blurH}:force_original_aspect_ratio=increase,crop=${blurW}:${blurH}:(iw-ow)/2:(ih-oh)/2,gblur=sigma=${blurSigmaScaled},scale=${w}:${h},colorchannelmixer=rr=${darken}:gg=${darken}:bb=${darken},setsar=1[bg]`,
    `[0:v]scale='min(${w}\\,iw)':'min(${h}\\,ih)':force_original_aspect_ratio=decrease[fg]`,
    `[bg][fg]overlay=(W-w)/2:(H-h)/2`,
  ].join(";");
  return { extraInputs: [], filterArgs: ["-filter_complex", fc], cleanup: [] };
}

// ── Reformat ──
app.post("/api/reformat", async (req, res) => {
  const { videoUrl, videoUrls, cacheId, width, height, name, templateId } = req.body;
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

    // Load template if provided
    let template = null;
    if (templateId) {
      try {
        const { data } = await supabaseServer.from("reformat_templates").select("*").eq("id", templateId).single();
        template = data;
      } catch {}
    }

    // Build filter
    const { extraInputs, filterArgs, cleanup: filterCleanup } = await buildReformatFilter(template, w, h, srcW, srcH);
    const extraInputArgs = extraInputs.flatMap(p => ["-i", p]);

    // Run FFmpeg
    console.log("[reformat] Processing...");
    await new Promise((ok, no) => {
      execFile(FFMPEG, ["-i", inp, ...extraInputArgs, ...filterArgs, "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-threads", "1", "-y", out],
        { timeout: 180000, maxBuffer: 10485760 },
        (e, _, stderr) => e ? no(new Error(stderr?.substring(0, 200) || e.message)) : ok());
    });
    filterCleanup.forEach(f => { try { fs.unlinkSync(f); } catch {} });

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
    console.log("[batch] Processing " + formats.length + " formats sequentially from " + inp.split("/").pop() + "...");

    for (let i = 0; i < formats.length; i++) {
      const fmt = formats[i];
      const outPath = path.join(tmp, prefix + "_" + fmt.name + "_" + ts + "_" + i + ".mp4");
      const w = fmt.width;
      const h = fmt.height;
      const { extraInputs, filterArgs, cleanup: filterCleanup } = await buildReformatFilter(null, w, h, srcW, srcH);
      const extraInputArgs = extraInputs.flatMap(p => ["-i", p]);
      console.log("[batch] " + fmt.name + " (" + w + "x" + h + ")...");
      await new Promise((ok, no) => {
        execFile(FFMPEG, ["-i", inp, ...extraInputArgs, ...filterArgs, "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-threads", "1", "-y", outPath],
          { timeout: 180000, maxBuffer: 10485760 },
          (e, _, stderr) => {
            if (e) return no(new Error(stderr?.substring(0, 200) || e.message));
            console.log("[batch] " + fmt.name + " done.");
            ok();
          });
      });
      filterCleanup.forEach(f => { try { fs.unlinkSync(f); } catch {} });
      outputFiles.push({ path: outPath, name: prefix + "_" + fmt.name + ".mp4" });
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

// ── Reformat Templates ──
app.get("/api/reformat-templates", async (req, res) => {
  try {
    const { data, error } = await supabaseServer.from("reformat_templates").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (e) {
    res.json([]); // graceful — table may not exist yet
  }
});

app.post("/api/reformat-templates", async (req, res) => {
  const { name, description, type, format, color_primary, color_secondary, blur_sigma, darken_opacity, safe_zone_x, safe_zone_y, safe_zone_width, safe_zone_height } = req.body;
  if (!name || !type) return res.status(400).json({ error: "name and type are required" });
  try {
    const { data, error } = await supabaseServer.from("reformat_templates").insert({
      name, description: description || null,
      type: type || "image", format: format || "all",
      color_primary: color_primary || null, color_secondary: color_secondary || null,
      blur_sigma: blur_sigma || null, darken_opacity: darken_opacity || null,
      safe_zone_x: safe_zone_x || null, safe_zone_y: safe_zone_y || null,
      safe_zone_width: safe_zone_width || null, safe_zone_height: safe_zone_height || null,
    }).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/reformat-templates/:id/upload", reformatUpload.single("image"), async (req, res) => {
  const { id } = req.params;
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  try {
    const ext = (req.file.originalname.split(".").pop() || "png").toLowerCase();
    const storagePath = `templates/${id}-${Date.now()}.${ext}`;
    await supabaseServer.storage.createBucket("reformat-templates", { public: true }).catch(() => {});
    const { error: upErr } = await supabaseServer.storage.from("reformat-templates").upload(storagePath, req.file.buffer, { contentType: req.file.mimetype, upsert: true });
    if (upErr) throw upErr;
    const { data: urlData } = supabaseServer.storage.from("reformat-templates").getPublicUrl(storagePath);
    const imageUrl = urlData.publicUrl;
    const { data, error: dbErr } = await supabaseServer.from("reformat_templates").update({ image_url: imageUrl, image_path: storagePath, type: "image", updated_at: new Date().toISOString() }).eq("id", id).select().single();
    if (dbErr) throw dbErr;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/reformat-templates/:id/default", async (req, res) => {
  const { id } = req.params;
  try {
    const { data: tmpl, error: fetchErr } = await supabaseServer.from("reformat_templates").select("format").eq("id", id).single();
    if (!tmpl || fetchErr) return res.status(404).json({ error: "Template not found" });
    // Unset other defaults for this format
    await supabaseServer.from("reformat_templates").update({ is_default: false }).eq("format", tmpl.format).eq("is_default", true);
    // Set this one
    const { error } = await supabaseServer.from("reformat_templates").update({ is_default: true }).eq("id", id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/reformat-templates/:id", async (req, res) => {
  const { id } = req.params;
  try {
    // Try to delete from storage too (non-fatal if missing)
    for (const ext of ["png", "jpg", "jpeg", "webp"]) {
      await supabaseServer.storage.from("reformat-templates").remove([`templates/${id}.${ext}`]).catch(() => {});
    }
    const { error } = await supabaseServer.from("reformat_templates").delete().eq("id", id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Background Reformat Jobs ──

function buildTextOverlayFilters(overlays, targetW, targetH, videoDuration, formatRatio) {
  if (!Array.isArray(overlays) || overlays.length === 0) return "";

  const filters = overlays
    .filter(o => o.content && o.content.trim())
    .filter(o => o.applyTo === "all" || o.applyTo === formatRatio)
    .map(overlay => {
      // Escape single quotes and colons for FFmpeg drawtext
      const text = overlay.content.replace(/\\/g, "\\\\").replace(/'/g, "\u2019").replace(/:/g, "\\:");
      const fontSize = overlay.font_size || 36;
      const fontColor = (overlay.font_color || "white").replace(/#/g, "0x");

      // Position mapping
      let x, y;
      switch (overlay.position_preset) {
        case "top-left":     x = "20";             y = "20";             break;
        case "top-center":   x = "(w-text_w)/2";   y = "20";             break;
        case "top-right":    x = "w-text_w-20";    y = "20";             break;
        case "center":       x = "(w-text_w)/2";   y = "(h-text_h)/2";   break;
        case "bottom-left":  x = "20";             y = "h-text_h-20";    break;
        case "bottom-right": x = "w-text_w-20";    y = "h-text_h-20";    break;
        default:             x = "(w-text_w)/2";   y = "h-text_h-20";    break; // bottom-center
      }

      // Background box — parse rgba string to FFmpeg boxcolor format
      let boxOpts = "";
      if (overlay.background_color) {
        // Convert "rgba(0,0,0,0.6)" → "black@0.6" or use hex
        const rgbaMatch = overlay.background_color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (rgbaMatch) {
          const r = parseInt(rgbaMatch[1]).toString(16).padStart(2, "0");
          const g = parseInt(rgbaMatch[2]).toString(16).padStart(2, "0");
          const b = parseInt(rgbaMatch[3]).toString(16).padStart(2, "0");
          const a = rgbaMatch[4] != null ? parseFloat(rgbaMatch[4]).toFixed(2) : "1.00";
          const pad = overlay.background_padding || 10;
          boxOpts = `:box=1:boxcolor=0x${r}${g}${b}@${a}:boxborderw=${pad}`;
        }
      }

      // Timing
      let enable = "";
      if (overlay.timing === "first_3s") {
        enable = ":enable='lte(t,3)'";
      } else if (overlay.timing === "last_2s") {
        const startTime = Math.max(0, (videoDuration || 0) - 2);
        enable = `:enable='gte(t,${startTime})'`;
      }

      return `drawtext=text='${text}':fontsize=${fontSize}:fontcolor=${fontColor}:x=${x}:y=${y}${boxOpts}${enable}`;
    });

  return filters.join(",");
}

async function processReformatJob(jobId) {
  const { data: job, error: jobErr } = await supabaseServer.from("reformat_jobs").select("*").eq("id", jobId).single();
  if (!job || jobErr) throw new Error("Job not found: " + jobId);

  await supabaseServer.from("reformat_jobs").update({ status: "processing", started_at: new Date().toISOString() }).eq("id", jobId);

  const config = job.template_config || {};
  const cacheId = config.cacheId || null;
  const videoUrls = config.videoUrls || (job.video_url ? [job.video_url] : []);

  // Variable resolver for text overlays
  const variables = config.variables || {};
  const resolveVars = (text) => text
    .replace(/\{creator_handle\}/g, variables.creator_handle || "")
    .replace(/\{campaign_name\}/g, variables.campaign_name || "")
    .replace(/\{product\}/g, variables.product || "Intake Breathing")
    .replace(/\{date\}/g, variables.date || new Date().toLocaleDateString());

  // Locate or download the video
  let inp;
  let needsCleanupInp = false;
  if (cacheId && videoCache.has(cacheId)) {
    inp = videoCache.get(cacheId).filePath;
    console.log(`[job:${jobId}] Using cached video ${cacheId}`);
  } else if (videoUrls.length) {
    inp = path.join(os.tmpdir(), `job-in-${jobId}.mp4`);
    needsCleanupInp = true;
    console.log(`[job:${jobId}] Downloading video from ${videoUrls.length} URL(s)...`);
    await downloadWithRetry(videoUrls, inp);
    const sz = fs.statSync(inp).size;
    if (sz < 5000) throw new Error("Download too small — video URL may have expired.");
    console.log(`[job:${jobId}] Downloaded ${(sz / 1048576).toFixed(1)}MB`);
  } else {
    throw new Error("No video source available. Re-fetch the video.");
  }

  // Probe source dimensions and duration
  let srcW = 1080, srcH = 1920, srcDuration = 16;
  try {
    const probe = await new Promise((ok, no) => execFile(FFPROBE, ["-v", "quiet", "-print_format", "json", "-show_streams", inp], { timeout: 15000, maxBuffer: 2097152 }, (e, o) => e ? no(e) : ok(JSON.parse(o))));
    const vs = probe.streams?.find(s => s.codec_type === "video");
    if (vs) { srcW = vs.width || 1080; srcH = vs.height || 1920; srcDuration = parseFloat(vs.duration) || 16; }
  } catch (e) { console.log(`[job:${jobId}] Probe fallback:`, e.message); }

  const formats = [
    { name: "16x9_Landscape", width: 1920, height: 1080, ratio: "16:9" },
    { name: "1x1_Square", width: 1080, height: 1080, ratio: "1:1" },
    { name: "4x5_Feed", width: 1080, height: 1350, ratio: "4:5" },
    { name: "9x16_Story", width: 1080, height: 1920, ratio: "9:16" },
  ];

  const outputDir = path.join(os.tmpdir(), `reformat-${jobId}`);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const completedFiles = [];

  // Cache of loaded templates to avoid repeat DB calls
  const tmplCache = {};
  const loadTemplate = async (id) => {
    if (!id) return null;
    if (tmplCache[id]) return tmplCache[id];
    const { data } = await supabaseServer.from("reformat_templates").select("*").eq("id", id).single().catch(() => ({ data: null }));
    if (data) tmplCache[id] = data;
    return data || null;
  };

  // Load format-specific defaults from DB
  const formatDefaults = {};
  const { data: defaultRows } = await supabaseServer.from("reformat_templates").select("*").eq("is_default", true).catch(() => ({ data: [] }));
  for (const row of (defaultRows || [])) {
    formatDefaults[row.format] = row;
    tmplCache[row.id] = row;
  }

  for (let i = 0; i < formats.length; i++) {
    const fmt = formats[i];
    await supabaseServer.from("reformat_jobs").update({
      progress: { formats_total: 4, formats_done: i, current_format: fmt.name },
    }).eq("id", jobId);

    const templateId = config[fmt.ratio] || null;
    // Resolve: per-format selection > format-specific default > "all" default > null (uses blur)
    const template = await loadTemplate(templateId)
      || formatDefaults[fmt.ratio]
      || formatDefaults["all"]
      || null;

    const { extraInputs, filterArgs, cleanup: filterCleanup } = await buildReformatFilter(template, fmt.width, fmt.height, srcW, srcH);
    const extraInputArgs = extraInputs.flatMap(p => ["-i", p]);

    // Append text overlay drawtext filters if any
    const rawOverlays = config.textOverlays || [];
    const resolvedOverlays = rawOverlays.map(o => ({ ...o, content: resolveVars(o.content || "") }));
    const textFilters = buildTextOverlayFilters(resolvedOverlays, fmt.width, fmt.height, srcDuration, fmt.ratio);

    let finalFilterArgs = filterArgs;
    if (textFilters) {
      if (filterArgs[0] === "-vf") {
        // Simple scale/pad chain — just append drawtext
        finalFilterArgs = ["-vf", filterArgs[1] + "," + textFilters];
      } else {
        // -filter_complex: label the composite output, then chain drawtext into [vout]
        const fc = filterArgs[1];
        const fcLabeled = fc.replace(/overlay=\(W-w\)\/2:\(H-h\)\/2$/, "overlay=(W-w)/2:(H-h)/2[vtmp]");
        finalFilterArgs = ["-filter_complex", fcLabeled + ";[vtmp]" + textFilters + "[vout]", "-map", "[vout]", "-map", "0:a?"];
      }
    }

    const outFile = path.join(outputDir, `${job.video_filename}_${fmt.name}.mp4`);

    console.log(`[job:${jobId}] ${fmt.name} (${fmt.width}x${fmt.height})${textFilters ? " +text" : ""}...`);
    await new Promise((ok, no) => {
      execFile(FFMPEG, ["-i", inp, ...extraInputArgs, ...finalFilterArgs, "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-threads", "1", "-y", outFile],
        { timeout: 300000, maxBuffer: 10485760 },
        (e, _, stderr) => e ? no(new Error(stderr?.substring(0, 200) || e.message)) : ok());
    });
    filterCleanup.forEach(f => { try { fs.unlinkSync(f); } catch {} });
    console.log(`[job:${jobId}] ${fmt.name} done.`);
    completedFiles.push(outFile);
  }

  // ZIP all formats
  await supabaseServer.from("reformat_jobs").update({
    status: "zipping",
    progress: { formats_total: 4, formats_done: 4, current_format: "zipping" },
  }).eq("id", jobId);

  const zipFilename = `${job.video_filename}_all_formats.zip`;
  const zipPath = path.join(outputDir, zipFilename);
  const folderName = job.video_filename + "_reformats";

  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 1 } });
    output.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(output);
    completedFiles.forEach(fp => archive.file(fp, { name: `${folderName}/${path.basename(fp)}` }));
    archive.finalize();
  });

  const zipStats = fs.statSync(zipPath);
  if (needsCleanupInp) try { fs.unlinkSync(inp); } catch {}

  await supabaseServer.from("reformat_jobs").update({
    status: "complete",
    completed_at: new Date().toISOString(),
    zip_path: zipPath,
    zip_size_bytes: zipStats.size,
    progress: { formats_total: 4, formats_done: 4, current_format: null },
  }).eq("id", jobId);

  console.log(`[job:${jobId}] Complete — ZIP ${(zipStats.size / 1048576).toFixed(1)}MB`);
}

app.post("/api/reformat-job", async (req, res) => {
  const { videoFilename, templateConfig, textOverlays, variables, estimatedSeconds } = req.body;
  const videoUrl = templateConfig?.videoUrls?.[0] || null;
  // Merge textOverlays and variables into template_config so processReformatJob can read them
  const fullConfig = {
    ...(templateConfig || {}),
    textOverlays: Array.isArray(textOverlays) ? textOverlays : [],
    variables: variables || {},
  };
  try {
    const { data: job, error } = await supabaseServer.from("reformat_jobs").insert({
      video_url: videoUrl,
      video_filename: (videoFilename || "video").replace(/[^a-zA-Z0-9_-]/g, "_"),
      status: "queued",
      template_config: fullConfig,
      estimated_seconds: estimatedSeconds || 60,
      progress: { formats_total: 4, formats_done: 0, current_format: null },
    }).select().single();
    if (error) throw error;

    res.json({ jobId: job.id });

    setImmediate(() => processReformatJob(job.id).catch(err => {
      console.error(`[reformat-job] Job ${job.id} failed:`, err.message);
      supabaseServer.from("reformat_jobs").update({ status: "failed", error_message: err.message }).eq("id", job.id).catch(() => {});
    }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/reformat-job/:id", async (req, res) => {
  const { data: job, error } = await supabaseServer.from("reformat_jobs").select("*").eq("id", req.params.id).single();
  if (!job || error) return res.status(404).json({ error: "Job not found" });
  res.json(job);
});

app.get("/api/reformat-job/:id/download", async (req, res) => {
  const { data: job, error } = await supabaseServer.from("reformat_jobs").select("*").eq("id", req.params.id).single();
  if (!job || error || job.status !== "complete") return res.status(404).json({ error: "Job not ready" });
  if (!job.zip_path || !fs.existsSync(job.zip_path)) return res.status(404).json({ error: "ZIP file not found on server. The server may have restarted — re-run the reformat." });
  const filename = path.basename(job.zip_path);
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Length", job.zip_size_bytes);
  fs.createReadStream(job.zip_path).pipe(res);
});

// ── Avatar image proxy (bypasses some CDN hotlink / referrer blocks) ──
app.get("/api/avatar-proxy", async (req, res) => {
  const raw = req.query.url;
  if (!raw || typeof raw !== "string") {
    return res.status(400).end();
  }
  let u;
  try {
    u = new URL(raw);
  } catch {
    return res.status(400).end();
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return res.status(400).end();
  }
  const host = u.hostname.toLowerCase();
  const allowed =
    /tiktokcdn|tiktok|instagram|cdninstagram|fbcdn|facebook|googleusercontent|ggpht|ytimg|youtube|twimg|snapchat|linkedin/i;
  if (!allowed.test(host)) {
    return res.status(403).json({ error: "host not allowed" });
  }
  try {
    const r = await fetch(raw, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; IntakeAvatar/1.0)",
        Accept: "image/*,*/*;q=0.8",
      },
      redirect: "follow",
    });
    if (!r.ok) {
      return res.status(502).end();
    }
    const ct = r.headers.get("content-type") || "image/jpeg";
    if (!ct.startsWith("image/")) {
      return res.status(415).end();
    }
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", ct);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(buf);
  } catch (e) {
    console.error("[avatar-proxy]", e.message);
    res.status(502).end();
  }
});

// ── Google Sheets (Service Account — read + write; API key fallback for read) ──
const GOOGLE_SHEETS_ID = process.env.GOOGLE_SHEETS_ID || "1aM51vSoGUhuhDJu8VyukeIp59XS2G_yv3alJxTJ2Aak";
const sheetsCache = new Map();
const CACHE_TTL = 120000;

let sheetsClient = null;

function sheetsQuoteTitle(name) {
  return `'${String(name).replace(/'/g, "''")}'`;
}

function getSheetsClient() {
  if (sheetsClient) return sheetsClient;

  let creds = null;

  // Try env var first
  const saJson = process.env.GOOGLE_SERVICE_ACCOUNT;
  if (saJson) {
    try {
      creds = JSON.parse(saJson);
    } catch (e) {
      console.error("[sheets] Failed to parse GOOGLE_SERVICE_ACCOUNT env var:", e.message);
    }
  }

  // Fall back to file
  if (!creds) {
    try {
      const filePath = path.join(__dirname, "google-sa.json");
      if (fs.existsSync(filePath)) {
        creds = JSON.parse(fs.readFileSync(filePath, "utf8"));
        console.log("[sheets] Loaded service account from google-sa.json");
      }
    } catch (e) {
      console.error("[sheets] Failed to read google-sa.json:", e.message);
    }
  }

  // Hardcoded fallback
  if (!creds) {
    console.log("[sheets] Using hardcoded service account credentials");
    creds = {
      type: "service_account",
      project_id: "intake-creators",
      private_key_id: "6a98410b9096a7a04d1cd3b29220fa44ae2bf728",
      private_key:
        "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCxnyxyNt3xiA0k\nRvthb6mEMMPjiRMLSvxUWdKASxoVOnbP1C9xoKMLzJ9l26xqxMhcPxADu/PuOc0Z\nekNLFGTjiH/4EFw7L6TTeewJEYf/IskS12gO3/0An91SoktyJFp/LEOYfBx1mLrk\niPlLXwlOzdjdGq1mmE0WyiUqeO6XEHKQM9fZYE+FCe9XyAK2wM9LCJoBR6sOe1jy\n+fB4NNTaBXy/lHWipatRPcEdsjm9NoD+DrwYZz1slhrhPHEQ/HoSwLchQFpq98hM\n9I4Wsbg718SGuOrpVElmOrsTh3FT12/uoGUF8j3exqFb1yCBQdMFEgmN8eFYYeVS\nwY8jHNEdAgMBAAECggEACIMhEWktOj/Dp3cqYWlFRbNDlAIz8jDaBl3Wn3TZ72YB\nnySjUG37GlvoUKyWJvi+xGL2TMODZWmKOXwZQP4ddqUKQvRfwytdmg/n/qhDLPg5\nDCjcEQhtesvugqEJ/hKdbqZLqAFcqMsUu9KPpevMSaVGTRRT9ox6d0rhPJeWkZEx\nAwioi3fEvts6w5V4XhArqpUbrFQUivmkQX8GywHHtZPIc+mgv1nL0XRdgrOUyMbZ\nSInNzi29MUQVY+IvdzSjBVvxgU10y1LNgvDhI2/7A52bbrfCKrYgU8Jdobi22jeW\n7D5BdTc9fi8A7+kNBOXQ6bH22Ce3F8vHl9sPjpoCgQKBgQDeyEHU+GsBt9IVl7mW\n2n7ea2P+F59uOILiHRm2cAk5wKEMJMF9Y+Mlp2kouFU/vayDvjWQwKCEBkMzimE6\noMomB2HQK6wDas6cSBkutygtGVZvXkAcB8yzvk+0IUQFRkwXklyNWz9dCX3YeP8g\n9WxKzJbR0PBJK+ZYmaFhO8CynQKBgQDMGxySsQFZkczMf/NdP0SNBkv3otiFnnfY\nIDWqXoX7X4gZAdhbTQpwsfIvnEXEmdM4afYJSzhhAKjNN+Br0LcreTpGXbshXXsf\nXXyXXVOrfHDSt4Z9nmc+H9fXMfmw5JxuKEnRJfxSR58iRJg5GI2DiG51VEMWVCWw\nVOXI+20QgQKBgEbLaHAfCRIgsff+oRFZGZvgkIP8ScOi3aSxDqy06ZmapxLO01Xf\nWh1rF7XC7gQ1aA7tcOQw8lFCFDTaso8I7XQsQF8AocbsN//dwXLg7Tl3pcn6L3E4\n4Un1Hirlr1HlxuRutE6PQpF0JLOXr6tvkhwq63p9ZP47nxVkrK3TaSbZAoGBAII8\ngnzvySa4K/AJbOaBKmK6M9st4+9O8LXNx7CQY/nEOXmLfdy0Sgci5KCQnMwYQ3jp\n0/6WKsFqxEs+bksdgOOSlSa1RGTD235mDswe1vbDjtJGHOEnJEW11+oOj37aQR7h\nQkjcbiaqYNZi4qb8DcByW9kuDSjARNRBN+aI2E0BAoGAF0SM914+Q5g5ItUJUM2e\nglJ88FUpsrVlKrrYKuPAbv3U6u/Q8OsdVrXQiDWIhN7zqFqOI/QsAJPxLHtF7Zys\nVGC4YnrpA8NzqF82n5yTEjPuPsigSdXsShp/FMtDhY4+D5z6MHa57QQ+jz6nIdt1\nvEVeqlrH9xx2ZWSJmaDswjU=\n-----END PRIVATE KEY-----\n",
      client_email: "channel-pipline@intake-creators.iam.gserviceaccount.com",
      client_id: "102885946467404793152",
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
    };
  }

  if (!creds) {
    console.warn("[sheets] No service account available — writes disabled, reads use API key");
    return null;
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    sheetsClient = google.sheets({ version: "v4", auth });
    console.log("[sheets] Service account authenticated:", creds.client_email);
    return sheetsClient;
  } catch (e) {
    console.error("[sheets] Auth failed:", e.message);
    return null;
  }
}

function readSheetWithApiKey(tab) {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_SHEETS_API_KEY || "AIzaSyBdTkuWEXGuuoxKPzyTteD7EBOQcg5wkCc";
  const range = encodeURIComponent(`${sheetsQuoteTitle(tab)}`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_ID}/values/${range}?key=${apiKey}&valueRenderOption=FORMATTED_VALUE`;
  return fetch(url).then(async (resp) => {
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${resp.status}`);
    }
    return resp.json();
  });
}

/** Google Sheets RGB (0–1 float) → hex; null/whitespace skips default white/black */
function rgbToHex(rgb) {
  if (!rgb) return null;
  const r = Math.round((rgb.red || 0) * 255);
  const g = Math.round((rgb.green || 0) * 255);
  const b = Math.round((rgb.blue || 0) * 255);
  if (r > 245 && g > 245 && b > 245) return null;
  if (r < 10 && g < 10 && b < 10) return null;
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function emptyFormatsForRows(rows) {
  return (rows || []).map((row) =>
    (Array.isArray(row) ? row : []).map(() => ({ bg: null, fg: null, bold: false, align: null })),
  );
}

app.get("/api/sheets/:tab", async (req, res) => {
  const tab = decodeURIComponent(req.params.tab);

  const cached = sheetsCache.get(tab);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return res.json(cached.data);
  }

  try {
    const client = getSheetsClient();
    let rows;

    if (client) {
      const response = await client.spreadsheets.values.get({
        spreadsheetId: GOOGLE_SHEETS_ID,
        range: sheetsQuoteTitle(tab),
        valueRenderOption: "FORMATTED_VALUE",
      });
      rows = response.data.values || [];
    } else {
      const data = await readSheetWithApiKey(tab);
      rows = data.values || [];
    }

    const result = { tab, rows, rowCount: rows.length, fetchedAt: new Date().toISOString() };
    sheetsCache.set(tab, { data: result, fetchedAt: Date.now() });
    console.log(`[sheets] Read "${tab}": ${rows.length} rows`);
    res.json(result);
  } catch (e) {
    console.error("[sheets] Read error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/sheets-formatted/:tab", async (req, res) => {
  const tab = decodeURIComponent(req.params.tab);

  const cacheKey = `fmt_${tab}`;
  const cached = sheetsCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return res.json(cached.data);
  }

  try {
    const client = getSheetsClient();
    if (!client) {
      const data = await readSheetWithApiKey(tab);
      const rows = data.values || [];
      const formats = emptyFormatsForRows(rows);
      const result = {
        tab,
        rows,
        formats,
        rowCount: rows.length,
        fetchedAt: new Date().toISOString(),
      };
      sheetsCache.set(cacheKey, { data: result, fetchedAt: Date.now() });
      console.log(`[sheets] Formatted fallback (values-only) "${tab}": ${rows.length} rows`);
      return res.json(result);
    }

    const response = await client.spreadsheets.get({
      spreadsheetId: GOOGLE_SHEETS_ID,
      ranges: [sheetsQuoteTitle(tab)],
      includeGridData: true,
      fields:
        "sheets.data.rowData.values(formattedValue,effectiveFormat(backgroundColor,textFormat(bold,foregroundColor),horizontalAlignment))",
    });

    const sheetData = response.data.sheets?.[0]?.data?.[0];
    if (!sheetData) {
      return res.status(404).json({ error: "Tab not found" });
    }

    const rows = [];
    const formats = [];

    for (const rowData of sheetData.rowData || []) {
      const rowValues = [];
      const rowFormats = [];

      for (const cell of rowData.values || []) {
        rowValues.push(cell.formattedValue ?? cell.userEnteredValue?.stringValue ?? "");

        const bg = cell.effectiveFormat?.backgroundColor;
        const fg = cell.effectiveFormat?.textFormat?.foregroundColor;
        const bold = cell.effectiveFormat?.textFormat?.bold || false;
        const align = cell.effectiveFormat?.horizontalAlignment || null;

        rowFormats.push({
          bg: bg ? rgbToHex(bg) : null,
          fg: fg ? rgbToHex(fg) : null,
          bold,
          align: align ? String(align).toLowerCase() : null,
        });
      }

      rows.push(rowValues);
      formats.push(rowFormats);
    }

    const result = { tab, rows, formats, rowCount: rows.length, fetchedAt: new Date().toISOString() };
    sheetsCache.set(cacheKey, { data: result, fetchedAt: Date.now() });
    console.log(`[sheets] Formatted read "${tab}": ${rows.length} rows`);
    res.json(result);
  } catch (e) {
    console.error("[sheets] Formatted read error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/sheets/update", async (req, res) => {
  const { tab, cell, value } = req.body || {};
  if (!tab || !cell) return res.status(400).json({ error: "Missing tab or cell" });

  const client = getSheetsClient();
  if (!client) return res.status(500).json({ error: "Service account not configured — write not available" });

  try {
    const range = `${sheetsQuoteTitle(tab)}!${cell}`;
    await client.spreadsheets.values.update({
      spreadsheetId: GOOGLE_SHEETS_ID,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[value ?? ""]] },
    });

    sheetsCache.delete(tab);
    sheetsCache.delete(`fmt_${tab}`);
    console.log(`[sheets] Wrote "${tab}"!${cell}`);
    res.json({ status: "ok", tab, cell, value });
  } catch (e) {
    console.error("[sheets] Write error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/sheets/batch-update", async (req, res) => {
  const { tab, updates } = req.body || {};
  if (!tab || !Array.isArray(updates) || !updates.length) {
    return res.status(400).json({ error: "Missing tab or updates" });
  }

  const client = getSheetsClient();
  if (!client) return res.status(500).json({ error: "Service account not configured" });

  try {
    const data = updates.map((u) => ({
      range: `${sheetsQuoteTitle(tab)}!${u.cell}`,
      values: [[u.value ?? ""]],
    }));

    await client.spreadsheets.values.batchUpdate({
      spreadsheetId: GOOGLE_SHEETS_ID,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data,
      },
    });

    sheetsCache.delete(tab);
    sheetsCache.delete(`fmt_${tab}`);
    console.log(`[sheets] Batch wrote ${updates.length} cells to "${tab}"`);
    res.json({ status: "ok", count: updates.length });
  } catch (e) {
    console.error("[sheets] Batch write error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/sheets-tabs", async (req, res) => {
  const cached = sheetsCache.get("__tabs__");
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return res.json(cached.data);
  }

  try {
    const client = getSheetsClient();
    if (client) {
      const response = await client.spreadsheets.get({
        spreadsheetId: GOOGLE_SHEETS_ID,
        fields: "sheets.properties.title",
      });
      const tabs = (response.data.sheets || []).map((s) => s.properties.title);
      const payload = { tabs };
      sheetsCache.set("__tabs__", { data: payload, fetchedAt: Date.now() });
      res.json(payload);
    } else {
      const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_SHEETS_API_KEY || "AIzaSyBdTkuWEXGuuoxKPzyTteD7EBOQcg5wkCc";
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_ID}?key=${apiKey}&fields=sheets.properties.title`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const tabs = (data.sheets || []).map((s) => s.properties.title);
      const payload = { tabs };
      sheetsCache.set("__tabs__", { data: payload, fetchedAt: Date.now() });
      res.json(payload);
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/sheets-refresh", (req, res) => {
  sheetsCache.clear();
  res.json({ status: "ok", message: "Cache cleared" });
});

// Static + SPA
// ── Email + SMS campaign notifications ──
async function getAppSetting(key) { const { data } = await supabaseServer.from("app_settings").select("value").eq("key", key).maybeSingle(); return data?.value || null; }

app.post("/api/send-campaign-invite", async (req, res) => {
  try {
    const { creatorEmail, creatorPhone, creatorName, creatorHandle, campaignName, campaignId, briefSummary, estimatedRate, notifyEmail, notifySms } = req.body;
    const results = { email: null, sms: null };
    if (notifyEmail && creatorEmail) {
      const resendKey = await getAppSetting("resend-api-key");
      if (resendKey) {
        const html = '<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:40px 24px"><h1 style="font-size:24px;font-weight:500;color:#0a0a0a;margin-bottom:8px">You\'re invited to a campaign</h1><p style="font-size:15px;color:#666;line-height:1.6;margin-bottom:24px">Hey ' + (creatorName || creatorHandle || "there") + ', the Intake Breathing team has invited you to create content for a new campaign.</p><div style="background:#f8f8f6;border:1px solid #e8e8e4;border-radius:12px;padding:20px;margin-bottom:24px"><div style="font-size:11px;font-weight:500;color:#00a86b;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px">CAMPAIGN</div><div style="font-size:18px;font-weight:500;color:#0a0a0a;margin-bottom:4px">' + campaignName + '</div>' + (briefSummary ? '<p style="font-size:13px;color:#666;line-height:1.5;margin:8px 0 0">' + briefSummary + '</p>' : '') + (estimatedRate ? '<div style="font-size:13px;color:#00a86b;font-weight:500;margin-top:8px">Estimated rate: $' + estimatedRate + '/video</div>' : '') + '</div><a href="https://www.intakecreators.com/creator/campaign?id=' + campaignId + '" style="display:inline-block;background:#00FEA9;color:#000;font-size:14px;font-weight:500;text-decoration:none;padding:12px 28px;border-radius:22px">View Campaign →</a><p style="font-size:12px;color:#999;margin-top:32px;line-height:1.5">You\'re receiving this because you\'re part of the Intake Breathing creator network.</p></div>';
        const emailRes = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: "Bearer " + resendKey, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Intake Breathing <campaigns@intakecreators.com>", to: [creatorEmail], subject: "You're invited: " + campaignName + " — Intake Breathing", html }) });
        results.email = emailRes.ok ? "sent" : "failed: " + (await emailRes.json().catch(() => ({}))).message;
      } else results.email = "skipped: no Resend API key";
    }
    if (notifySms && creatorPhone) {
      const sid = await getAppSetting("twilio-account-sid"); const token = await getAppSetting("twilio-auth-token"); const from = await getAppSetting("twilio-phone-number");
      if (sid && token && from) {
        let phone = creatorPhone.replace(/[^0-9+]/g, ""); if (!phone.startsWith("+")) phone = "+1" + phone.replace(/^1/, "");
        const smsRes = await fetch("https://api.twilio.com/2010-04-01/Accounts/" + sid + "/Messages.json", { method: "POST", headers: { Authorization: "Basic " + Buffer.from(sid + ":" + token).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ To: phone, From: from, Body: 'Intake Breathing: You\'ve been invited to "' + campaignName + '"! Check your email or view: https://www.intakecreators.com/creator/campaign?id=' + campaignId }).toString() });
        results.sms = smsRes.ok ? "sent" : "failed: " + (await smsRes.json().catch(() => ({}))).message;
      } else results.sms = "skipped: Twilio not configured";
    }
    res.json({ ok: true, results });
  } catch (err) { console.error("[notify] Campaign invite error:", err); res.status(500).json({ error: err.message }); }
});

app.post("/api/test-email", async (req, res) => {
  try {
    const key = await getAppSetting("resend-api-key"); if (!key) return res.status(400).json({ error: "No Resend API key" });
    const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Intake Breathing <campaigns@intakecreators.com>", to: [req.body.email || "david@intakebreathing.com"], subject: "Intake Creators — Email test", html: "<p>Email sending is working. You're all set.</p>" }) });
    r.ok ? res.json({ ok: true }) : res.status(400).json({ error: (await r.json().catch(() => ({}))).message || r.status });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/test-sms", async (req, res) => {
  try {
    const sid = await getAppSetting("twilio-account-sid"); const token = await getAppSetting("twilio-auth-token"); const from = await getAppSetting("twilio-phone-number");
    if (!sid || !token || !from) return res.status(400).json({ error: "Twilio credentials not set" });
    let phone = (req.body.phone || "").replace(/[^0-9+]/g, ""); if (!phone) return res.status(400).json({ error: "No phone number" }); if (!phone.startsWith("+")) phone = "+1" + phone.replace(/^1/, "");
    const r = await fetch("https://api.twilio.com/2010-04-01/Accounts/" + sid + "/Messages.json", { method: "POST", headers: { Authorization: "Basic " + Buffer.from(sid + ":" + token).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ To: phone, From: from, Body: "Intake Creators — SMS test. You're all set." }).toString() });
    r.ok ? res.json({ ok: true }) : res.status(400).json({ error: (await r.json().catch(() => ({}))).message || r.status });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.use(express.static(path.join(__dirname, "dist")));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "dist", "index.html")));

app.listen(PORT, "0.0.0.0", () => console.log(`Server :${PORT} | FFmpeg: ${FFMPEG}`));
