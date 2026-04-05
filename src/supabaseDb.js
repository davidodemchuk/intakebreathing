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
    assigned_to: c.assignedTo || null,
    assigned_at: c.assignedAt || null,
    assigned_by: c.assignedBy || null,
    programs: c.programs || [],
    creator_tier: c.creator_tier || null,
    intake_size: c.intakeSize || c.intake_size || "",
    other_social: c.otherSocial || c.other_social || "",
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
    assignedTo: row.assigned_to || null,
    assignedAt: row.assigned_at || null,
    assignedBy: row.assigned_by || null,
    programs: row.programs || [],
    creator_tier: row.creator_tier || null,
    intakeSize: row.intake_size || "",
    otherSocial: row.other_social || "",
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

export async function dbGetSetting(key) {
  const { data, error } = await supabase.from("app_settings").select("value").eq("key", key).maybeSingle();
  if (error) {
    console.error("[db] Get setting error:", error);
    return null;
  }
  return data?.value ?? null;
}

export async function fetchIBSettings() {
  const keys = [
    "ai_brand_context", "ai_approved_claims", "ai_banned_claims",
    "ai_tone_hooks", "ai_personas", "ai_length_guide",
    "ai_default_rejections", "ai_platform_notes",
  ];
  const { data } = await supabase.from("app_settings").select("key, value").in("key", keys);
  const settings = {};
  data?.forEach(row => {
    try { settings[row.key] = JSON.parse(row.value); }
    catch { settings[row.key] = row.value; }
  });
  return settings;
}

export async function dbLoadTeamMembers() {
  const { data, error } = await supabase.from("team_members").select("*").order("name");
  if (error) { console.error("[db] Load team members error:", error); return []; }
  return data || [];
}

export async function dbAssignCreator(creatorId, teamMemberId, assignedBy) {
  const { error } = await supabase.from("creators").update({
    assigned_to: teamMemberId,
    assigned_at: new Date().toISOString(),
    assigned_by: assignedBy || "unknown",
  }).eq("id", creatorId);
  if (error) console.error("[db] Assign creator error:", error);
  return { error };
}

export async function dbLoadCreatorAssignments() {
  const { data, error } = await supabase.from("creator_assignments").select("*").order("assigned_at");
  if (error) { console.error("[db] Load assignments error:", error); return []; }
  return data || [];
}

export async function dbAssignCreatorMulti(creatorId, teamMemberId, assignedBy) {
  const { data, error } = await supabase.from("creator_assignments").upsert({
    creator_id: creatorId,
    team_member_id: teamMemberId,
    assigned_by: assignedBy || "manager",
    assigned_at: new Date().toISOString(),
  }, { onConflict: "creator_id,team_member_id" }).select().single();
  if (error) console.error("[db] Assign error:", error);
  return { data, error };
}

export async function dbUnassignCreator(creatorId, teamMemberId) {
  const { error } = await supabase.from("creator_assignments").delete().match({ creator_id: creatorId, team_member_id: teamMemberId });
  if (error) console.error("[db] Unassign error:", error);
  return { error };
}

export async function dbLoadTtsWeekly() {
  const { data, error } = await supabase.from("tts_weekly").select("*").order("week_start", { ascending: false });
  if (error) { console.error("[db] Load TTS weekly error:", error); return []; }
  return data || [];
}

export async function dbSaveTtsWeek(row) {
  const clean = {
    week_start: row.week_start, week_end: row.week_end,
    samples_sent: row.samples_sent || 0, sample_requests: row.sample_requests || 0, samples_posted: row.samples_posted || 0,
    videos_posted: row.videos_posted || 0, videos_approved: row.videos_approved || 0, videos_rejected: row.videos_rejected || 0,
    impressions: row.impressions || 0, organic_impressions: row.organic_impressions || 0, clicks: row.clicks || 0, orders: row.orders || 0,
    tts_gmv: row.tts_gmv || 0, tts_commission: row.tts_commission || 0, ad_spend: row.ad_spend || 0,
    sample_cost: row.sample_cost || 0, creator_payments: row.creator_payments || 0,
    new_creators_added: row.new_creators_added || 0, active_creators: row.active_creators || 0, total_creators: row.total_creators || 0,
    superfiliate_invites: row.superfiliate_invites || 0, notes: row.notes || "",
    organic_gmv: row.organic_gmv || 0, paid_gmv: row.paid_gmv || 0,
    entered_by: row.entered_by || null, gmv_source: row.gmv_source || "manual",
    impressions_source: row.impressions_source || "manual", ad_spend_source: row.ad_spend_source || "manual",
    ai_summary: row.ai_summary || null, ai_analyzed_at: row.ai_analyzed_at || null,
    overrides: row.overrides || {},
  };
  if (row.id) {
    const { error } = await supabase.from("tts_weekly").update(clean).eq("id", row.id);
    if (error) { console.error("[db] Update TTS week error:", error.message); return { error }; }
    return { error: null };
  } else {
    const { data, error } = await supabase.from("tts_weekly").insert(clean).select().single();
    if (error) { console.error("[db] Insert TTS week error:", error.message); return { error }; }
    return { data, error: null };
  }
}

export async function dbDeleteTtsWeek(id) {
  const { error } = await supabase.from("tts_weekly").delete().eq("id", id);
  return { error };
}

export async function dbLoadTtsMonthly() {
  const { data, error } = await supabase.from("tts_monthly").select("*");
  if (error) { console.error("[db] Load TTS monthly error:", error); return []; }
  return data || [];
}

export async function dbLoadTtsTargets() {
  const { data, error } = await supabase.from("tts_monthly_targets").select("*").order("month", { ascending: false });
  if (error) { console.error("[db] Load TTS targets error:", error); return []; }
  return data || [];
}

export async function dbSaveTtsTarget(row) {
  const { data, error } = await supabase.from("tts_monthly_targets").upsert(row, { onConflict: "month" }).select().single();
  if (error) { console.error("[db] Save TTS target error:", error); return { error }; }
  return { data, error: null };
}

export async function dbLoadTtsCreatorWeekly(weekId) {
  const { data, error } = await supabase.from("tts_creator_weekly").select("*").eq("week_id", weekId).order("gmv", { ascending: false });
  if (error) { console.error("[db] Load TTS creator weekly error:", error); return []; }
  return data || [];
}

export async function dbSaveTtsCreatorWeekly(row) {
  const clean = { week_id: row.week_id, creator_id: row.creator_id || null, creator_handle: row.creator_handle || "", videos_posted: row.videos_posted || 0, impressions: row.impressions || 0, gmv: row.gmv || 0, orders: row.orders || 0, commission: row.commission || 0, top_video_url: row.top_video_url || "", notes: row.notes || "" };
  if (row.id) {
    const { error } = await supabase.from("tts_creator_weekly").update(clean).eq("id", row.id);
    return { error };
  } else {
    const { data, error } = await supabase.from("tts_creator_weekly").insert(clean).select().single();
    return { data, error };
  }
}

export async function dbDeleteTtsCreatorWeekly(id) {
  const { error } = await supabase.from("tts_creator_weekly").delete().eq("id", id);
  return { error };
}

export async function dbLoadTtsMilestones() {
  const { data, error } = await supabase.from("tts_milestones").select("*").order("week_start", { ascending: false });
  if (error) { console.error("[db] Load TTS milestones error:", error); return []; }
  return data || [];
}

export async function dbSaveTtsMilestone(row) {
  const { data, error } = await supabase.from("tts_milestones").insert(row).select().single();
  if (error) { console.error("[db] Save milestone error:", error); return { error }; }
  return { data, error: null };
}

export async function dbDeleteTtsMilestone(id) {
  const { error } = await supabase.from("tts_milestones").delete().eq("id", id);
  return { error };
}

// ── Creator Messaging ──
export async function dbGetOrCreateConversation(creatorId) {
  const { data: existing } = await supabase.from("creator_conversations").select("*").eq("creator_id", creatorId).maybeSingle();
  if (existing) return existing;
  const { data, error } = await supabase.from("creator_conversations").insert({ creator_id: creatorId }).select().single();
  if (error) { console.error("[db] Create conversation error:", error); return null; }
  return data;
}

export async function dbLoadMessages(conversationId) {
  const { data, error } = await supabase.from("creator_messages").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: true });
  if (error) { console.error("[db] Load messages error:", error); return []; }
  return data || [];
}

export async function dbSaveMessage(msg) {
  if (msg.id) { const { error } = await supabase.from("creator_messages").update(msg).eq("id", msg.id); return { error }; }
  const { data, error } = await supabase.from("creator_messages").insert(msg).select().single();
  return { data, error };
}

export async function dbDeleteMessage(id) {
  const { error } = await supabase.from("creator_messages").delete().eq("id", id);
  return { error };
}

export async function dbLoadTemplates() {
  const { data, error } = await supabase.from("message_templates").select("*").order("usage_count", { ascending: false });
  if (error) { console.error("[db] Load templates error:", error); return []; }
  return data || [];
}

export async function dbUpdateConversation(id, updates) {
  const { error } = await supabase.from("creator_conversations").update(updates).eq("id", id);
  return { error };
}

// ── Campaigns ──
export async function dbLoadCampaigns() {
  const { data, error } = await supabase.from("campaigns").select("*").order("created_at", { ascending: false });
  if (error) { console.error("[db] Load campaigns error:", error); return []; }
  return data || [];
}
export async function dbSaveCampaign(row) {
  if (row.id) { const { error } = await supabase.from("campaigns").update(row).eq("id", row.id); return { error }; }
  const { data, error } = await supabase.from("campaigns").insert(row).select().single();
  return { data, error };
}
export async function dbDeleteCampaign(id) { return await supabase.from("campaigns").delete().eq("id", id); }
export async function dbLoadCampaignCreators(campaignId) {
  const { data, error } = await supabase.from("campaign_creators").select("*").eq("campaign_id", campaignId).order("invited_at", { ascending: false });
  if (error) { console.error("[db] Load campaign creators error:", error); return []; }
  return data || [];
}
export async function dbSaveCampaignCreator(row) {
  if (row.id) { const { error } = await supabase.from("campaign_creators").update(row).eq("id", row.id); return { error }; }
  const { data, error } = await supabase.from("campaign_creators").insert(row).select().single();
  return { data, error };
}
export async function dbDeleteCampaignCreator(id) { return await supabase.from("campaign_creators").delete().eq("id", id); }

export async function dbUpdateCampaignCreator(id, updates) {
  const { error } = await supabase.from("campaign_creators").update(updates).eq("id", id);
  if (error) console.error("[db] Update campaign creator error:", error);
  return { error };
}

export async function dbUpdateCampaignBudget(campaignId, totalBudget) {
  const { error } = await supabase.from("campaigns").update({ total_budget: totalBudget }).eq("id", campaignId);
  if (error) console.error("[db] Update campaign budget error:", error);
  return { error };
}

export async function dbLoadCampaignOwners(campaignId) {
  const { data, error } = await supabase.from("campaign_owners").select("*, team_members(*)").eq("campaign_id", campaignId);
  if (error) { console.error("[db] Load campaign owners error:", error); return []; }
  return data || [];
}

export async function dbAddCampaignOwner(campaignId, teamMemberId) {
  const { data, error } = await supabase.from("campaign_owners").upsert({ campaign_id: campaignId, team_member_id: teamMemberId, assigned_at: new Date().toISOString() }, { onConflict: "campaign_id,team_member_id" }).select("*, team_members(*)").single();
  if (error) console.error("[db] Add campaign owner error:", error);
  return { data, error };
}

export async function dbRemoveCampaignOwner(campaignId, teamMemberId) {
  const { error } = await supabase.from("campaign_owners").delete().match({ campaign_id: campaignId, team_member_id: teamMemberId });
  if (error) console.error("[db] Remove campaign owner error:", error);
  return { error };
}

export async function dbSetSetting(key, value) {
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) console.error("[db] Set setting error:", error);
}
