import { supabase } from "./supabase.js";

// ═══ SUPABASE DATABASE HELPERS ═══

function isUuid(id) {
  return (
    typeof id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
  );
}

export function creatorToRow(c) {
  const row = {
    handle: c.handle || "",
    email: c.email || "",
    name: c.name || "",
    status: c.status || "Active",
    niche: c.niche || "",
    address: c.address || "",
    quality: c.quality || "Standard",
    cost_per_video: c.costPerVideo || "",
    notes: c.notes || "",
    instagram_handle: c.instagramHandle || "",
    tiktok_handle: c.tiktokHandle || "",
    youtube_handle: c.youtubeHandle || "",
    twitter_handle: c.twitterHandle || "",
    instagram_url: c.instagramUrl || "",
    tiktok_url: c.tiktokUrl || "",
    ib_score: c.ibScore != null ? Number(c.ibScore) : null,
    ib_score_label: c.ibScoreLabel || null,
    ib_score_breakdown: c.ibScoreBreakdown || null,
    ai_analysis: c.aiAnalysis || null,
    tiktok_data: c.tiktokData || null,
    instagram_data: c.instagramData || null,
    youtube_data: c.youtubeData || null,
    twitter_data: c.twitterData || null,
    snapchat_data: c.snapchatData || null,
    facebook_data: c.facebookData || null,
    linkedin_data: c.linkedinData || null,
    tiktok_shop_data: c.tiktokShopData || null,
    tiktok_recent_videos: c.tiktokRecentVideos || null,
    tiktok_best_video: c.tiktokBestVideo || null,
    tiktok_eng_rate: c.tiktokEngRate != null ? Number(c.tiktokEngRate) : null,
    tiktok_avg_views: c.tiktokAvgViews != null ? Number(c.tiktokAvgViews) : null,
    instagram_recent_posts: c.instagramRecentPosts || null,
    instagram_recent_reels: c.instagramRecentReels || null,
    instagram_eng_rate: c.instagramEngRate != null ? Number(c.instagramEngRate) : null,
    instagram_avg_likes: c.instagramAvgLikes != null ? Number(c.instagramAvgLikes) : null,
    instagram_avg_comments: c.instagramAvgComments != null ? Number(c.instagramAvgComments) : null,
    engagement_rate: c.engagementRate != null ? Number(c.engagementRate) : null,
    cpm_data: c.cpmData || null,
    total_videos: c.totalVideos ?? 0,
    video_log: c.videoLog || [],
    ai_auto_filled: c.aiAutoFilled || null,
    date_added: c.dateAdded || new Date().toISOString().split("T")[0],
    last_enriched: c.lastEnriched || null,
    invite_token: c.inviteToken || null,
    onboarded: c.onboarded ?? false,
    onboarded_at: c.onboardedAt || null,
  };

  const clean = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === undefined) continue;
    if (typeof v === "number" && !Number.isFinite(v)) {
      clean[k] = null;
      continue;
    }
    if (v && typeof v === "object") {
      try {
        clean[k] = JSON.parse(JSON.stringify(v, (_, x) => (typeof x === "number" && !Number.isFinite(x) ? null : x)));
      } catch {
        clean[k] = null;
      }
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

export function rowToCreator(row) {
  return {
    id: row.id,
    handle: row.handle || "",
    email: row.email || "",
    name: row.name || "",
    status: row.status || "Active",
    niche: row.niche || "",
    address: row.address || "",
    quality: row.quality || "Standard",
    costPerVideo: row.cost_per_video || "",
    notes: row.notes || "",
    instagramHandle: row.instagram_handle || "",
    tiktokHandle: row.tiktok_handle || "",
    youtubeHandle: row.youtube_handle || "",
    twitterHandle: row.twitter_handle || "",
    instagramUrl: row.instagram_url || "",
    tiktokUrl: row.tiktok_url || "",
    ibScore: row.ib_score,
    ibScoreLabel: row.ib_score_label || null,
    ibScoreBreakdown: row.ib_score_breakdown || null,
    aiAnalysis: row.ai_analysis || null,
    tiktokData: row.tiktok_data || null,
    instagramData: row.instagram_data || null,
    youtubeData: row.youtube_data || null,
    twitterData: row.twitter_data || null,
    snapchatData: row.snapchat_data || null,
    facebookData: row.facebook_data || null,
    linkedinData: row.linkedin_data || null,
    tiktokShopData: row.tiktok_shop_data || null,
    tiktokRecentVideos: row.tiktok_recent_videos || [],
    tiktokBestVideo: row.tiktok_best_video || null,
    tiktokEngRate: row.tiktok_eng_rate != null ? Number(row.tiktok_eng_rate) : null,
    tiktokAvgViews: row.tiktok_avg_views != null ? Number(row.tiktok_avg_views) : null,
    instagramRecentPosts: row.instagram_recent_posts || [],
    instagramRecentReels: row.instagram_recent_reels || [],
    instagramEngRate: row.instagram_eng_rate != null ? Number(row.instagram_eng_rate) : null,
    instagramAvgLikes: row.instagram_avg_likes != null ? Number(row.instagram_avg_likes) : null,
    instagramAvgComments: row.instagram_avg_comments != null ? Number(row.instagram_avg_comments) : null,
    engagementRate: row.engagement_rate != null ? Number(row.engagement_rate) : null,
    cpmData: row.cpm_data || null,
    totalVideos: row.total_videos || 0,
    videoLog: row.video_log || [],
    aiAutoFilled: row.ai_auto_filled || {},
    dateAdded: row.date_added || "",
    lastEnriched: row.last_enriched || null,
    inviteToken: row.invite_token || null,
    onboarded: row.onboarded || false,
    onboardedAt: row.onboarded_at || null,
  };
}

export function briefToRow(b) {
  const fd = b.formData || {};
  return {
    share_id: b.shareId || fd.shareId || null,
    name: b.name || "",
    brief_data: b.brief || null,
    form_data: b.formData || null,
    mode: fd.mode || b.mode || "template",
    created_by: fd.manager || b.created_by || "",
  };
}

export function rowToBrief(row) {
  const fd = row.form_data || {};
  return {
    id: row.id,
    shareId: row.share_id || fd.shareId || "",
    name: row.name || "",
    brief: row.brief_data || {},
    formData: row.form_data || {},
    date: row.created_at ? new Date(row.created_at).toLocaleDateString() : "",
  };
}

export async function dbLoadCreators() {
  const { data, error } = await supabase.from("creators").select("*").order("created_at", { ascending: true });
  if (error) {
    console.error("[db] Load creators error:", error);
    return null;
  }
  return (data || []).map(rowToCreator);
}

export async function dbUpsertCreator(creator) {
  const row = creatorToRow(creator);

  const logRow = {};
  for (const [k, v] of Object.entries(row)) {
    if (v && typeof v === "object") {
      logRow[k] = `[${Array.isArray(v) ? "array" : "object"} ${JSON.stringify(v).length}b]`;
    } else {
      logRow[k] = v;
    }
  }
  console.log("[db] Writing creator:", creator.id, logRow);

  if (isUuid(creator.id)) {
    let { error } = await supabase.from("creators").update(row).eq("id", creator.id);
    if (error) {
      console.warn("[db] Update retry after error:", error.message);
      await new Promise((r) => setTimeout(r, 400));
      ({ error } = await supabase.from("creators").update(row).eq("id", creator.id));
    }
    if (error) {
      console.error("[db] Update creator error:", error.message, "| Code:", error.code, "| Details:", error.details);
      return { error };
    }
    return { error: null };
  }

  const { data, error } = await supabase.from("creators").insert(row).select().single();
  if (error) {
    console.error("[db] Insert creator error:", error.message, "| Code:", error.code, "| Details:", error.details);
    return { error };
  }
  const creatorOut = data ? rowToCreator(data) : null;
  return creatorOut ? { error: null, creator: creatorOut } : { error: new Error("Insert returned no row") };
}

export async function dbDeleteCreator(id) {
  const { error } = await supabase.from("creators").delete().eq("id", id);
  if (error) console.error("[db] Delete creator error:", error);
}

export async function dbLoadBriefs() {
  const { data, error } = await supabase.from("briefs").select("*").order("created_at", { ascending: false });
  if (error) {
    console.error("[db] Load briefs error:", error);
    return null;
  }
  return (data || []).map(rowToBrief);
}

export async function dbInsertBrief(briefObj) {
  const row = briefToRow(briefObj);
  const { data, error } = await supabase.from("briefs").insert(row).select().single();
  if (error) console.error("[db] Insert brief error:", error);
  return data ? rowToBrief(data) : null;
}

export async function dbUpdateBriefForm(id, patch) {
  const { error } = await supabase.from("briefs").update(patch).eq("id", id);
  if (error) console.error("[db] Update brief error:", error);
}

export async function dbDeleteBrief(id) {
  const { error } = await supabase.from("briefs").delete().eq("id", id);
  if (error) console.error("[db] Delete brief error:", error);
}

export async function migrateLocalStorageToSupabase() {
  const migrated = localStorage.getItem("intake-supabase-migrated");
  if (migrated === "true") return false;

  console.log("[migration] Checking for localStorage data to migrate...");

  const creatorsJson = localStorage.getItem("intake-creators");
  if (creatorsJson) {
    try {
      const localCreators = JSON.parse(creatorsJson);
      if (Array.isArray(localCreators) && localCreators.length > 0) {
        const { count } = await supabase.from("creators").select("id", { count: "exact", head: true });
        if (count === 0) {
          console.log(`[migration] Migrating ${localCreators.length} creators to Supabase...`);
          const rows = localCreators.map((c) => creatorToRow(c));
          for (let i = 0; i < rows.length; i += 20) {
            const batch = rows.slice(i, i + 20);
            const { error } = await supabase.from("creators").insert(batch);
            if (error) console.error("[migration] Creator batch error:", error);
          }
          console.log("[migration] Creators migrated.");
        } else {
          console.log("[migration] Supabase already has creators, skipping migration.");
        }
      }
    } catch (e) {
      console.error("[migration] Creator parse error:", e);
    }
  }

  const briefsJson = localStorage.getItem("intake-library");
  if (briefsJson) {
    try {
      const localBriefs = JSON.parse(briefsJson);
      if (Array.isArray(localBriefs) && localBriefs.length > 0) {
        const { count } = await supabase.from("briefs").select("id", { count: "exact", head: true });
        if (count === 0) {
          console.log(`[migration] Migrating ${localBriefs.length} briefs to Supabase...`);
          const rows = localBriefs.map((b) => briefToRow(b));
          for (let i = 0; i < rows.length; i += 20) {
            const batch = rows.slice(i, i + 20);
            const { error } = await supabase.from("briefs").insert(batch);
            if (error) console.error("[migration] Brief batch error:", error);
          }
          console.log("[migration] Briefs migrated.");
        }
      }
    } catch (e) {
      console.error("[migration] Brief parse error:", e);
    }
  }

  localStorage.setItem("intake-supabase-migrated", "true");
  console.log("[migration] Migration complete.");
  return true;
}
