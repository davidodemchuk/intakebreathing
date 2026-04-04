import React, { useState, useRef, useEffect, useContext } from "react";
import ThemeContext from "../ThemeContext.js";
import { aspectRatioLabel, durationToSeconds } from "../utils/helpers.js";

function VideoReformatter({ onBack }) {
  const { t, S } = useContext(ThemeContext);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [video, setVideo] = useState(null); // fetched video data
  const [downloading, setDownloading] = useState({}); // {formatId: true}
  const [downloadError, setDownloadError] = useState(null);
  const [batchDownloading, setBatchDownloading] = useState(false);
  const batchAbortRef = useRef(null);
  const [customRatio, setCustomRatio] = useState("");
  const [customWidth, setCustomWidth] = useState("1080");

  // Fetch video from ScrapeCreators
  const fetchVideo = async () => {
    const scrapeKey = localStorage.getItem("intake-scrape-key") || "";
    if (!scrapeKey) { setError("Add your ScrapeCreators API key in Settings first."); return; }
    const trimmed = url.trim();
    if (!trimmed) { setError("Paste a video URL first."); return; }

    let platform;
    if (/tiktok\.com/i.test(trimmed)) platform = "tiktok";
    else if (/instagram\.com/i.test(trimmed)) platform = "instagram";
    else { setError("Paste a TikTok or Instagram URL."); return; }

    setLoading(true);
    setError(null);
    setVideo(null);
    setDownloadError(null);
    try {
      let apiUrl;
      if (platform === "tiktok") {
        apiUrl = `https://api.scrapecreators.com/v2/tiktok/video?url=${encodeURIComponent(trimmed)}`;
      } else {
        apiUrl = `https://api.scrapecreators.com/v1/instagram/post?url=${encodeURIComponent(trimmed)}`;
      }

      const res = await Promise.race([
        fetch(apiUrl, { headers: { "x-api-key": scrapeKey } }),
        new Promise((_, rej) => setTimeout(() => rej(new Error("Request timed out — try again.")), 20000)),
      ]);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || body?.error || `API error ${res.status}`);
      }

      const data = await res.json();
      console.log("[VideoReformatter] Raw API response:", JSON.stringify(data).substring(0, 1000));

      let parsed;
      if (platform === "tiktok") {
        const ad = data.aweme_detail || data.data?.aweme_detail || data;
        const v = ad?.video;
        const brSorted = [...(v?.bit_rate || [])].sort((a, b) => (b.bit_rate || 0) - (a.bit_rate || 0));

        // Priority order: watermark-free first, watermarked last
        const videoUrls = [];

        // 1. ScrapeCreators top-level fields — usually watermark-free
        if (data.video_url) videoUrls.push(data.video_url);
        if (data.download_url) videoUrls.push(data.download_url);
        if (data.nwm_video_url) videoUrls.push(data.nwm_video_url);
        if (data.no_watermark_url) videoUrls.push(data.no_watermark_url);
        if (ad?.download_url) videoUrls.push(ad.download_url);
        if (ad?.nwm_video_url) videoUrls.push(ad.nwm_video_url);
        if (ad?.no_watermark_url) videoUrls.push(ad.no_watermark_url);

        // 2. play_addr — playback URL, typically NO watermark
        if (v?.play_addr?.url_list) videoUrls.push(...v.play_addr.url_list);

        // 3. bit_rate variants — sorted by quality, play_addr versions (no watermark)
        for (const br of brSorted) {
          if (br.play_addr?.url_list) videoUrls.push(...br.play_addr.url_list);
        }

        const uniqueUrls = [...new Set(videoUrls.filter(Boolean))];

        // Filter out any URLs that are known watermarked paths
        const cleanUrls = uniqueUrls.filter(u => {
          const lower = u.toLowerCase();
          // TikTok watermarked URLs often contain these patterns
          if (lower.includes("/download/") && lower.includes("watermark=1")) return false;
          if (lower.includes("download_addr")) return false;
          return true;
        });

        if (cleanUrls.length === 0) {
          throw new Error("Could not find a watermark-free video URL. Try opening the video in TikTok and sharing the direct link, or download it manually from TikTok without watermark using a third-party tool.");
        }

        console.log("[VideoReformatter] Clean URLs (no watermark):", cleanUrls.length, "of", uniqueUrls.length, "total");

        parsed = {
          platform: "TikTok",
          author: ad?.author?.nickname || "Unknown",
          authorHandle: ad?.author?.unique_id || "",
          caption: ad?.desc || "",
          videoUrl: cleanUrls[0] || "",
          videoUrls: cleanUrls,
          coverUrl: v?.cover?.url_list?.[0] || v?.origin_cover?.url_list?.[0] || v?.dynamic_cover?.url_list?.[0] || "",
          width: v?.width || 0,
          height: v?.height || 0,
          duration: durationToSeconds(v?.duration || ad?.music?.duration || 0),
          views: ad?.statistics?.play_count || 0,
          likes: ad?.statistics?.digg_count || 0,
          comments: ad?.statistics?.comment_count || 0,
          shares: ad?.statistics?.share_count || 0,
        };
      } else {
        const item = data.data || data;
        const isVideo = item.is_video || item.media_type === 2 || !!item.video_url;
        parsed = {
          platform: "Instagram",
          author: item.user?.full_name || item.user?.username || "Unknown",
          authorHandle: item.user?.username || "",
          caption: item.caption?.text || "",
          videoUrl: item.video_url || item.video_versions?.[0]?.url || "",
          coverUrl: item.thumbnail_url || item.display_url || item.image_versions2?.candidates?.[0]?.url || "",
          width: item.original_width || 0,
          height: item.original_height || 0,
          duration: durationToSeconds(item.video_duration || 0),
          views: item.view_count || item.video_view_count || item.play_count || 0,
          likes: item.like_count || 0,
          comments: item.comment_count || 0,
          shares: item.share_count || 0,
        };
        if (!isVideo || !parsed.videoUrl) {
          throw new Error("This post doesn't appear to be a video. Paste a Reel or video URL.");
        }
        const igUrls = [parsed.videoUrl, ...(item.video_versions?.map((x) => x?.url).filter(Boolean) || [])].filter(Boolean);
        parsed.videoUrls = [...new Set(igUrls)];
        parsed.videoUrl = parsed.videoUrls[0] || parsed.videoUrl;
      }

      if (!parsed.videoUrl) {
        throw new Error("Could not extract video URL from the API response. The video may be private or unavailable.");
      }

      if (!parsed.videoUrls) parsed.videoUrls = [parsed.videoUrl];

      setVideo(parsed);

      if (parsed.videoUrl) {
        try {
          const cacheRes = await fetch("/api/cache-video", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              videoUrl: parsed.videoUrl,
              videoUrls: parsed.videoUrls || [parsed.videoUrl],
              filename: parsed.authorHandle || "video",
            }),
          });
          if (cacheRes.ok) {
            const cacheData = await cacheRes.json();
            setVideo((prev) =>
              prev
                ? {
                    ...prev,
                    cacheId: cacheData.cacheId,
                    cached: true,
                    cacheFailed: false,
                    cachedWidth: cacheData.width,
                    cachedHeight: cacheData.height,
                    cachedDuration: cacheData.duration,
                    cacheSizeBytes: cacheData.size,
                    coverUrl: "/api/cache-thumbnail/" + cacheData.cacheId,
                  }
                : prev,
            );
            console.log("[VideoReformatter] Video cached:", cacheData.cacheId, `${(cacheData.size / 1048576).toFixed(1)}MB`);
          } else {
            const errData = await cacheRes.json().catch(() => ({}));
            console.error("[VideoReformatter] Cache FAILED:", errData.error);
            setDownloadError(`Video cache failed: ${errData.error || "Server couldn't download the video"}. Try a different video or download manually.`);
            setVideo((prev) => (prev ? { ...prev, cacheFailed: true } : prev));
          }
        } catch (e) {
          console.error("[VideoReformatter] Cache exception:", e.message);
          setDownloadError(`Video cache failed: ${e.message}`);
          setVideo((prev) => (prev ? { ...prev, cacheFailed: true } : prev));
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Download original via server proxy (avoids CORS)
  const downloadOriginal = async () => {
    if (!video || (!video.videoUrl && !video.cacheId)) return;
    setDownloading((prev) => ({ ...prev, original: true }));
    setDownloadError(null);
    try {
      const res = await fetch("/api/proxy-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cacheId: video.cacheId || null,
          videoUrl: video.cacheId ? null : video.videoUrl,
          videoUrls: video.cacheId ? undefined : (video.videoUrls || [video.videoUrl]),
          filename: `${video.authorHandle || "video"}_original`,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error ${res.status}`);
      }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${video.authorHandle || "video"}_original.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setDownloadError(`Download failed: ${e.message}`);
    } finally {
      setDownloading((prev) => ({ ...prev, original: false }));
    }
  };

  const downloadAll = async () => {
    if (!video?.cacheId) {
      setDownloadError("Video not cached yet. Wait for caching to finish.");
      return;
    }
    setBatchDownloading(true);
    setDownloadError(null);
    batchAbortRef.current = new AbortController();
    const controller = batchAbortRef.current;
    const timeout = setTimeout(() => controller.abort(), 480000);
    try {
      const res = await fetch("/api/reformat-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cacheId: video.cacheId,
          videoUrl: null,
          authorHandle: video.authorHandle || "video",
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server returned ${res.status}`);
      }

      const blob = await res.blob();
      if (blob.size < 1000) throw new Error("ZIP file is too small — reformatting may have failed.");

      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${video.authorHandle || "video"}_all_formats.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch (e) {
      if (e.name === "AbortError") {
        setDownloadError("Processing timed out after 8 minutes. The video may be too long. Try downloading formats individually or use a shorter clip.");
      } else {
        setDownloadError(`Batch download failed: ${e.message}`);
      }
    } finally {
      clearTimeout(timeout);
      setBatchDownloading(false);
      batchAbortRef.current = null;
    }
  };

  // Reformat via server FFmpeg
  const reformat = async (format) => {
    if (!video || (!video.videoUrl && !video.cacheId)) return;
    const [w, h] = String(format.dimensions).split(/[×x]/i).map(Number);
    if (!w || !h) return;

    setDownloading((prev) => ({ ...prev, [format.id]: true }));
    setDownloadError(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180000);
    try {
      const res = await fetch("/api/reformat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cacheId: video.cacheId || null,
          videoUrl: video.cacheId ? null : video.videoUrl,
          videoUrls: video.cacheId ? undefined : (video.videoUrls || [video.videoUrl]),
          width: w,
          height: h,
          name: `${video.authorHandle || "video"}_${format.name.replace(/\s+/g, "_")}`,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server returned ${res.status}`);
      }

      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${video.authorHandle || "video"}_${format.name.replace(/\s+/g, "_")}_${w}x${h}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch (e) {
      if (e.name === "AbortError") {
        setDownloadError("Processing timed out. Try downloading the original and reformatting in CapCut or Premiere.");
      } else {
        setDownloadError(`Reformat failed: ${e.message}`);
      }
    } finally {
      clearTimeout(timeout);
      setDownloading((prev) => ({ ...prev, [format.id]: false }));
    }
  };

  const fmt = (n) => {
    if (n == null || n === 0) return "—";
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
    if (n >= 1000) return (n / 1000).toFixed(1) + "K";
    return String(n);
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px 80px", animation: "fadeIn 0.3s ease" }}>
      <button type="button" onClick={onBack} style={{ ...S.btnS, fontSize: 13, padding: "9px 18px", marginBottom: 20 }}>← Back to Tools</button>
      <div style={{ fontSize: 24, fontWeight: 800, color: t.text, marginBottom: 6 }}>Video Reformatter</div>
      <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 24 }}>Paste a URL to fetch a video, download the original, or reformat for different ad platforms.</div>

      {/* URL input */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <input
          type="url"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setError(null); setVideo(null); setDownloadError(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") fetchVideo(); }}
          placeholder="https://www.tiktok.com/@creator/video/... or https://www.instagram.com/reel/..."
          style={{ ...S.input, flex: 1, marginBottom: 0 }}
        />
        <button
          type="button"
          onClick={fetchVideo}
          disabled={loading}
          style={{ ...S.btnP, padding: "11px 20px", fontSize: 14, opacity: loading ? 0.6 : 1, whiteSpace: "nowrap" }}
        >
          {loading ? "Fetching..." : "Fetch Video"}
        </button>
      </div>

      {/* Error */}
      {error ? (
        <div style={{ padding: "12px 14px", background: t.red + "10", border: `1px solid ${t.red}30`, borderRadius: 8, marginBottom: 16, fontSize: 13, color: t.red }}>
          {error}
        </div>
      ) : null}

      {/* Download error */}
      {downloadError ? (
        <div style={{ padding: "12px 14px", background: t.orange + "10", border: `1px solid ${t.orange}30`, borderRadius: 8, marginBottom: 16, fontSize: 13, color: t.orange }}>
          {downloadError}
          <button onClick={() => setDownloadError(null)} style={{ marginLeft: 12, background: "none", border: "none", color: t.textFaint, cursor: "pointer", fontSize: 12 }}>Dismiss</button>
        </div>
      ) : null}

      {/* Video preview */}
      {video ? (
        <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            
            {/* Left: thumbnail (TikTok blocks direct <video> playback in browser) */}
            <div style={{ width: 180, flexShrink: 0 }}>
              <div style={{ width: 180, height: 320, borderRadius: 8, overflow: "hidden", background: t.cardAlt, position: "relative", flexShrink: 0 }}>
                {video.cacheId ? (
                  <video
                    src={"/api/cache-video/" + video.cacheId}
                    poster={video.coverUrl || ""}
                    controls
                    playsInline
                    preload="metadata"
                    style={{ width: 180, height: 320, objectFit: "cover", display: "block", borderRadius: 8 }}
                  />
                ) : video.coverUrl ? (
                  <img key={video.coverUrl} src={video.coverUrl} alt="" referrerPolicy="no-referrer" style={{ width: 180, height: 320, objectFit: "cover", display: "block" }} onError={(e) => { e.target.style.opacity = "0"; }} />
                ) : (
                  <div style={{ width: 180, height: 320, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, color: t.textFaint }}>▶</div>
                )}
              </div>
            </div>

            {/* Right: info */}
            <div style={{ flex: 1, minWidth: 200 }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: video.platform === "TikTok" ? t.green + "15" : "#E1306C15", color: video.platform === "TikTok" ? t.green : "#E1306C" }}>
                {video.platform}
              </span>

              <div style={{ fontSize: 16, fontWeight: 700, color: t.text, marginTop: 8 }}>{video.author}</div>
              <div style={{ fontSize: 13, color: t.textFaint, marginBottom: 8 }}>@{video.authorHandle}</div>

              {video.caption ? (
                <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.5, marginBottom: 12, maxHeight: 60, overflow: "hidden" }}>{video.caption}</div>
              ) : null}

              {/* Stats row */}
              <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 12 }}>
                {[
                  { label: "Views", value: video.views },
                  { label: "Likes", value: video.likes },
                  { label: "Comments", value: video.comments },
                  { label: "Shares", value: video.shares },
                ].map((s) => (
                  <div key={s.label}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: t.text }}>{fmt(s.value)}</div>
                    <div style={{ fontSize: 11, color: t.textFaint }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Dimensions + duration */}
              <div style={{ fontSize: 12, color: t.textFaint, marginBottom: 12 }}>
                {video.width && video.height ? `${video.width} × ${video.height}` : ""}
                {video.width && video.height ? ` (${aspectRatioLabel(video.width, video.height)})` : ""}
                {video.duration ? ` · ${video.duration}s` : ""}
              </div>

              {/* Download Original button */}
              <button
                type="button"
                onClick={downloadOriginal}
                disabled={downloading.original || batchDownloading}
                style={{ ...S.btnP, padding: "10px 20px", fontSize: 13, opacity: downloading.original || batchDownloading ? 0.6 : 1 }}
              >
                {downloading.original ? "Downloading..." : "Download Original"}
              </button>

              {batchDownloading ? (
                <div style={{ padding: 16, background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, marginTop: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 16, height: 16, border: `2px solid ${t.border}`, borderTop: `2px solid ${t.green}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>Processing 4 formats...</span>
                  </div>
                  <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.5 }}>
                    1:1 Square · 4:5 Feed · 9:16 Story · 16:9 Landscape
                  </div>
                  <div style={{ fontSize: 11, color: t.textFaint, marginTop: 8 }}>This takes 1-3 minutes. Don&apos;t close this tab.</div>
                  <button
                    type="button"
                    onClick={() => {
                      batchAbortRef.current?.abort();
                      setBatchDownloading(false);
                    }}
                    style={{ marginTop: 10, padding: "6px 14px", borderRadius: 6, border: `1px solid ${t.border}`, background: "transparent", color: t.textFaint, fontSize: 11, cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => void downloadAll()}
                  disabled={!video.cacheId}
                  style={{
                    padding: "12px 24px",
                    borderRadius: 8,
                    border: "none",
                    background: video.cacheId ? t.green : t.cardAlt,
                    color: video.cacheId ? (t.isLight ? "#fff" : "#000") : t.textFaint,
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: video.cacheId ? "pointer" : "not-allowed",
                    marginTop: 8,
                    width: "100%",
                  }}
                >
                  {video.cacheId ? "⬇ Download All Formats (ZIP)" : video.cacheFailed ? "ZIP unavailable — cache failed" : "Caching video..."}
                </button>
              )}

              <div style={{ fontSize: 12, marginTop: 10, lineHeight: 1.55 }}>
                {video.cacheId ? (
                  <div style={{ color: t.green }}>
                    ✓ Cached on server
                    {video.cacheSizeBytes != null ? ` (${(video.cacheSizeBytes / 1048576).toFixed(1)} MB)` : ""}
                    {" — "}ready for reformat & ZIP
                  </div>
                ) : video.cacheFailed ? (
                  <div style={{ color: t.orange }}>
                    Cache failed — try individual formats below or Download Original (server will retry URLs).
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: t.textMuted }}>
                    <div style={{ width: 12, height: 12, border: `2px solid ${t.border}`, borderTop: `2px solid ${t.green}`, borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />
                    <span>Caching video on server…</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {(video?.cached || video?.cacheId) ? (
        <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 20, marginTop: 16, marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 4 }}>Custom Ratio</div>
          <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 14 }}>Enter any aspect ratio to download a custom reformat.</div>

          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 120px", minWidth: 100 }}>
              <div style={{ fontSize: 11, color: t.textFaint, marginBottom: 4 }}>Ratio (width:height)</div>
              <input
                value={customRatio}
                onChange={(e) => setCustomRatio(e.target.value)}
                placeholder="e.g. 1:2, 3:4, 21:9"
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 14, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ flex: "0 0 100px" }}>
              <div style={{ fontSize: 11, color: t.textFaint, marginBottom: 4 }}>Base width (px)</div>
              <input
                value={customWidth}
                onChange={(e) => setCustomWidth(e.target.value.replace(/\D/g, ""))}
                placeholder="1080"
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 14, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                const parts = customRatio.trim().split(/[:/×x]/i).map(Number);
                const rW = parts[0];
                const rH = parts[1];
                if (!rW || !rH || rW <= 0 || rH <= 0) {
                  setDownloadError("Enter a valid ratio like 1:2, 3:4, or 21:9");
                  return;
                }
                const baseW = Number(customWidth) || 1080;
                const w = Math.round(baseW);
                const h = Math.round(baseW * (rH / rW));
                const finalW = w % 2 === 0 ? w : w + 1;
                const finalH = h % 2 === 0 ? h : h + 1;
                reformat({
                  id: `custom-${rW}x${rH}`,
                  name: `Custom_${rW}x${rH}`,
                  dimensions: `${finalW}×${finalH}`,
                  ratio: `${rW}:${rH}`,
                });
              }}
              disabled={!customRatio.trim() || Object.values(downloading).some(Boolean) || batchDownloading}
              style={{
                padding: "10px 20px", borderRadius: 8, border: "none",
                background: customRatio.trim() ? t.green : t.cardAlt,
                color: customRatio.trim() ? (t.isLight ? "#fff" : "#000") : t.textFaint,
                fontSize: 13, fontWeight: 700,
                cursor: customRatio.trim() ? "pointer" : "not-allowed",
                whiteSpace: "nowrap",
              }}
            >
              {(() => {
                const parts = customRatio.trim().split(/[:/×x]/i).map(Number);
                const rW = parts[0];
                const rH = parts[1];
                const id = rW && rH ? `custom-${rW}x${rH}` : "";
                return id && downloading[id] ? "Processing..." : "Download";
              })()}
            </button>
          </div>

          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
            {["1:1", "4:5", "9:16", "16:9", "1:2", "2:3", "3:4", "21:9"].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setCustomRatio(r)}
                style={{
                  padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                  border: `1px solid ${customRatio === r ? t.green + "50" : t.border}`,
                  background: customRatio === r ? t.green + "10" : "transparent",
                  color: customRatio === r ? t.green : t.textFaint,
                  cursor: "pointer",
                }}
              >
                {r}
              </button>
            ))}
          </div>

          {(() => {
            const parts = customRatio.trim().split(/[:/×x]/i).map(Number);
            const rW = parts[0];
            const rH = parts[1];
            if (!rW || !rH || rW <= 0 || rH <= 0) return null;
            const baseW = Number(customWidth) || 1080;
            const w = Math.round(baseW);
            const h = Math.round(baseW * (rH / rW));
            const finalW = w % 2 === 0 ? w : w + 1;
            const finalH = h % 2 === 0 ? h : h + 1;
            return (
              <div style={{ fontSize: 12, color: t.textMuted, marginTop: 8 }}>
                Output: {finalW} × {finalH}px
              </div>
            );
          })()}
        </div>
      ) : null}

      {/* Format cards — always show as reference, clickable when video is fetched */}
      <div style={{ marginTop: video ? 0 : 32 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: t.text, marginBottom: 4 }}>
          {video ? "Individual Formats" : "Format Reference"}
        </div>
        <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 16 }}>
          {video ? "Or download formats individually:" : "Fetch a video above to enable downloads. Use these specs as a reference for manual reformatting."}
        </div>

        {VIDEO_REFORMAT_GROUPS.map((group) => (
          <div key={group.title} style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.textFaint, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 10 }}>{group.title}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
              {group.items.map((item) => {
                const isLoading = !!downloading[item.id];
                const canClick = !!video && !!(video.cacheId || video.videoUrl) && !isLoading && !batchDownloading;
                return (
                  <div
                    key={item.id}
                    onClick={() => canClick && reformat(item)}
                    style={{
                      background: t.card,
                      border: `1px solid ${isLoading ? t.green + "50" : t.border}`,
                      borderRadius: 10,
                      padding: "12px 14px",
                      cursor: canClick ? "pointer" : "default",
                      opacity: video ? (isLoading ? 0.7 : 1) : 0.5,
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => { if (canClick) { e.currentTarget.style.borderColor = t.green + "50"; e.currentTarget.style.background = t.green + "06"; } }}
                    onMouseLeave={(e) => { if (canClick) { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.background = t.card; } }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{item.name}</span>
                      {isLoading ? (
                        <div style={{ width: 14, height: 14, border: `2px solid ${t.border}`, borderTop: `2px solid ${t.green}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                      ) : canClick ? (
                        <span style={{ fontSize: 10, color: t.green }}>↓</span>
                      ) : null}
                    </div>
                    <div style={{ fontSize: 11, color: t.textMuted }}>{item.ratio} · {item.dimensions}</div>
                    <div style={{ fontSize: 10, color: t.textFaint, marginTop: 2 }}>{item.placement}</div>
                    {item.recommended ? <div style={{ fontSize: 9, fontWeight: 700, color: t.green, marginTop: 4 }}>★ RECOMMENDED</div> : null}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const VIDEO_LOG_PLATFORMS = ["TikTok", "Instagram", "YouTube Shorts", "Facebook", "Other"];
const VIDEO_LOG_STATUSES = [
  { value: "live", label: "Live" },
  { value: "in_review", label: "In Review" },
  { value: "draft", label: "Draft" },
];

/** Single highlight for detail view: best TikTok clip vs top IG post by engagement. */

export default VideoReformatter;
