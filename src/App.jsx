import React, { useState, useRef, useCallback, useEffect, useMemo, memo, createContext, useContext, Fragment } from "react";
import SEED_CREATORS from "./seedCreators.json";
// If API key sync fails, ensure `app_settings` exists — run the SQL block in supabase/schema.sql in the Supabase SQL Editor.
import {
  migrateLocalStorageToSupabase,
  dbLoadCreators,
  dbLoadBriefs,
  dbUpsertCreator,
  dbInsertBrief,
  dbDeleteBrief,
  dbUpdateBriefForm,
  rowToCreator,
  creatorToRow,
  dbGetSetting,
  dbSetSetting,
  dbLoadTeamMembers,
  dbAssignCreator,
  dbLoadCreatorAssignments,
  dbAssignCreatorMulti,
  dbUnassignCreator,
  dbLoadTtsWeekly,
  dbSaveTtsWeek,
  dbDeleteTtsWeek,
  dbLoadTtsMonthly,
  dbLoadTtsTargets,
  dbSaveTtsTarget,
  dbLoadTtsMilestones,
  dbSaveTtsMilestone,
  dbDeleteTtsMilestone,
  dbLoadTtsCreatorWeekly,
  dbSaveTtsCreatorWeekly,
  dbDeleteTtsCreatorWeekly,
  dbGetOrCreateConversation,
  dbLoadMessages,
  dbSaveMessage,
  dbDeleteMessage,
  dbLoadTemplates,
  dbUpdateConversation,
  dbLoadCampaigns,
  dbSaveCampaign,
  dbDeleteCampaign,
  dbLoadCampaignCreators,
  dbSaveCampaignCreator,
  dbDeleteCampaignCreator,
} from "./supabaseDb.js";
import { parseCSVLine, formatMetricShort, medianOf, fmtDollar, genShareId, formatCount, durationToSeconds, gcd, aspectRatioLabel } from "./utils/helpers.js";
import { ManagerCreatorChat, CreatorLogin, CreatorOnboard, CreatorDashboard, CreatorBriefView, CreatorMessages, CreatorProfileEdit, PublicBriefView } from "./components/CreatorPortal.jsx";
import SettingsPanel, { HomepageSettingsBlock } from "./components/Settings.jsx";
import { UGCDashboard, ManagerLogin } from "./components/UGCDashboard.jsx";
import TtsNativeTab from "./components/TtsNative.jsx";
import ChannelPipeline from "./components/ChannelPipeline.jsx";
import CampaignsPage from "./components/Campaigns.jsx";
import MessagingHub from "./components/MessagingHub.jsx";
import { ChangeRequestsPage, ChangeRequestWidget } from "./components/ChangeRequests.jsx";
import { notifySlack, notifyOwners } from "./utils/notifications.js";
import VideoReformatter from "./components/VideoReformatter.jsx";
import { Icon, CardIcon } from "./components/Icons.jsx";
import { PRODUCTS, productOptionName, VIBES, APPROVED_CLAIMS, BANNED_CLAIMS, buildRejectionsArray, PLATFORMS, MANAGERS, buildBriefExtractionPrompt, splitSentences, pick, getDefaultAiKnowledge, mergeAiKnowledge, normalizePlatforms, formatPlatformsDisplay, managerDisplayName, formatToneDisplay, generateBrief, mergeExtractedBriefToPrefill, getBriefFormBaseDefaults, UploadOldBrief, IBAiSourceOfTruth, EditableField, EditableRejectionLine, RejectionAddRow, RejectionSection, BriefDisplay, buildBriefPrintHtml } from "./components/BriefGenerator.jsx";
import { supabase } from "./supabase.js";

// FUTURE: Arrow keys to navigate between cells, Tab to move right, Enter to edit

const CREATOR_COLUMNS = [
  { key: "status", label: "Status", width: 100, filterable: true, sortable: true },
  { key: "owner", label: "Owner", width: 100, sortable: true, filterable: true },
  { key: "avatar", label: "", width: 36, sortable: false },
  { key: "handle", label: "Handle", width: 160, sortable: true },
  { key: "niche", label: "Niche", width: 170, filterable: true, sortable: true, editable: true },
  { key: "tt", label: "TT", width: 36, isLink: "external" },
  { key: "ig", label: "IG", width: 36, isLink: "external" },
  { key: "ibScore", label: "IB", width: 44, sortable: true, align: "right" },
  { key: "videos", label: "Videos", width: 60, sortable: true, align: "right" },
  { key: "avgViews", label: "Avg Views", width: 80, sortable: true, align: "right" },
  { key: "engRate", label: "Eng %", width: 52, sortable: true, align: "right" },
  { key: "quality", label: "Quality", width: 70, filterable: true, sortable: true },
  { key: "cost", label: "Cost", width: 90, editable: true },
  { key: "notes", label: "Notes", width: null, editable: true },
];

function buildCreatorGridTemplate(colWidths) {
  return CREATOR_COLUMNS.map((c) => (c.width == null ? "1fr" : `${colWidths[c.key] ?? c.width}px`)).join(" ");
}

// ═══ UPDATE THIS WITH EVERY PUSH ═══
// Add new version at the TOP of this array
// Bump APP_VERSION to match
// Format: { version: "X.Y.Z", date: "YYYY-MM-DD", changes: ["what changed"] }
// notifySlack, notifyOwners moved to utils/notifications.js

const APP_VERSION = "6.62.0";
const CHANGELOG = [
  { version: "6.46.0", date: "2026-04-04", changes: [
    "TTS: auto-fill indicators on API-destined fields, manual override locks prevent API overwrites",
    "TTS: resizable columns with drag handles, widths persist to localStorage",
    "TTS: 8 months of sparkline data, click any data point to scroll to that week",
    "TTS: quarter visual separation with left border stripe and bold Q labels",
  ]},
  { version: "6.40.0", date: "2026-04-04", changes: [
    "TTS: creator-level attribution per week — track which creators drove GMV",
    "TTS: AI weekly analysis — Claude reads the week's data and writes executive summary with recommendations",
    "TTS: organic vs paid GMV split, data completeness warnings, priority form layout",
    "TTS: content notes template prompting for top video, content types, standout creators",
  ]},
  { version: "6.35.0", date: "2026-04-04", changes: [
    "TTS: month and quarter subtotals with color-coded rows (green quarters, amber months)",
    "TTS: monthly rollups view redesigned as table matching weekly layout",
    "TTS: team milestones — mark when team members join or leave the TTS program",
    "TTS: inline cell editing — click any cell to edit like Google Sheets, auto-save on Enter/blur",
  ]},
  { version: "6.30.0", date: "2026-04-04", changes: [
    "TTS: monthly targets with progress bars, set GMV/video/order/ROAS goals per month",
    "TTS: week-over-week change arrows (green up, red down) on key metrics",
    "TTS: rolling 30-day dashboard stats instead of calendar month",
    "TTS: sparkline trend charts for GMV, impressions, and videos with hover tooltips",
    "TTS: CSV export for sharing data outside the platform",
  ]},
  { version: "6.25.0", date: "2026-04-04", changes: [
    "TTS Native Pipeline launched — first channel fully off Google Sheets",
    "Native data entry form with live calculations (ROAS, CPM, S/V ratio auto-compute)",
    "Historical data imported from Google Sheets (28 weeks of TTS data)",
    "TTS: entered by tracking with team member avatars, remembers last selection",
    "TTS: sticky header, separate SF/Requests/Shipped columns, bigger text, better contrast",
  ]},
  { version: "6.22.0", date: "2026-04-04", changes: [
    "Multi-owner creator assignments — multiple team members per creator with stacked avatars",
    "Owner chips show avatar, title, click to open Slack DM with creator URL auto-copied",
    "Share on Slack button copies creator profile link and opens native Slack app",
    "Creator ownership stored in Supabase junction table (creator_assignments)",
  ]},
  { version: "6.20.0", date: "2026-04-04", changes: [
    "Full team synced from Slack — 21 team members with avatars, titles, emails, Slack IDs",
    "Custom owner dropdown with avatars and titles (replaces plain select)",
    "Slack deep links open native app directly (slack://user?team=TFC94FVGF&id=...)",
    "Slack icon in creators table owner column for quick DM access",
  ]},
  { version: "6.18.0", date: "2026-04-04", changes: [
    "Dark mode contrast fix — lighter card surfaces (#141414), visible borders (#2a2a2a)",
    "Creator ownership system — assign team members to creators, filter by owner",
    "Team members stored in Supabase with Slack profile data",
  ]},
  { version: "6.15.0", date: "2026-04-03", changes: [
    "Critical bug fixes — thumbnails stored inside enrichment pipeline while CDN URLs are fresh",
    "Snapchat/Facebook/LinkedIn validate responses to eliminate false positives",
    "Page leave warning during enrichment prevents data loss",
    "Error boundary on creator detail view shows crash info instead of white screen",
    "Rate calculator: platform rates use capped base rate, realistic estimates",
  ]},
  { version: "6.12.0", date: "2026-04-03", changes: [
    "Flow chart and Canva embeds load on click with blurred preview",
    "Rate calculator uses median views instead of mean — eliminates viral outlier skew",
    "Dollar amounts show commas, quick stats show Typical views (median)",
  ]},
  { version: "6.11.0", date: "2026-04-03", changes: [
    "Flow chart and Canva embeds load on click with blurred preview — no more slow homepage loads",
  ]},
  { version: "6.10.0", date: "2026-04-03", changes: [
    "Rate calculator uses median views instead of mean — eliminates viral outlier skew",
    "Dollar amounts show commas for readability ($124,180 not $124180)",
    "Quick stats show 'Typical views' (median) instead of misleading average",
  ]},
  { version: "6.9.0", date: "2026-04-03", changes: [
    "Enrichment UI redesigned — grid layout with progress bar, do-not-leave warning",
    "Snapchat, Facebook, LinkedIn false positives filtered — validates real data before marking green",
    "Thumbnail storage moved earlier in pipeline — captures CDN URLs before they expire",
  ]},
  { version: "6.8.0", date: "2026-04-03", changes: [
    "Settings V2 — services dashboard with links, password-protected API keys, 2-column layout",
    "ScrapeCreators key always visible (not locked behind password)",
    "Powered by IB-Ai overview replaces old How It Works section",
  ]},
  { version: "6.7.0", date: "2026-04-03", changes: [
    "Rate calculator V3 — per-platform breakdown (TikTok, IG Reel, Story, Feed, YT Short, YT Dedicated)",
    "Each rate shows AI reasoning when clicked — references creator's actual metrics",
    "Fixed $500-500 display bug",
    "Database test fixed — compares timestamps by value not string format",
  ]},
  { version: "6.6.0", date: "2026-04-03", changes: [
    "Change Requests page — filter by open/completed/all, mark done, delete",
    "Homepage stat card shows open request count instead of avg IB score",
    "Change requests stored in Supabase — survive all deploys",
  ]},
  { version: "6.5.0", date: "2026-04-03", changes: [
    "Creator Flow Chart (Lucidchart) with fullscreen mode",
    "2025 In Review (Canva) presentation embedded on homepage",
    "Section titles enlarged for readability",
  ]},
  { version: "6.4.0", date: "2026-04-03", changes: [
    "Permanent thumbnail storage via Supabase Storage — TikTok covers no longer expire",
    "TikTok videos increased from 15 to 30, display up to 15",
  ]},
  { version: "6.3.0", date: "2026-04-03", changes: [
    "Source of Truth and Settings are homepage cards with own pages (not collapsible blocks)",
    "Source of Truth page at /source-of-truth with startOpen prop",
  ]},
  { version: "6.2.0", date: "2026-04-03", changes: [
    "All sub-page cards match homepage V2 style — full accent borders, CardIcons, shadows",
    "Instagram Reels row removed — merged into Instagram Posts (deduped)",
    "Top Performer moved into Recent Content section",
    "Format labels use colon notation (1:1, 4:5, 9:16, 16:9)",
  ]},
  { version: "6.1.0", date: "2026-04-03", changes: [
    "Video reformatter — watermark-free downloads prioritized, blurred zoom background on reformats",
    "Playable video preview with server streaming + thumbnail poster",
    "Batch reformat 5x faster — ultrafast preset, chunked processing",
    "TikTok download never uses watermarked source — errors instead",
  ]},
  { version: "6.0.0", date: "2026-04-03", changes: [
    "UI V2 — warm beige theme, full accent card borders, custom SVG icons, polished shadows across entire app",
  ]},
  { version: "5.39.0", date: "2026-04-02", changes: [
    "Source of Truth edit matches display — product lines and all sections use stored data only (no hidden hardcoded text)",
  ]},
  { version: "5.38.0", date: "2026-04-02", changes: [
    "IB-Ai Source of Truth expanded — now covers IB Score, rate calculator, outreach, competitor detection, and creator analysis",
  ]},
  { version: "5.37.0", date: "2026-04-02", changes: [
    "Channel Pipeline now matches Google Sheet formatting — cell colors, bold, backgrounds all preserved",
  ]},
  { version: "5.36.0", date: "2026-04-02", changes: [
    "Channel Pipeline tables — sticky header row while scrolling",
  ]},
  { version: "5.35.0", date: "2026-04-02", changes: [
    "Settings accessible from homepage as a collapsible block",
  ]},
  { version: "5.34.0", date: "2026-04-02", changes: [
    "Change Request widget — button reads \"Request Changes\"; scope toggle defaults to this page with clear labels",
  ]},
  { version: "5.33.0", date: "2026-04-02", changes: [
    "YouTube data displays correctly — better response parsing",
    "Content thumbnails — graceful fallback when CDN URLs expire",
    "Creator profile layout — header, AI summary, stats all in proper card sections",
  ]},
  { version: "5.32.0", date: "2026-04-02", changes: [
    "IB-Ai Source of Truth moved to homepage — visible to all managers",
  ]},
  { version: "5.31.0", date: "2026-04-02", changes: [
    "IB-Ai Source of Truth is now editable — managers can update claims, products, tones, and brand context live",
    "AI knowledge stored in Supabase — no code changes needed to update what IB-Ai knows",
  ]},
  { version: "5.30.0", date: "2026-04-02", changes: [
    "IB-Ai Source of Truth — collapsible knowledge base showing everything the AI uses to generate briefs and scores",
  ]},
  { version: "5.29.0", date: "2026-04-02", changes: [
    "Upload Old Brief — drop any PDF, image, or text file and AI rewrites it into Intake's brief format",
  ]},
  { version: "5.28.0", date: "2026-04-02", changes: [
    "Change request system — floating button on every page for managers and creators to request updates",
    "Request includes: who's requesting, page, description, priority",
    "Admin view to manage all requests — mark complete, delete",
  ]},
  { version: "5.27.0", date: "2026-04-01", changes: [
    "Fix creator profile white screen — always recalculate CPM v2, null-safe rate UI, error boundary",
  ]},
  { version: "5.26.0", date: "2026-04-01", changes: [
    "Instagram is now the primary platform — source of truth for handles",
    "Smart YouTube discovery — tries handle, bio links, and name variations",
    "Smart Twitter discovery — tries handle and bio links",
    "Extracts YouTube/Twitter URLs from TikTok and Instagram bios automatically",
  ]},
  { version: "5.25.0", date: "2026-04-01", changes: [
    "Recent Content — one horizontal row per platform (TikTok, IG Reels, IG Posts) with avatars and scrollable linked thumbnails",
  ]},
  { version: "5.24.0", date: "2026-04-01", changes: [
    "Rate calculator rebuilt — industry-aligned, $25 CPM cap, Intake content bonus, competitor detection",
    "Transparent formula breakdown visible on every creator profile",
  ]},
  { version: "5.23.0", date: "2026-04-01", changes: [
    "Status column wider — no more truncated text",
    "Draggable column resizing — grab any column border to resize",
  ]},
  { version: "5.22.0", date: "2026-04-01", changes: [
    "Avatar fix — tries YouTube and Facebook avatars as fallback, proxy for CDN-blocked URLs",
    "Notes auto-fill from AI enrichment — partnership notes generated on first enrich",
    "AI prompt upgraded — now generates partnershipNotes, outreachDM, competitorMentions, brandSafety",
    "Content gallery — shows recent TikTok videos and Instagram posts with thumbnails",
    "Quick stats bar — total reach, avg views, engagement rate, est rate, posting frequency",
    "Bio display — shows TT bio, IG bio, bio links, account age",
    "Bulk enrich progress bar improved — shows live count with cancel option",
  ]},
  { version: "5.21.0", date: "2026-04-01", changes: [
    "Creator profile 2.0 — quick stats, TikTok/IG galleries, bio & links, view trend",
    "IB-Ai: partnership notes (auto-fills Notes when empty), outreach DM/email, competitor & brand safety",
    "Platform cards: Verified / Business / Commerce badges; header shows creator since & last enriched",
  ]},
  { version: "5.20.0", date: "2026-04-01", changes: [
    "Channel Pipeline now reads AND writes to Google Sheets",
    "Service account authentication replaces API key",
    "Inline cell editing — click a cell, type, press Enter to save to Google Sheet",
    "Refresh button clears cache and fetches live data",
  ]},
  { version: "5.19.0", date: "2026-04-01", changes: [
    "Notes textarea on creator detail is smaller (2 rows instead of large box)",
    "Notes column in table is more compact",
  ]},
  { version: "5.18.0", date: "2026-04-01", changes: [
    "Channel Pipeline reads LIVE from Google Sheets — all formulas, all data, always current",
    "Server-side Google Sheets proxy with caching",
    "Each tab displays the exact sheet data with proper formatting",
  ]},
  { version: "5.17.0", date: "2026-04-01", changes: [
    "Overview tab — full Creator Monthly with all 24 columns, channel breakdown, ad metrics",
    "Spend tab — Partnership Spend with all 22 columns, grouped by section, editable, clickable creators",
  ]},
  { version: "5.16.0", date: "2026-04-01", changes: [
    "Instagram Weekly tab — full spreadsheet replica with all columns, editable, monthly totals",
  ]},
  { version: "5.15.0", date: "2026-04-01", changes: [
    "TTS Weekly tab rebuilt — exact match of Google Sheet with all 20+ columns",
    "Monthly and quarterly auto-totals",
    "Editable cells — double-click to edit, Enter to save",
    "Add Week form for new data entry",
    "Calculated fields auto-compute (S/V Ratio, CPVideo, Net Per Video, PR %)",
  ]},
  { version: "5.14.0", date: "2026-04-01", changes: [
    "Channel Pipeline dashboard is live — Overview and Partnership Spend tabs",
    "Monthly overview with budget vs actual, ROAS, CPA across all channels",
    "Partnership Spend — editable creator payment tracker with status, deliverables, payments",
    "Sub-tab navigation: Overview, Spend, TTS, Instagram, UGC, YouTube, SOPs, KPIs",
  ]},
  { version: "5.13.0", date: "2026-04-01", changes: [
    "Removed Proof Points and Required Disclosure sections from briefs",
  ]},
  { version: "5.12.0", date: "2026-04-01", changes: [
    "Fixed enrichment data not persisting — visible error banner when saves fail",
    "Creator table shows avatars instead of letters",
    "Creators page improved with better layout",
    "Added database connection test in Settings",
  ]},
  { version: "5.11.0", date: "2026-04-01", changes: [
    "Homepage reverted to card-based layout matching UGC Army dashboard style",
  ]},
  { version: "5.10.0", date: "2026-04-01", changes: [
    "Custom ratio input on Video Reformatter — enter any aspect ratio and download",
  ]},
  { version: "5.9.0", date: "2026-04-01", changes: [
    "Video reformatter: fixed infinite loading — downloads now have hard timeouts",
    "Prefer download_addr over play_addr for TikTok (more reliable)",
    "Try multiple video URLs if first one fails",
    "Clear error messages instead of infinite spinners",
    "Cache status shown to user — know exactly what's happening",
  ]},
  { version: "5.8.0", date: "2026-04-01", changes: [
    "One-click 'Download All Formats' button — ZIP with 1:1, 4:5, 9:16, 16:9",
  ]},
  { version: "5.7.0", date: "2026-04-01", changes: [
    "Manager authentication — password-protected dashboard",
    "Login persists across sessions via Supabase app_settings",
    "Creator portal remains email + OTP login",
  ]},
  { version: "5.6.0", date: "2026-04-01", changes: [
    "API keys now stored in Supabase — persist across browsers and devices",
    "Theme preference stays in localStorage (per-device)",
  ]},
  { version: "5.5.0", date: "2026-04-01", changes: [
    "Fixed enrichment data not persisting — added write verification, error surfacing, and retry",
  ]},
  { version: "5.4.0", date: "2026-04-01", changes: [
    "Removed Email and Plat columns from creator table — less clutter, data still in detail view",
    "Shipping address visible and editable on manager detail and creator portal",
  ]},
  { version: "5.3.0", date: "2026-04-01", changes: [
    "Fixed video preview — shows thumbnail image instead of broken video player",
    "Fixed reformat timeout — server caches video immediately on fetch, reformat uses cached copy",
    "Download Original and all reformat operations use server-cached video",
  ]},
  { version: "5.2.0", date: "2026-04-01", changes: [
    "Homepage redesigned to match intakebreathing.com brand — dark, minimal, editorial",
    "Removed metrics bar from homepage",
    "Cards are full-width sections instead of a 2x2 grid",
  ]},
  { version: "5.1.0", date: "2026-04-01", changes: [
    "Creators page has a proper title and description header",
    "Removed email column from creator table overview — visible in detail view only",
  ]},
  { version: "5.0.0", date: "2026-04-01", changes: [
    "Creator Portal at /creator — email + OTP login via Supabase",
    "Creator onboarding form — name, handles, address, rate, niches",
    "Creator dashboard — view assigned briefs and messages",
    "Brief assignment — managers assign briefs to creators from the brief display",
    "Creator-manager messaging — simple chat thread per creator",
    "Shareable brief links at /brief?id=SHARE_ID",
  ]},
  { version: "4.0.0", date: "2026-04-01", changes: [
    "Supabase database integration — creators and briefs now stored in a real database",
    "Data persists across devices and browsers",
    "Foundation for creator portal (creators can access their own data)",
    "One-time migration moves existing localStorage data to Supabase",
  ]},
  { version: "3.10.0", date: "2026-04-01", changes: [
    "Per-platform editable handles — Instagram, TikTok, YouTube, Twitter each get their own handle",
    "PlatformCard component — clickable to open profile, editable handle with save/cancel",
    "UGC Army dashboard — hub page at /ugc-army with Creators, New Brief, Library, Campaigns cards",
    "Homepage UGC Army card now goes to the UGC dashboard instead of straight to Library",
  ]},
  { version: "3.9.0", date: "2026-04-01", changes: [
    "UGC Army now has its own dashboard with navigation to Creators, New Brief, Library",
  ]},
  { version: "3.8.0", date: "2026-04-01", changes: [
    "Separate handles per platform — Instagram, TikTok, YouTube, Twitter can each have different handles",
    "Platform cards are clickable and link to the correct profile",
    "Each platform handle is editable from the creator detail view",
    "Search button per platform — searches ScrapeCreators to find the right profile",
    "Enrichment uses platform-specific handles instead of assuming they match",
  ]},
  { version: "3.7.0", date: "2026-04-01", changes: [
    "Video Reformatter completely rebuilt from scratch",
    "Download Original now works — downloads the source video directly in browser",
    "Server-side reformat uses bundled FFmpeg via npm (no system install needed)",
    "Video preview shows inline player instead of broken thumbnails",
    "Proper error messages with retry options",
    "Format cards show download progress",
  ]},
  { version: "3.6.3", date: "2026-04-01", changes: [
    "Fixed avatar not loading — tries multiple sources with better fallback",
    "Removed 'View Data' button — unnecessary",
    "Renamed 'Refresh' to 'Refresh Metrics'",
    "Platform cards are clickable — opens creator's profile on that platform",
  ]},
  { version: "3.6.2", date: "2026-04-01", changes: [
    "Estimated rate now uses CPM calculation from actual video performance, not AI guessing",
    "Shows CPM, average views, and calculated rate per video with full breakdown",
  ]},
  { version: "3.6.1", date: "2026-04-01", changes: [
    "Creator detail auto-detects primary platform — links to Instagram or TikTok based on where they're biggest",
    "Platform cards are now clickable — opens the creator's profile on that platform",
    "Platform URLs are editable inline on the detail view",
    "Avatar pulls from the platform with the most followers",
    "Contact section redesigned — clean editable fields with open buttons",
    "Fixed engagement rate still showing 100% and 0.01%",
  ]},
  { version: "3.6.0", date: "2026-04-01", changes: [
    "IB Score section completely redesigned — cleaner layout, expandable AI reasoning",
    "Why Intake text is now prominent, not grey",
    "Estimated rate is clickable to show AI reasoning",
    "Best Platform now shows runner-up with explanations",
    "Campaign suggestions restyled as a labeled list, not random bubbles",
    "All AI-generated insights have expandable 'How IB-Ai determined this' sections",
  ]},
  { version: "3.5.1", date: "2026-04-01", changes: [
    "Fixed enrichment data extraction — handles all ScrapeCreators response structures",
    "Added raw API response logging to console for debugging",
    "Fixed engagement rate showing 29400% and 140% — caps at 100%, guards against null followers",
    "Fixed Instagram, YouTube, Twitter data not populating",
  ]},
  { version: "3.5.0", date: "2026-04-01", changes: [
    "Fixed favicon — now uses real Intake hex logo (black bg, white logo)",
    "FFmpeg bundled via npm — video reformatter downloads now work on Railway",
    "PDF compact layout — briefs fit in 2 pages instead of 5, removed Required Disclosure section",
  ]},
  { version: "3.4.0", date: "2026-04-01", changes: [
    "Avatar column added to creator table — shows profile pic from TikTok or Instagram",
    "IB-Ai generated badge — any data calculated by AI is clearly marked",
    "Removed Recent Videos section from creator detail — data still pulled for IB-Ai scoring but not displayed as a section",
    "Best performing video shown as a single compact highlight instead of a full video list",
  ]},
  { version: "3.3.0", date: "2026-04-01", changes: [
    "11-platform creator enrichment: Instagram (profile+posts+reels), TikTok (profile+videos+shop), YouTube, Twitter/X, LinkedIn, Snapchat, Facebook",
    "IB Score system — Intake-branded 1-100 creator score with 5-category breakdown",
    "Instagram-heavy scoring: IG metrics worth 45% of IB Score",
    "Creator detail view completely redesigned with platform cards, playable videos, IB Score hero",
    "TikTok Shop detection — see if creators are selling products",
    "Cross-platform presence mapped for every creator",
  ]},
  { version: "3.2.0", date: "2026-04-01", changes: [
    "Homepage stripped back and rebuilt — clean, minimal, polished design",
    "Removed decorative clutter: no background avatars, no gradient borders, no dot grid",
    "Cards simplified to clean flat design with clear hierarchy",
  ]},
  { version: "3.1.0", date: "2026-04-01", changes: [
    "Smart API caching — enrichment data persists in localStorage, never re-pulled unless explicitly requested",
    "Enrich button shows last enriched date and won't auto-re-pull if data exists",
    "Bulk enrich skips creators already enriched (configurable: 24h, 7d, 30d, or never re-pull)",
  ]},
  { version: "3.0.0", date: "2026-04-01", changes: [
    "Fixed engagement rate — now calculated from recent video performance, not lifetime hearts",
    "Fixed Instagram enrichment — better error handling, separate IG handle field",
    "Now pulling ALL available data from ScrapeCreators: recent videos, top posts, bio links",
    "Creator detail shows recent video performance cards with views, likes, comments",
  ]},
  { version: "2.9.0", date: "2026-03-31", changes: [
    "Creator table completely redesigned — Google Sheets-style with filters in column headers",
    "Inline editing — double-click any cell to edit directly in the table",
    "Column header filters: click the filter icon in any header to filter by that column",
    "Search bar is the only thing above the table — compact single row with action buttons",
  ]},
  { version: "2.8.0", date: "2026-03-31", changes: [
    "Auto-enrichment pipeline — adding a creator by handle triggers automatic data pull",
    "ScrapeCreators auto-pulls TikTok profile, stats, and recent videos on creator add",
    "IB-Ai auto-analyzes each new creator: suggested niche, content style, estimated rate, fit score",
    "Creator add flow redesigned: paste handle → loading screen → fully enriched profile appears",
    "Architecture foundations for future outreach and follow-up systems",
  ]},
  { version: "2.7.0", date: "2026-03-31", changes: [
    "Creator enrichment via ScrapeCreators — pull live TikTok and Instagram metrics",
    "Enrich button on creator detail pulls: followers, hearts, video count, bio, avatar, verified status",
    "Bulk enrich option to update all creators at once",
    "All CSV fields now properly stored: addresses, names, notes, quality, video counts",
    "Creator detail view shows shipping address (collapsible)",
    "Profile avatar pulled from TikTok displayed on creator cards and detail",
  ]},
  { version: "2.6.0", date: "2026-03-31", changes: [
    "Removed Name column from creator table — available in detail view only",
    "Niche is now a live filterable dropdown in the table header",
    "Auto-generated Instagram URLs for all creators from their handles",
    "TikTok and Instagram links both clickable from the table",
  ]},
  { version: "2.5.0", date: "2026-03-31", changes: [
    "Intermediate creator table iteration before 2.6 layout",
  ]},
  { version: "2.3.0", date: "2026-03-31", changes: [
    "Creator list redesigned as dense spreadsheet-style table — no wasted space",
    "Column headers with click-to-sort on every column",
    "Filter dropdowns per column: status, niche, quality, platform",
    "Compact rows with all key info visible — handle, name, niche, email, videos, quality, cost, contact links",
    "Clicking a row opens the creator detail dashboard",
  ]},
  { version: "2.2.0", date: "2025-04-01", changes: [
    "Creator Database 2.0 — completely redesigned list view with rich info at a glance",
    "Clickable TikTok and Instagram links directly on each creator card",
    "Video tracking per creator — log videos with URLs, campaign, date, and performance",
    "Creator cards show niche tags, video count, quality tier, cost, and contact links inline",
    "Fetch live TikTok/Instagram profile data via ScrapeCreators API",
    "Creator search improved — searches across handle, name, niche, and notes",
    "Sort options: by name, video count, status, most recent activity",
  ]},
  { version: "2.0.6", date: "2025-04-01", changes: [
    "Added budget per video field to Brief Details — defaults to $100",
    "Added supervision level dropdown — Full Review, Light Touch, or Hands Off",
    "Budget and supervision level included in generated brief deliverables and PDF",
  ]},
  { version: "2.0.5", date: "2025-04-01", changes: [
    "Homepage redesigned — premium dashboard with animated cards, stats bar, gradient accents",
    "Time-based greeting with manager name",
    "Live stats bar showing key metrics at a glance",
    "Cards redesigned with gradient borders, glow effects, and micro-animations",
  ]},
  { version: "2.0.4", date: "2025-04-01", changes: [
    "Complete PDF overhaul — eliminated dead white space, tighter professional layout",
    "Two-column layout for persona, say/don't, and proof points sections",
    "Condensed story arc beats into a more compact format",
    "Better use of page real estate — fits more content per page",
  ]},
  { version: "2.0.3", date: "2025-04-01", changes: [
    "Video reformatter now downloads reformatted videos — click any format to download",
    "Server-side FFmpeg processing via Express backend on Railway",
    "Format cards are now clickable download buttons when a video is loaded",
  ]},
  { version: "2.1.0", date: "2025-04-01", changes: [
    "Creator Database added to UGC Army — full roster management",
    "53 existing creators imported from Intake's spreadsheet",
    "Creator profiles: handle, name, niche, contact info, video count, quality tier, notes",
    "Direct contact links: email mailto, TikTok profile, Instagram profile",
    "Filter by status (Active, One-time, Off-boarded), search by name/handle",
    "Add new creators, edit existing, CSV import support",
    "Creator detail view with full profile and editable fields",
    "Stored in localStorage as intake-creators",
  ]},
  { version: "2.0.5", date: "2025-04-01", changes: [
    "Removed 'Dashboard' subtitle from homepage",
    "Replaced all emojis with custom SVG icons throughout the app for a more professional feel",
    "Improved homepage card design",
  ]},
  { version: "2.0.2", date: "2025-04-01", changes: [
    "ScrapeCreators API fully wired — paste TikTok or Instagram URL to fetch video data",
    "Video preview with thumbnail, caption, author, and engagement stats",
    "Download Original button for fetched videos",
    "ScrapeCreators API key field added to Settings if not already present",
  ]},
  { version: "2.0.1", date: "2025-04-01", changes: [
    "Code audit cleanup — removed dead code, fixed bugs, eliminated redundancies",
  ]},
  { version: "2.0.0", date: "2025-04-01", changes: [
    "Homepage reworked into multi-section dashboard with card navigation",
    "New sections: UGC Army, Channel Pipeline, Influencer Buys, Tools",
    "Video Reformatter tool — paste TikTok/Instagram URL to fetch and preview video",
    "ScrapeCreators API integrated for video fetching",
    "All Meta and YouTube ad aspect ratios built in as reformat presets",
    "Channel Pipeline and Influencer Buys are placeholder cards for future",
  ]},
  { version: "1.3.6", date: "2025-04-01", changes: [
    "Platform selection changed to compact multi-select dropdown — reduces dead space in Brief Details",
    "Dropdown shows selected platforms as comma-separated text, click to toggle options",
  ]},
  { version: "1.3.5", date: "2025-04-01", changes: [
    "Softened rejection criteria language — now framed as revision requirements, not instant rejections",
  ]},
  { version: "1.3.4", date: "2025-04-01", changes: [
    "Complete PDF redesign — clean, professional, highly legible layout",
    "Proper page breaks between major sections",
    "Improved typography, spacing, and color contrast for print",
  ]},
  { version: "1.3.3", date: "2025-04-01", changes: [
    "IB-Ai loading screen now shows live step-by-step progress as the brief is being written",
    "Animated progress steps with checkmarks as each phase completes",
  ]},
  { version: "1.3.2", date: "2025-04-01", changes: [
    "Added Manager Info section above Product & Campaign — who is submitting + content quantity",
    "Manager names: Summer, Mike Max, David, Chris, Alex, Other with custom input",
    "Content quantity field — how many pieces of UGC are needed",
    "Moved Platform selection from Format section up to Manager Info section",
    "Fixed Other platform bug — added Enter key and + button to submit custom platform name",
  ]},
  { version: "1.3.1", date: "2025-04-01", changes: [
    "Rebranded AI Generate to IB-Ai across the entire app",
  ]},
  { version: "1.3.0", date: "2025-04-01", changes: [
    "PDF download button on generated briefs — prints all sections including revision criteria",
    "Foundation for role-based access: Manager vs Creator roles",
    "Managers can edit briefs, Creators get read-only view (creator login coming later)",
    "Share link concept: briefs get a unique ID for future creator-facing URLs",
    "Brief display shows Download PDF and Copy Share Link buttons",
  ]},
  { version: "1.2.4", date: "2025-03-31", changes: [
    "Compliance section now IB-Ai powered — auto-selects approved and banned claims based on form inputs",
    "Managers can remove individual approved/banned claims by clicking ✕",
    "Managers can add custom approved/banned claims via text input",
    "IB-Ai compliance suggestions debounced at 2 seconds like proof points",
    "Full APPROVED_CLAIMS and BANNED_CLAIMS arrays kept as the master source — IB-Ai selects from them",
  ]},
  { version: "1.2.3", date: "2025-03-31", changes: [
    "Added Revision Criteria section to generated briefs — warning section",
    "Pre-built revision reasons: upside down band, tabs not adhered, applicator in video",
    "Custom revision criteria input with Other field on the form",
    "All revision items are editable by managers on the generated brief via contentEditable",
    "Removed disclosure warning box from the form",
  ]},
  { version: "1.2.2", date: "2025-03-31", changes: [
    "Tone dropdown now includes Other option with custom text input",
    "IB-Ai prompt updated to use custom tone when Other is selected",
  ]},
  { version: "1.2.1", date: "2025-03-31", changes: [
    "Platform selection changed from dropdown to multi-select checkboxes",
    "Removed Multi-platform option — users now check all that apply",
    "Added Other platform option with custom text input",
  ]},
  { version: "1.2.0", date: "2025-03-31", changes: [
    "Proof points overhauled — only stats verified on intakebreathing.com",
    "Removed unverified claims: 96% easier breathing, 41% congestion, 88% expansion, 90% fit rate",
    "Added verified site claims: press features, industry stats, product specs",
    "IB-Ai proof point suggestions now use verified data only",
  ]},
  { version: "1.1.0", date: "2025-03-31", changes: [
    "IB-Ai powered proof point auto-selection — stats update based on product, audience, problem, mission, and campaign fields",
    "Debounced 2-second delay to avoid excessive API calls",
    "Visual loading indicator on proof points section during IB-Ai suggestion",
  ]},
  { version: "1.0.0", date: "2025-03-31", changes: [
    "Initial release — UGC Brief Command Center",
    "IB-Ai with Claude Sonnet API",
    "Instant Draft with template engine",
    "Dark/Light theme with persistent storage",
    "Brief Library with localStorage persistence",
    "PDF download for generated briefs",
    "Editable brief sections (contentEditable)",
    "Products: Starter Kit Black, Starter Kit Clear, Mouth Tape Sleep Strips, Sports Tabs, Refills, Case, All Products, Other",
    "Campaign Vibes with custom Other option",
    "Audience targeting by age range and gender",
    "Free-text core problem field",
    "Proof points from verified SleepScore Labs data",
    "Compliance guardrails: approved claims, banned claims, required disclosure",
    "Platform-specific guidance for TikTok, Reels, Shorts, Facebook, Multi-platform",
  ]},
];

// ═══════════════════════════════════════════════════════════
// THEME SYSTEM
// ═══════════════════════════════════════════════════════════

const THEMES = {
  dark: {
    bg: "#060606", card: "#141414", cardAlt: "#1c1c1c",
    border: "#2a2a2a", borderLight: "#333",
    navBg: "rgba(6,6,6,0.95)",
    text: "#f0f0f0", textSecondary: "#cccccc", textMuted: "#777777", textFaint: "#444444",
    inputBg: "#1a1a1a", inputText: "#f0f0f0",
    green: "#00e09a", blue: "#63B7BA", red: "#ef4444", orange: "#f59200", purple: "#a78bfa",
    discBg: "rgba(0,0,0,0.3)",
    scrollThumb: "#222",
    isLight: false,
    shadow: "0 2px 8px rgba(0,0,0,0.3)",
  },
  light: {
    bg: "#f7f5ef", card: "#ffffff", cardAlt: "#f2f0ea",
    border: "#e2ded4", borderLight: "#d0ccc2",
    navBg: "rgba(247,245,239,0.95)",
    text: "#111111", textSecondary: "#333333", textMuted: "#888888", textFaint: "#bbbbbb",
    inputBg: "#ffffff", inputText: "#111111",
    green: "#00b87d", blue: "#4a9da0", red: "#dc4444", orange: "#d4890a", purple: "#8b6cc4",
    discBg: "rgba(0,0,0,0.05)",
    scrollThumb: "#ccc",
    isLight: true,
    shadow: "0 2px 8px rgba(0,0,0,0.04)",
  },
};

import ThemeContext from "./ThemeContext.js";

const NAV_SECTIONS = {
  dashboard: ["home"],
  ugcArmy: ["ugcDashboard", "create", "display", "library", "creators", "creatorDetail"],
  tools: ["tools", "videotool"],
  pipeline: ["pipeline"],
  influencer: ["influencer"],
  settings: ["settings"],
};

function getCurrentSection(view) {
  for (const [section, views] of Object.entries(NAV_SECTIONS)) {
    if (views.includes(view)) return section;
  }
  return "dashboard";
}

const NAV_SUB_LABELS = {
  dashboard: "Creator Partnerships",
  ugcArmy: "UGC Army",
  tools: "Tools",
  pipeline: "Channel Pipeline",
  influencer: "Influencer Buys",
  settings: "Settings",
};

const ROUTES = {
  "/": "home",
  "/ugc-army": "ugcDashboard",
  "/ugc-army/new": "create",
  "/ugc-army/brief": "display",
  "/ugc-army/library": "library",
  "/ugc-army/creators": "creators",
  "/ugc-army/creator": "creatorDetail",
  "/channel-pipeline": "pipeline",
  "/influencer-buys": "influencer",
  "/tools": "tools",
  "/tools/video-reformatter": "videotool",
  "/settings": "settings",
  "/source-of-truth": "sourceOfTruth",
  "/change-requests": "changeRequests",
  "/messaging": "messaging",
  "/campaigns": "campaigns",
  "/creator": "creatorLogin",
  "/creator/dashboard": "creatorDashboard",
  "/creator/onboard": "creatorOnboard",
  "/creator/profile": "creatorProfile",
  "/creator/brief": "creatorBriefView",
  "/creator/messages": "creatorMessages",
  "/brief": "publicBrief",
};

const VIEW_TO_PATH = {
  home: "/",
  ugcDashboard: "/ugc-army",
  create: "/ugc-army/new",
  display: "/ugc-army/brief",
  library: "/ugc-army/library",
  creators: "/ugc-army/creators",
  creatorDetail: "/ugc-army/creator",
  pipeline: "/channel-pipeline",
  influencer: "/influencer-buys",
  tools: "/tools",
  videotool: "/tools/video-reformatter",
  settings: "/settings",
  sourceOfTruth: "/source-of-truth",
  changeRequests: "/change-requests",
  messaging: "/messaging",
  campaigns: "/campaigns",
  creatorLogin: "/creator",
  creatorDashboard: "/creator/dashboard",
  creatorOnboard: "/creator/onboard",
  creatorProfile: "/creator/profile",
  creatorBriefView: "/creator/brief",
  creatorMessages: "/creator/messages",
  publicBrief: "/brief",
};

const CREATOR_PORTAL_VIEWS = ["creatorLogin", "creatorOnboard", "creatorDashboard", "creatorProfile", "creatorBriefView", "creatorMessages"];

function getViewFromPath() {
  if (typeof window === "undefined") return "home";
  const raw = window.location.pathname || "/";
  const path = raw.replace(/\/$/, "") || "/";
  if (path === "/creator") return "creatorLogin";
  if (path === "/creator/dashboard") return "creatorDashboard";
  if (path === "/creator/onboard") return "creatorOnboard";
  if (path === "/creator/profile") return "creatorProfile";
  if (path === "/creator/brief") return "creatorBriefView";
  if (path === "/creator/messages") return "creatorMessages";
  if (path === "/brief") return "publicBrief";
  if (path === "/ugc-army/creators") return "creators";
  if (path === "/ugc-army/creator") return "creatorDetail";
  if (path === "/channel-pipeline" || path.startsWith("/channel-pipeline/")) return "pipeline";
  if (path === "/messaging") return "messaging";
  if (path === "/campaigns" || path.startsWith("/campaigns")) return "campaigns";
  return ROUTES[path] || "home";
}

// ═══ Icon and CardIcon moved to ./components/Icons.jsx ═══
function getS(t) {
  return {
    app: { background: t.bg, minHeight: "100vh", color: t.text, fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif", transition: "background 0.3s, color 0.3s" },
    nav: { borderBottom: `1px solid ${t.border}`, padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: t.navBg, backdropFilter: "blur(12px)", zIndex: 100, transition: "background 0.3s", boxShadow: t.shadow },
    navLogo: { display: "flex", alignItems: "center", gap: 10, cursor: "pointer" },
    navTitle: { fontSize: 15, fontWeight: 700, letterSpacing: "-0.02em", color: t.text },
    navSub: { fontSize: 11, color: t.textFaint, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase" },
    navLinks: { display: "flex", gap: 6, alignItems: "center" },
    navBtn: (a) => ({ padding: "7px 14px", borderRadius: 8, border: "none", background: a ? t.green+"18" : "transparent", color: a ? t.green : t.textFaint, fontSize: 13, fontWeight: 600, cursor: "pointer" }),
    themeToggle: { width: 36, height: 20, borderRadius: 10, border: "none", cursor: "pointer", position: "relative", background: t.border, display: "flex", alignItems: "center", padding: 2, transition: "background 0.2s" },
    themeKnob: (isDark) => ({ width: 16, height: 16, borderRadius: 8, background: t.green, transition: "transform 0.2s", transform: isDark ? "translateX(16px)" : "translateX(0)" }),
    btnP: { padding: "13px 28px", borderRadius: 10, border: "none", background: t.green, color: t.isLight ? "#fff" : "#000", fontSize: 14, fontWeight: 700, cursor: "pointer" },
    btnS: { padding: "13px 28px", borderRadius: 10, border: `1px solid ${t.border}`, background: "transparent", color: t.text, fontSize: 14, fontWeight: 600, cursor: "pointer" },
    formWrap: { maxWidth: 720, margin: "0 auto", padding: "40px 24px 80px" },
    formTitle: { fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 6, color: t.text },
    formSub: { fontSize: 14, color: t.textMuted },
    section: { marginBottom: 32 },
    secLabel: { fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: t.green, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 },
    fg: { marginBottom: 18 },
    label: { display: "block", fontSize: 13, fontWeight: 600, color: t.textSecondary, marginBottom: 6 },
    hint: { fontSize: 11, color: t.textFaint, marginTop: 4, fontStyle: "italic" },
    input: { width: "100%", padding: "11px 14px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box", transition: "border-color 0.2s, background 0.3s", boxShadow: t.isLight ? "inset 0 1px 2px rgba(0,0,0,0.06)" : "none" },
    textarea: { width: "100%", padding: "11px 14px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 14, fontFamily: "inherit", outline: "none", resize: "vertical", minHeight: 80, lineHeight: 1.5, boxSizing: "border-box", transition: "border-color 0.2s, background 0.3s", boxShadow: t.isLight ? "inset 0 1px 2px rgba(0,0,0,0.06)" : "none" },
    select: { width: "100%", padding: "11px 14px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box", cursor: "pointer", transition: "background 0.3s", boxShadow: t.isLight ? "inset 0 1px 2px rgba(0,0,0,0.06)" : "none" },
    r2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
    r3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 },
    genBtn: { width: "100%", padding: "16px", borderRadius: 12, border: "none", background: `linear-gradient(135deg,${t.green},${t.blue})`, color: t.isLight ? "#fff" : "#000", fontSize: 16, fontWeight: 800, cursor: "pointer", marginTop: 12 },
    chipGrid: { display: "flex", flexWrap: "wrap", gap: 8 },
    chip: (on) => ({
      padding: "8px 14px", borderRadius: 8, fontSize: 13, cursor: "pointer", fontWeight: on ? 600 : 500,
      border: `1px solid ${on ? t.green : t.border}`,
      background: on ? (t.isLight ? t.green+"18" : t.green+"15") : t.cardAlt,
      color: on ? t.green : t.textSecondary,
      transition: "all 0.15s", userSelect: "none",
      boxShadow: t.isLight && on ? `0 0 0 1px ${t.green}30` : "none",
    }),
    roBox: { background: t.cardAlt, borderRadius: 10, border: `1px solid ${t.border}`, padding: "12px 14px", fontSize: 13, color: t.textFaint, lineHeight: 1.6, transition: "background 0.3s" },
    roItem: () => ({ marginBottom: 4, fontSize: 13, color: t.textSecondary, lineHeight: 1.6 }),
    roMarker: (c) => ({ color: c, fontWeight: 700, marginRight: 6 }),
    bWrap: { maxWidth: 760, margin: "0 auto", padding: "40px 24px 80px" },
    bHeader: { textAlign: "center", marginBottom: 40, paddingBottom: 32, borderBottom: `1px solid ${t.border}` },
    bCampaign: { fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 8, color: t.text },
    bMission: { fontSize: 16, color: t.textMuted, fontStyle: "italic", marginBottom: 18 },
    badges: { display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" },
    badge: (c) => ({ padding: "5px 12px", borderRadius: 20, background: c + (t.isLight ? "20" : "18"), color: c, fontSize: 12, fontWeight: 700, border: t.isLight ? `1px solid ${c}30` : "none" }),
    bSec: { marginBottom: 32 },
    bSecTitle: { fontSize: 14, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: t.textFaint, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 },
    card: { background: t.card, borderRadius: 12, border: `1px solid ${t.border}`, padding: 20, marginBottom: 12, transition: "background 0.3s", boxShadow: t.shadow },
    cols2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
    beat: (c) => ({ background: t.card, borderRadius: 12, border: `1px solid ${c}25`, borderLeft: `4px solid ${c}`, padding: 20, marginBottom: 14, transition: "background 0.3s", boxShadow: t.shadow }),
    beatLabel: (c) => ({ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: c, marginBottom: 8 }),
    beatInst: { fontSize: 14, color: t.text, lineHeight: 1.6, marginBottom: 14 },
    beatSub: { fontSize: 11, fontWeight: 700, color: t.textFaint, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 },
    beatLine: { fontSize: 13, color: t.textSecondary, lineHeight: 1.7, paddingLeft: 12, borderLeft: `2px solid ${t.border}`, marginBottom: 4 },
    hookItem: { display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 12 },
    hookNum: { minWidth: 28, height: 28, borderRadius: 8, background: t.orange + (t.isLight ? "20" : "22"), color: t.orange, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, border: t.isLight ? `1px solid ${t.orange}35` : "none" },
    hookText: { fontSize: 14, color: t.textSecondary, lineHeight: 1.5, paddingTop: 3 },
    sayCol: { background: t.card, borderRadius: 12, border: `1px solid ${t.green}20`, padding: 16, transition: "background 0.3s", boxShadow: t.shadow },
    dontCol: { background: t.card, borderRadius: 12, border: `1px solid ${t.red}20`, padding: 16, transition: "background 0.3s", boxShadow: t.shadow },
    sayH: (c) => ({ fontSize: 12, fontWeight: 800, color: c, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }),
    li: { fontSize: 13, color: t.textSecondary, lineHeight: 1.7, marginBottom: 6, paddingLeft: 2 },
    mk: (c) => ({ color: c, fontWeight: 700, marginRight: 6 }),
    listItem: { background: t.card, borderRadius: 12, border: `1px solid ${t.border}`, padding: "16px 20px", marginBottom: 10, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "background 0.3s", boxShadow: t.shadow },
    empty: { textAlign: "center", padding: "80px 24px", color: t.textFaint },
  };
}

// ═══════════════════════════════════════════════════════════
// INTAKE KNOWLEDGE BASE
// ═══════════════════════════════════════════════════════════

// ═══ Brief constants (PRODUCTS, VIBES, etc.) moved to ./components/BriefGenerator.jsx ═══

const ROLES = { MANAGER: "manager", CREATOR: "creator" };
const CREATOR_ALLOWED_VIEWS = ["library", "display"];

// parseCSVLine moved to utils/helpers.js

function normalizeHandleKey(h) {
  return String(h || "").trim().toLowerCase().replace(/^@/, "");
}

function tiktokUrlFromHandle(handle) {
  const h = String(handle || "").trim().replace(/^@/, "");
  if (!h) return "";
  return `https://www.tiktok.com/@${h}`;
}

function instagramUsernameFromUrl(url) {
  try {
    const u = new URL(String(url || "").trim());
    const parts = u.pathname.split("/").filter(Boolean);
    return parts[0] || "";
  } catch {
    return "";
  }
}

function creatorDisplayVideoCount(c) {
  const logLen = Array.isArray(c?.videoLog) ? c.videoLog.length : 0;
  const legacy = Number(c?.totalVideos) || 0;
  return Math.max(logLen, legacy);
}

const DEFAULT_TIKTOK_DATA = {
  followers: null,
  following: null,
  hearts: null,
  videoCount: null,
  bio: "",
  avatarUrl: "",
  verified: false,
  lastEnriched: null,
  bioLink: "",
  displayName: "",
  accountCreated: null,
  isPrivate: false,
  isCommerceUser: false,
  friendCount: null,
  likedVideos: null,
  recentVideos: [],
  avgViews: null,
  avgLikes: null,
  avgComments: null,
  avgShares: null,
  bestVideo: null,
};
const DEFAULT_INSTAGRAM_DATA = {
  followers: null,
  following: null,
  posts: null,
  bio: "",
  avatarUrl: "",
  verified: false,
  lastEnriched: null,
  enrichError: null,
  fullName: "",
  externalUrl: "",
  category: "",
  isPrivate: false,
  isBusiness: false,
  businessCategory: "",
};

// ═══ FUTURE: Outreach & Follow-Up System ═══
// outreachStatus tracks the pipeline: not_contacted → contacted → replied → negotiating → onboarded
// followUpDue triggers reminders in the Channel Pipeline section
// campaigns links creators to specific briefs
// payments tracks cost per creator per campaign

const ENRICH_STEPS = [
  { id: "tt_profile", label: "TikTok Profile" },
  { id: "tt_videos", label: "TikTok Videos" },
  { id: "tt_shop", label: "TikTok Shop" },
  { id: "ig_profile", label: "Instagram Profile" },
  { id: "ig_posts", label: "Instagram Posts" },
  { id: "ig_reels", label: "Instagram Reels" },
  { id: "youtube", label: "YouTube" },
  { id: "twitter", label: "Twitter/X" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "snapchat", label: "Snapchat" },
  { id: "facebook", label: "Facebook" },
  { id: "ai_score", label: "IB-Ai calculating score" },
];

/** Canonical CSV/spreadsheet field fixes keyed by normalized handle (no @). */
const CREATOR_FIELD_PATCHES = {
  "jack.manning": { name: "Jack Manning", address: "306 Grove Ave NW Cleveland TN 37311" },
  "peter_gorbatenko": { name: "Petr Goratenko", address: "21 Robeson st., Apt 428, Somerville, NJ, 08876" },
  "coachirmalissette": { name: "Irma Avila", address: "214 Blackwell lane Kyle Texas" },
  "rooted_strength_and_wellness": { name: "Ryan Parry", address: "175 W Fifth S Rexburg, ID 83440" },
  "lindsaypeachfinds": { name: "Lindsay Amarel", address: "2402 W 525 S Layton, UTAH 84041" },
  "thesarahyeary": { name: "Sarah Yeary", address: "4611 Depew Ave, Austin, TX 78751" },
  "ugcwithsusanna": { name: "Susanna Smith", address: "18442 Indian, Redford MI 48240" },
  "fabianugc": { name: "Fabian Maqueira", address: "104 Locust Dr, Bristol, TN 37620" },
  "kelli_klaus": { name: "Kelli Klaus", address: "916 Druid Dr, Plano, TX 75075" },
  tarakatchur: { name: "Tara Katchur" },
  bymattson: { name: "Matt Son" },
  "michael_fong.spt": { name: "Michael Fong" },
  natedank: {
    tiktokHandle: "nategotdealz",
    instagramHandle: "natedank",
    notes:
      "600K impression video, mouth breathing content, huge performance in male 25-34 range",
  },
  xkarinaslife: {
    notes:
      "300K impression video, $15K spend in March, discussing how mouth breathing gives you a double chin, great hook, grabbing female attention across 35-44 well",
  },
  bbellasclothez: {
    quality: "High",
    notes:
      "300K impressions on 1 UGC video (she had a great idea to show the cut from level 1 to 4 at the very end to emphasize the difference), another video, 24K views on Viktor Thorup reaction, lot of potential there, loved the style, \"I'll give you 3 seconds to see what I see in this picture\" as a great hook",
  },
  the_airway_champion: { notes: "127K Insta Followers, big advocate" },
  alytheslp: { notes: "$100/1 video pending" },
  tonybakertb: { quality: "High" },
};

function normalizeCreatorRow(c) {
  if (!c || typeof c !== "object") return c;
  const tt = typeof c.tiktokData === "object" && c.tiktokData ? c.tiktokData : {};
  const ig = typeof c.instagramData === "object" && c.instagramData ? c.instagramData : {};
  const cleanH = String(c.handle || "").replace(/^@/, "").trim();
  const ttH =
    c.tiktokHandle != null && String(c.tiktokHandle).trim() !== ""
      ? String(c.tiktokHandle).replace(/^@/, "").trim()
      : cleanH;
  const igH =
    c.instagramHandle != null && String(c.instagramHandle).trim() !== ""
      ? String(c.instagramHandle).replace(/^@/, "").trim()
      : cleanH;
  const ytH =
    c.youtubeHandle != null && String(c.youtubeHandle).trim() !== ""
      ? String(c.youtubeHandle).replace(/^@/, "").trim()
      : "";
  const twH =
    c.twitterHandle != null && String(c.twitterHandle).trim() !== ""
      ? String(c.twitterHandle).replace(/^@/, "").trim()
      : "";
  return {
    ...c,
    videoLog: Array.isArray(c.videoLog) ? c.videoLog : [],
    dateAdded: c.dateAdded || "2025-03-31",
    tiktokHandle: ttH,
    instagramHandle: igH,
    youtubeHandle: ytH,
    twitterHandle: twH,
    tiktokData: { ...DEFAULT_TIKTOK_DATA, ...tt },
    instagramData: { ...DEFAULT_INSTAGRAM_DATA, ...ig },
    engagementRate: c.engagementRate != null && c.engagementRate !== "" ? c.engagementRate : null,
    ibScore: c.ibScore != null && c.ibScore !== "" ? Number(c.ibScore) : null,
    ibScoreLabel: c.ibScoreLabel || null,
    ibScoreBreakdown: c.ibScoreBreakdown && typeof c.ibScoreBreakdown === "object" ? c.ibScoreBreakdown : null,
    tiktokEngRate: c.tiktokEngRate != null && c.tiktokEngRate !== "" ? c.tiktokEngRate : null,
    instagramEngRate: c.instagramEngRate != null && c.instagramEngRate !== "" ? c.instagramEngRate : null,
    instagramAvgLikes: c.instagramAvgLikes != null ? c.instagramAvgLikes : null,
    instagramAvgComments: c.instagramAvgComments != null ? c.instagramAvgComments : null,
    instagramRecentPosts: Array.isArray(c.instagramRecentPosts) ? c.instagramRecentPosts : [],
    instagramRecentReels: Array.isArray(c.instagramRecentReels) ? c.instagramRecentReels : [],
    tiktokShopData: c.tiktokShopData && typeof c.tiktokShopData === "object" ? c.tiktokShopData : null,
    youtubeData: c.youtubeData && typeof c.youtubeData === "object" ? c.youtubeData : null,
    twitterData: c.twitterData && typeof c.twitterData === "object" ? c.twitterData : null,
    linkedinData: c.linkedinData && typeof c.linkedinData === "object" ? c.linkedinData : null,
    snapchatData: c.snapchatData && typeof c.snapchatData === "object" ? c.snapchatData : null,
    facebookData: c.facebookData && typeof c.facebookData === "object" ? c.facebookData : null,
    lastEnriched: c.lastEnriched || null,
    aiAnalysis: c.aiAnalysis && typeof c.aiAnalysis === "object" ? c.aiAnalysis : null,
    aiAutoFilled:
      c.aiAutoFilled && typeof c.aiAutoFilled === "object"
        ? {
            niche: !!c.aiAutoFilled.niche,
            quality: !!c.aiAutoFilled.quality,
            costPerVideo: !!c.aiAutoFilled.costPerVideo,
          }
        : { niche: false, quality: false, costPerVideo: false },
    tiktokBestVideo: c.tiktokBestVideo && typeof c.tiktokBestVideo === "object" ? c.tiktokBestVideo : null,
    cpmData: c.cpmData && typeof c.cpmData === "object" ? c.cpmData : null,
    outreachStatus: c.outreachStatus ?? null,
    lastContactDate: c.lastContactDate ?? null,
    contactMethod: c.contactMethod ?? null,
    followUpDue: c.followUpDue ?? null,
    campaigns: Array.isArray(c.campaigns) ? c.campaigns : [],
    payments: Array.isArray(c.payments) ? c.payments : [],
  };
}

function fieldIsEmptyForPatch(v) {
  if (v == null) return true;
  if (typeof v === "string") return !String(v).trim();
  return false;
}

/** Apply canonical CSV fixes only where the stored value is still empty (does not overwrite user edits). */
function mergeCreatorFieldPatches(c) {
  const key = normalizeHandleKey(c.handle);
  const patch = CREATOR_FIELD_PATCHES[key];
  if (!patch) return c;
  const out = { ...c };
  for (const [k, v] of Object.entries(patch)) {
    if (fieldIsEmptyForPatch(out[k])) out[k] = v;
  }
  return out;
}

function hydrateCreator(c) {
  return normalizeCreatorRow(mergeCreatorFieldPatches(backfillCreatorSocialUrls(c)));
}

/** Backfill TikTok/Instagram profile URLs from handle when missing (spreadsheet links were lost in CSV). */
function backfillCreatorSocialUrls(c) {
  const clean = String(c.handle || "").replace(/@/g, "").trim();
  if (!clean) return c;
  const tt = String(c.tiktokHandle || clean).replace(/^@/, "").trim();
  const ig = String(c.instagramHandle || clean).replace(/^@/, "").trim();
  const updates = {};
  if (!String(c.tiktokUrl || "").trim()) updates.tiktokUrl = tt ? `https://www.tiktok.com/@${tt}` : "";
  if (!String(c.instagramUrl || "").trim()) updates.instagramUrl = ig ? `https://www.instagram.com/${ig}/` : "";
  return Object.keys(updates).length ? { ...c, ...updates } : c;
}

function buildPlatformUrls(creator) {
  const clean = String(creator.handle || "").replace("@", "").trim();
  const tt = String(creator.tiktokHandle || clean).replace("@", "").trim();
  const ig = String(creator.instagramHandle || clean).replace("@", "").trim();
  const yt = String(creator.youtubeHandle || "").replace("@", "").trim();
  const tw = String(creator.twitterHandle || "").replace("@", "").trim();
  return {
    tiktok: tt ? `https://www.tiktok.com/@${tt}` : "",
    instagram: ig ? `https://www.instagram.com/${ig}/` : "",
    youtube: yt ? `https://www.youtube.com/@${yt}` : (creator.youtubeData?.channelUrl || ""),
    twitter: tw ? `https://x.com/${tw}` : "",
    facebook: creator.facebookData?.profileUrl || "",
    linkedin: creator.linkedinData?.profileUrl || "",
    snapchat: "",
  };
}

/** Dot + label for how stale TikTok enrichment is (uses tt lastEnriched). */
function creatorDataFreshness(lastIso, t) {
  if (!lastIso) return { color: t.textFaint, text: "Never enriched" };
  const days = (Date.now() - new Date(lastIso).getTime()) / 86400000;
  if (days < 1) return { color: t.green, text: "Data from today" };
  if (days < 7) return { color: "#eab308", text: `Data from ${Math.floor(days) || 1} days ago` };
  if (days < 30) return { color: t.orange, text: `Data from ${Math.floor(days)} days ago` };
  return { color: t.red, text: `Data is ${Math.floor(days)} days old — consider refreshing` };
}

/** Bulk: who needs a re-pull given skip-within window. mode "never" = re-pull everyone. */
function shouldBulkEnrichCreator(c, mode) {
  const last = c.tiktokData?.lastEnriched;
  if (mode === "never") return true;
  if (!last) return true;
  const ms =
    mode === "24h"
      ? 24 * 60 * 60 * 1000
      : mode === "7d"
        ? 7 * 24 * 60 * 60 * 1000
        : mode === "30d"
          ? 30 * 24 * 60 * 60 * 1000
          : 7 * 24 * 60 * 60 * 1000;
  return Date.now() - new Date(last).getTime() > ms;
}

/** Compact e.g. 4.1M, 127K */
// formatMetricShort moved to utils/helpers.js

/** Profile pic URLs to try (IG, TT, YT, FB). */
function creatorAvatarUrlCandidates(c) {
  return [c.instagramData?.avatarUrl, c.tiktokData?.avatarUrl, c.youtubeData?.avatarUrl, c.facebookData?.avatarUrl]
    .map((v) => String(v || "").trim())
    .filter((v) => v.length > 5);
}

/** Server proxy first, then direct URL, per candidate. */
function buildAvatarSrcAttempts(c) {
  const urls = creatorAvatarUrlCandidates(c);
  const attempts = [];
  urls.forEach((u) => {
    try {
      attempts.push(`/api/avatar-proxy?url=${encodeURIComponent(u)}`);
    } catch {
      attempts.push(u);
    }
    attempts.push(u);
  });
  return attempts;
}

/** When Notes is empty, build text from IB-Ai fields after enrich. */
function buildAutoNotesFromAi(ai) {
  if (!ai) return "";
  return [
    ai.partnershipNotes,
    !ai.partnershipNotes && ai.oneSentence ? ai.oneSentence : null,
    !ai.partnershipNotes && ai.whyIntake ? `Why Intake: ${ai.whyIntake}` : null,
    ai.risk && ai.risk !== "None identified" ? `⚠️ ${ai.risk}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/** TikTok accountCreated ISO date (yyyy-mm-dd) → "Sep 2021" */
function formatCreatorSinceLabel(isoDate) {
  if (!isoDate) return null;
  const d = new Date(String(isoDate).length <= 10 ? `${isoDate}T12:00:00` : isoDate);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function formatRelativePostDate(isoOrDateStr) {
  if (!isoOrDateStr) return null;
  const d = new Date(isoOrDateStr);
  if (Number.isNaN(d.getTime())) return null;
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Posting frequency from TikTok recentVideos (date field). */
function computePostingFrequencyLabel(videos) {
  const vids = Array.isArray(videos) ? videos : [];
  if (vids.length < 1) return "—";
  const dates = vids
    .map((x) => (x.date ? new Date(x.date) : null))
    .filter((d) => d && !Number.isNaN(d.getTime()))
    .sort((a, b) => a - b);
  if (dates.length < 2) return vids.length === 1 ? "~1 in sample" : "—";
  const days = Math.max(1, (dates[dates.length - 1] - dates[0]) / 86400000);
  const perWeek = ((dates.length - 1) / days) * 7;
  if (perWeek >= 1) return `${perWeek.toFixed(1)}×/wk`;
  return `${(perWeek * 4.33).toFixed(1)}×/mo`;
}

/** At-a-glance stats for creator detail quick bar. */
function computeCreatorQuickStats(c) {
  const tt = c.tiktokData || {};
  const ig = c.instagramData || {};
  const yt = c.youtubeData || {};
  const tw = c.twitterData || {};
  const fb = c.facebookData || {};
  const totalReach =
    (Number(tt.followers) || 0) +
    (Number(ig.followers) || 0) +
    (Number(yt.subscribers) || 0) +
    (Number(tw.followers) || 0) +
    (Number(fb.followers) || 0);

  const videos = Array.isArray(tt.recentVideos) ? tt.recentVideos : [];
  const avgViews =
    tt.avgViews != null && tt.avgViews > 0
      ? tt.avgViews
      : videos.length
        ? Math.round(videos.reduce((s, v) => s + (Number(v.views) || 0), 0) / videos.length)
        : null;

  const eng =
    c.instagramEngRate != null && c.instagramEngRate >= 0.05 && c.instagramEngRate <= 100
      ? c.instagramEngRate
      : c.tiktokEngRate != null && c.tiktokEngRate >= 0.05 && c.tiktokEngRate <= 100
        ? c.tiktokEngRate
        : c.engagementRate != null && c.engagementRate >= 0.05 && c.engagementRate <= 100
          ? c.engagementRate
          : null;

  const cpm = calculateCreatorCPM(c);
  const estRate = cpm?.rateDisplay || null;
  const postFreq = computePostingFrequencyLabel(videos);
  const sorted = videos
    .map((v) => (v.date ? new Date(v.date) : null))
    .filter((d) => d && !Number.isNaN(d.getTime()))
    .sort((a, b) => b - a);
  const lastPosted = sorted[0] ? formatRelativePostDate(sorted[0].toISOString().split("T")[0]) : null;

  return { totalReach, avgViews, engRate: eng, estRate, postFreq, lastPosted };
}

/** Normalize view counts for a simple sparkline (0–100 heights). */
function buildViewsSparklinePercents(videos, max = 15) {
  const vids = (Array.isArray(videos) ? videos : []).slice(0, max);
  const views = vids.map((v) => Number(v.views) || 0);
  const hi = Math.max(1, ...views);
  return views.map((v) => Math.round((v / hi) * 100));
}

/**
 * Intake Breathing Creator Rate Calculator v2
 *
 * Industry context (2026):
 * - Average UGC: $185/deliverable
 * - Beginner: $50-150, Mid: $150-300, Established: $300-500+
 * - Usage rights add 25-50% on top
 *
 * Our formula:
 * 1. Base CPM ($5-$25 max) based on creator tier
 * 2. × Average views per video (from actual data)
 * 3. × Content alignment multiplier (0.8 - 1.5)
 * 4. × Engagement quality multiplier (0.7 - 1.3)
 * 5. Floor at $50, cap at $500 per video (UGC range)
 */
function pickCpmTierFromKnowledge(totalFollowers, tiers) {
  const list = Array.isArray(tiers) && tiers.length ? tiers : getDefaultAiKnowledge().cpmTiers;
  const tf = Number(totalFollowers) || 0;
  for (const tier of list) {
    let max = tier.maxFollowers;
    if (max == null || max === Infinity || (typeof max === "number" && max > 1e14)) max = Infinity;
    else max = Number(max);
    if (tf < max) {
      return { label: tier.label || "Tier", cpm: Number(tier.cpm) || 0 };
    }
  }
  const last = list[list.length - 1];
  return { label: last?.label || "Tier", cpm: Number(last?.cpm) || 0 };
}

// medianOf, fmtDollar moved to utils/helpers.js

function calculateCreatorCPM(creator, knowledge) {
  const k = mergeAiKnowledge(knowledge);
  const cpmCap = k.cpmCap ?? 25;
  const rateFloor = k.rateFloor ?? 50;
  const rateCeiling = k.rateCeiling ?? 500;
  const intakeKeywords = Array.isArray(k.alignmentKeywords) && k.alignmentKeywords.length ? k.alignmentKeywords.map((x) => String(x).toLowerCase()) : getDefaultAiKnowledge().alignmentKeywords.map((x) => x.toLowerCase());
  const competitorKeywords = Array.isArray(k.competitorKeywords) && k.competitorKeywords.length ? k.competitorKeywords.map((x) => String(x).toLowerCase()) : getDefaultAiKnowledge().competitorKeywords.map((x) => x.toLowerCase());

  // ─── Step 1: Get actual view data (MEDIAN, not mean) ───
  const ttVideosArr = creator.tiktokData?.recentVideos || creator.tiktokRecentVideos || [];
  const ttViewCounts = ttVideosArr.map(v => v.views || 0).filter(v => v > 0);
  const ttMedianViews = medianOf(ttViewCounts);
  const ttMeanViews = ttViewCounts.length > 0 ? Math.round(ttViewCounts.reduce((a, b) => a + b, 0) / ttViewCounts.length) : 0;
  const ttAvgViews = ttMedianViews || creator.tiktokData?.avgViews || creator.tiktokAvgViews || 0;

  const igRecentPosts = creator.instagramRecentPosts || [];
  const igRecentReels = creator.instagramRecentReels || [];

  // Instagram: use median reel views if available, otherwise estimate from median likes
  const igReelViews = igRecentReels.map(r => r.video_view_count || r.view_count || r.views || r.playCount || 0).filter(v => v > 0);
  const igPostLikes = igRecentPosts.map(p => p.likes || p.like_count || 0).filter(v => v > 0);
  const igMedianReelViews = medianOf(igReelViews);
  const igMedianLikes = medianOf(igPostLikes);

  let igAvgViews = 0;
  if (igMedianReelViews > 0) {
    igAvgViews = igMedianReelViews;
  } else if (igMedianLikes > 0) {
    igAvgViews = Math.round(igMedianLikes * 8);
  }

  // Pick the platform with better data
  let avgViews, platform, videoCount, platformFollowers, meanViews;
  if (ttAvgViews > 0) {
    avgViews = ttAvgViews;
    meanViews = ttMeanViews;
    platform = "TikTok";
    videoCount = ttViewCounts.length;
    platformFollowers = creator.tiktokData?.followers || 0;
  } else if (igAvgViews > 0) {
    avgViews = igAvgViews;
    meanViews = igAvgViews;
    platform = "Instagram";
    videoCount = igReelViews.length || igPostLikes.length;
    platformFollowers = creator.instagramData?.followers || 0;
  } else {
    return null; // No view data — can't calculate
  }

  // ─── Step 2: Base CPM by tier (from Source of Truth) ───
  const totalFollowers = Math.max(creator.instagramData?.followers || 0, creator.tiktokData?.followers || 0);

  const picked = pickCpmTierFromKnowledge(totalFollowers, k.cpmTiers);
  const cpmBase = picked.cpm;
  const tier = picked.label;
  const cpmFinal = Math.min(cpmBase, cpmCap);

  // ─── Step 3: Content alignment multiplier ───
  // Check if creator's content aligns with Intake's categories
  const niche = (creator.niche || "").toLowerCase();
  const ttBio = (creator.tiktokData?.bio || "").toLowerCase();
  const igBio = (creator.instagramData?.bio || "").toLowerCase();
  const allBios = `${niche} ${ttBio} ${igBio}`;
  const aiAnalysis = creator.aiAnalysis || {};

  let alignmentMultiplier = 1.0;
  const alignmentReasons = [];

  // Check for Intake-specific content
  const hasIntakeContent = allBios.includes("intake") || (aiAnalysis.competitorMentions || "").toLowerCase().includes("intake");
  if (hasIntakeContent) {
    alignmentMultiplier += 0.3;
    alignmentReasons.push("Has created Intake content (+30%)");
  }

  // Check for niche alignment
  const matchedKeywords = intakeKeywords.filter((kw) => allBios.includes(kw));
  if (matchedKeywords.length >= 3) {
    alignmentMultiplier += 0.2;
    alignmentReasons.push(`Strong niche fit: ${matchedKeywords.slice(0, 3).join(", ")} (+20%)`);
  } else if (matchedKeywords.length >= 1) {
    alignmentMultiplier += 0.1;
    alignmentReasons.push(`Partial niche fit: ${matchedKeywords.join(", ")} (+10%)`);
  }

  // Check for competitor content (NEGATIVE signal)
  const hasCompetitor = competitorKeywords.some((kw) => allBios.includes(kw));
  const competitorFromAi = (aiAnalysis.competitorMentions || "").toLowerCase();
  const hasCompetitorAi = competitorFromAi && !competitorFromAi.includes("none");
  if (hasCompetitor || hasCompetitorAi) {
    alignmentMultiplier -= 0.15;
    alignmentReasons.push("Competitor product detected (-15%)");
  }

  // Verified or business account bonus
  if (creator.instagramData?.verified || creator.tiktokData?.verified) {
    alignmentMultiplier += 0.1;
    alignmentReasons.push("Verified account (+10%)");
  }

  // TikTok Shop / Commerce user bonus
  if (creator.tiktokData?.isCommerceUser || creator.tiktokShopData?.hasShop) {
    alignmentMultiplier += 0.05;
    alignmentReasons.push("TikTok commerce creator (+5%)");
  }

  // Cap alignment multiplier
  alignmentMultiplier = Math.max(0.7, Math.min(1.5, alignmentMultiplier));

  // ─── Step 4: Engagement quality multiplier ───
  let engMultiplier = 1.0;
  const engReasons = [];

  let engRate =
    creator.engagementRate != null && creator.engagementRate !== ""
      ? Number(creator.engagementRate)
      : creator.tiktokEngRate != null && creator.tiktokEngRate !== ""
        ? Number(creator.tiktokEngRate)
        : creator.instagramEngRate != null && creator.instagramEngRate !== ""
          ? Number(creator.instagramEngRate)
          : null;
  if (engRate != null && Number.isFinite(engRate) && engRate > 0 && engRate <= 1) {
    engRate *= 100;
  }

  if (engRate != null && Number.isFinite(engRate)) {
    if (engRate >= 8) {
      engMultiplier = 1.3;
      engReasons.push(`Exceptional engagement ${engRate.toFixed(1)}% (+30%)`);
    } else if (engRate >= 5) {
      engMultiplier = 1.15;
      engReasons.push(`Strong engagement ${engRate.toFixed(1)}% (+15%)`);
    } else if (engRate >= 2) {
      engMultiplier = 1.0;
      engReasons.push(`Average engagement ${engRate.toFixed(1)}%`);
    } else if (engRate >= 1) {
      engMultiplier = 0.85;
      engReasons.push(`Below average engagement ${engRate.toFixed(1)}% (-15%)`);
    } else {
      engMultiplier = 0.7;
      engReasons.push(`Low engagement ${engRate.toFixed(1)}% (-30%)`);
    }
  }

  // View-to-follower ratio check
  if (platformFollowers > 0 && avgViews > 0) {
    const viewRatio = avgViews / platformFollowers;
    if (viewRatio > 0.5) {
      engMultiplier += 0.1;
      engReasons.push(`High view ratio ${(viewRatio * 100).toFixed(0)}% (+10%)`);
    } else if (viewRatio < 0.05) {
      engMultiplier -= 0.1;
      engReasons.push(`Low view ratio ${(viewRatio * 100).toFixed(1)}% (-10%)`);
    }
  }

  engMultiplier = Math.max(0.6, Math.min(1.4, engMultiplier));

  // ─── Step 5: Calculate final rate ───
  const rawRate = (avgViews / 1000) * cpmFinal * alignmentMultiplier * engMultiplier;

  // Industry-aligned range: ±20% around the calculated rate
  let rateLow = Math.round(rawRate * 0.8);
  let rateHigh = Math.round(rawRate * 1.2);

  rateLow = Math.max(rateFloor, rateLow);
  rateHigh = Math.max(rateHigh, rateLow + 25);
  rateLow = Math.min(rateLow, rateCeiling - 50);
  rateHigh = Math.min(rateHigh, rateCeiling);
  if (rateLow >= rateHigh) rateHigh = rateLow + 50;

  const rateDisplay = "$" + rateLow.toLocaleString() + "-" + rateHigh.toLocaleString();

  // ─── Build explanation ───
  const explanation = [
    `Base: ${formatMetricShort(avgViews)} median views (mean: ${formatMetricShort(meanViews)}) across ${videoCount} videos on ${platform} × $${cpmFinal} CPM (${tier}) = ${fmtDollar(Math.round((avgViews / 1000) * cpmFinal))}`,
    `Content alignment: ×${alignmentMultiplier.toFixed(2)} ${alignmentReasons.length > 0 ? `(${alignmentReasons.join("; ")})` : "(neutral)"}`,
    `Engagement quality: ×${engMultiplier.toFixed(2)} ${engReasons.length > 0 ? `(${engReasons.join("; ")})` : "(no data)"}`,
    `Raw rate: $${Math.round(rawRate)} → Range: ${rateDisplay}/video`,
    "Industry context: Avg UGC in 2026 is $150-300/video. Beginner $50-150, Mid $150-300, Established $300-500.",
  ].join("\n");

  return {
    cpmBase,
    cpmFinal,
    cpmTier: tier,
    avgViews,
    meanViews,
    platform,
    videoCount,
    platformFollowers,
    rateLow,
    rateHigh,
    rateDisplay,
    rawRate: Math.round(rawRate),
    alignmentMultiplier,
    alignmentReasons,
    engMultiplier,
    engReasons,
    explanation,
    // For display
    totalFollowers,
    engRate,
    hasIntakeContent,
    hasCompetitor: hasCompetitor || hasCompetitorAi,
  };
}

function calculatePlatformRates(creator, baseCpmData) {
  if (!baseCpmData) return null;
  const baseRate = (baseCpmData.rateLow + baseCpmData.rateHigh) / 2;
  const igFollowers = Number(creator.instagramData?.followers) || 0;
  const ttFollowers = Number(creator.tiktokData?.followers) || 0;
  const ytSubscribers = Number(creator.youtubeData?.subscribers) || 0;
  const igEngRate = creator.instagramEngRate || 0;
  const ttAvgViews = creator.tiktokData?.avgViews || creator.tiktokAvgViews || 0;
  const hasIntakeContent = baseCpmData.hasIntakeContent || false;
  const hasShop = creator.tiktokData?.isCommerceUser || creator.tiktokShopData?.hasShop;

  const buildRate = (multiplier, platformCeiling, platformFloor) => {
    const cap = platformCeiling || 700;
    const floor = platformFloor || 50;
    const raw = Math.round(baseRate * multiplier);
    let low = Math.max(floor, Math.round(raw * 0.85));
    let high = Math.max(low + 25, Math.min(cap, Math.round(raw * 1.15)));
    low = Math.min(low, cap - 25);
    high = Math.min(high, cap);
    if (low >= high) low = high - 25;
    if (low < floor) low = floor;
    return { low, high, display: "$" + low.toLocaleString() + "-" + high.toLocaleString() };
  };

  const rates = {};

  var igReelMult = igFollowers > 0 ? 1.1 * (igEngRate > 3 ? 1.15 : igEngRate > 1 ? 1.0 : 0.85) : 0.9;
  rates.instagramReel = {
    ...buildRate(igReelMult, 600, 75),
    platform: "Instagram", type: "Reel",
    reasoning: igFollowers > 0
      ? "Based on " + formatMetricShort(igFollowers) + " followers with " + (igEngRate ? igEngRate.toFixed(1) + "%" : "unknown") + " engagement. Reels get algorithmic distribution beyond followers — top UGC format for Intake. " + (igEngRate > 3 ? "Strong engagement boosts value." : igEngRate > 1 ? "Moderate engagement, room to grow." : "Low engagement reduces value.")
      : "No Instagram data — estimated from TikTok metrics. Recommend enriching IG handle for accurate pricing.",
  };

  rates.instagramStory = {
    ...buildRate(0.4, 250, 50),
    platform: "Instagram", type: "Story",
    reasoning: "Stories disappear in 24 hours — lower long-term value but high authenticity signal. Good for behind-the-scenes Intake unboxing or morning routine content. Best used as an add-on to a Reel package, not standalone. Industry avg for stories is $80-250.",
  };

  rates.instagramFeedPost = {
    ...buildRate(0.75, 400, 75),
    platform: "Instagram", type: "Feed post",
    reasoning: "Permanent content with SEO and profile value. Lower algorithmic reach than Reels but stays on the creator's grid forever. Good for polished product shots or transformation content. " + (igFollowers > 50000 ? "Large audience makes feed posts more valuable as evergreen content." : "Consider bundling with a Reel for better ROI."),
  };

  var ttMult = ttAvgViews > 100000 ? 1.2 : ttAvgViews > 10000 ? 1.0 : 0.85;
  rates.tiktokVideo = {
    ...buildRate(ttMult, 500, 50),
    platform: "TikTok", type: "Video",
    reasoning: "Core UGC format. " + (ttAvgViews > 0 ? formatMetricShort(ttAvgViews) + " avg views — " : "No view data — ") + "TikTok's algorithm can push any video to millions regardless of follower count. " + (ttAvgViews > 100000 ? "This creator consistently hits 100K+ views — proven distribution." : ttAvgViews > 10000 ? "Solid view performance across recent videos." : "Lower average views but TikTok is volatile — one video can break out.") + (hasIntakeContent ? " Already creates Intake content — lower risk, proven product knowledge." : ""),
  };

  rates.tiktokShopVideo = {
    ...buildRate(hasShop ? 1.35 : 1.15, 700, 100),
    platform: "TikTok", type: "Shop video",
    reasoning: hasShop
      ? "Commerce-enabled creator with TikTok Shop access. Can tag products directly, driving measurable conversions. " + (creator.tiktokShopData?.productCount ? creator.tiktokShopData.productCount + " products in their shop. " : "") + "Higher rate justified by direct attribution to sales."
      : "Creator doesn't have TikTok Shop yet but can still create commerce-style content. Rate based on standard TikTok performance with a commerce intent premium. Consider helping them set up TikTok Shop for better tracking.",
  };

  var ytShortMult = ytSubscribers > 10000 ? 1.0 : ytSubscribers > 1000 ? 0.8 : 0.6;
  rates.youtubeShort = {
    ...buildRate(ytShortMult, 400, 50),
    platform: "YouTube", type: "Short",
    reasoning: ytSubscribers > 0
      ? formatMetricShort(ytSubscribers) + " subscribers. YouTube Shorts reach a different demographic — typically 25-44, higher purchasing power than TikTok. " + (ytSubscribers > 50000 ? "Strong YouTube presence increases cross-platform value significantly." : ytSubscribers > 5000 ? "Decent YouTube audience adds distribution value." : "Smaller YouTube audience — consider as a bonus repurpose, not primary deliverable.")
      : "No YouTube data. If creator has a channel, add the handle and re-enrich for accurate pricing. Otherwise, treat as a repurpose of TikTok content at reduced rate.",
  };

  var ytDedicatedMult = ytSubscribers > 50000 ? 5.0 : ytSubscribers > 10000 ? 3.5 : ytSubscribers > 1000 ? 2.5 : 1.5;
  rates.youtubeDedicated = {
    ...buildRate(ytDedicatedMult, 3000, 200),
    platform: "YouTube", type: "Dedicated video",
    reasoning: ytSubscribers > 0
      ? "Long-form content (3-15 min) requires significantly more production time. " + formatMetricShort(ytSubscribers) + " subscribers. " + (ytSubscribers > 50000 ? "With this audience size, a dedicated Intake video could drive substantial traffic and has long-tail SEO value. Worth the premium." : ytSubscribers > 10000 ? "Moderate audience. A dedicated video provides evergreen content but may not justify top rates unless niche alignment is strong." : "Smaller channel — consider a YouTube Short first to test performance before investing in a dedicated video.")
      : "No YouTube presence. Dedicated YouTube video not recommended until creator establishes a channel. Focus on TikTok and Instagram instead.",
  };

  return rates;
}

/** After enrichment, attach cpmData and optionally auto-fill costPerVideo from CPM (or legacy AI rate). */
function enrichPatchWithCpm(creatorBefore, patch, mergedCreator, aiKnowledge) {
  const prevAf =
    creatorBefore && creatorBefore.aiAutoFilled && typeof creatorBefore.aiAutoFilled === "object"
      ? creatorBefore.aiAutoFilled
      : { niche: false, quality: false, costPerVideo: false };
  const baseAf = patch && patch.aiAutoFilled && typeof patch.aiAutoFilled === "object" ? patch.aiAutoFilled : {};
  const emptyCost = !String((creatorBefore && creatorBefore.costPerVideo) || "").trim();
  const cpmCalc = calculateCreatorCPM(mergedCreator, aiKnowledge);
  const updates = { ...(patch || {}) };

  if (cpmCalc) updates.cpmData = cpmCalc;

  if (emptyCost) {
    if (cpmCalc) updates.costPerVideo = cpmCalc.rateDisplay;
    else if (updates.aiAnalysis?.estimatedRate) updates.costPerVideo = updates.aiAnalysis.estimatedRate;
  }

  updates.aiAutoFilled = {
    ...prevAf,
    ...baseAf,
    costPerVideo:
      emptyCost && String(updates.costPerVideo || mergedCreator.costPerVideo || "").trim()
        ? true
        : baseAf.costPerVideo ?? prevAf.costPerVideo ?? false,
  };

  return updates;
}

async function enrichTikTokFromApi(handle, apiKey) {
  const cleanHandle = String(handle || "").replace(/^@/, "").trim();
  if (!cleanHandle) throw new Error("Missing handle");
  const res = await Promise.race([
    fetch(`https://api.scrapecreators.com/v1/tiktok/profile?handle=${encodeURIComponent(cleanHandle)}`, {
      headers: { "x-api-key": apiKey },
    }),
    new Promise((_, rej) => setTimeout(() => rej(new Error("TIMEOUT")), 20000)),
  ]);
  if (!res.ok) throw new Error(`TikTok API returned ${res.status}`);
  const raw = await res.json();
  const data = raw?.data ?? raw;
  const user = data?.user ?? data;
  const stats = data?.stats ?? data;
  return {
    followers: stats?.followerCount ?? stats?.follower_count ?? null,
    following: stats?.followingCount ?? stats?.following_count ?? null,
    hearts: stats?.heartCount ?? stats?.heart ?? stats?.diggCount ?? null,
    videoCount: stats?.videoCount ?? null,
    bio: user?.signature ?? user?.bio ?? "",
    avatarUrl: user?.avatarMedium ?? user?.avatarLarger ?? user?.avatarThumb ?? "",
    verified: !!user?.verified,
    lastEnriched: new Date().toISOString(),
  };
}

async function enrichInstagramFromApi(handle, apiKey) {
  const cleanHandle = String(handle || "").replace(/^@/, "").trim();
  if (!cleanHandle || !apiKey) return null;
  try {
    const res = await Promise.race([
      fetch(`https://api.scrapecreators.com/v1/instagram/profile?handle=${encodeURIComponent(cleanHandle)}`, {
        headers: { "x-api-key": apiKey },
      }),
      new Promise((_, rej) => setTimeout(() => rej(new Error("TIMEOUT")), 20000)),
    ]);
    if (!res.ok) return null;
    const raw = await res.json();
    const data = raw?.data ?? raw;
    return {
      followers: data?.follower_count ?? data?.edge_followed_by?.count ?? null,
      following: data?.following_count ?? data?.edge_follow?.count ?? null,
      posts: data?.media_count ?? data?.edge_owner_to_timeline_media?.count ?? null,
      bio: data?.biography ?? "",
      avatarUrl: data?.profile_pic_url_hd ?? data?.profile_pic_url ?? "",
      verified: !!data?.is_verified,
      lastEnriched: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function parseTikTokUserStats(raw) {
  const data = raw?.data ?? raw;
  const user = data?.user ?? data;
  const stats = data?.stats ?? data;
  return { user, stats, data };
}

function instagramDataFromProfileResponse(raw) {
  if (!raw) return { ...DEFAULT_INSTAGRAM_DATA, lastEnriched: null, enrichError: null };
  const data = raw?.data ?? raw;
  return {
    followers: data?.follower_count ?? data?.edge_followed_by?.count ?? null,
    following: data?.following_count ?? data?.edge_follow?.count ?? null,
    posts: data?.media_count ?? data?.edge_owner_to_timeline_media?.count ?? null,
    bio: data?.biography ?? "",
    avatarUrl: data?.profile_pic_url_hd ?? data?.profile_pic_url ?? "",
    verified: !!data?.is_verified,
    fullName: data?.full_name ?? "",
    externalUrl: data?.external_url ?? "",
    category: data?.category_name ?? data?.category ?? "",
    isPrivate: !!data?.is_private,
    isBusiness: !!data?.is_business_account,
    businessCategory: data?.business_category_name ?? "",
    lastEnriched: new Date().toISOString(),
    enrichError: null,
  };
}

async function fetchInstagramEnrichment(igHandleRaw, scrapeKey, existingData = {}, onCreditUsed) {
  const base = { ...DEFAULT_INSTAGRAM_DATA, ...existingData };
  const clean = String(igHandleRaw || "").replace(/^@/, "").trim();
  const sk = String(scrapeKey || "").trim();
  if (!clean) {
    return { ...base, enrichError: "Missing Instagram handle", lastEnriched: base.lastEnriched };
  }
  if (!sk) {
    return { ...base, enrichError: "Missing ScrapeCreators API key" };
  }
  try {
    const igRes = await Promise.race([
      fetch(`https://api.scrapecreators.com/v1/instagram/profile?handle=${encodeURIComponent(clean)}`, {
        headers: { "x-api-key": sk },
      }),
      new Promise((_, rej) => setTimeout(() => rej(new Error("TIMEOUT")), 20000)),
    ]);
    if (!igRes.ok) {
      return {
        ...base,
        lastEnriched: new Date().toISOString(),
        enrichError: `Profile not found (HTTP ${igRes.status}). Handle may differ from TikTok.`,
      };
    }
    onCreditUsed?.();
    const igProfile = await igRes.json();
    return {
      ...base,
      ...instagramDataFromProfileResponse(igProfile),
      enrichError: null,
    };
  } catch (err) {
    return {
      ...base,
      lastEnriched: new Date().toISOString(),
      enrichError: err?.message || String(err),
    };
  }
}

function tiktokDataFromUserStats(user, stats) {
  const bioLink =
    user?.bioLink?.link ??
    user?.bio_link?.url ??
    user?.bioLinkUrl ??
    (typeof user?.bioLink === "string" ? user.bioLink : "") ??
    "";
  const createT = user?.createTime ?? user?.create_time;
  let accountCreated = null;
  if (createT != null) {
    const sec = Number(createT);
    if (Number.isFinite(sec)) {
      accountCreated = new Date(sec < 1e12 ? sec * 1000 : sec).toISOString().slice(0, 10);
    }
  }
  return {
    followers: stats?.followerCount ?? stats?.follower_count ?? null,
    following: stats?.followingCount ?? stats?.following_count ?? null,
    hearts: stats?.heartCount ?? stats?.heart ?? stats?.diggCount ?? null,
    videoCount: stats?.videoCount ?? null,
    bio: user?.signature ?? user?.bio ?? "",
    avatarUrl: user?.avatarMedium ?? user?.avatarLarger ?? user?.avatarThumb ?? "",
    verified: !!user?.verified,
    lastEnriched: new Date().toISOString(),
    bioLink: bioLink || "",
    displayName: user?.nickname ?? user?.nickName ?? "",
    accountCreated,
    isPrivate: !!(user?.privateAccount ?? user?.secret),
    isCommerceUser: !!(user?.commerceUserInfo?.commerceUser ?? user?.commerce_user),
    friendCount: stats?.friendCount ?? stats?.friend_count ?? null,
    likedVideos: stats?.diggCount ?? null,
  };
}

function extractTikTokVideoList(raw) {
  const data = raw?.data ?? raw;
  if (Array.isArray(raw?.itemList)) return raw.itemList;
  if (Array.isArray(data?.itemList)) return data.itemList;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.videos)) return data.videos;
  if (Array.isArray(data?.aweme_list)) return data.aweme_list;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(raw?.videos)) return raw.videos;
  return [];
}

/** Map Profile Videos API response → recentVideos, averages, engagement %, best clip. */
function buildTikTokRecentVideosAndMetrics(vidRaw, cleanHandle, followerCount) {
  const raw = vidRaw?.data ?? vidRaw;
  let videos = [];
  if (Array.isArray(vidRaw?.itemList)) videos = vidRaw.itemList;
  else if (Array.isArray(raw?.itemList)) videos = raw.itemList;
  else if (Array.isArray(vidRaw?.videos)) videos = vidRaw.videos;
  else if (Array.isArray(raw?.videos)) videos = raw.videos;
  else videos = extractTikTokVideoList(vidRaw || {});

  const recentVideos = videos.slice(0, 20);
  const n = recentVideos.length;
  const followers = Number(followerCount) > 0 ? Number(followerCount) : 0;

  let avgViews = null;
  let avgLikes = null;
  let avgComments = null;
  let avgShares = null;
  let engagementRate = null;

  if (n > 0 && followers > 0) {
    let totalViews = 0;
    let totalLikes = 0;
    let totalComments = 0;
    let totalShares = 0;
    for (const v of recentVideos) {
      const st = v.stats || v.statistics || {};
      totalViews += Number(st.playCount ?? st.play_count ?? v.playCount ?? 0) || 0;
      totalLikes += Number(st.diggCount ?? st.digg_count ?? 0) || 0;
      totalComments += Number(st.commentCount ?? st.comment_count ?? 0) || 0;
      totalShares += Number(st.shareCount ?? st.share_count ?? 0) || 0;
    }
    avgViews = Math.round(totalViews / n);
    avgLikes = Math.round(totalLikes / n);
    avgComments = Math.round(totalComments / n);
    avgShares = Math.round(totalShares / n);
    const avgEngagementActionsPerVideo = (totalLikes + totalComments + totalShares) / n;
    const rawRate = (avgEngagementActionsPerVideo / followers) * 100;
    engagementRate = parseFloat(Math.min(rawRate, 100).toFixed(2));
  }

  const mapOne = (v) => {
    const st = v.stats || v.statistics || {};
    const vid = v.id || v.aweme_id || v.awemeId;
    const ct = v.createTime ?? v.create_time ?? v.create_time_ms;
    let dateStr = "";
    if (ct != null) {
      const sec = Number(ct);
      if (Number.isFinite(sec)) {
        const ms = sec < 1e12 ? sec * 1000 : sec;
        dateStr = new Date(ms).toISOString().split("T")[0];
      }
    }
    return {
      id: vid,
      caption: String(v.desc || v.caption || "").trim(),
      views: Number(st.playCount ?? st.play_count ?? 0) || 0,
      likes: Number(st.diggCount ?? st.digg_count ?? 0) || 0,
      comments: Number(st.commentCount ?? st.comment_count ?? 0) || 0,
      shares: Number(st.shareCount ?? st.share_count ?? 0) || 0,
      cover: v.video?.cover || v.video?.originCover || v.video?.dynamicCover || "",
      date: dateStr,
      url: vid ? `https://www.tiktok.com/@${cleanHandle}/video/${vid}` : "",
    };
  };

  const mapped10 = recentVideos.slice(0, 10).map(mapOne);
  let bestVideo = null;
  for (const mv of mapped10) {
    if (!bestVideo || (mv.views || 0) > (bestVideo.views || 0)) bestVideo = { ...mv };
  }

  return {
    recentVideos: mapped10,
    avgViews,
    avgLikes,
    avgComments,
    avgShares,
    engagementRate,
    bestVideo: bestVideo && (bestVideo.views != null || bestVideo.id) ? bestVideo : null,
  };
}

function videoPlayCount(v) {
  return Number(v?.statistics?.play_count ?? v?.play_count ?? v?.stats?.playCount ?? v?.playCount ?? 0) || 0;
}

function videoDesc(v) {
  return String(v?.desc ?? v?.caption ?? v?.description ?? "").trim();
}

function topVideosForAi(raw) {
  const list = extractTikTokVideoList(raw)
    .map((v) => ({ v, pc: videoPlayCount(v) }))
    .sort((a, b) => b.pc - a.pc)
    .slice(0, 10)
    .map((x) => x.v);
  return list;
}

function normalizeQualityTier(q) {
  const s = String(q || "").toLowerCase();
  if (s.includes("high")) return "High";
  return "Standard";
}

/** @returns {Promise<object|null>} */
async function runCreatorAiAnalysis({
  cleanHandle,
  user,
  stats,
  videoDescriptions,
  apiKey,
}) {
  const key = String(apiKey || "").trim();
  if (!key) return null;
  const nickname = user?.nickname ?? user?.uniqueId ?? "";
  const body = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: `You are a UGC talent scout for Intake Breathing, a magnetic nasal dilator company. Analyze this TikTok creator for potential UGC partnership.

CREATOR: @${cleanHandle}
NAME: ${nickname || "Unknown"}
BIO: ${user?.signature || user?.bio || "None"}
FOLLOWERS: ${stats?.followerCount ?? stats?.follower_count ?? 0}
TOTAL HEARTS: ${stats?.heartCount ?? stats?.heart ?? 0}
TOTAL VIDEOS: ${stats?.videoCount ?? 0}
VERIFIED: ${user?.verified || false}

THEIR RECENT VIDEO CAPTIONS:
${videoDescriptions || "No captions available"}

Based on this data, return ONLY a JSON object with:
{
  "suggestedNiche": "their primary content niche, pick the best 2-3 from: Lifestyle, Gen Z, Gym Bro, Medical, Skincare, UGC Creator, Family, Foodie, Athlete, Breathing, Women's Fitness, Holistic Wellness, Running, Pets, Gaming, ASMR, Comedy",
  "contentStyle": "1-2 sentence description of their content style and what makes them unique",
  "fitScore": <integer 1-10, how good a fit for Intake Breathing UGC, 10 = perfect>,
  "fitReason": "1 sentence explaining why they would or wouldn't be a good fit for nasal breathing/sleep/athletic performance content",
  "suggestedCampaigns": "what type of Intake campaigns they'd be best for (e.g. 'Athletic performance, gym content')",
  "qualityTier": "High or Standard based on follower count, engagement, and content quality"
}

Return ONLY the JSON, nothing else.`,
      },
    ],
  };
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
      "x-api-key": key,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const aiData = await res.json();
  const aiText = (aiData.content || []).map((i) => i.text || "").join("");
  const aiMatch = aiText.match(/\{[\s\S]*\}/);
  if (!aiMatch) return null;
  try {
    const parsed = JSON.parse(aiMatch[0]);
    if (typeof parsed.fitScore === "string") parsed.fitScore = parseInt(parsed.fitScore, 10);
    if (!Number.isFinite(parsed.fitScore)) parsed.fitScore = null;
    parsed.qualityTier = normalizeQualityTier(parsed.qualityTier);
    return parsed;
  } catch {
    return null;
  }
}

function mergeAiFieldsIntoExisting(creator, aiAnalysis) {
  if (!aiAnalysis) return {};
  const out = { aiAnalysis };
  const prev = creator.aiAutoFilled && typeof creator.aiAutoFilled === "object" ? creator.aiAutoFilled : {};
  if (!String(creator.niche || "").trim()) out.niche = aiAnalysis.suggestedNiche || creator.niche;
  if (creator.quality === "High") {
    /* keep manager-set High */
  } else if (!creator.quality || creator.quality === "Standard") {
    out.quality = aiAnalysis.qualityTier === "High" ? "High" : "Standard";
  }
  if (aiAnalysis.ibScore != null && Number.isFinite(Number(aiAnalysis.ibScore))) {
    out.ibScore = Number(aiAnalysis.ibScore);
    out.ibScoreLabel = aiAnalysis.scoreLabel || creator.ibScoreLabel;
    out.ibScoreBreakdown = aiAnalysis.scoreBreakdown || creator.ibScoreBreakdown;
  }
  const seedNotes =
    aiAnalysis.partnershipNotes && String(aiAnalysis.partnershipNotes).trim() && !String(creator.notes || "").trim();
  if (seedNotes) {
    out.notes = String(aiAnalysis.partnershipNotes).trim();
  }
  out.aiAutoFilled = {
    niche: !String(creator.niche || "").trim() && aiAnalysis.suggestedNiche ? true : prev.niche ?? false,
    quality:
      creator.quality === "High"
        ? false
        : (!creator.quality || creator.quality === "Standard") && aiAnalysis.qualityTier
          ? true
          : prev.quality ?? false,
    costPerVideo: prev.costPerVideo ?? false,
    notes: seedNotes ? true : prev.notes ?? false,
  };
  return out;
}

function fitScoreBadgeStyle(score, t) {
  const n = Number(score);
  if (!Number.isFinite(n)) return { bg: t.cardAlt, color: t.textFaint, label: "" };
  if (n >= 8) return { bg: t.green + "22", color: t.green, label: "Great Fit" };
  if (n >= 5) return { bg: t.orange + "22", color: t.orange, label: "Potential Fit" };
  return { bg: t.red + "18", color: t.red, label: "Low Fit" };
}

/** IB Score 1–100 → tier color */
function ibScoreTierColor(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return "#64748b";
  if (n >= 90) return "#00e09a";
  if (n >= 75) return "#22c55e";
  if (n >= 60) return "#3b82f6";
  if (n >= 40) return "#f59e0b";
  return "#ef4444";
}

/** Build all enrichment structs from 11 parallel API raw responses. */
async function processElevenPlatformApiResults(cleanHandle, igHandle, raw, existingInstagramData = {}) {
  const ttProfile = raw.ttProfileRaw;
  const ttVideos = raw.ttVideosRaw;
  const ttShop = raw.ttShopRaw;
  const igProfile = raw.igProfileRaw;
  const igPosts = raw.igPostsRaw;
  const igReels = raw.igReelsRaw;
  const ytData = raw.ytData;
  const twData = raw.twData;
  const liData = raw.liData;
  const snapData = raw.snapData;
  const fbData = raw.fbData;

  let tiktokData = null;
  if (ttProfile) {
    const { user, stats } = parseTikTokUserStats(ttProfile);
    tiktokData = {
      ...DEFAULT_TIKTOK_DATA,
      ...tiktokDataFromUserStats(user, stats),
      lastEnriched: new Date().toISOString(),
    };
  }

  let ttRecentVideos = [];
  let ttAvgViews = 0;
  let ttAvgLikes = 0;
  let ttAvgComments = 0;
  let ttAvgShares = 0;
  let ttEngRate = null;
  let ttBestVideo = null;

  if (ttVideos) {
    const vidRoot = ttVideos?.data ?? ttVideos;
    const videos = vidRoot.itemList || vidRoot.videos || vidRoot.aweme_list || [];
    const recent = videos.slice(0, 30);
    if (recent.length > 0) {
      let totalV = 0;
      let totalL = 0;
      let totalC = 0;
      let totalS = 0;
      let bestViews = 0;
      ttRecentVideos = recent.map((v) => {
        const views = v.stats?.playCount || v.statistics?.play_count || 0;
        const likes = v.stats?.diggCount || v.statistics?.digg_count || 0;
        const comments = v.stats?.commentCount || v.statistics?.comment_count || 0;
        const shares = v.stats?.shareCount || v.statistics?.share_count || 0;
        const vid = v.id || v.aweme_id || "";
        totalV += views;
        totalL += likes;
        totalC += comments;
        totalS += shares;
        const entry = {
          id: vid,
          caption: v.desc || "",
          views,
          likes,
          comments,
          shares,
          cover: v.video?.cover?.url_list?.[0] || v.video?.origin_cover?.url_list?.[0] || v.video?.dynamic_cover?.url_list?.[0] || "",
          playUrl: v.video?.play_addr?.url_list?.[0] || v.video?.download_addr?.url_list?.[0] || "",
          date: v.createTime
            ? new Date(v.createTime * 1000).toISOString().split("T")[0]
            : v.create_time
              ? new Date(v.create_time * 1000).toISOString().split("T")[0]
              : "",
          url: `https://www.tiktok.com/@${cleanHandle}/video/${vid}`,
        };
        if (views > bestViews) {
          bestViews = views;
          ttBestVideo = entry;
        }
        return entry;
      });
      const count = recent.length;
      ttAvgViews = Math.round(totalV / count);
      ttAvgLikes = Math.round(totalL / count);
      ttAvgComments = Math.round(totalC / count);
      ttAvgShares = Math.round(totalS / count);
      const ttMedianViewsStored = medianOf(ttRecentVideos.map(v => v.views || 0).filter(v => v > 0));
      const ttFollowerCount = tiktokData?.followers;
      if (ttFollowerCount && ttFollowerCount > 0 && recent.length > 0) {
        const avgEng = ttAvgLikes + ttAvgComments + ttAvgShares;
        const rawRate = (avgEng / ttFollowerCount) * 100;
        ttEngRate = parseFloat(Math.min(rawRate, 100).toFixed(2));
      } else {
        ttEngRate = null;
      }
    }
  }

  if (tiktokData) {
    tiktokData = {
      ...DEFAULT_TIKTOK_DATA,
      ...tiktokData,
      recentVideos: ttRecentVideos,
      avgViews: ttAvgViews || null,
      medianViews: ttMedianViewsStored || null,
      avgLikes: ttAvgLikes || null,
      avgComments: ttAvgComments || null,
      avgShares: ttAvgShares || null,
      bestVideo: ttBestVideo,
    };
  } else if (ttRecentVideos.length) {
    tiktokData = {
      ...DEFAULT_TIKTOK_DATA,
      recentVideos: ttRecentVideos,
      avgViews: ttAvgViews || null,
      medianViews: ttMedianViewsStored || null,
      avgLikes: ttAvgLikes || null,
      avgComments: ttAvgComments || null,
      avgShares: ttAvgShares || null,
      bestVideo: ttBestVideo,
      lastEnriched: new Date().toISOString(),
    };
  }

  const tiktokShopData = ttShop
    ? {
        hasShop: !!(ttShop.products?.length || ttShop.showcase_products?.length || ttShop.data?.products?.length),
        productCount: ttShop.products?.length || ttShop.showcase_products?.length || ttShop.data?.products?.length || 0,
        products: (ttShop.products || ttShop.showcase_products || ttShop.data?.products || []).slice(0, 5).map((p) => ({
          name: p.title || p.product_name || "",
          price: p.price || p.original_price || "",
          image: p.cover?.url_list?.[0] || p.images?.[0]?.url_list?.[0] || "",
        })),
        lastEnriched: new Date().toISOString(),
      }
    : null;

  const igP = igProfile
    ? (igProfile.data?.user || igProfile.data || igProfile.user || igProfile.graphql?.user || igProfile)
    : null;
  let instagramData = igP
    ? {
        followers:
          igP.follower_count ??
          igP.followers_count ??
          igP.edge_followed_by?.count ??
          igP.followers ??
          (typeof igP.followerCount === "number" ? igP.followerCount : null),
        following:
          igP.following_count ??
          igP.followings_count ??
          igP.edge_follow?.count ??
          igP.following ??
          null,
        posts:
          igP.media_count ??
          igP.edge_owner_to_timeline_media?.count ??
          igP.total_media_count ??
          igP.postsCount ??
          null,
        bio: igP.biography || igP.bio || "",
        avatarUrl: igP.profile_pic_url_hd || igP.profile_pic_url || igP.profilePicUrl || igP.avatar || "",
        verified: igP.is_verified ?? igP.verified ?? false,
        fullName: igP.full_name || igP.fullName || igP.name || "",
        externalUrl: igP.external_url || igP.externalUrl || igP.bio_link?.url || "",
        category: igP.category_name || igP.category || igP.business_category_name || "",
        isBusiness: igP.is_business_account ?? igP.is_business ?? false,
        isPrivate: igP.is_private ?? false,
        lastEnriched: new Date().toISOString(),
        enrichError: null,
      }
    : {
        ...DEFAULT_INSTAGRAM_DATA,
        ...existingInstagramData,
        lastEnriched: new Date().toISOString(),
        enrichError: "Profile not found — handle may differ from TikTok",
      };

  let igRecentPosts = [];
  let igAvgLikes = 0;
  let igAvgComments = 0;
  let igEngRate = null;

  if (igPosts) {
    console.log("[enrichment] IG Posts raw sample:", JSON.stringify(igPosts)?.substring(0, 500));
    const pr = igPosts?.data ?? igPosts;
    const posts = pr.items || pr.edge_owner_to_timeline_media?.edges?.map((e) => e.node) || [];
    const recent = posts.slice(0, 20);
    if (recent.length > 0) {
      let totalL = 0;
      let totalC = 0;
      igRecentPosts = recent.map((p) => {
        const likes = p.like_count || p.edge_media_preview_like?.count || 0;
        const comments = p.comment_count || p.edge_media_to_comment?.count || 0;
        totalL += likes;
        totalC += comments;
        return {
          id: p.id || p.pk || "",
          caption: p.caption?.text || p.edge_media_to_caption?.edges?.[0]?.node?.text || "",
          likes,
          comments,
          mediaType: p.media_type || (p.is_video ? "video" : "image"),
          imageUrl: p.thumbnail_url || p.display_url || p.image_versions2?.candidates?.[0]?.url || "",
          videoUrl: p.video_url || "",
          url: `https://www.instagram.com/p/${p.shortcode || p.code || ""}/`,
          date: p.taken_at ? new Date(p.taken_at * 1000).toISOString().split("T")[0] : "",
        };
      });
      const count = recent.length;
      igAvgLikes = Math.round(totalL / count);
      igAvgComments = Math.round(totalC / count);
      const igFollowerCount = instagramData?.followers;
      if (igFollowerCount && igFollowerCount > 0 && recent.length > 0) {
        const rawRate = ((igAvgLikes + igAvgComments) / igFollowerCount) * 100;
        igEngRate = parseFloat(Math.min(rawRate, 100).toFixed(2));
      } else {
        igEngRate = null;
      }
    }
  }

  let igRecentReels = [];
  if (igReels) {
    const rr = igReels?.data ?? igReels;
    const reels = rr.items || rr.reels || [];
    igRecentReels = reels.slice(0, 20).map((r) => ({
      id: r.id || r.pk || "",
      caption: r.caption?.text || "",
      playCount: r.play_count || r.video_view_count || 0,
      likes: r.like_count || 0,
      comments: r.comment_count || 0,
      videoUrl: r.video_url || r.video_versions?.[0]?.url || "",
      coverUrl: r.image_versions2?.candidates?.[0]?.url || r.thumbnail_url || "",
      url: `https://www.instagram.com/reel/${r.code || ""}/`,
      date: r.taken_at ? new Date(r.taken_at * 1000).toISOString().split("T")[0] : "",
    }));
  }

  // === Store thumbnails NOW while CDN URLs are still fresh ===
  const _thumbVideos = [
    ...ttRecentVideos.map(v => ({ id: v.id, cover: v.cover, playUrl: v.playUrl || "" })),
    ...igRecentPosts.map(p => ({ id: p.id, cover: p.imageUrl, videoUrl: p.videoUrl || "" })),
    ...igRecentReels.map(r => ({ id: r.id, cover: r.coverUrl, videoUrl: r.videoUrl || "" })),
  ].filter(v => ((v.cover && v.cover.startsWith("http")) || v.playUrl || v.videoUrl) && !(v.cover || "").includes("supabase.co"));

  if (_thumbVideos.length > 0) {
    console.log("[enrich] Storing " + _thumbVideos.length + " thumbnails while CDN URLs are fresh...");
    try {
      const _thumbRes = await fetch("/api/store-thumbnails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorHandle: cleanHandle, videos: _thumbVideos }),
      });
      if (_thumbRes.ok) {
        const _thumbData = await _thumbRes.json();
        if (_thumbData?.results) {
          const _urlMap = {};
          _thumbData.results.forEach((r, i) => { if (r.url && _thumbVideos[i]) _urlMap[_thumbVideos[i].id] = r.url; });
          ttRecentVideos.forEach(v => { if (_urlMap[v.id]) { v.cover = _urlMap[v.id]; v.coverUrl = _urlMap[v.id]; } });
          igRecentPosts.forEach(p => { if (_urlMap[p.id]) p.imageUrl = _urlMap[p.id]; });
          igRecentReels.forEach(r => { if (_urlMap[r.id]) r.coverUrl = _urlMap[r.id]; });
          console.log("[enrich] Stored " + Object.keys(_urlMap).length + "/" + _thumbVideos.length + " permanent thumbnails");
        } else {
          console.warn("[enrich] Thumbnail storage returned no results");
        }
      } else {
        const errBody = await _thumbRes.text().catch(() => "");
        console.error("[enrich] Thumbnail storage failed:", _thumbRes.status, errBody.substring(0, 200));
      }
    } catch (e) {
      console.error("[enrich] Thumbnail storage error:", e.message);
    }
  }

  // YouTube — try every possible response structure
  let youtubeData = null;
  if (ytData) {
    console.log("[enrich] YouTube raw:", JSON.stringify(ytData)?.substring(0, 800));

    const yt = ytData?.data || ytData?.channel || ytData?.items?.[0] || ytData?.snippet || ytData;
    const ytSnippet = yt?.snippet || yt;
    const ytStats = yt?.statistics || ytData?.statistics || {};
    const ytBranding = yt?.brandingSettings?.channel || {};

    const subs = Number(
      ytStats.subscriberCount ?? ytStats.subscriber_count ??
      yt.subscriberCount ?? yt.subscriber_count ?? yt.subscribers ??
      yt.follower_count ?? yt.followers ?? 0
    ) || null;

    const views = Number(
      ytStats.viewCount ?? ytStats.view_count ??
      yt.viewCount ?? yt.view_count ?? yt.totalViews ?? 0
    ) || null;

    const vidCount = Number(
      ytStats.videoCount ?? ytStats.video_count ??
      yt.videoCount ?? yt.video_count ?? 0
    ) || null;

    const avatar = yt.avatar || yt.thumbnail || yt.profile_image_url ||
      ytSnippet?.thumbnails?.default?.url || ytSnippet?.thumbnails?.medium?.url ||
      yt.thumbnails?.default?.url || "";

    const channelUrl = yt.customUrl ? `https://youtube.com/${String(yt.customUrl).replace(/^\//, "")}` :
      yt.url || yt.channel_url || yt.vanity_url ||
      (yt.id ? `https://youtube.com/channel/${yt.id}` : "");

    const title = yt.title || ytSnippet?.title || ytBranding.title || yt.name || "";
    const desc = yt.description || ytSnippet?.description || ytBranding.description || "";

    if (subs || views || vidCount || title) {
      youtubeData = {
        subscribers: subs,
        totalViews: views,
        videoCount: vidCount,
        description: desc,
        avatarUrl: avatar,
        channelUrl,
        title,
        lastEnriched: new Date().toISOString(),
      };
      console.log("[enrich] YouTube parsed:", { subs, views, vidCount, title: title?.substring(0, 30) });
    } else {
      console.log("[enrich] YouTube response had no usable data");
    }
  }

  const twP = twData ? (twData.data || twData.user || twData) : null;
  const twMetrics = twP?.public_metrics || {};
  const twitterData = twP
    ? {
        followers:
          twP.followers_count ?? twMetrics.followers_count ?? twP.followersCount ?? twP.followers ?? null,
        following:
          twP.following_count ?? twP.friends_count ?? twMetrics.following_count ?? twP.followingCount ?? null,
        tweets:
          twP.statuses_count ?? twMetrics.tweet_count ?? twP.tweetsCount ?? twP.tweets_count ?? null,
        bio: twP.description || twP.bio || "",
        verified: twP.verified ?? twP.is_blue_verified ?? false,
        avatarUrl: twP.profile_image_url_https || twP.profile_image_url || twP.avatar || "",
        handle: twP.screen_name || twP.username || "",
        lastEnriched: new Date().toISOString(),
      }
    : null;

  const linkedinData = liData
    ? {
        headline: liData.headline || "",
        summary: liData.summary || "",
        connections: liData.connections_count || liData.connectionsCount || null,
        location: liData.location || "",
        profileUrl: liData.url || liData.profile_url || "",
        lastEnriched: new Date().toISOString(),
      }
    : null;

  const snapchatData = snapData
    ? {
        displayName: snapData.display_name || snapData.displayName || "",
        bitmoji: snapData.bitmoji_avatar || snapData.bitmojiAvatarUrl || "",
        snapcodeUrl: snapData.snapcode_image_url || "",
        lastEnriched: new Date().toISOString(),
      }
    : null;

  const facebookData = fbData
    ? {
        followers: fbData.followers_count || fbData.follower_count || null,
        likes: fbData.likes_count || fbData.fan_count || null,
        bio: fbData.about || fbData.bio || "",
        category: fbData.category || "",
        avatarUrl: fbData.profile_pic_url || fbData.profilePicUrl || "",
        profileUrl: fbData.url || "",
        lastEnriched: new Date().toISOString(),
      }
    : null;

  const { user: u2, stats: s2 } = ttProfile ? parseTikTokUserStats(ttProfile) : { user: {}, stats: {} };
  const videoDescriptions = ttRecentVideos
    .slice(0, 5)
    .map((v) => v.caption)
    .filter(Boolean)
    .join("\n");
  const engagementRate = igEngRate ?? ttEngRate ?? null;

  return {
    tiktokData,
    tiktokRecentVideos: ttRecentVideos,
    tiktokBestVideo: ttBestVideo,
    tiktokAvgViews: ttAvgViews,
    tiktokAvgLikes: ttAvgLikes,
    tiktokAvgComments: ttAvgComments,
    tiktokAvgShares: ttAvgShares,
    tiktokEngRate: ttEngRate,
    tiktokShopData,
    instagramData,
    instagramRecentPosts: igRecentPosts,
    instagramRecentReels: igRecentReels,
    instagramAvgLikes: igAvgLikes,
    instagramAvgComments: igAvgComments,
    instagramEngRate: igEngRate,
    youtubeData,
    twitterData,
    linkedinData,
    snapchatData,
    facebookData,
    engagementRate,
    videoDescriptions,
    user: u2,
    stats: s2,
    ttCaptions: ttRecentVideos.slice(0, 5).map((v) => v.caption).filter(Boolean).join(" | "),
    igCaptions: igRecentPosts.slice(0, 5).map((p) => p.caption).filter(Boolean).join(" | "),
  };
}

async function runIbScoreClaude(ctx) {
  const key = String(ctx.apiKey || "").trim();
  if (!key) return null;
  const {
    cleanHandle,
    tiktokData,
    instagramData,
    tiktokShopData,
    ttCaptions,
    igCaptions,
    igEngRate,
    ttEngRate,
    igAvgLikes,
    igAvgComments,
    igRecentReels,
    youtubeData,
    twitterData,
    linkedinData,
    facebookData,
    snapchatData,
  } = ctx;
  const safeNum = (val) => (val != null && Number(val) > 0 ? String(val) : "unknown");
  const safeRate = (val) => (val != null && Number(val) >= 0 && Number(val) <= 100 ? `${val}%` : "unknown");

  const k = mergeAiKnowledge(ctx.aiKnowledge);
  const w = k.ibScoreWeights || getDefaultAiKnowledge().ibScoreWeights;
  const wi = Number(w.instagram) || 45;
  const wt = Number(w.tiktok) || 30;
  const wc = Number(w.crossPlatform) || 10;
  const wa = Number(w.contentAlignment) || 15;
  const wSum = wi + wt + wc + wa;
  const labelOpts = Object.values(k.ibScoreLabels || getDefaultAiKnowledge().ibScoreLabels).join(" | ");

  const brandLine = (ctx.brandContext && String(ctx.brandContext).trim()) || (k.brandContext && String(k.brandContext).trim());
  const brandBlock = brandLine
    ? `BRAND / COMPANY CONTEXT (use for content alignment, outreach tone, and "why Intake"):\n${brandLine}\n\n`
    : `BRAND / COMPANY CONTEXT: Intake Breathing — magnetic external nasal dilator for better breathing, sleep, and athletic performance. FDA registered, made in USA.\n\n`;

  const analysisBlock =
    k.creatorAnalysisPrompt && String(k.creatorAnalysisPrompt).trim()
      ? `CREATOR ANALYSIS FOCUS (evaluate with this lens):\n${String(k.creatorAnalysisPrompt).trim()}\n\n`
      : "";
  const outreachBlock =
    k.outreachStyle && String(k.outreachStyle).trim()
      ? `OUTREACH STYLE (DM + email must follow — tone, formality, what to avoid):\n${String(k.outreachStyle).trim()}\n\n`
      : "";

  const prompt = `You are the IB Score calculator for Intake Breathing, a magnetic nasal dilator company for better breathing, sleep, and athletic performance.

${brandBlock}${analysisBlock}${outreachBlock}SCORING WEIGHTS (from managers — sub-scores must sum to ibScore; category maxima must match): Instagram ${wi}%, TikTok ${wt}%, Cross-platform ${wc}%, Content alignment ${wa}% (total ${wSum}%). If total ≠ 100%, normalize mentally.

CREATOR: @${cleanHandle}
NAME: ${tiktokData?.displayName || instagramData?.fullName || "Unknown"}

INSTAGRAM (primary platform — weight ${wi}%):
  Followers: ${safeNum(instagramData?.followers)}
  Posts: ${safeNum(instagramData?.posts)}
  IG Engagement Rate: ${safeRate(igEngRate)}
  Avg Likes per post: ${safeNum(igAvgLikes)}
  Avg Comments per post: ${safeNum(igAvgComments)}
  Bio: ${instagramData?.bio || "none"}
  Category: ${instagramData?.category || "unknown"}
  Verified: ${instagramData?.verified || false}
  Business Account: ${instagramData?.isBusiness || false}
  Recent post captions: ${igCaptions || "none"}
  Reels count pulled: ${Array.isArray(igRecentReels) ? igRecentReels.length : 0}

TIKTOK (weight ${wt}%):
  Followers: ${safeNum(tiktokData?.followers)}
  Total Hearts: ${safeNum(tiktokData?.hearts)}
  TT Videos: ${safeNum(tiktokData?.videoCount)}
  TT Engagement Rate: ${safeRate(ttEngRate)}
  Avg Views per video: ${safeNum(tiktokData?.avgViews)}
  Bio: ${tiktokData?.bio || "none"}
  Verified: ${tiktokData?.verified || false}
  Has TikTok Shop: ${tiktokShopData?.hasShop || false} (${tiktokShopData?.productCount || 0} products)
  Recent video captions: ${ttCaptions || "none"}

CROSS-PLATFORM PRESENCE (weight ${wc}%):
  YouTube: ${youtubeData ? `${safeNum(youtubeData.subscribers)} subscribers` : "not found"}
  Twitter/X: ${twitterData ? `${safeNum(twitterData.followers)} followers` : "not found"}
  LinkedIn: ${linkedinData ? "present" : "not found"}
  Facebook: ${facebookData ? `${safeNum(facebookData.followers)} followers` : "not found"}
  Snapchat: ${snapchatData ? "present" : "not found"}

Return ONLY a JSON object:
{
  "ibScore": <number 1-100>,
  "scoreBreakdown": {
    "instagramScore": <0-${wi}>,
    "instagramReason": "<1 sentence explaining the Instagram score>",
    "tiktokScore": <0-${wt}>,
    "tiktokReason": "<1 sentence explaining the TikTok score>",
    "crossPlatform": <0-${wc}>,
    "crossPlatformReason": "<1 sentence explaining cross-platform score>",
    "contentAlignment": <0-${wa}>,
    "contentAlignmentReason": "<1 sentence explaining content alignment score>"
  },
  "scoreLabel": <one of: ${labelOpts}>,
  "oneSentence": "<one sentence summary>",
  "contentStyle": "<2 sentences>",
  "whyIntake": "<2-3 sentences. Be specific about WHY this creator's content aligns with Intake Breathing. Reference specific content themes, audience overlap, or unique strengths.>",
  "risk": "<red flags or 'None identified'>",
  "riskDetail": "<if risk exists, explain in 2 sentences what the risk means and how to mitigate it. If no risk, say 'No significant risks.'>",
  "suggestedCampaigns": [
    {"name": "campaign type", "reason": "why this creator fits this campaign"}
  ],
  "bestPlatform": "<'Instagram' or 'TikTok'>",
  "bestPlatformReason": "<1-2 sentences explaining why this is their stronger platform>",
  "runnerUpPlatform": "<the other platform or 'YouTube' etc>",
  "runnerUpReason": "<1 sentence on why the runner-up is also worth considering>",
  "suggestedNiche": "<comma-separated>",
  "qualityTier": "<'High' if ibScore >= 70, else 'Standard'>",
  "partnershipNotes": "<3-4 bullet points: (1) what makes this creator valuable or risky for Intake, (2) what content type they'd be best for (UGC, collab reel, TTS, etc), (3) rate context based on their metrics, (4) specific outreach angle to use>",
  "outreachDM": "<2-3 sentence Instagram DM. Follow OUTREACH STYLE above. Mention Intake Breathing, reference something specific about their content. Do not mention payment.>",
  "outreachEmail": "<3-4 sentence email. Follow OUTREACH STYLE above. Professional but warm.>",
  "competitorMentions": "<list any competing nasal strips, breathing products, or sleep products mentioned in their bios or content. Say 'None detected' if clean.>",
  "brandSafety": "<'Safe' | 'Review' | 'Concern'> — Safe if no issues, Review if borderline content, Concern if explicit/controversial content or competitor partnerships"
}

Suggested creator rates are computed in-app from CPM and actual view data — do not estimate dollar rates in your response.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
      "x-api-key": key,
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1400,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) return null;
  const aiData = await res.json();
  const aiText = (aiData.content || []).map((i) => i.text || "").join("") || "";
  const aiMatch = aiText.match(/\{[\s\S]*\}/);
  if (!aiMatch) return null;
  try {
    const parsed = JSON.parse(aiMatch[0]);
    if (typeof parsed.ibScore === "string") parsed.ibScore = parseInt(parsed.ibScore, 10);
    if (!Number.isFinite(parsed.ibScore)) parsed.ibScore = null;
    parsed.qualityTier = normalizeQualityTier(parsed.qualityTier);
    return parsed;
  } catch {
    return null;
  }
}

async function runElevenPlatformEnrichmentPipeline(cleanHandle, scrapeKey, aiKey, onStep, opts) {
  const sk = String(scrapeKey || "").trim();
  const ak = String(aiKey || "").trim();
  const skipAi = !!opts?.skipAi;
  const bump = opts?.onCreditUsed;
  const base = "https://api.scrapecreators.com";

  // Instagram is the source of truth
  const igHandle = String(opts?.instagramHandle || "").replace(/^@/, "").trim() || cleanHandle;
  const ttHandle = String(opts?.tiktokHandle || "").replace(/^@/, "").trim() || cleanHandle;

  // YouTube and Twitter: use explicit handle, OR fall back to trying the IG handle
  const ytHandleExplicit = String(opts?.youtubeHandle || "").replace(/^@/, "").trim();
  const twHandleExplicit = String(opts?.twitterHandle || "").replace(/^@/, "").trim();

  // We'll try the main handle for YT/TW — most creators use the same handle across platforms
  const ytHandle = ytHandleExplicit || igHandle;
  const twHandle = twHandleExplicit || igHandle;

  const h = encodeURIComponent(cleanHandle);
  const ttEnc = encodeURIComponent(ttHandle);
  const igEnc = encodeURIComponent(igHandle);

  const fetchOne = async (url, stepId) => {
    try {
      const res = await fetch(url, { headers: { "x-api-key": sk } });
      if (!res.ok) {
        onStep?.(stepId, "fail");
        return null;
      }
      const j = await res.json().catch(() => null);
      bump?.();
      onStep?.(stepId, "ok");
      return j;
    } catch {
      onStep?.(stepId, "fail");
      return null;
    }
  };

  // Phase 1: Core platforms (TikTok + Instagram — always run)
  const [ttProfileRaw, ttVideosRaw, ttShopRaw, igProfileRaw, igPostsRaw, igReelsRaw] = await Promise.all([
    fetchOne(`${base}/v1/tiktok/profile?handle=${ttEnc}`, "tt_profile"),
    fetchOne(`${base}/v3/tiktok/profile/videos?handle=${ttEnc}`, "tt_videos"),
    fetchOne(`${base}/v1/tiktok/user/showcase?handle=${ttEnc}`, "tt_shop"),
    fetchOne(`${base}/v1/instagram/profile?handle=${igEnc}`, "ig_profile"),
    fetchOne(`${base}/v2/instagram/user/posts?handle=${igEnc}`, "ig_posts"),
    fetchOne(`${base}/v1/instagram/user/reels?handle=${igEnc}`, "ig_reels"),
  ]);

  // Phase 2: Extract handles from bios BEFORE calling secondary platforms
  const ttBio = (() => {
    try {
      const d = ttProfileRaw?.data ?? ttProfileRaw;
      const user = d?.user ?? d?.userInfo?.user ?? d;
      return (user?.signature || user?.bio || "").toLowerCase();
    } catch {
      return "";
    }
  })();
  const igBio = (() => {
    try {
      const d = igProfileRaw?.data?.user ?? igProfileRaw?.data ?? igProfileRaw?.user ?? igProfileRaw;
      return `${d?.biography || d?.bio || ""} ${d?.external_url || d?.bio_link?.url || ""}`.toLowerCase();
    } catch {
      return "";
    }
  })();
  const allBios = `${ttBio} ${igBio}`;

  // Extract YouTube handle from bio links
  let discoveredYtHandle = ytHandle;
  const ytUrlMatch = allBios.match(/youtube\.com\/@?([\w.-]+)|youtube\.com\/(?:c\/|channel\/|user\/)?([\w.-]+)|youtu\.be\/([\w.-]+)/i);
  if (ytUrlMatch) {
    const extracted = (ytUrlMatch[1] || ytUrlMatch[2] || ytUrlMatch[3] || "").replace(/^@/, "").split(/[/?#]/)[0];
    if (extracted && extracted.length > 1 && !["watch", "playlist", "feed", "results"].includes(extracted.toLowerCase())) {
      discoveredYtHandle = extracted;
      console.log(`[enrich] Discovered YouTube handle from bio: @${extracted}`);
    }
  }

  // Extract Twitter/X handle from bio links
  let discoveredTwHandle = twHandle;
  const twUrlMatch = allBios.match(/(?:twitter\.com|x\.com)\/([\w]+)/i);
  if (twUrlMatch) {
    const extracted = twUrlMatch[1];
    if (extracted && extracted.length > 1 && !["intent", "share", "home", "i", "search"].includes(extracted.toLowerCase())) {
      discoveredTwHandle = extracted;
      console.log(`[enrich] Discovered Twitter handle from bio: @${extracted}`);
    }
  }

  // Phase 3: Secondary platforms — use discovered handles
  const [ytRaw, twRaw, liRaw, snapRaw, fbRaw] = await Promise.all([
    fetchOne(`${base}/v1/youtube/channel?handle=${encodeURIComponent(discoveredYtHandle)}`, "youtube"),
    fetchOne(`${base}/v1/twitter/profile?handle=${encodeURIComponent(discoveredTwHandle)}`, "twitter"),
    fetchOne(`${base}/v1/linkedin/profile?handle=${h}`, "linkedin"),
    fetchOne(`${base}/v1/snapchat/profile?handle=${h}`, "snapchat"),
    fetchOne(`${base}/v1/facebook/profile?handle=${h}`, "facebook"),
  ]);

  // Phase 4: If YouTube failed with discovered handle, try alternatives
  let ytFinal = ytRaw;
  if (!ytRaw && discoveredYtHandle !== igHandle) {
    console.log(`[enrich] YouTube not found as @${discoveredYtHandle}, trying @${igHandle}...`);
    ytFinal = await fetchOne(`${base}/v1/youtube/channel?handle=${encodeURIComponent(igHandle)}`, "youtube");
  }
  if (!ytFinal && discoveredYtHandle !== ttHandle && igHandle !== ttHandle) {
    console.log(`[enrich] YouTube not found as @${igHandle}, trying @${ttHandle}...`);
    ytFinal = await fetchOne(`${base}/v1/youtube/channel?handle=${encodeURIComponent(ttHandle)}`, "youtube");
  }
  if (!ytFinal) {
    console.log(`[enrich] YouTube retry with @ prefix on @${igHandle}`);
    ytFinal = await fetchOne(`${base}/v1/youtube/channel?handle=${encodeURIComponent(`@${igHandle}`)}`, "youtube");
  }
  if (!ytFinal) {
    ytFinal = await fetchOne(`${base}/v1/youtube/channel?handle=${encodeURIComponent(`@${ttHandle}`)}`, "youtube");
  }

  // Twitter: if empty, try IG / TT handles
  let twFinal = twRaw;
  if (!twRaw && discoveredTwHandle !== igHandle) {
    twFinal = await fetchOne(`${base}/v1/twitter/profile?handle=${encodeURIComponent(igHandle)}`, "twitter");
  }
  if (!twFinal && igHandle !== ttHandle) {
    twFinal = await fetchOne(`${base}/v1/twitter/profile?handle=${encodeURIComponent(ttHandle)}`, "twitter");
  }
  if (!twFinal) {
    twFinal = await fetchOne(`${base}/v1/twitter/profile?handle=${encodeURIComponent(`@${igHandle}`)}`, "twitter");
  }

  // Validate secondary platforms — ScrapeCreators returns 200 for non-existent accounts
  const validSnap = (() => {
    if (!snapRaw) return null;
    const d = snapRaw?.data || snapRaw;
    const hasName = d?.displayName || d?.display_name || d?.username;
    const hasScore = d?.snapScore || d?.snap_score;
    const hasBitmoji = d?.bitmoji || d?.bitmojiUrl;
    if (!hasName && !hasScore && !hasBitmoji) {
      console.log("[enrich] Snapchat returned empty profile — marking as not found");
      onStep?.("snapchat", "skip");
      return null;
    }
    return snapRaw;
  })();

  const validFb = (() => {
    if (!fbRaw) return null;
    const d = fbRaw?.data || fbRaw;
    const hasFollowers = Number(d?.followers || d?.follower_count || d?.fan_count || 0) > 0;
    const hasName = d?.name || d?.page_name;
    if (!hasFollowers && !hasName) {
      console.log("[enrich] Facebook returned empty profile — marking as not found");
      onStep?.("facebook", "skip");
      return null;
    }
    return fbRaw;
  })();

  const validLi = (() => {
    if (!liRaw) return null;
    const d = liRaw?.data || liRaw;
    const hasName = d?.firstName || d?.first_name || d?.headline || d?.name;
    const hasFollowers = Number(d?.followersCount || d?.followers || d?.follower_count || 0) > 0;
    if (!hasName && !hasFollowers) {
      console.log("[enrich] LinkedIn returned empty profile — marking as not found");
      onStep?.("linkedin", "skip");
      return null;
    }
    return liRaw;
  })();

  // Debug logging — shows actual API response structures
  if (typeof window !== "undefined" && window.console) {
    console.group("[Enrich] Raw API responses for @" + cleanHandle);
    console.log("TT Profile:", JSON.stringify(ttProfileRaw)?.substring(0, 500));
    console.log("TT Videos:", JSON.stringify(ttVideosRaw)?.substring(0, 500));
    console.log("IG Profile:", JSON.stringify(igProfileRaw)?.substring(0, 500));
    console.log("IG Posts:", JSON.stringify(igPostsRaw)?.substring(0, 500));
    console.log("YouTube:", JSON.stringify(ytFinal)?.substring(0, 500));
    console.log("Twitter:", JSON.stringify(twFinal)?.substring(0, 500));
    console.log("LinkedIn:", JSON.stringify(validLi)?.substring(0, 500));
    console.log("Snapchat:", JSON.stringify(validSnap)?.substring(0, 500));
    console.log("Facebook:", JSON.stringify(validFb)?.substring(0, 500));
    console.groupEnd();
  }

  if (opts?.requireTikTokProfile && !ttProfileRaw) {
    const e = new Error("NOT_FOUND");
    e.status = 404;
    throw e;
  }

  const processed = await processElevenPlatformApiResults(cleanHandle, igHandle, {
    ttProfileRaw,
    ttVideosRaw,
    ttShopRaw,
    igProfileRaw,
    igPostsRaw,
    igReelsRaw,
    ytData: ytFinal,
    twData: twFinal,
    liData: validLi,
    snapData: validSnap,
    fbData: validFb,
  }, opts?.existingInstagramData || {});

  let aiAnalysis = null;
  if (!skipAi && ak) {
    onStep?.("ai_score", "run");
    aiAnalysis = await runIbScoreClaude({
      apiKey: ak,
      brandContext: opts?.brandContext,
      aiKnowledge: opts?.aiKnowledge,
      cleanHandle,
      tiktokData: processed.tiktokData,
      instagramData: processed.instagramData,
      tiktokShopData: processed.tiktokShopData,
      ttCaptions: processed.ttCaptions,
      igCaptions: processed.igCaptions,
      igEngRate: processed.instagramEngRate,
      ttEngRate: processed.tiktokEngRate,
      igAvgLikes: processed.instagramAvgLikes,
      igAvgComments: processed.instagramAvgComments,
      igRecentReels: processed.instagramRecentReels,
      youtubeData: processed.youtubeData,
      twitterData: processed.twitterData,
      linkedinData: processed.linkedinData,
      facebookData: processed.facebookData,
      snapchatData: processed.snapchatData,
    });
    onStep?.("ai_score", aiAnalysis ? "ok" : "fail");
  } else {
    onStep?.("ai_score", skipAi ? "skip" : "fail");
  }

  const notes = [];
  if (!ak && !skipAi) notes.push("Add your Anthropic API key in Settings to enable IB Score");

  const nickname = processed.tiktokData?.displayName || processed.instagramData?.fullName || "";

  const platformsFound = [
    ttProfileRaw,
    ttVideosRaw,
    ttShopRaw,
    igProfileRaw,
    igPostsRaw,
    igReelsRaw,
    ytFinal,
    twFinal,
    validLi,
    validSnap,
    validFb,
  ].filter(Boolean).length;

  const discoveredYoutubeHandle =
    discoveredYtHandle !== igHandle && discoveredYtHandle !== ttHandle ? discoveredYtHandle : null;
  const discoveredTwitterHandle =
    discoveredTwHandle !== igHandle && discoveredTwHandle !== ttHandle ? discoveredTwHandle : null;

  return {
    ...processed,
    aiAnalysis,
    notes,
    nickname,
    igData: processed.instagramData,
    ttData: processed.tiktokData,
    platformsFound,
    discoveredYoutubeHandle,
    discoveredTwitterHandle,
  };
}

async function fetchTikTokProfileRaw(cleanHandle, scrapeKey, onCreditUsed) {
  const res = await Promise.race([
    fetch(`https://api.scrapecreators.com/v1/tiktok/profile?handle=${encodeURIComponent(cleanHandle)}`, {
      headers: { "x-api-key": scrapeKey },
    }),
    new Promise((_, rej) => setTimeout(() => rej(new Error("TIMEOUT")), 20000)),
  ]);
  const raw = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(res.status === 404 ? "NOT_FOUND" : `HTTP_${res.status}`);
    e.status = res.status;
    throw e;
  }
  onCreditUsed?.();
  return raw;
}

async function fetchTikTokVideosRaw(cleanHandle, scrapeKey, onCreditUsed) {
  try {
    const res = await Promise.race([
      fetch(`https://api.scrapecreators.com/v3/tiktok/profile/videos?handle=${encodeURIComponent(cleanHandle)}`, {
        headers: { "x-api-key": scrapeKey },
      }),
      new Promise((_, rej) => setTimeout(() => rej(new Error("TIMEOUT")), 20000)),
    ]);
    if (!res.ok) return null;
    onCreditUsed?.();
    return await res.json().catch(() => null);
  } catch {
    return null;
  }
}

/** Full ScrapeCreators + optional IB-Ai pipeline for one handle (TikTok + videos + IG + AI). onStep(id) fires after each phase starts. opts.skipAi: skip Anthropic. opts.instagramHandle: override IG handle. opts.existingInstagramData: merge base for IG errors. */
async function runScrapeAndAiPipeline(cleanHandle, scrapeKey, aiKey, onStep, opts) {
  const out = await runElevenPlatformEnrichmentPipeline(cleanHandle, scrapeKey, aiKey, onStep, opts);
  return {
    user: out.user,
    stats: out.stats,
    ttData: out.ttData,
    igData: out.igData,
    aiAnalysis: out.aiAnalysis,
    engagementRate: out.engagementRate,
    videoDescriptions: out.videoDescriptions,
    nickname: out.nickname,
    notes: out.notes,
    tiktokShopData: out.tiktokShopData,
    youtubeData: out.youtubeData,
    twitterData: out.twitterData,
    linkedinData: out.linkedinData,
    snapchatData: out.snapchatData,
    facebookData: out.facebookData,
    tiktokRecentVideos: out.tiktokRecentVideos,
    tiktokBestVideo: out.tiktokBestVideo,
    tiktokAvgViews: out.tiktokAvgViews,
    tiktokAvgLikes: out.tiktokAvgLikes,
    tiktokAvgComments: out.tiktokAvgComments,
    tiktokAvgShares: out.tiktokAvgShares,
    tiktokEngRate: out.tiktokEngRate,
    instagramRecentPosts: out.instagramRecentPosts,
    instagramRecentReels: out.instagramRecentReels,
    instagramAvgLikes: out.instagramAvgLikes,
    instagramAvgComments: out.instagramAvgComments,
    instagramEngRate: out.instagramEngRate,
    platformsFound: out.platformsFound,
    discoveredYoutubeHandle: out.discoveredYoutubeHandle,
    discoveredTwitterHandle: out.discoveredTwitterHandle,
  };
}

/** Sort numeric metrics; null/invalid always sort to the bottom. */
function cmpMetric(a, b, getVal, dir) {
  const naRaw = getVal(a);
  const nbRaw = getVal(b);
  const na = naRaw != null && !Number.isNaN(Number(naRaw)) ? Number(naRaw) : null;
  const nb = nbRaw != null && !Number.isNaN(Number(nbRaw)) ? Number(nbRaw) : null;
  if (na == null && nb == null) return 0;
  if (na == null) return 1;
  if (nb == null) return -1;
  if (na < nb) return dir === "asc" ? -1 : 1;
  if (na > nb) return dir === "asc" ? 1 : -1;
  return 0;
}

function sortCreatorsForDisplay(arr) {
  const order = { Active: 0, "One-time": 1, "Off-boarded": 2 };
  return [...arr].sort((a, b) => {
    const ao = order[a.status] ?? 99;
    const bo = order[b.status] ?? 99;
    if (ao !== bo) return ao - bo;
    return creatorDisplayVideoCount(b) - creatorDisplayVideoCount(a);
  });
}

/** @param {"videos"|"name"|"handle"|"recent"|"status"} sortKey */
function sortCreatorsList(arr, sortKey) {
  const list = [...arr];
  const statusOrder = { Active: 0, "One-time": 1, "Off-boarded": 2 };
  const nameKey = (c) => (c.name || "").trim().toLowerCase() || String(c.handle || "").toLowerCase();
  switch (sortKey) {
    case "videos":
      return list.sort((a, b) => creatorDisplayVideoCount(b) - creatorDisplayVideoCount(a));
    case "name":
      return list.sort((a, b) => nameKey(a).localeCompare(nameKey(b)));
    case "handle":
      return list.sort((a, b) => String(a.handle || "").localeCompare(String(b.handle || ""), undefined, { sensitivity: "base" }));
    case "recent":
      return list.sort((a, b) => {
        const db = new Date(b.dateAdded || 0).getTime();
        const da = new Date(a.dateAdded || 0).getTime();
        return db - da;
      });
    case "status":
      return list.sort((a, b) => {
        const ao = statusOrder[a.status] ?? 99;
        const bo = statusOrder[b.status] ?? 99;
        if (ao !== bo) return ao - bo;
        return String(a.handle || "").localeCompare(String(b.handle || ""));
      });
    default:
      return sortCreatorsForDisplay(list);
  }
}

// genShareId moved to utils/helpers.js

// ═══ Brief form constants (PLATFORMS, MANAGERS, etc.) moved to ./components/BriefGenerator.jsx ═══

// ═══ BriefGenerator functions moved to ./components/BriefGenerator.jsx ═══
// ═══ Creator Portal components moved to ./components/CreatorPortal.jsx ═══

// ═══════════════════════════════════════════════════════════
// DASHBOARD / TOOLS — Video Reformatter
// ═══════════════════════════════════════════════════════════

function ComingSoonPage({ title, message, onBack }) {
  const { t, S } = useContext(ThemeContext);
  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 24px 80px", animation: "fadeIn 0.3s ease" }}>
      <button type="button" onClick={onBack} style={{ ...S.btnS, fontSize: 13, padding: "9px 18px", marginBottom: 24 }}>← Back</button>
      <div
        style={{
          background: t.card,
          border: `1px solid ${t.border}`,
          borderRadius: 16,
          padding: 36,
          boxShadow: t.shadow,
          textAlign: "center",
        }}
      >
        <div style={{ marginBottom: 16, display: "flex", justifyContent: "center" }}><Icon name="construction" size={40} color={t.orange} /></div>
        <div style={{ fontSize: 13, fontWeight: 700, color: t.orange, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>Coming Soon</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: t.text, marginBottom: 14 }}>{title}</div>
        <div style={{ fontSize: 15, color: t.textMuted, lineHeight: 1.65 }}>{message}</div>
      </div>
    </div>
  );
}

function ToolsPage({ onBack, onOpenVideo }) {
  const { t, S } = useContext(ThemeContext);
  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "40px 24px 80px", animation: "fadeIn 0.3s ease" }}>
      <button type="button" onClick={onBack} style={{ ...S.btnS, fontSize: 13, padding: "9px 18px", marginBottom: 24 }}>← Back</button>
      <div style={{ fontSize: 24, fontWeight: 800, color: t.text, marginBottom: 8 }}>Tools</div>
      <div style={{ fontSize: 14, color: t.textMuted, marginBottom: 28 }}>Utilities for creators and media.</div>
      <div
        onClick={onOpenVideo}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.blue; e.currentTarget.style.boxShadow = `0 4px 16px ${t.blue}15`; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.blue + "60"; e.currentTarget.style.boxShadow = `0 2px 8px ${t.blue}08`; }}
        style={{
          background: t.card,
          border: `2px solid ${t.blue}60`,
          borderRadius: 14,
          padding: 22,
          cursor: "pointer",
          boxShadow: `0 2px 8px ${t.blue}08`,
          transition: "border-color 0.2s, box-shadow 0.2s",
        }}
      >
        <div style={{ marginBottom: 14 }}><CardIcon type="video" color={t.blue} /></div>
        <div style={{ fontSize: 18, fontWeight: 700, color: t.text, marginBottom: 4 }}>Video Reformatter</div>
        <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.55 }}>
          Paste a TikTok or Instagram URL or upload a file — download the original and use the ad format reference for Meta, YouTube, and TikTok placements
        </div>
      </div>
    </div>
  );
}

// ═══ VideoReformatter moved to ./components/VideoReformatter.jsx ═══
function pickBestContentHighlight(c) {
  const tt = c.tiktokBestVideo || c.tiktokData?.bestVideo || null;
  const posts = c.instagramRecentPosts || [];
  let topIg = null;
  let bestIg = -1;
  for (const p of posts) {
    const s = (Number(p.likes) || 0) + (Number(p.comments) || 0);
    if (s > bestIg) {
      bestIg = s;
      topIg = p;
    }
  }
  if (!tt && !topIg) return null;
  if (!tt) {
    return {
      kind: "ig",
      views: null,
      likes: topIg.likes,
      comments: topIg.comments,
      caption: topIg.caption || "",
      url: topIg.url || "",
    };
  }
  if (!topIg) {
    return { kind: "tt", views: tt.views, likes: tt.likes, comments: tt.comments, caption: tt.caption || "", url: tt.url || "" };
  }
  const igScore = (topIg.likes || 0) + (topIg.comments || 0);
  if ((tt.views || 0) >= igScore * 100) {
    return { kind: "tt", views: tt.views, likes: tt.likes, comments: tt.comments, caption: tt.caption || "", url: tt.url || "" };
  }
  return {
    kind: "ig",
    views: null,
    likes: topIg.likes,
    comments: topIg.comments,
    caption: topIg.caption || "",
    url: topIg.url || "",
  };
}

function ExpandableInsight({ t, label, value, valueColor, valueFontSize = 14, explanation, isAi = false }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: t.textFaint, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</div>
      <div
        onClick={() => setOpen(!open)}
        style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
      >
        {isAi ? <span style={{ fontSize: 10, color: t.green }}>✦</span> : null}
        <span style={{ fontSize: valueFontSize, fontWeight: 700, color: valueColor || t.text }}>{value}</span>
        <span style={{ fontSize: 10, color: t.textFaint, transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0)" }}>▼</span>
      </div>
      {open ? (
        <div style={{ marginTop: 8, padding: 10, background: t.cardAlt, borderRadius: 6, fontSize: 12, color: t.textMuted, lineHeight: 1.5, border: `1px solid ${t.border}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.textFaint, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>How IB-Ai determined this</div>
          {explanation}
        </div>
      ) : null}
    </div>
  );
}

function PlatformCard({ t, platform, brandColor, handle, url, followers, followerLabel = "followers", secondaryText, extraInfo, badges, onHandleChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(handle || "");

  useEffect(() => { setDraft(handle || ""); }, [handle]);

  const hasFollowers = followers != null && followers > 0;

  return (
    <div
      style={{
        flex: "1 1 160px", minWidth: 160,
        background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: 14,
        cursor: url && !editing ? "pointer" : "default",
        transition: "border-color 0.15s",
      }}
      onClick={() => { if (url && !editing) window.open(url, "_blank"); }}
      onMouseEnter={(e) => { if (url && !editing) e.currentTarget.style.borderColor = brandColor + "50"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: brandColor }}>{platform}</span>
        <div style={{ display: "flex", gap: 4 }}>
          {url && !editing ? <span style={{ fontSize: 10, color: t.textFaint }}>↗</span> : null}
          <span
            onClick={(e) => { e.stopPropagation(); setEditing(!editing); if (editing) setDraft(handle || ""); }}
            style={{ fontSize: 10, color: t.textFaint, cursor: "pointer", padding: "0 2px" }}
            title="Edit handle"
          >✎</span>
        </div>
      </div>

      {/* Handle display or edit */}
      {!editing ? (
        <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 6 }}>@{handle || "not set"}</div>
      ) : (
        <div style={{ marginBottom: 6 }} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: "flex", gap: 4 }}>
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value.replace(/^@/, "").trim())}
              placeholder="handle"
              style={{ flex: 1, padding: "4px 8px", borderRadius: 6, border: `1px solid ${brandColor}40`, background: t.inputBg, color: t.inputText, fontSize: 11, outline: "none" }}
              onKeyDown={(e) => {
                if (e.key === "Enter") { onHandleChange?.(draft); setEditing(false); }
                if (e.key === "Escape") { setDraft(handle || ""); setEditing(false); }
              }}
            />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onHandleChange?.(draft); setEditing(false); }}
              style={{ padding: "4px 8px", borderRadius: 6, border: "none", background: brandColor, color: "#fff", fontSize: 10, fontWeight: 700, cursor: "pointer" }}
            >Save</button>
          </div>
          <div style={{ fontSize: 9, color: t.textFaint, marginTop: 2 }}>Enter to save · Esc to cancel</div>
        </div>
      )}

      {/* Followers */}
      <div style={{ fontSize: 22, fontWeight: 800, color: t.text, marginBottom: 2 }}>
        {hasFollowers ? formatMetricShort(followers) : "—"}
      </div>
      <div style={{ fontSize: 11, color: t.textFaint, marginBottom: 4 }}>{followerLabel}</div>

      {/* Secondary */}
      {secondaryText ? <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.4 }}>{secondaryText}</div> : null}
      {Array.isArray(badges) && badges.filter(Boolean).length ? (
        <div style={{ fontSize: 10, color: t.textFaint, marginTop: 4, lineHeight: 1.35 }}>{badges.filter(Boolean).join(" · ")}</div>
      ) : null}
      {extraInfo ? <div style={{ fontSize: 11, color: brandColor, marginTop: 4, fontWeight: 600 }}>{extraInfo}</div> : null}
    </div>
  );
}

class CreatorDetailErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { error: error.message || String(error) };
  }
  componentDidCatch(error, errorInfo) {
    console.error("[CreatorDetail] Crash:", error, errorInfo);
    this.setState({ errorInfo });
  }
  render() {
    if (this.state.error) {
      const t = this.props.t || { card: "#fff", border: "#e2ded4", text: "#111", textMuted: "#888", green: "#00b87d", red: "#ef4444", shadow: "0 2px 8px rgba(0,0,0,0.04)" };
      return (
        <div style={{ maxWidth: 700, margin: "40px auto", padding: "0 24px" }}>
          <div style={{ background: t.card, border: "1px solid " + t.border, borderRadius: 12, padding: 24, boxShadow: t.shadow }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: t.red || "#ef4444", marginBottom: 8 }}>Creator profile crashed</div>
            <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 16 }}>This is a bug — the error has been logged. Try going back and clicking the creator again.</div>
            <pre style={{ background: t.inputBg, color: "#f97316", padding: 16, borderRadius: 8, fontSize: 11, overflow: "auto", maxHeight: 200, marginBottom: 16 }}>{this.state.error}</pre>
            <button onClick={() => { this.setState({ error: null, errorInfo: null }); window.history.back(); }} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: t.green, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Go back</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function CreatorDetailView({ c, updateCreator, library, navigate, scrapeKey, apiKey, t, S, onScrapeCreditUsed = () => {}, setDbError, aiKnowledge, teamMembers = [], setTeamMembers = () => {}, getCreatorOwners = () => [], creatorAssignments = [], setCreatorAssignments = () => {} }) {
  const ak = mergeAiKnowledge(aiKnowledge);
  const [showVideoForm, setShowVideoForm] = useState(false);
  const [videoDraft, setVideoDraft] = useState({
    url: "",
    campaign: "",
    platform: "TikTok",
    status: "live",
    notes: "",
    date: new Date().toISOString().slice(0, 10),
    views: "",
  });
  const [enriching, setEnriching] = useState(false);
  const [enrichMsg, setEnrichMsg] = useState(null);
  const [enrichStepMap, setEnrichStepMap] = useState(null);
  const [expandedBar, setExpandedBar] = useState(null);
  const [expandedRate, setExpandedRate] = useState(null);
  const [ownerDropdownOpen, setOwnerDropdownOpen] = useState(false);
  const [igPullBusy, setIgPullBusy] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [msgConv, setMsgConv] = useState(null);
  const [msgList, setMsgList] = useState([]);
  const [msgTemplates, setMsgTemplates] = useState([]);
  const [msgCompose, setMsgCompose] = useState("");
  const [msgSubject, setMsgSubject] = useState("");
  const [msgChannel, setMsgChannel] = useState("email");
  const [msgSending, setMsgSending] = useState(false);
  const [msgDrafting, setMsgDrafting] = useState(false);
  const [msgSelTemplate, setMsgSelTemplate] = useState("");
  const msgEndRef = useRef(null);

  useEffect(() => {
    if (!ownerDropdownOpen) return;
    const handler = () => { setOwnerDropdownOpen(false); };
    setTimeout(() => document.addEventListener("click", handler), 0);
    return () => document.removeEventListener("click", handler);
  }, [ownerDropdownOpen]);

  useEffect(() => {
    if (!enriching) return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = "Enrichment is still running. Data may be lost if you leave.";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [enriching]);

  const campaignNames = useMemo(() => {
    const s = new Set();
    (library || []).forEach((item) => {
      const n = (item.formData?.campaignName || "").trim();
      if (n) s.add(n);
    });
    return [...s].sort();
  }, [library]);

  const activeCampaignCount = useMemo(() => {
    const logs = Array.isArray(c.videoLog) ? c.videoLog : [];
    const names = new Set();
    logs.forEach((v) => {
      if (String(v.status || "").toLowerCase() === "live" && (v.campaign || "").trim()) names.add(v.campaign.trim());
    });
    return names.size;
  }, [c.videoLog]);

  const ttUrl = c.tiktokUrl?.trim() || tiktokUrlFromHandle(c.tiktokHandle || c.handle);
  const videoCount = creatorDisplayVideoCount(c);
  const ttD = c.tiktokData || {};
  const igD = c.instagramData || {};
  const primaryPlatform = "instagram";
  const cleanHandle = String(c.handle || "").replace(/^@/, "").trim();
  const ttH = String(c.tiktokHandle || cleanHandle).replace(/^@/, "").trim();
  const igH = String(c.instagramHandle || cleanHandle).replace(/^@/, "").trim();
  const platformLinks = {
    instagram: igH ? `https://www.instagram.com/${igH}/` : "",
    tiktok: ttH ? `https://www.tiktok.com/@${ttH}` : "",
    youtube: c.youtubeData?.channelUrl || (c.youtubeHandle ? `https://youtube.com/@${c.youtubeHandle}` : ""),
    twitter: c.twitterData?.handle ? `https://x.com/${c.twitterData.handle}` : (c.twitterHandle ? `https://x.com/${c.twitterHandle}` : ""),
    facebook: c.facebookData?.profileUrl || "",
    linkedin: c.linkedinData?.profileUrl || "",
  };
  const primaryUrl = primaryPlatform === "instagram" ? platformLinks.instagram : platformLinks.tiktok;
  const primaryLabel = primaryPlatform === "instagram" ? "IG" : "TT";
  const lastEnriched = ttD.lastEnriched || igD.lastEnriched;
  const handleLetter = String(c.handle || "?").replace(/^@/, "").slice(0, 1).toUpperCase();
  const hasTTEnrichment = !!ttD.lastEnriched;
  const lastEnrichDateLabel = hasTTEnrichment
    ? new Date(ttD.lastEnriched).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : null;
  const freshness = creatorDataFreshness(ttD.lastEnriched, t);
  const creatorSince = formatCreatorSinceLabel(ttD.accountCreated);
  const lastEnrichedIso = ttD.lastEnriched || igD.lastEnriched;
  const lastEnrichedDisplay = lastEnrichedIso
    ? new Date(lastEnrichedIso).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : null;
  const pullInstagramOnly = async () => {
    const key = (scrapeKey || "").trim() || (typeof localStorage !== "undefined" ? localStorage.getItem("intake-scrape-key") : "") || "";
    if (!key.trim()) {
      alert("Add your ScrapeCreators API key in Settings");
      return;
    }
    const igH = (c.instagramHandle || cleanHandle || "").replace(/^@/, "").trim() || cleanHandle;
    setIgPullBusy(true);
    try {
      const merged = { ...DEFAULT_INSTAGRAM_DATA, ...(c.instagramData || {}) };
      const ig = await fetchInstagramEnrichment(igH, key.trim(), merged, onScrapeCreditUsed);
      updateCreator(c.id, { instagramData: { ...merged, ...ig } });
    } finally {
      setIgPullBusy(false);
    }
  };

  const onInstagramHandleBlur = async (e) => {
    const v = e.target.value.replace(/^@/, "").trim();
    const resolved = v || cleanHandle;
    updateCreator(c.id, { instagramHandle: resolved });
    const key = (scrapeKey || "").trim() || (typeof localStorage !== "undefined" ? localStorage.getItem("intake-scrape-key") : "") || "";
    if (!key.trim()) return;
    setIgPullBusy(true);
    try {
      const merged = { ...DEFAULT_INSTAGRAM_DATA, ...(c.instagramData || {}) };
      const ig = await fetchInstagramEnrichment(resolved, key.trim(), merged, onScrapeCreditUsed);
      updateCreator(c.id, { instagramData: { ...merged, ...ig } });
    } finally {
      setIgPullBusy(false);
    }
  };

  const runFullEnrich = async (forceRefresh = false) => {
    const key = (scrapeKey || "").trim() || (typeof localStorage !== "undefined" ? localStorage.getItem("intake-scrape-key") : "") || "";
    const ak = (apiKey || "").trim() || (typeof localStorage !== "undefined" ? localStorage.getItem("intake-apikey") : "") || "";
    if (!key.trim()) {
      alert("Add your ScrapeCreators API key in Settings");
      return;
    }
    if (!forceRefresh && ttD.lastEnriched) {
      const hoursSince = (Date.now() - new Date(ttD.lastEnriched).getTime()) / (1000 * 60 * 60);
      if (hoursSince < 24) {
        alert(`Already enriched ${Math.round(hoursSince)} hours ago. Click "Refresh" to re-pull.`);
        return;
      }
    }
    setEnriching(true);
    setEnrichMsg(null);
    setEnrichStepMap(Object.fromEntries(ENRICH_STEPS.map((s) => [s.id, "pending"])));
    const onStep = (id, status) => {
      setEnrichStepMap((prev) => ({ ...prev, [id]: status === "ok" ? "ok" : status === "fail" ? "fail" : status === "skip" ? "skip" : status === "run" ? "run" : "pending" }));
    };
    try {
      const payload = await runScrapeAndAiPipeline(cleanHandle, key.trim(), ak, onStep, {
        tiktokHandle: c.tiktokHandle || cleanHandle,
        instagramHandle: c.instagramHandle || cleanHandle,
        youtubeHandle: c.youtubeHandle || "",
        twitterHandle: c.twitterHandle || "",
        existingInstagramData: c.instagramData,
        onCreditUsed: onScrapeCreditUsed,
        brandContext: aiKnowledge?.brandContext,
        aiKnowledge,
      });
      const patch = payload.aiAnalysis ? mergeAiFieldsIntoExisting(c, payload.aiAnalysis) : {};
      const platformUpdate = {
        tiktokData: { ...DEFAULT_TIKTOK_DATA, ...(c.tiktokData || {}), ...payload.ttData },
        instagramData: { ...DEFAULT_INSTAGRAM_DATA, ...(c.instagramData || {}), ...payload.igData },
        tiktokBestVideo: payload.tiktokBestVideo ?? c.tiktokBestVideo,
        engagementRate: payload.engagementRate,
        tiktokEngRate: payload.tiktokEngRate,
        instagramEngRate: payload.instagramEngRate,
        instagramAvgLikes: payload.instagramAvgLikes,
        instagramAvgComments: payload.instagramAvgComments,
        instagramRecentPosts: payload.instagramRecentPosts,
        instagramRecentReels: payload.instagramRecentReels,
        tiktokShopData: payload.tiktokShopData,
        youtubeData: payload.youtubeData || c.youtubeData,
        twitterData: payload.twitterData || c.twitterData,
        linkedinData: payload.linkedinData || c.linkedinData,
        snapchatData: payload.snapchatData || c.snapchatData,
        facebookData: payload.facebookData || c.facebookData,
        lastEnriched: new Date().toISOString(),
      };
      const mergedCreator = { ...c, ...platformUpdate, ...patch };
      const cpmExtra = enrichPatchWithCpm(c, patch, mergedCreator, ak);
      const nameExtra = !c.name?.trim() && payload.nickname ? { name: payload.nickname } : {};
      const fullUpdate = {
        ...platformUpdate,
        ...patch,
        ...cpmExtra,
        ...nameExtra,
      };
      if (payload.discoveredYoutubeHandle && !c.youtubeHandle) {
        fullUpdate.youtubeHandle = payload.discoveredYoutubeHandle;
      }
      if (payload.youtubeData?.title && !String(fullUpdate.youtubeHandle || c.youtubeHandle || "").trim()) {
        fullUpdate.youtubeHandle = cleanHandle;
      }
      if (payload.discoveredTwitterHandle && !c.twitterHandle) {
        fullUpdate.twitterHandle = payload.discoveredTwitterHandle;
      }
      updateCreator(c.id, fullUpdate);

      // Thumbnails already stored inside pipeline — no need to re-store here

      const hasNotesAfter = String(fullUpdate.notes ?? c.notes ?? "").trim();
      if (!hasNotesAfter && payload.aiAnalysis) {
        const autoNotes = buildAutoNotesFromAi(payload.aiAnalysis);
        if (autoNotes.trim()) {
          updateCreator(c.id, { notes: autoNotes.trim() });
        }
      }
      const pf = payload.platformsFound ?? 0;
      const ib = payload.aiAnalysis?.ibScore;
      setEnrichMsg(
        `Enrichment complete — ${pf}/11 platforms found · ${ib != null ? `${ib} IB Score` : "— IB Score"}`
      );

      const mergedForRetry = { ...c, ...fullUpdate };
      setTimeout(async () => {
        try {
          const { data: check, error: checkErr } = await supabase
            .from("creators")
            .select("tiktok_data, instagram_data, ib_score, last_enriched")
            .eq("id", c.id)
            .single();

          if (checkErr) {
            console.error("[enrich-verify] Read error:", checkErr);
            setEnrichMsg((prev) => `${prev || ""} ⚠️ Could not verify save.`);
            return;
          }

          if (!check.tiktok_data && !check.instagram_data && !check.ib_score) {
            console.error("[enrich-verify] DATA NOT PERSISTED. Retrying...");
            setEnrichMsg((prev) => `${prev || ""} ⚠️ Retrying save...`);

            const retryRow = creatorToRow(mergedForRetry);
            const { error: retryErr } = await supabase.from("creators").update(retryRow).eq("id", c.id);

            if (retryErr) {
              console.error("[enrich-verify] RETRY FAILED:", retryErr.message, retryErr.code, retryErr.details);
              setEnrichMsg(
                `Enrichment data FAILED to save: ${retryErr.message}. Screenshot this and report it.`
              );
              setDbError(`Enrichment save failed for ${c.handle}: ${retryErr.message}`);
            } else {
              console.log("[enrich-verify] Retry succeeded.");
              setEnrichMsg((prev) => prev.replace("⚠️ Retrying save...", "✓ Data saved on retry."));
            }
          } else {
            console.log("[enrich-verify] ✓ Data persisted:", {
              ib: check.ib_score,
              tt: !!check.tiktok_data,
              ig: !!check.instagram_data,
            });
          }
        } catch (e) {
          console.error("[enrich-verify] Exception:", e);
        }
      }, 3000);
    } catch (err) {
      setEnrichMsg(err.message || "Enrichment failed.");
    } finally {
      setEnriching(false);
      setEnrichStepMap(null);
    }
  };

  const refreshProfile = async () => {
    if (!window.confirm("This will use up to 11 ScrapeCreators API credits plus IB-Ai. Continue?")) return;
    await runFullEnrich(true);
  };

  const reanalyzeOnly = async () => {
    const liveKey = (apiKey || "").trim() || (typeof localStorage !== "undefined" ? localStorage.getItem("intake-apikey") : "") || "";
    if (!liveKey.trim()) {
      alert("Add your Anthropic API key in Settings to enable IB Score");
      return;
    }
    setEnriching(true);
    setEnrichMsg("IB-Ai calculating IB Score…");
    try {
      const tt = c.tiktokData || {};
      const ig = c.instagramData || {};
      const ai = await runIbScoreClaude({
        apiKey: liveKey.trim(),
        brandContext: ak.brandContext,
        aiKnowledge: ak,
        cleanHandle,
        tiktokData: tt,
        instagramData: ig,
        tiktokShopData: c.tiktokShopData,
        ttCaptions: (Array.isArray(c.tiktokData?.recentVideos) ? c.tiktokData.recentVideos : []).slice(0, 5).map((v) => v.caption).filter(Boolean).join(" | "),
        igCaptions: (c.instagramRecentPosts || []).slice(0, 5).map((p) => p.caption).filter(Boolean).join(" | "),
        igEngRate: c.instagramEngRate,
        ttEngRate: c.tiktokEngRate,
        igAvgLikes: c.instagramAvgLikes,
        igAvgComments: c.instagramAvgComments,
        igRecentReels: c.instagramRecentReels || [],
        youtubeData: c.youtubeData,
        twitterData: c.twitterData,
        linkedinData: c.linkedinData,
        facebookData: c.facebookData,
        snapchatData: c.snapchatData,
      });
      if (ai) {
        const patch = mergeAiFieldsIntoExisting(c, ai);
        const mergedCreator = { ...c, ...patch };
        const row = { ...patch, ...enrichPatchWithCpm(c, patch, mergedCreator, ak) };
        updateCreator(c.id, row);
        const hasNotesAfter = String(row.notes ?? c.notes ?? "").trim();
        if (!hasNotesAfter) {
          const autoNotes = buildAutoNotesFromAi(ai);
          if (autoNotes.trim()) {
            updateCreator(c.id, { notes: autoNotes.trim() });
          }
        }
        setEnrichMsg("IB Score updated.");
      } else {
        setEnrichMsg("Could not parse AI response.");
      }
    } catch (err) {
      setEnrichMsg(err.message || "Re-analyze failed.");
    } finally {
      setEnriching(false);
    }
  };

  const saveVideoLogEntry = () => {
    const id = `v-${Date.now()}`;
    const entry = {
      id,
      url: videoDraft.url.trim(),
      campaign: videoDraft.campaign.trim(),
      date: videoDraft.date,
      platform: videoDraft.platform,
      status: videoDraft.status,
      views: Number(videoDraft.views) || 0,
      notes: videoDraft.notes.trim(),
    };
    const prevLog = Array.isArray(c.videoLog) ? c.videoLog : [];
    const videoLog = [...prevLog, entry];
    const totalVideos = Math.max(videoLog.length, Number(c.totalVideos) || 0);
    updateCreator(c.id, { videoLog, totalVideos });
    setShowVideoForm(false);
    setVideoDraft({
      url: "",
      campaign: "",
      platform: "TikTok",
      status: "live",
      notes: "",
      date: new Date().toISOString().slice(0, 10),
      views: "",
    });
  };

  const statusPill = (status) => {
    const st = String(status || "").toLowerCase();
    if (st === "live") return { bg: t.green + "18", color: t.green, border: t.green + "35", label: "Live" };
    if (st === "in_review") return { bg: t.orange + "18", color: t.orange, border: t.orange + "35", label: "In Review" };
    return { bg: t.cardAlt, color: t.textFaint, border: t.border, label: "Draft" };
  };

  const pillLink = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    fontWeight: 600,
    color: t.textMuted,
    textDecoration: "none",
    padding: "8px 12px",
    borderRadius: 8,
    border: `1px solid ${t.border}`,
    background: t.cardAlt,
    cursor: "pointer",
  };


  const ib = c.ibScore != null ? Number(c.ibScore) : null;
  const ibLabel = c.ibScoreLabel || c.aiAnalysis?.scoreLabel || "";
  const ibCol = ibScoreTierColor(ib);
  const br = c.ibScoreBreakdown || c.aiAnalysis?.scoreBreakdown || {};
  const ai = c.aiAnalysis || {};
  const ytD = c.youtubeData || {};
  const twD = c.twitterData || {};
  const liD = c.linkedinData || {};
  const snD = c.snapchatData || {};
  const fbD = c.facebookData || {};
  const shop = c.tiktokShopData || {};
  const af = c.aiAutoFilled || { niche: false, quality: false, costPerVideo: false };
  const openMessages = async () => {
    setShowMessages(true);
    if (!msgConv) {
      const conv = await dbGetOrCreateConversation(c.id);
      setMsgConv(conv);
      if (conv) { const msgs = await dbLoadMessages(conv.id); setMsgList(msgs); }
      const tmpls = await dbLoadTemplates();
      setMsgTemplates(tmpls);
    }
  };
  const sendMsg = async (status) => {
    if (!msgCompose.trim() || !msgConv) return;
    setMsgSending(true);
    const result = await dbSaveMessage({ conversation_id: msgConv.id, creator_id: c.id, direction: "outbound", channel: msgChannel, subject: msgSubject, body: msgCompose.trim(), status, sent_at: status === "sent" ? new Date().toISOString() : null, template_id: msgSelTemplate || null });
    if (!result.error && result.data) { setMsgList(prev => [...prev, result.data]); setMsgCompose(""); setMsgSubject(""); setMsgSelTemplate(""); await dbUpdateConversation(msgConv.id, { last_message_at: new Date().toISOString() }); if (status === "sent") { notifySlack("message_sent", { creatorHandle: c.tiktokHandle || c.instagramHandle || c.handle, channel: msgChannel, subject: msgSubject, sentBy: "Team", aiGenerated: !!msgSelTemplate }); notifyOwners(c.id, c.tiktokHandle || c.instagramHandle || c.handle, "message_sent", { subject: msgSubject, sentByName: "Team" }); } }
    setMsgSending(false);
  };
  const addMsgNote = async () => {
    if (!msgCompose.trim() || !msgConv) return;
    setMsgSending(true);
    const result = await dbSaveMessage({ conversation_id: msgConv.id, creator_id: c.id, direction: "internal_note", channel: "manual", body: msgCompose.trim(), status: "sent", sent_at: new Date().toISOString() });
    if (!result.error && result.data) { setMsgList(prev => [...prev, result.data]); setMsgCompose(""); }
    setMsgSending(false);
  };
  const draftMsgWithAi = async () => {
    setMsgDrafting(true);
    try {
      const apiKey = await dbGetSetting("anthropic-api-key");
      if (!apiKey) { alert("No API key."); setMsgDrafting(false); return; }
      const cn = c.tiktokData?.displayName || c.instagramData?.fullName || c.handle || "Creator";
      const ch = c.tiktokHandle || c.instagramHandle || c.handle || "";
      const prev = msgList.slice(-5).map(m => m.direction + ": " + m.body.substring(0, 200)).join("\n");
      const prompt = "You are a creator partnerships manager at Intake Breathing. Write a friendly, authentic outreach message to a TikTok/Instagram creator. Reference their specific content. Keep under 150 words.\n\nCREATOR: " + cn + " (@" + ch + ")\nTikTok followers: " + (c.tiktokData?.followers || "unknown") + "\nIG followers: " + (c.instagramData?.followers || "unknown") + "\nIB Score: " + (c.ibScore?.overall || "not scored") + "\n" + (prev ? "\nPREVIOUS MESSAGES:\n" + prev : "First outreach.") + "\n\nWrite ONLY the message body.";
      const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" }, body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 500, messages: [{ role: "user", content: prompt }] }) });
      if (!res.ok) throw new Error("API " + res.status);
      const data = await res.json();
      setMsgCompose(data.content?.[0]?.text || "");
      if (!msgSubject) setMsgSubject("Partnership opportunity with Intake Breathing");
      notifyOwners(c.id, c.tiktokHandle || c.instagramHandle || c.handle, "draft_ready");
    } catch (e) { alert("AI draft failed: " + e.message); }
    setMsgDrafting(false);
  };
  useEffect(() => { if (showMessages) msgEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgList, showMessages]);

  const bestHighlight = useMemo(() => pickBestContentHighlight(c), [c]);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px 60px", animation: "fadeIn 0.3s ease" }}>
      {enriching && enrichStepMap ? (
        <div style={{ marginBottom: 16, padding: 14, background: t.cardAlt, borderRadius: 12, border: `1px solid ${t.border}` }}>
          {ENRICH_STEPS.map((step) => {
            const st = enrichStepMap[step.id];
            return (
              <div key={step.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, fontSize: 12, color: st === "ok" ? t.green : st === "fail" ? t.red : t.textFaint }}>
                <span style={{ width: 16 }}>{st === "ok" ? "✓" : st === "fail" ? "✗" : "…"}</span>
                {step.label}
              </div>
            );
          })}
        </div>
      ) : null}

      {/* CARD: Profile header */}
      <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: "1 1 240px", minWidth: 0 }}>
          {(() => {
            const attempts = buildAvatarSrcAttempts(c);

            if (attempts.length === 0) {
              return (
                <div style={{ width: 48, height: 48, borderRadius: 24, background: t.cardAlt, border: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: t.textFaint, flexShrink: 0 }}>
                  {handleLetter}
                </div>
              );
            }

            return (
              <img
                src={attempts[0]}
                alt=""
                referrerPolicy="no-referrer"
                data-av-idx="0"
                style={{ width: 48, height: 48, borderRadius: 24, objectFit: "cover", background: t.cardAlt, border: `1px solid ${t.border}`, flexShrink: 0, display: "block" }}
                onError={(e) => {
                  const img = e.currentTarget;
                  const idx = Number(img.dataset.avIdx || 0) + 1;
                  if (idx < attempts.length) {
                    img.dataset.avIdx = String(idx);
                    img.src = attempts[idx];
                    return;
                  }
                  img.style.display = "none";
                  const parent = img.parentElement;
                  if (parent && !parent.querySelector("[data-avatar-fallback='true']")) {
                    const fallback = document.createElement("div");
                    fallback.setAttribute("data-avatar-fallback", "true");
                    fallback.style.cssText = `width:48px;height:48px;border-radius:24px;background:${t.cardAlt};border:1px solid ${t.border};display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;color:${t.textFaint};flex-shrink:0;`;
                    fallback.textContent = handleLetter;
                    parent.appendChild(fallback);
                  }
                }}
              />
            );
          })()}
          <div style={{ minWidth: 0 }}>
            <a href={primaryUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 22, fontWeight: 800, color: t.text, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
              {c.handle}
              <span style={{ fontSize: 9, fontWeight: 700, color: t.textFaint, padding: "2px 6px", borderRadius: 4, background: t.cardAlt, border: `1px solid ${t.border}` }}>{primaryLabel}</span>
            </a>
            {c.name?.trim() ? <div style={{ fontSize: 13, color: t.textMuted }}>{c.name.trim()}</div> : null}
            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 12, background: c.status === "Active" ? t.green + "18" : t.cardAlt, color: c.status === "Active" ? t.green : t.textMuted, marginTop: 4, display: "inline-block" }}>{c.status}</span>
            {creatorSince || lastEnrichedDisplay ? (
              <div style={{ fontSize: 12, color: t.textMuted, marginTop: 6, lineHeight: 1.45 }}>
                {creatorSince ? <span>Creator since {creatorSince}</span> : null}
                {creatorSince && lastEnrichedDisplay ? <span> · </span> : null}
                {lastEnrichedDisplay ? <span>Last enriched {lastEnrichedDisplay}</span> : null}
              </div>
            ) : null}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "0 0 auto" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: Number.isFinite(ib) ? ibCol : t.border, display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${t.border}` }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>{Number.isFinite(ib) ? Math.round(ib) : "—"}</span>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: ibCol, marginTop: 4 }}>{ibLabel || "IB Score"}</div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" onClick={() => navigate("creators")} style={{ ...S.btnS, padding: "9px 16px", fontSize: 13 }}>← Back</button>
          {!hasTTEnrichment ? (
            <button type="button" disabled={enriching} onClick={() => runFullEnrich(false)} style={{ ...S.btnP, padding: "9px 16px", fontSize: 13 }}>{enriching ? "…" : "Enrich Profile"}</button>
          ) : (
            <>
              <span style={{ fontSize: 11, color: t.textMuted }}>Last: {lastEnrichDateLabel}</span>
              <button type="button" disabled={enriching} onClick={refreshProfile} style={{ ...S.btnS, padding: "9px 14px", fontSize: 12 }}>Refresh Metrics</button>
            </>
          )}
        </div>
      </div>
      </div>

      <div style={{ background: t.card, border: "1px solid " + t.border, borderRadius: 12, padding: 16, marginBottom: 16, boxShadow: t.shadow }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: getCreatorOwners(c.id).length > 0 ? 10 : 0 }}>
          <div style={{ fontSize: 12, color: t.textFaint }}>Owned by</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setOwnerDropdownOpen(prev => !prev)} style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, border: "1px solid " + t.border, background: t.cardAlt, color: t.textMuted, cursor: "pointer" }}>+ Add</button>
            {ownerDropdownOpen ? (
              <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 4, zIndex: 50, background: t.card, border: "1px solid " + t.border, borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", minWidth: 220, overflow: "hidden", maxHeight: 300, overflowY: "auto" }}>
                {teamMembers.filter(m => !getCreatorOwners(c.id).find(o => o.id === m.id)).map(m => (
                  <div key={m.id} onClick={async () => { await dbAssignCreatorMulti(c.id, m.id, "manager"); setCreatorAssignments(prev => [...prev, { creator_id: c.id, team_member_id: m.id, assigned_at: new Date().toISOString() }]); setOwnerDropdownOpen(false); }} style={{ padding: "8px 12px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }} onMouseEnter={(e) => { e.currentTarget.style.background = t.cardAlt; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                    {m.avatar_url ? <img src={m.avatar_url} alt="" style={{ width: 24, height: 24, borderRadius: 12, objectFit: "cover", flexShrink: 0 }} onError={(e) => { e.target.style.display = "none"; }} /> : <div style={{ width: 24, height: 24, borderRadius: 12, background: t.green + "15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: t.green }}>{m.name?.[0]}</div>}
                    <div><div style={{ fontWeight: 600, color: t.text }}>{m.name}</div>{m.title ? <div style={{ fontSize: 10, color: t.textFaint }}>{m.title}</div> : null}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {getCreatorOwners(c.id).map(member => (
            <div key={member.id} style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "8px 14px 8px 8px", borderRadius: 12, background: t.green + "08", border: "1px solid " + t.green + "25", cursor: "pointer", transition: "all 0.2s" }}
              onClick={() => { const creatorUrl = "https://www.intakecreators.com/creator/" + c.id; const handle = c.handle || c.instagramHandle || c.tiktokHandle || "creator"; navigator.clipboard.writeText("Re: @" + handle + " — " + creatorUrl); if (member.slack_id) window.location.href = "slack://user?team=TFC94FVGF&id=" + member.slack_id; }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.green + "50"; e.currentTarget.style.background = t.green + "12"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.green + "25"; e.currentTarget.style.background = t.green + "08"; }}
              title={"Open Slack DM with " + member.name + " — creator link copied to clipboard"}>
              {member.avatar_url ? <img src={member.avatar_url} alt="" style={{ width: 32, height: 32, borderRadius: 16, objectFit: "cover", flexShrink: 0 }} onError={(e) => { e.target.style.display = "none"; }} /> : <div style={{ width: 32, height: 32, borderRadius: 16, background: t.green + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: t.green, flexShrink: 0 }}>{member.name?.[0]}</div>}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text, lineHeight: 1.2 }}>{member.name}</div>
                {member.title ? <div style={{ fontSize: 10, color: t.textFaint, lineHeight: 1.2 }}>{member.title}</div> : null}
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, opacity: 0.4 }}><path d="M14.5 2C13.1 2 12 3.1 12 4.5V9h4.5C17.9 9 19 7.9 19 6.5S17.9 4 16.5 4H14.5V2zM9.5 2C8.1 2 7 3.1 7 4.5S8.1 7 9.5 7H12V4.5C12 3.1 10.9 2 9.5 2zM4.5 9C3.1 9 2 10.1 2 11.5S3.1 14 4.5 14H9v-5H4.5zM9 15H4.5C3.1 15 2 16.1 2 17.5S3.1 20 4.5 20c1.4 0 2.5-1.1 2.5-2.5V15zM15 15v2.5c0 1.4 1.1 2.5 2.5 2.5S20 18.9 20 17.5 18.9 15 17.5 15H15zM15 9v5h4.5c1.4 0 2.5-1.1 2.5-2.5S20.9 9 19.5 9H15z" fill={t.textMuted} opacity="0.6"/></svg>
              <button onClick={(e) => { e.stopPropagation(); dbUnassignCreator(c.id, member.id); setCreatorAssignments(prev => prev.filter(a => !(a.creator_id === c.id && a.team_member_id === member.id))); }} style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px", fontSize: 14, color: t.textFaint, lineHeight: 1, borderRadius: 4, marginLeft: 2 }} title="Remove" onMouseEnter={(e) => { e.currentTarget.style.color = t.red || "#ef4444"; }} onMouseLeave={(e) => { e.currentTarget.style.color = t.textFaint; }}>×</button>
            </div>
          ))}
          {getCreatorOwners(c.id).length === 0 ? <span style={{ fontSize: 12, color: t.textFaint }}>Unassigned</span> : null}
        </div>
      </div>

      {/* Messages toggle */}
      <button onClick={openMessages} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "12px 16px", borderRadius: 12, marginBottom: showMessages ? 0 : 16, border: "1px solid " + (showMessages ? t.blue + "40" : t.border), background: showMessages ? t.blue + "08" : t.card, color: showMessages ? t.blue : t.textMuted, cursor: "pointer", fontSize: 13, fontWeight: 700, boxShadow: t.shadow, textAlign: "left", borderBottomLeftRadius: showMessages ? 0 : 12, borderBottomRightRadius: showMessages ? 0 : 12 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round"/></svg>
        Messages{msgList.length > 0 ? " (" + msgList.length + ")" : ""}
        <span style={{ marginLeft: "auto", fontSize: 10, color: t.textFaint }}>{showMessages ? "Hide" : "Show"}</span>
      </button>

      {showMessages ? (
        <div style={{ background: t.card, border: "1px solid " + t.blue + "40", borderTop: "none", borderRadius: "0 0 12px 12px", marginBottom: 16, boxShadow: t.shadow, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderBottom: "1px solid " + t.border, background: t.blue + "05" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Conversation with @{c.tiktokHandle || c.instagramHandle || c.handle}</div>
            <button onClick={() => setShowMessages(false)} style={{ background: "none", border: "none", fontSize: 16, color: t.textFaint, cursor: "pointer" }}>x</button>
          </div>
          <div style={{ maxHeight: 300, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            {msgList.length === 0 ? <div style={{ textAlign: "center", color: t.textFaint, padding: 20, fontSize: 12 }}>No messages yet. Start a conversation below.</div> : msgList.map(msg => {
              const isOut = msg.direction === "outbound"; const isNote = msg.direction === "internal_note";
              return (
                <div key={msg.id} style={{ maxWidth: isNote ? "100%" : "75%", alignSelf: isOut ? "flex-end" : isNote ? "center" : "flex-start", background: isNote ? (t.isLight ? "#fef9c3" : "#1a1a0a") : isOut ? t.green + "12" : (t.isLight ? "#f3f4f6" : "#1e1e1e"), border: "1px solid " + (isNote ? (t.isLight ? "#fde68a" : "#3d3d0f") : isOut ? t.green + "30" : t.border), borderRadius: 12, padding: "10px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, gap: 12 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: isNote ? (t.isLight ? "#92400e" : "#fbbf24") : isOut ? t.green : t.blue, textTransform: "uppercase" }}>{isNote ? "Note" : isOut ? "Sent via " + msg.channel : "Received"}</span>
                    <span style={{ fontSize: 9, color: t.textFaint }}>{msg.sent_at ? new Date(msg.sent_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Draft"}</span>
                  </div>
                  {msg.subject ? <div style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 4 }}>{msg.subject}</div> : null}
                  <div style={{ fontSize: 13, color: t.text, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{msg.body}</div>
                  <div style={{ textAlign: "right", marginTop: 4 }}><button onClick={async () => { if (window.confirm("Delete?")) { await dbDeleteMessage(msg.id); setMsgList(prev => prev.filter(m => m.id !== msg.id)); } }} style={{ background: "none", border: "none", color: t.textFaint, cursor: "pointer", fontSize: 9, opacity: 0.5 }}>delete</button></div>
                </div>
              );
            })}
            <div ref={msgEndRef} />
          </div>
          <div style={{ borderTop: "1px solid " + t.border, padding: "12px 16px", background: t.cardAlt }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <select value={msgSelTemplate} onChange={(e) => { if (e.target.value) { const tmpl = msgTemplates.find(tp => tp.id === e.target.value); if (tmpl) { let b = tmpl.body.replace(/\{\{creator_name\}\}/g, c.tiktokData?.displayName || c.handle || "").replace(/\{\{handle\}\}/g, c.tiktokHandle || c.handle || ""); setMsgCompose(b); setMsgSubject((tmpl.subject || "").replace(/\{\{creator_name\}\}/g, c.tiktokData?.displayName || c.handle || "")); } } setMsgSelTemplate(e.target.value); }} style={{ flex: 1, padding: "5px 10px", borderRadius: 6, border: "1px solid " + t.border, background: t.inputBg, color: t.inputText, fontSize: 11 }}>
                <option value="">Use a template...</option>
                {msgTemplates.map(tp => <option key={tp.id} value={tp.id}>{tp.name}</option>)}
              </select>
              <select value={msgChannel} onChange={(e) => setMsgChannel(e.target.value)} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid " + t.border, background: t.inputBg, color: t.inputText, fontSize: 11, width: 120 }}>
                <option value="email">Email</option><option value="instagram_dm">IG DM</option><option value="tiktok_dm">TT DM</option><option value="sms">SMS</option><option value="manual">Manual</option>
              </select>
            </div>
            {msgChannel === "email" ? <input value={msgSubject} onChange={(e) => setMsgSubject(e.target.value)} placeholder="Subject line..." style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid " + t.border, background: t.inputBg, color: t.inputText, fontSize: 12, marginBottom: 8, boxSizing: "border-box" }} /> : null}
            <textarea value={msgCompose} onChange={(e) => setMsgCompose(e.target.value)} placeholder={"Write a message to @" + (c.tiktokHandle || c.handle || "") + "..."} style={{ width: "100%", minHeight: 80, padding: "8px 12px", borderRadius: 8, border: "1px solid " + t.border, background: t.inputBg, color: t.inputText, fontSize: 12, resize: "vertical", boxSizing: "border-box", fontFamily: "inherit", lineHeight: 1.6 }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={draftMsgWithAi} disabled={msgDrafting} style={{ padding: "6px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600, border: "1px solid " + t.green + "40", background: t.green + "08", color: t.green, cursor: "pointer", opacity: msgDrafting ? 0.6 : 1 }}>{msgDrafting ? "Drafting..." : "Draft with IB-Ai"}</button>
                <button onClick={addMsgNote} disabled={!msgCompose.trim() || msgSending} style={{ padding: "6px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600, border: "1px solid " + (t.isLight ? "#fde68a" : "#3d3d0f"), background: t.isLight ? "#fef9c350" : "#1a1a0a", color: t.isLight ? "#92400e" : "#fbbf24", cursor: "pointer" }}>Save as note</button>
                <button onClick={async () => { if (!msgCompose.trim() || !msgConv) return; setMsgSending(true); const result = await dbSaveMessage({ conversation_id: msgConv.id, creator_id: c.id, direction: "inbound", channel: msgChannel, subject: msgSubject, body: msgCompose.trim(), status: "sent", sent_at: new Date().toISOString() }); if (!result.error && result.data) { setMsgList(prev => [...prev, result.data]); setMsgCompose(""); setMsgSubject(""); notifyOwners(c.id, c.tiktokHandle || c.instagramHandle || c.handle, "creator_replied"); await dbUpdateConversation(msgConv.id, { last_message_at: new Date().toISOString() }); } setMsgSending(false); }} disabled={!msgCompose.trim() || msgSending} style={{ padding: "6px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600, border: "1px solid " + t.blue + "40", background: t.blue + "08", color: t.blue, cursor: "pointer" }}>Log received reply</button>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => sendMsg("draft")} disabled={!msgCompose.trim() || msgSending} style={{ padding: "6px 14px", borderRadius: 6, fontSize: 11, fontWeight: 600, border: "1px solid " + t.border, background: t.card, color: t.textMuted, cursor: "pointer" }}>Save draft</button>
                <button onClick={() => sendMsg("sent")} disabled={!msgCompose.trim() || msgSending} style={{ padding: "6px 14px", borderRadius: 6, fontSize: 11, fontWeight: 700, border: "none", background: t.green, color: t.isLight ? "#fff" : "#000", cursor: "pointer", opacity: msgSending ? 0.6 : 1 }}>{msgSending ? "Sending..." : "Mark as sent"}</button>
              </div>
            </div>
            <div style={{ fontSize: 9, color: t.textFaint, marginTop: 6 }}>Messages logged for tracking. Actual email/SMS sending coming in Phase 2.</div>
          </div>
        </div>
      ) : null}

      {(() => {
        const igF = Number(c.instagramData?.followers) || 0;
        const ttF = Number(c.tiktokData?.followers) || 0;
        const ytF = Number(c.youtubeData?.subscribers) || 0;
        const totalReach = igF + ttF + ytF;
        const avgViews = medianOf((c.tiktokData?.recentVideos || []).map(v => v.views || 0).filter(v => v > 0)) || c.tiktokData?.medianViews || c.tiktokData?.avgViews || c.tiktokAvgViews || null;
        const engRate = c.engagementRate ?? c.tiktokEngRate ?? c.instagramEngRate ?? null;
        const cpmD = calculateCreatorCPM(c, ak);
        const costDisplay = (String(c.costPerVideo || "").trim() || cpmD?.rateDisplay || "").trim() || null;
        const recentVids = c.tiktokData?.recentVideos || c.tiktokRecentVideos || [];
        let postFreq = null;
        if (recentVids.length >= 3) {
          const dates = recentVids.map((v) => v.date).filter(Boolean).sort();
          if (dates.length >= 2) {
            const first = new Date(dates[0]);
            const last = new Date(dates[dates.length - 1]);
            const daySpan = Math.max(1, (last - first) / (1000 * 60 * 60 * 24));
            const perWeek = ((dates.length - 1) / daySpan) * 7;
            postFreq =
              perWeek >= 7
                ? `${Math.round(perWeek / 7)}x/day`
                : perWeek >= 1
                  ? `${Math.round(perWeek)}x/week`
                  : `${Math.max(1, Math.round(perWeek * 4.33))}x/month`;
          }
        }
        const acctCreated = c.tiktokData?.accountCreated;
        let tenure = null;
        if (acctCreated) {
          const created = new Date(acctCreated.length <= 10 ? `${acctCreated}T12:00:00` : acctCreated);
          if (!Number.isNaN(created.getTime())) {
            const totalMonths = Math.floor((Date.now() - created.getTime()) / (30.44 * 24 * 60 * 60 * 1000));
            const y = Math.floor(totalMonths / 12);
            const m = totalMonths % 12;
            tenure = y > 0 ? `${y}y ${m}m` : `${m}m`;
          }
        }
        const hasEng = engRate != null && Number.isFinite(Number(engRate));
        if (totalReach === 0 && !avgViews && !hasEng && !costDisplay && !postFreq && !tenure) {
          return null;
        }
        const stats = [
          totalReach > 0 ? { value: formatMetricShort(totalReach), label: "Total Reach" } : null,
          avgViews ? { value: formatMetricShort(avgViews), label: "Typical views" } : null,
          engRate != null && Number.isFinite(Number(engRate)) ? { value: `${Number(engRate).toFixed(1)}%`, label: "Eng Rate" } : null,
          costDisplay ? { value: costDisplay.startsWith("$") ? costDisplay : `$${costDisplay}`, label: "Est Rate" } : null,
          postFreq ? { value: postFreq, label: "Post Freq" } : null,
          tenure ? { value: tenure, label: "Creator Since" } : null,
        ].filter(Boolean);
        if (stats.length === 0) return null;
        return (
          <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.textFaint, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Quick Stats</div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {stats.map((s, i) => (
                <div
                  key={i}
                  style={{
                    flex: "1 1 100px",
                    minWidth: 90,
                    background: t.cardAlt,
                    border: `1px solid ${t.border}`,
                    borderRadius: 8,
                    padding: "10px 12px",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 18, fontWeight: 800, color: t.text }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: t.textFaint, marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      <div id="creator-detail-content" style={{ marginBottom: 20 }}>
        <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.textFaint, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Platforms</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>

            {/* Instagram */}
            <PlatformCard
              t={t}
              platform="Instagram"
              brandColor="#E1306C"
              handle={c.instagramHandle || (c.handle || "").replace("@", "")}
              url={platformLinks.instagram}
              followers={c.instagramData?.followers}
              secondaryText={[
                c.instagramData?.posts ? `${c.instagramData.posts} posts` : null,
                c.instagramEngRate != null && c.instagramEngRate >= 0.1 && c.instagramEngRate <= 50 ? `${c.instagramEngRate}% eng` : null,
                c.instagramData?.category || null,
              ].filter(Boolean).join(" · ")}
              badges={[c.instagramData?.verified && "Verified", c.instagramData?.isBusiness && "Business"].filter(Boolean)}
              onHandleChange={(h) => updateCreator(c.id, { instagramHandle: h, instagramUrl: h ? `https://www.instagram.com/${h}/` : "" })}
            />

            {/* TikTok */}
            <PlatformCard
              t={t}
              platform="TikTok"
              brandColor={t.green}
              handle={c.tiktokHandle || (c.handle || "").replace("@", "")}
              url={platformLinks.tiktok}
              followers={c.tiktokData?.followers}
              secondaryText={[
                c.tiktokData?.hearts ? `${formatMetricShort(c.tiktokData.hearts)} hearts` : null,
                c.tiktokData?.videoCount ? `${c.tiktokData.videoCount} videos` : null,
                c.tiktokEngRate != null && c.tiktokEngRate >= 0.1 && c.tiktokEngRate <= 50 ? `${c.tiktokEngRate}% eng` : null,
              ].filter(Boolean).join(" · ")}
              badges={[c.tiktokData?.verified && "Verified", c.tiktokData?.isCommerceUser && "Commerce"].filter(Boolean)}
              extraInfo={shop.hasShop ? `TikTok Shop (${shop.productCount ?? 0})` : null}
              onHandleChange={(h) => updateCreator(c.id, { tiktokHandle: h, tiktokUrl: h ? `https://www.tiktok.com/@${h}` : "" })}
            />

            {/* YouTube — meaningful data or handle; else Add */}
            {((Number(c.youtubeData?.subscribers) > 0) || !!(String(c.youtubeHandle || "").trim())) ? (
              <PlatformCard
                t={t}
                platform="YouTube"
                brandColor="#FF0000"
                handle={c.youtubeHandle || ""}
                url={c.youtubeData?.channelUrl || (c.youtubeHandle ? `https://youtube.com/@${c.youtubeHandle}` : "")}
                followers={c.youtubeData?.subscribers}
                followerLabel="subscribers"
                secondaryText={c.youtubeData?.videoCount ? `${c.youtubeData.videoCount} videos` : ""}
                onHandleChange={(h) => updateCreator(c.id, { youtubeHandle: h })}
              />
            ) : (
              <button
                type="button"
                onClick={() => updateCreator(c.id, { youtubeHandle: igH })}
                style={{
                  flex: "0 0 auto",
                  alignSelf: "flex-start",
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: `1px dashed ${t.border}`,
                  background: t.cardAlt,
                  color: t.textMuted,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                + Add YouTube
              </button>
            )}

            {/* Twitter — meaningful data or handle; else Add */}
            {((Number(c.twitterData?.followers) > 0) || !!(String(c.twitterHandle || "").trim())) ? (
              <PlatformCard
                t={t}
                platform="X / Twitter"
                brandColor="#1DA1F2"
                handle={c.twitterHandle || ""}
                url={c.twitterData?.handle ? `https://x.com/${c.twitterData.handle}` : (c.twitterHandle ? `https://x.com/${c.twitterHandle}` : "")}
                followers={c.twitterData?.followers}
                secondaryText={c.twitterData?.tweets ? `${formatMetricShort(c.twitterData.tweets)} tweets` : ""}
                onHandleChange={(h) => updateCreator(c.id, { twitterHandle: h })}
              />
            ) : (
              <button
                type="button"
                onClick={() => updateCreator(c.id, { twitterHandle: igH })}
                style={{
                  flex: "0 0 auto",
                  alignSelf: "flex-start",
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: `1px dashed ${t.border}`,
                  background: t.cardAlt,
                  color: t.textMuted,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                + Add Twitter
              </button>
            )}

            {/* Facebook — only if followers */}
            {Number(c.facebookData?.followers) > 0 ? (
              <PlatformCard
                t={t}
                platform="Facebook"
                brandColor="#1877F2"
                handle=""
                url={c.facebookData?.profileUrl || ""}
                followers={c.facebookData?.followers}
                secondaryText={c.facebookData?.category || ""}
                onHandleChange={() => {}}
              />
            ) : null}

            {/* Snapchat — display name from enrichment */}
            {c.snapchatData?.displayName && String(c.snapchatData.displayName).trim() ? (
              <div style={{ flex: "1 1 140px", minWidth: 140, background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#FFFC00", marginBottom: 6 }}>Snapchat</div>
                <div style={{ fontSize: 13, color: t.text }}>{c.snapchatData.displayName}</div>
              </div>
            ) : null}

          </div>
        </div>

        {/* ═══ Recent Content — by Platform ═══ */}
        {(() => {
          const ttVideos = (c.tiktokData?.recentVideos || c.tiktokRecentVideos || []).slice(0, 15);

          const platforms = [
            {
              name: "TikTok",
              color: t.green,
              icon: "♪",
              avatar: c.tiktokData?.avatarUrl || "",
              handle: c.tiktokHandle || c.handle?.replace("@", "") || "",
              profileUrl: c.tiktokHandle ? `https://www.tiktok.com/@${c.tiktokHandle}` : "",
              followers: c.tiktokData?.followers,
              items: ttVideos.map((v) => ({
                cover: v.cover || v.coverUrl || "",
                views: v.views || 0,
                likes: v.likes || 0,
                comments: v.comments || 0,
                caption: v.caption || v.desc || "",
                url: v.url || "",
                date: v.date || "",
                type: "video",
              })),
            },
            {
              name: "Instagram",
              color: "#E1306C",
              icon: "◎",
              avatar: c.instagramData?.avatarUrl || "",
              handle: c.instagramHandle || c.handle?.replace("@", "") || "",
              profileUrl: c.instagramHandle ? `https://www.instagram.com/${c.instagramHandle}/` : "",
              followers: c.instagramData?.followers,
              items: (() => {
                const posts = (c.instagramRecentPosts || []).map(p => ({
                  cover: p.imageUrl || p.thumbnail_url || "",
                  views: p.video_view_count || p.view_count || (p.mediaType === "video" ? p.playCount : 0) || 0,
                  likes: p.likes || p.like_count || 0,
                  comments: p.comments || p.comment_count || 0,
                  caption: p.caption || "",
                  url: p.url || "",
                  date: p.date || "",
                  type: p.mediaType === "video" ? "reel" : "post",
                }));
                const reels = (c.instagramRecentReels || []).map(r => ({
                  cover: r.coverUrl || r.imageUrl || "",
                  views: r.playCount || r.play_count || r.views || 0,
                  likes: r.likes || r.like_count || 0,
                  comments: r.comments || r.comment_count || 0,
                  caption: r.caption || "",
                  url: r.url || "",
                  date: r.date || "",
                  type: "reel",
                }));
                const all = [...posts, ...reels];
                const seen = new Set();
                return all.filter(item => {
                  const key = item.url || (item.date + "-" + item.likes);
                  if (seen.has(key)) return false;
                  seen.add(key);
                  return true;
                }).sort((a, b) => (b.views || b.likes || 0) - (a.views || a.likes || 0)).slice(0, 15);
              })(),
            },
          ].filter((p) => p.items.length > 0);

          if (platforms.length === 0) return null;

          return (
            <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.textFaint, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Recent Content</div>

              {bestHighlight && bestHighlight.url ? (
                <a href={bestHighlight.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "flex", gap: 14, alignItems: "center", padding: "12px 16px", background: t.cardAlt, borderRadius: 10, marginBottom: 14, border: "1px solid " + t.border, transition: "border-color 0.2s" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.green; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; }}>
                  <div style={{ width: 8, height: 8, borderRadius: 4, background: t.green, flexShrink: 0 }}></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: t.green, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Top performer</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>
                      {bestHighlight.kind === "tt"
                        ? formatMetricShort(bestHighlight.views) + " views · " + formatMetricShort(bestHighlight.likes) + " likes"
                        : formatMetricShort(bestHighlight.likes) + " likes · " + formatMetricShort(bestHighlight.comments) + " comments"}
                    </div>
                    <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bestHighlight.caption || ""}</div>
                  </div>
                  <span style={{ fontSize: 11, color: t.blue, flexShrink: 0 }}>View on {bestHighlight.kind === "tt" ? "TikTok" : "Instagram"} →</span>
                </a>
              ) : null}

              {platforms.map((plat, pi) => (
                <div key={pi} style={{ marginBottom: 16 }}>
                  {/* Platform header row — avatar + name + handle + follower count */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    {plat.avatar ? (
                      <img
                        src={plat.avatar}
                        alt=""
                        referrerPolicy="no-referrer"
                        style={{ width: 28, height: 28, borderRadius: 14, objectFit: "cover", border: `2px solid ${plat.color}30`, flexShrink: 0 }}
                        onError={(e) => {
                          e.target.style.display = "none";
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                          background: `${plat.color}15`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 14,
                          color: plat.color,
                          flexShrink: 0,
                        }}
                      >
                        {plat.icon}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: plat.color }}>{plat.name}</span>
                        {plat.profileUrl ? (
                          <a href={plat.profileUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: t.textMuted, textDecoration: "none" }}>
                            @{plat.handle} ↗
                          </a>
                        ) : null}
                      </div>
                      {plat.followers ? (
                        <div style={{ fontSize: 10, color: t.textFaint }}>
                          {formatMetricShort(plat.followers)} followers · {plat.items.length} recent{" "}
                          {plat.items[0]?.type === "post" ? "posts" : plat.items[0]?.type === "reel" ? "reels" : "videos"}
                        </div>
                      ) : (
                        <div style={{ fontSize: 10, color: t.textFaint }}>
                          {plat.items.length} recent{" "}
                          {plat.items[0]?.type === "post" ? "posts" : plat.items[0]?.type === "reel" ? "reels" : "videos"}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Scrollable content row */}
                  <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                    {plat.items.map((item, ii) => (
                      <a key={ii} href={item.url || "#"} target="_blank" rel="noopener noreferrer"
                        style={{ flexShrink: 0, width: 130, textDecoration: "none", borderRadius: 10, overflow: "hidden", border: "1px solid " + t.border, background: t.card, transition: "border-color 0.2s" }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = plat.color + "50"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; }}>
                        <div style={{ width: 130, height: 170, position: "relative", background: t.cardAlt, overflow: "hidden" }}>
                          {item.cover ? <img key={item.cover} src={item.cover} alt="" referrerPolicy="no-referrer" loading="lazy" style={{ width: 130, height: 170, objectFit: "cover", display: "block", position: "relative", zIndex: 1 }} onError={(e) => { e.target.style.opacity = "0"; }} /> : null}
                          <div style={{ position: "absolute", top: 0, left: 0, width: 130, height: 170, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
                            {item.views > 0 ? <div style={{ fontSize: 15, fontWeight: 800, color: t.text }}>{formatMetricShort(item.views)}</div> : item.likes > 0 ? <div style={{ fontSize: 15, fontWeight: 800, color: t.text }}>{formatMetricShort(item.likes)}</div> : null}
                            <div style={{ fontSize: 10, color: t.textFaint }}>{item.views > 0 ? "views" : item.likes > 0 ? "likes" : ""}</div>
                            {item.date ? <div style={{ fontSize: 9, color: t.textFaint }}>{item.date}</div> : null}
                          </div>
                        </div>
                        <div style={{ padding: "6px 8px" }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>{item.views > 0 ? formatMetricShort(item.views) + " views" : formatMetricShort(item.likes) + " likes"}</div>
                          {item.views > 0 && item.likes > 0 ? <div style={{ fontSize: 10, color: t.textMuted }}>{formatMetricShort(item.likes)} likes</div> : item.comments > 0 ? <div style={{ fontSize: 10, color: t.textMuted }}>{formatMetricShort(item.comments)} comments</div> : null}
                          {item.date ? <div style={{ fontSize: 9, color: t.textFaint, marginTop: 2 }}>{item.date}</div> : null}
                          {item.caption ? <div style={{ fontSize: 9, color: t.textFaint, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 114 }}>{item.caption.substring(0, 50)}</div> : null}
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {(() => {
          const ttBio = c.tiktokData?.bio;
          const igBio = c.instagramData?.bio;
          const ttBioLink = c.tiktokData?.bioLink;
          const igExtUrl = c.instagramData?.externalUrl;
          const isCommerce = c.tiktokData?.isCommerceUser;
          const isBusiness = c.instagramData?.isBusiness;
          const igCategory = c.instagramData?.category;

          if (!ttBio && !igBio && !ttBioLink && !igExtUrl) return null;

          return (
            <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.textFaint, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Bios & Links</div>
              <div style={{ background: t.cardAlt, border: `1px solid ${t.border}`, borderRadius: 10, padding: 16 }}>
                {ttBio ? (
                  <div style={{ marginBottom: 10 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: t.green }}>TikTok:</span>
                    <span style={{ fontSize: 12, color: t.text, marginLeft: 6 }}>{ttBio}</span>
                    {isCommerce ? (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          color: t.green,
                          marginLeft: 6,
                          padding: "1px 6px",
                          borderRadius: 4,
                          background: `${t.green}15`,
                        }}
                      >
                        Commerce ✓
                      </span>
                    ) : null}
                  </div>
                ) : null}
                {igBio ? (
                  <div style={{ marginBottom: 10 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#E1306C" }}>Instagram:</span>
                    <span style={{ fontSize: 12, color: t.text, marginLeft: 6 }}>{igBio}</span>
                    {isBusiness ? (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          color: "#E1306C",
                          marginLeft: 6,
                          padding: "1px 6px",
                          borderRadius: 4,
                          background: "#E1306C15",
                        }}
                      >
                        Business ✓
                      </span>
                    ) : null}
                    {igCategory ? <span style={{ fontSize: 9, color: t.textFaint, marginLeft: 4 }}>({igCategory})</span> : null}
                  </div>
                ) : null}
                {ttBioLink || igExtUrl ? (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {ttBioLink ? (
                      <a
                        href={ttBioLink.startsWith("http") ? ttBioLink : `https://${ttBioLink}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 11, color: t.blue, textDecoration: "none" }}
                      >
                        🔗 {ttBioLink.replace(/^https?:\/\//, "").substring(0, 40)}
                      </a>
                    ) : null}
                    {igExtUrl && igExtUrl !== ttBioLink ? (
                      <a
                        href={igExtUrl.startsWith("http") ? igExtUrl : `https://${igExtUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 11, color: t.blue, textDecoration: "none" }}
                      >
                        🔗 {igExtUrl.replace(/^https?:\/\//, "").substring(0, 40)}
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })()}
      </div>

      {Number.isFinite(ib) ? (
        <>
        <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 24, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: t.text }}>IB Score</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: t.green, padding: "2px 8px", borderRadius: 4, background: t.green + "12" }}>✦ IB-Ai</span>
          </div>

          <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 0 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
              <div style={{ width: 80, height: 80, borderRadius: "50%", background: ibCol, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 800, color: "#fff" }}>
                {Math.round(ib)}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: ibCol, marginTop: 6 }}>{ibLabel}</div>
            </div>

            <div style={{ flex: "1 1 300px", minWidth: 0 }}>
              {[
                { key: "instagramScore", label: "Instagram", max: 45, reasonKey: "instagramReason" },
                { key: "tiktokScore", label: "TikTok", max: 30, reasonKey: "tiktokReason" },
                { key: "crossPlatform", label: "Cross-Platform", max: 10, reasonKey: "crossPlatformReason" },
                { key: "contentAlignment", label: "Content Fit", max: 15, reasonKey: "contentAlignmentReason" },
              ].map(({ key, label, max, reasonKey }) => {
                const val = Number(br[key]) || 0;
                const pct = Math.min(100, (val / max) * 100);
                const reason = br[reasonKey] || "";
                return (
                  <div key={key} style={{ marginBottom: 12, cursor: reason ? "pointer" : "default" }} onClick={() => reason && setExpandedBar(expandedBar === key ? null : key)}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{label}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: ibCol }}>{val}/{max}</span>
                        {reason ? <span style={{ fontSize: 9, color: t.textFaint, transition: "transform 0.2s", transform: expandedBar === key ? "rotate(180deg)" : "rotate(0)" }}>▼</span> : null}
                      </div>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: t.border, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: ibCol, borderRadius: 3, transition: "width 0.3s" }} />
                    </div>
                    {expandedBar === key && reason ? (
                      <div style={{ fontSize: 11, color: t.textMuted, marginTop: 6, padding: 8, background: t.cardAlt, borderRadius: 6, lineHeight: 1.4, border: `1px solid ${t.border}` }}>
                        {reason}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 24, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: t.text, marginBottom: 16 }}>AI Insights</div>
          {ai.whyIntake ? (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: t.green, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Why Intake</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: t.text, lineHeight: 1.6 }}>{ai.whyIntake}</div>
            </div>
          ) : null}

          {ai.contentStyle ? (
            <ExpandableInsight
              t={t}
              label="Content Style"
              value={`${String(ai.contentStyle).split(".")[0]}.`}
              explanation={ai.contentStyle}
            />
          ) : null}

          {ai.risk && ai.risk !== "None identified" ? (
            <div style={{ marginBottom: 16, padding: 12, background: t.orange + "08", border: `1px solid ${t.orange}25`, borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: t.orange, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Risk</div>
              <div style={{ fontSize: 13, color: t.orange, lineHeight: 1.5 }}>{ai.risk}</div>
              {ai.riskDetail && ai.riskDetail !== ai.risk ? (
                <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4, lineHeight: 1.5 }}>{ai.riskDetail}</div>
              ) : null}
            </div>
          ) : (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: t.green }}>✓ No risks identified</div>
            </div>
          )}

          {ai.suggestedCampaigns ? (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: t.textFaint, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Suggested Campaigns</div>
              {Array.isArray(ai.suggestedCampaigns) ? (
                ai.suggestedCampaigns.map((camp, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 12, color: t.green, fontWeight: 700, marginTop: 1, flexShrink: 0 }}>→</span>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{typeof camp === "string" ? camp : camp?.name}</span>
                      {typeof camp === "object" && camp?.reason ? (
                        <span style={{ fontSize: 12, color: t.textMuted, marginLeft: 6 }}>— {camp.reason}</span>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                String(ai.suggestedCampaigns).split(",").map((x, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: t.green, fontWeight: 700 }}>→</span>
                    <span style={{ fontSize: 13, color: t.text }}>{x.trim()}</span>
                  </div>
                ))
              )}
            </div>
          ) : null}

          {(ai.outreachDM || ai.outreachEmail) ? (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.textFaint, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Suggested Outreach</div>
              {ai.outreachDM ? (
                <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: 14, marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#E1306C" }}>Instagram DM</span>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(ai.outreachDM);
                      }}
                      style={{
                        fontSize: 10,
                        padding: "2px 8px",
                        borderRadius: 4,
                        border: `1px solid ${t.border}`,
                        background: t.cardAlt,
                        color: t.textMuted,
                        cursor: "pointer",
                      }}
                    >
                      Copy
                    </button>
                  </div>
                  <div style={{ fontSize: 12, color: t.text, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{ai.outreachDM}</div>
                </div>
              ) : null}
              {ai.outreachEmail ? (
                <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: t.blue }}>Email</span>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(ai.outreachEmail);
                      }}
                      style={{
                        fontSize: 10,
                        padding: "2px 8px",
                        borderRadius: 4,
                        border: `1px solid ${t.border}`,
                        background: t.cardAlt,
                        color: t.textMuted,
                        cursor: "pointer",
                      }}
                    >
                      Copy
                    </button>
                  </div>
                  <div style={{ fontSize: 12, color: t.text, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{ai.outreachEmail}</div>
                </div>
              ) : null}
            </div>
          ) : null}

          {(ai.competitorMentions || ai.brandSafety) ? (
            <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
              {ai.competitorMentions ? (
                <div style={{ flex: "1 1 200px", background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: t.textFaint, textTransform: "uppercase", marginBottom: 6 }}>Competitor Check</div>
                  <div style={{ fontSize: 12, color: ai.competitorMentions === "None detected" ? t.green : t.orange }}>{ai.competitorMentions}</div>
                </div>
              ) : null}
              {ai.brandSafety ? (
                <div style={{ flex: "1 1 200px", background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: t.textFaint, textTransform: "uppercase", marginBottom: 6 }}>Brand Safety</div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: ai.brandSafety === "Safe" ? t.green : ai.brandSafety === "Review" ? t.orange : t.red,
                    }}
                  >
                    {ai.brandSafety === "Safe" ? "✓ " : ai.brandSafety === "Concern" ? "⚠️ " : "🔍 "}
                    {ai.brandSafety}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

        </div>

        <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 24, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: t.text, marginBottom: 16 }}>Rate & platform</div>

          {(() => {
            const cpmData = c.cpmData || calculateCreatorCPM(c, ak);
            if (!cpmData) return null;
            const platformRates = calculatePlatformRates(c, cpmData);
            if (!platformRates) return null;

            const platforms = [
              { name: "TikTok", color: t.green, items: ["tiktokVideo", "tiktokShopVideo"] },
              { name: "Instagram", color: "#E1306C", items: ["instagramReel", "instagramStory", "instagramFeedPost"] },
              { name: "YouTube", color: "#FF0000", items: ["youtubeShort", "youtubeDedicated"] },
            ];

            return (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 28, fontWeight: 800, color: t.green }}>{cpmData.rateDisplay}</span>
                  <span style={{ fontSize: 13, color: t.textMuted }}>avg per video</span>
                </div>
                <div style={{ fontSize: 11, color: t.textFaint, marginBottom: 20 }}>
                  Based on {formatMetricShort(cpmData.avgViews)} avg views · ${cpmData.cpmFinal} CPM · x{(cpmData.alignmentMultiplier ?? 1).toFixed(2)} fit · x{(cpmData.engMultiplier ?? 1).toFixed(2)} engagement
                </div>

                {platforms.map(function(plat) {
                  return (
                    <div key={plat.name} style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: plat.color, marginBottom: 8 }}>{plat.name}</div>
                      <div style={{ display: "grid", gridTemplateColumns: plat.items.length > 2 ? "1fr 1fr 1fr" : "1fr 1fr", gap: 8 }}>
                        {plat.items.map(function(key) {
                          var rate = platformRates[key];
                          if (!rate) return null;
                          var isExpanded = expandedRate === key;
                          return (
                            <div key={key}
                              onClick={function() { setExpandedRate(isExpanded ? null : key); }}
                              style={{
                                padding: "10px 12px", borderRadius: 10,
                                border: "1px solid " + (isExpanded ? plat.color + "40" : t.border),
                                background: isExpanded ? plat.color + "05" : t.cardAlt,
                                cursor: "pointer", transition: "all 0.2s",
                              }}>
                              <div style={{ fontSize: 10, color: t.textFaint, marginBottom: 2 }}>{rate.type}</div>
                              <div style={{ fontSize: 16, fontWeight: 800, color: t.text }}>{rate.display}</div>
                            </div>
                          );
                        })}
                      </div>
                      {plat.items.map(function(key) {
                        if (expandedRate !== key || !platformRates[key]) return null;
                        var rate = platformRates[key];
                        return (
                          <div key={key + "-detail"} style={{ marginTop: 8, padding: 12, background: t.cardAlt, borderRadius: 8, borderLeft: "3px solid " + plat.color, fontSize: 12, color: t.textMuted, lineHeight: 1.6 }}>
                            {rate.reasoning}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                <div style={{ borderTop: "1px solid " + t.border, paddingTop: 12, marginTop: 8 }}>
                  {(cpmData.alignmentReasons && cpmData.alignmentReasons.length > 0) || (cpmData.engReasons && cpmData.engReasons.length > 0) ? (
                    <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.6, marginBottom: 8 }}>
                      {[].concat(cpmData.alignmentReasons || []).concat(cpmData.engReasons || []).map(function(r, i) {
                        return <div key={i} style={{ color: r.includes("+") ? t.green : r.includes("-") ? t.orange : t.textMuted }}>{"• " + r}</div>;
                      })}
                    </div>
                  ) : null}
                  <div style={{ fontSize: 10, color: t.textFaint, lineHeight: 1.5 }}>
                    Industry avg UGC (2026): $150-300/video · Beginner $50-150 · Mid $150-300 · Established $300-500 · YouTube dedicated $500-3000+
                  </div>
                </div>
              </div>
            );
          })()}

          {ai.bestPlatform ? (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: t.textFaint, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Platform Strength</div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 200px", padding: 12, background: t.green + "08", border: `1px solid ${t.green}25`, borderRadius: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: t.green, marginBottom: 4 }}>★ PRIMARY</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{ai.bestPlatform}</div>
                  {ai.bestPlatformReason ? (
                    <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4, lineHeight: 1.4 }}>{ai.bestPlatformReason}</div>
                  ) : null}
                </div>
                {ai.runnerUpPlatform ? (
                  <div style={{ flex: "1 1 200px", padding: 12, background: t.cardAlt, border: `1px solid ${t.border}`, borderRadius: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: t.textFaint, marginBottom: 4 }}>RUNNER-UP</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{ai.runnerUpPlatform}</div>
                    {ai.runnerUpReason ? (
                      <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4, lineHeight: 1.4 }}>{ai.runnerUpReason}</div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          <button type="button" disabled={enriching} onClick={reanalyzeOnly} style={{ ...S.btnS, fontSize: 12, padding: "8px 14px", marginTop: 8 }}>Recalculate IB Score</button>
        </div>
        </>
      ) : null}

      <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 400px", minWidth: 280 }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12, color: t.text }}>Profile</div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: t.textFaint, marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
              Niche
              {af.niche ? <span style={{ fontSize: 10, color: t.green }}>✦</span> : null}
            </div>
            <input
              value={c.niche || ""}
              onChange={(e) => updateCreator(c.id, { niche: e.target.value, aiAutoFilled: { ...af, niche: false } })}
              style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 13 }}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: t.textFaint, marginBottom: 4 }}>Status</div>
              <select value={c.status || "Active"} onChange={(e) => updateCreator(c.id, { status: e.target.value })} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 13 }}>
                <option value="Active">Active</option>
                <option value="One-time">One-time</option>
                <option value="Off-boarded">Off-boarded</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: t.textFaint, marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
                Quality
                {af.quality ? <span style={{ fontSize: 10, color: t.green }}>✦</span> : null}
              </div>
              <select
                value={c.quality || "Standard"}
                onChange={(e) => updateCreator(c.id, { quality: e.target.value, aiAutoFilled: { ...af, quality: false } })}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 13 }}
              >
                <option value="High">High</option>
                <option value="Standard">Standard</option>
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: t.textFaint, marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
              Cost / video
              {af.costPerVideo ? <span style={{ fontSize: 10, color: t.green }}>✦</span> : null}
            </div>
            <input
              value={String(c.costPerVideo || "").replace(/^\$/, "")}
              onChange={(e) => updateCreator(c.id, { costPerVideo: e.target.value, aiAutoFilled: { ...af, costPerVideo: false } })}
              style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 13 }}
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: t.textFaint, marginBottom: 4 }}>Shipping Address</div>
            <textarea
              value={c.address || ""}
              onChange={(e) => updateCreator(c.id, { address: e.target.value })}
              onBlur={(e) => updateCreator(c.id, { address: e.target.value })}
              placeholder="No address yet — creator can add from their portal"
              rows={2}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 8,
                border: `1px solid ${t.border}`,
                background: t.inputBg,
                color: t.inputText,
                fontSize: 13,
                resize: "vertical",
                fontFamily: "inherit",
                outline: "none",
                boxSizing: "border-box",
                minHeight: 44,
                maxHeight: 100,
              }}
            />
          </div>
        </div>
        <div style={{ flex: "1 1 280px", minWidth: 240 }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12, color: t.text }}>Contact & Links</div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: t.textFaint, marginBottom: 4 }}>Email</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                value={c.email || ""}
                onChange={(e) => updateCreator(c.id, { email: e.target.value })}
                placeholder="creator@email.com"
                style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 13 }}
              />
              {c.email ? (
                <a href={`mailto:${c.email}`} style={{ padding: "8px 12px", borderRadius: 8, background: t.cardAlt, border: `1px solid ${t.border}`, fontSize: 11, fontWeight: 600, color: t.textMuted, textDecoration: "none", whiteSpace: "nowrap" }}>
                  Send ↗
                </a>
              ) : null}
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: t.textFaint, marginBottom: 4 }}>Instagram</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                value={c.instagramHandle || (c.handle || "").replace("@", "")}
                onChange={(e) => {
                  const clean = e.target.value.replace("@", "").trim();
                  updateCreator(c.id, {
                    instagramHandle: clean,
                    instagramUrl: clean ? `https://www.instagram.com/${clean}/` : "",
                  });
                }}
                placeholder="instagram handle"
                style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 13 }}
              />
              {(c.instagramUrl || c.instagramHandle) ? (
                <a
                  href={c.instagramUrl || `https://www.instagram.com/${(c.instagramHandle || "").replace("@", "")}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ padding: "8px 12px", borderRadius: 8, background: "#E1306C12", border: "1px solid #E1306C25", fontSize: 11, fontWeight: 600, color: "#E1306C", textDecoration: "none", whiteSpace: "nowrap" }}
                >
                  Open ↗
                </a>
              ) : null}
            </div>
            {c.instagramData?.followers ? (
              <div style={{ fontSize: 11, color: t.textFaint, marginTop: 2 }}>{formatMetricShort(c.instagramData.followers)} followers</div>
            ) : null}
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: t.textFaint, marginBottom: 4 }}>TikTok</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                value={(c.handle || "").replace("@", "")}
                onChange={(e) => {
                  const clean = e.target.value.replace("@", "").trim();
                  updateCreator(c.id, {
                    handle: `@${clean}`,
                    tiktokUrl: clean ? `https://www.tiktok.com/@${clean}` : "",
                  });
                }}
                placeholder="tiktok handle"
                style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 13 }}
              />
              {c.tiktokUrl ? (
                <a
                  href={c.tiktokUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ padding: "8px 12px", borderRadius: 8, background: t.green + "12", border: `1px solid ${t.green}25`, fontSize: 11, fontWeight: 600, color: t.green, textDecoration: "none", whiteSpace: "nowrap" }}
                >
                  Open ↗
                </a>
              ) : null}
            </div>
            {c.tiktokData?.followers ? (
              <div style={{ fontSize: 11, color: t.textFaint, marginTop: 2 }}>{formatMetricShort(c.tiktokData.followers)} followers</div>
            ) : null}
          </div>

          {c.youtubeData?.channelUrl ? (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: t.textFaint, marginBottom: 4 }}>YouTube</div>
              <a
                href={c.youtubeData.channelUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "inline-flex", padding: "8px 12px", borderRadius: 8, background: "#FF000012", border: "1px solid #FF000025", fontSize: 12, fontWeight: 600, color: "#FF0000", textDecoration: "none", gap: 4 }}
              >
                YouTube ↗
              </a>
              {c.youtubeData.subscribers ? (
                <span style={{ fontSize: 11, color: t.textFaint, marginLeft: 8 }}>{formatMetricShort(c.youtubeData.subscribers)} subscribers</span>
              ) : null}
            </div>
          ) : null}

          {c.twitterData?.followers ? (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: t.textFaint, marginBottom: 4 }}>X / Twitter</div>
              <a
                href={c.twitterData.handle ? `https://x.com/${c.twitterData.handle}` : `https://x.com/${(c.handle || "").replace("@", "")}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "inline-flex", padding: "8px 12px", borderRadius: 8, background: t.cardAlt, border: `1px solid ${t.border}`, fontSize: 12, fontWeight: 600, color: t.text, textDecoration: "none", gap: 4 }}
              >
                X ↗
              </a>
              <span style={{ fontSize: 11, color: t.textFaint, marginLeft: 8 }}>{formatMetricShort(c.twitterData.followers)} followers</span>
            </div>
          ) : null}

          {(c.tiktokData?.bioLink || c.instagramData?.externalUrl) ? (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${t.border}` }}>
              <div style={{ fontSize: 11, color: t.textFaint, marginBottom: 4 }}>Bio Links</div>
              {c.tiktokData?.bioLink ? (
                <a href={c.tiktokData.bioLink} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: t.blue, textDecoration: "none", display: "block", marginBottom: 2 }}>
                  {c.tiktokData.bioLink.replace(/^https?:\/\/(www\.)?/, "").substring(0, 40)}... ↗
                </a>
              ) : null}
              {c.instagramData?.externalUrl ? (
                <a href={c.instagramData.externalUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: t.blue, textDecoration: "none", display: "block" }}>
                  {c.instagramData.externalUrl.replace(/^https?:\/\/(www\.)?/, "").substring(0, 40)}... ↗
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      </div>

      <div id="creator-notes-section" style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 8, color: t.text, display: "flex", alignItems: "center", gap: 8 }}>
          Notes
          {af.notes ? <span style={{ fontSize: 10, fontWeight: 700, color: t.green }}>✦ IB-Ai seeded</span> : null}
        </div>
        <textarea
          value={c.notes || ""}
          onChange={(e) => updateCreator(c.id, { notes: e.target.value })}
          placeholder="Campaign notes, hooks, performance..."
          rows={2}
          style={{
            width: "100%",
            padding: "8px 10px",
            borderRadius: 8,
            border: `1px solid ${t.border}`,
            background: t.inputBg,
            color: t.inputText,
            fontSize: 13,
            resize: "vertical",
            fontFamily: "inherit",
            outline: "none",
            boxSizing: "border-box",
            minHeight: 48,
            maxHeight: 150,
            lineHeight: 1.45,
          }}
        />
      </div>

      <ManagerCreatorChat creatorId={c.id} t={t} />

      <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 22, boxShadow: t.shadow }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: t.text }}>Video Log</div>
          <button type="button" onClick={() => setShowVideoForm((v) => !v)} style={{ ...S.btnP, padding: "8px 14px", fontSize: 12 }}>+ Add Video</button>
        </div>
        {showVideoForm ? (
          <div style={{ background: t.cardAlt, border: `1px solid ${t.border}`, borderRadius: 10, padding: 14, marginBottom: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, marginBottom: 10 }}>
              <input value={videoDraft.url} onChange={(e) => setVideoDraft((d) => ({ ...d, url: e.target.value }))} placeholder="URL" style={{ padding: 8, borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 13 }} />
              <input value={videoDraft.campaign} onChange={(e) => setVideoDraft((d) => ({ ...d, campaign: e.target.value }))} placeholder="Campaign" style={{ padding: 8, borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 13 }} />
              <input type="date" value={videoDraft.date} onChange={(e) => setVideoDraft((d) => ({ ...d, date: e.target.value }))} style={{ padding: 8, borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 13 }} />
            </div>
            <button type="button" onClick={saveVideoLogEntry} style={{ ...S.btnP, padding: "8px 16px", fontSize: 13 }}>Save</button>
          </div>
        ) : null}
        {(Array.isArray(c.videoLog) ? c.videoLog : []).length === 0 ? (
          <div style={{ fontSize: 13, color: t.textFaint }}>No videos logged.</div>
        ) : (
          [...(c.videoLog || [])].reverse().map((v) => {
            const sp = statusPill(v.status);
            return (
              <div key={v.id || v.url} style={{ border: `1px solid ${t.border}`, borderRadius: 10, padding: "10px 12px", marginBottom: 8, background: t.cardAlt }}>
                <div style={{ fontSize: 12, color: t.text }}>{v.campaign || "—"} · {v.date}</div>
                {v.url?.trim() ? <a href={v.url.trim()} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: t.green }}>Open</a> : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ═══ UGCDashboard, ManagerLogin, TtsNativeTab, ChannelPipeline, CampaignsPage, MessagingHub, ChangeRequestsPage, ChangeRequestWidget moved to ./components/ ═══
// ═══════════════════════════════════════════════════════════
// SETTINGS PANEL (shared: /settings page + homepage collapsible)
// ═══════════════════════════════════════════════════════════

// ═══ SettingsPanel and HomepageSettingsBlock moved to ./components/Settings.jsx ═══


// ═══════════════════════════════════════════════════════════
// APP
// ═══════════════════════════════════════════════════════════

export default function App() {
  // ═══ ROLE-BASED ACCESS (Phase 1 — foundation) ═══
  // currentRole defaults to "manager" — full edit access
  // Future: creator login will set role to "creator" — read-only brief view
  // Future: share links will load a specific brief in creator mode
  // Future: manager login with email/password or SSO

  const [isDark, setIsDark] = useState(true);
  const [currentRole, setCurrentRole] = useState(ROLES.MANAGER);
  const [view, setView] = useState(() => getViewFromPath());
  const [managerAuthed, setManagerAuthed] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);

  const navigate = useCallback((newView, opts) => {
    const o = opts && typeof opts === "object" ? opts : {};
    let path = VIEW_TO_PATH[newView] || "/";
    if (newView === "creatorDetail" && o.creatorId) {
      path = `/ugc-army/creator?id=${encodeURIComponent(String(o.creatorId))}`;
    }
    if (newView === "creatorBriefView" && (o.briefId || o.assignmentId)) {
      const q = new URLSearchParams();
      if (o.briefId) q.set("briefId", String(o.briefId));
      if (o.assignmentId) q.set("assignmentId", String(o.assignmentId));
      path = `/creator/brief?${q.toString()}`;
    }
    window.history.pushState({ view: newView, creatorId: o.creatorId || null, briefId: o.briefId || null, assignmentId: o.assignmentId || null }, "", path);
    setView(newView);
  }, []);

  const [currentBrief, setCurrentBrief] = useState(null);
  const [currentFormData, setCurrentFormData] = useState(null);
  const [library, setLibrary] = useState([]);
  const [openChangeRequests, setOpenChangeRequests] = useState(0);
  const [flowChartFullscreen, setFlowChartFullscreen] = useState(false);
  const [flowChartLoaded, setFlowChartLoaded] = useState(false);
  const [canvaLoaded, setCanvaLoaded] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [briefPrefill, setBriefPrefill] = useState(null);
  const [aiKnowledge, setAiKnowledge] = useState(() => getDefaultAiKnowledge());
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [aiSteps, setAiSteps] = useState([]);
  const [storageReady, setStorageReady] = useState(() => {
    if (typeof window === "undefined") return false;
    const p = window.location.pathname.replace(/\/$/, "") || "/";
    return p.startsWith("/creator") || p === "/brief";
  });
  const [apiKey, setApiKey] = useState("");
  const [scrapeKey, setScrapeKey] = useState("");
  const [creatorSession, setCreatorSession] = useState(null);
  const [creatorProfile, setCreatorProfile] = useState(null);
  const [creatorAuthLoading, setCreatorAuthLoading] = useState(true);
  const loadCreatorProfile = useCallback(async (email) => {
    if (!email) {
      setCreatorProfile(null);
      return null;
    }
    const { data } = await supabase.from("creators").select("*").eq("email", email.toLowerCase().trim()).maybeSingle();
    if (data) {
      const c = rowToCreator(data);
      setCreatorProfile(c);
      return c;
    }
    setCreatorProfile(null);
    return null;
  }, []);
  const [creators, setCreators] = useState([]);
  const [creatorSearch, setCreatorSearch] = useState("");
  const [sortCol, setSortCol] = useState("ibScore");
  const [sortDir, setSortDir] = useState("desc");
  const [filters, setFilters] = useState({ status: "All", niche: "All", quality: "All", owner: "All" });
  const [teamMembers, setTeamMembers] = useState([]);
  const [creatorAssignments, setCreatorAssignments] = useState([]);
  const [colWidths, setColWidths] = useState(() => {
    const w = {};
    CREATOR_COLUMNS.forEach((col) => {
      if (col.width != null) w[col.key] = col.width;
    });
    return w;
  });
  const getCreatorOwners = useCallback((creatorId) => {
    return creatorAssignments
      .filter(a => a.creator_id === creatorId)
      .map(a => {
        const member = teamMembers.find(m => m.id === a.team_member_id);
        return member ? { ...member, assignedAt: a.assigned_at } : null;
      })
      .filter(Boolean);
  }, [creatorAssignments, teamMembers]);

  const handleColResize = useCallback((key, startX, startWidth) => {
    const onMove = (e) => {
      const diff = e.clientX - startX;
      const newWidth = Math.max(36, startWidth + diff);
      setColWidths((prev) => ({ ...prev, [key]: newWidth }));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);
  const [openFilter, setOpenFilter] = useState(null);
  const [dbError, setDbError] = useState(null);
  const [editingCell, setEditingCell] = useState(null);
  const skipCreatorCellBlurRef = useRef(false);
  const addHandleInputRef = useRef(null);
  const [showAddCreatorPanel, setShowAddCreatorPanel] = useState(false);
  const [addHandleInput, setAddHandleInput] = useState("");
  const [addEnrichBusy, setAddEnrichBusy] = useState(false);
  const [addEnrichStepState, setAddEnrichStepState] = useState(null);
  const [duplicateModal, setDuplicateModal] = useState(null);
  const [creatorImportToast, setCreatorImportToast] = useState(null);
  const csvInputRef = useRef(null);
  const timerRef = useRef(null);
  const cancelledRef = useRef(false);
  const stepTimers = useRef([]);

  // Storage helpers — localStorage for standalone deployment
  const storageGet = (key) => {
    try { return localStorage.getItem(key); }
    catch { return null; }
  };
  const storageSet = (key, value) => {
    try { localStorage.setItem(key, value); }
    catch {}
  };

  // ── Load open change request count ──
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.from("change_requests").select("id").eq("status", "open");
        if (!error && data) setOpenChangeRequests(data.length);
      } catch {}
    })();
  }, []);

  // ── Load from Supabase on mount ──
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      await migrateLocalStorageToSupabase();

      const applyPlatformHandleDefaults = (list) =>
        list.map((c) => {
          const clean = String(c.handle || "").replace("@", "").trim();
          return hydrateCreator({
            ...c,
            tiktokHandle: c.tiktokHandle || clean,
            instagramHandle: c.instagramHandle || clean,
            youtubeHandle: c.youtubeHandle || "",
            twitterHandle: c.twitterHandle || "",
          });
        });

      const dbCreators = await dbLoadCreators();
      if (!cancelled && dbCreators && dbCreators.length > 0) {
        setCreators(applyPlatformHandleDefaults(dbCreators.map((c) => hydrateCreator(c))));
        console.log(`[init] Loaded ${dbCreators.length} creators from Supabase`);
      } else if (!cancelled) {
        console.log("[init] No creators in Supabase, loading seed data...");
        const seedLoaded = SEED_CREATORS.map((c, i) => hydrateCreator({ ...c, id: c.id || `seed-${i}` }));
        setCreators(seedLoaded);
        for (const c of seedLoaded) {
          const sr = await dbUpsertCreator(c);
          if (sr?.error) console.error("[seed] Failed to upsert creator:", c.id, sr.error);
        }
        const fresh = await dbLoadCreators();
        if (!cancelled && fresh && fresh.length > 0) setCreators(applyPlatformHandleDefaults(fresh.map((c) => hydrateCreator(c))));
      }

      const members = await dbLoadTeamMembers();
      if (!cancelled) setTeamMembers(members);
      const assignments = await dbLoadCreatorAssignments();
      if (!cancelled) setCreatorAssignments(assignments);

      const dbBriefs = await dbLoadBriefs();
      if (!cancelled && dbBriefs && dbBriefs.length > 0) {
        setLibrary(dbBriefs);
        console.log(`[init] Loaded ${dbBriefs.length} briefs from Supabase`);
      } else if (!cancelled) {
        const libVal = localStorage.getItem("intake-library");
        if (libVal) {
          try {
            const parsed = JSON.parse(libVal);
            if (Array.isArray(parsed) && parsed.length > 0) setLibrary(parsed);
          } catch {}
        }
      }

      const themeVal = storageGet("intake-theme");
      if (themeVal && !cancelled) setIsDark(themeVal === "dark");

      const keyVal = storageGet("intake-apikey");
      if (keyVal && !cancelled) setApiKey(keyVal);

      const scrapeVal = storageGet("intake-scrape-key");
      if (scrapeVal && !cancelled) setScrapeKey(scrapeVal);

      const [dbApiKey, dbScrapeKey] = await Promise.all([
        dbGetSetting("anthropic-api-key"),
        dbGetSetting("scrapecreators-api-key"),
      ]);
      if (!cancelled && dbApiKey) {
        setApiKey(dbApiKey);
        storageSet("intake-apikey", dbApiKey);
      } else if (!cancelled && keyVal && !dbApiKey) {
        dbSetSetting("anthropic-api-key", keyVal).catch((e) => console.error("[settings] Seed Anthropic key to Supabase failed:", e));
      }
      if (!cancelled && dbScrapeKey) {
        setScrapeKey(dbScrapeKey);
        storageSet("intake-scrape-key", dbScrapeKey);
      } else if (!cancelled && scrapeVal && !dbScrapeKey) {
        dbSetSetting("scrapecreators-api-key", scrapeVal).catch((e) => console.error("[settings] Seed ScrapeCreators key to Supabase failed:", e));
      }

      const aiSettingPairs = [
        ["ai_approved_claims", "approvedClaims"],
        ["ai_banned_claims", "bannedClaims"],
        ["ai_products", "products"],
        ["ai_default_rejections", "defaultRejections"],
        ["ai_tone_hooks", "toneHooks"],
        ["ai_platform_notes", "platformNotes"],
        ["ai_length_guide", "lengthGuide"],
        ["ai_personas", "personas"],
        ["ai_brand_context", "brandContext"],
        ["ai_ib_score_weights", "ibScoreWeights"],
        ["ai_ib_score_labels", "ibScoreLabels"],
        ["ai_creator_analysis_prompt", "creatorAnalysisPrompt"],
        ["ai_outreach_style", "outreachStyle"],
        ["ai_cpm_tiers", "cpmTiers"],
        ["ai_cpm_cap", "cpmCap"],
        ["ai_rate_floor", "rateFloor"],
        ["ai_rate_ceiling", "rateCeiling"],
        ["ai_alignment_keywords", "alignmentKeywords"],
        ["ai_competitor_keywords", "competitorKeywords"],
      ];
      const aiUpdates = {};
      for (const [dbKey, field] of aiSettingPairs) {
        const val = await dbGetSetting(dbKey);
        if (val == null) continue;
        try {
          if (field === "brandContext" || field === "creatorAnalysisPrompt" || field === "outreachStyle") {
            aiUpdates[field] = typeof val === "string" ? val : String(val);
          } else {
            aiUpdates[field] = typeof val === "string" ? JSON.parse(val) : val;
          }
        } catch {
          /* skip malformed */
        }
      }
      if (!cancelled && Object.keys(aiUpdates).length > 0) {
        setAiKnowledge((prev) => ({ ...prev, ...aiUpdates }));
      }

      if (!cancelled) setStorageReady(true);
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCreatorSession(session || null);
      if (session?.user?.email) loadCreatorProfile(session.user.email);
      setCreatorAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCreatorSession(session || null);
      if (session?.user?.email) loadCreatorProfile(session.user.email);
      else setCreatorProfile(null);
    });
    return () => subscription.unsubscribe();
  }, [loadCreatorProfile]);

  useEffect(() => {
    const creatorViews = ["creatorDashboard", "creatorOnboard", "creatorProfile", "creatorBriefView", "creatorMessages"];
    if (creatorViews.includes(view) && !creatorSession && !creatorAuthLoading) {
      navigate("creatorLogin");
    }
  }, [view, creatorSession, creatorAuthLoading, navigate]);

  // ── Save theme preference ──
  useEffect(() => {
    if (!storageReady) return;
    storageSet("intake-theme", isDark ? "dark" : "light");
  }, [isDark, storageReady]);

  useEffect(() => {
    const handlePopState = (event) => {
      if (event.state && event.state.view) {
        setView(event.state.view);
      } else {
        setView(getViewFromPath());
      }
    };
    window.addEventListener("popstate", handlePopState);
    const pathAndSearch = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/";
    window.history.replaceState({ view: getViewFromPath() }, "", pathAndSearch);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (view === "publicBrief" || CREATOR_PORTAL_VIEWS.includes(view)) return;
    if (currentRole === ROLES.CREATOR && !CREATOR_ALLOWED_VIEWS.includes(view)) {
      navigate("library");
    }
  }, [currentRole, view, navigate]);

  useEffect(() => {
    if (openFilter == null) return;
    const close = (e) => {
      if (!e.target.closest?.("[data-creator-sheet-filter]")) setOpenFilter(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [openFilter]);

  useEffect(() => {
    (async () => {
      const localHash = localStorage.getItem("intake-manager-auth");
      if (!localHash) {
        setAuthChecking(false);
        return;
      }
      try {
        const storedHash = await dbGetSetting("manager-password-hash");
        if (storedHash && localHash === storedHash) {
          setManagerAuthed(true);
        } else {
          localStorage.removeItem("intake-manager-auth");
        }
      } catch {
        setManagerAuthed(true);
      }
      setAuthChecking(false);
    })();
  }, []);

  useEffect(() => {
    if (view !== "creatorDetail" || typeof window === "undefined") return;
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) navigate("creators");
  }, [view, navigate]);

  const t = isDark ? THEMES.dark : THEMES.light;
  const S = getS(t);
  const ctx = { t, S };

  const saveBrief = useCallback(
    async (brief, formData) => {
      const existing = formData.shareId != null && String(formData.shareId).trim() !== "";
      const shareId = existing ? String(formData.shareId).trim() : genShareId();
      const fd = { ...formData, shareId };
      const briefObj = {
        name: fd.campaignName || (fd.productName === "Other" && fd.customProductName?.trim() ? fd.customProductName.trim() : fd.productName) || "Brief",
        brief,
        formData: fd,
        shareId,
      };
      const inserted = await dbInsertBrief(briefObj);
      const entry =
        inserted || {
          id: Date.now(),
          shareId,
          name: briefObj.name,
          brief,
          formData: fd,
          date: new Date().toLocaleDateString(),
        };

      setCurrentBrief(brief);
      setCurrentFormData(fd);
      setLibrary((prev) => [entry, ...prev]);
      setFormKey((k) => k + 1);
      navigate("display");
    },
    [navigate]
  );

  const openLibraryItem = useCallback(
    (item) => {
      let fd = item.formData || item.form_data;
      if (!fd || typeof fd !== "object") fd = {};
      const brief = item.brief || item.brief_data || {};
      if (!fd.shareId) {
        const shareId = genShareId();
        fd = { ...fd, shareId };
        setLibrary((prev) => prev.map((x) => (x.id === item.id ? { ...x, formData: fd, shareId } : x)));
        dbUpdateBriefForm(item.id, { form_data: fd, share_id: shareId }).catch((e) => console.error("[save] Brief share id update failed:", e));
      }
      setCurrentBrief(brief);
      setCurrentFormData(fd);
      navigate("display");
    },
    [navigate]
  );

  const deleteBrief = useCallback((id) => {
    setLibrary((prev) => prev.filter((item) => item.id !== id));
    dbDeleteBrief(id).catch((e) => console.error("[save] Brief delete failed:", e));
  }, []);

  const updateCreator = useCallback((id, updates) => {
    setCreators((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const merged = { ...c };
        for (const [key, val] of Object.entries(updates)) {
          if (
            val &&
            typeof val === "object" &&
            !Array.isArray(val) &&
            Object.getPrototypeOf(val) === Object.prototype
          ) {
            const prevVal = c[key];
            if (
              prevVal &&
              typeof prevVal === "object" &&
              !Array.isArray(prevVal) &&
              Object.getPrototypeOf(prevVal) === Object.prototype
            ) {
              merged[key] = { ...prevVal, ...val };
            } else {
              merged[key] = val;
            }
          } else {
            merged[key] = val;
          }
        }
        dbUpsertCreator(merged)
          .then((result) => {
            if (result?.error) {
              const msg =
                result.error.message || result.error.details || JSON.stringify(result.error);
              console.error("[SAVE FAILED]", msg);
              setDbError(msg);
            }
          })
          .catch((e) => {
            console.error("[SAVE EXCEPTION]", e);
            setDbError(e.message || "Unknown save error");
          });
        return merged;
      })
    );
  }, []);

  const [bulkEnrichProgress, setBulkEnrichProgress] = useState(null);
  const bulkEnrichAbortRef = useRef(false);
  const [bulkStaleWindow, setBulkStaleWindow] = useState("7d");
  const [creditsUsed, setCreditsUsed] = useState(0);
  const bumpScrapeCredit = useCallback(() => {
    setCreditsUsed((n) => n + 1);
  }, []);

  const runBulkEnrichAll = useCallback(async () => {
    const key = (scrapeKey || "").trim() || storageGet("intake-scrape-key") || "";
    const ak = (apiKey || "").trim() || storageGet("intake-apikey") || "";
    if (!key.trim()) {
      alert("Add your ScrapeCreators API key in Settings");
      return;
    }
    const active = creators.filter((c) => c.status === "Active");
    const stale = active.filter((c) => shouldBulkEnrichCreator(c, bulkStaleWindow));
    const skipped = active.length - stale.length;
    const estCredits = stale.length * 11;
    if (
      !window.confirm(
        `This will enrich ${stale.length} creators (${skipped} skipped as recent). Estimated cost: ${estCredits} ScrapeCreators credits (≈11 per creator). IB-Ai uses additional API calls for IB Score. Continue?`
      )
    ) {
      return;
    }
    bulkEnrichAbortRef.current = false;
    let done = 0;
    let fail = 0;
    let topDiscovery = null;
    const clean = (h) => String(h || "").replace(/^@/, "").trim().toLowerCase();
    for (let i = 0; i < stale.length; i++) {
      if (bulkEnrichAbortRef.current) break;
      const cr = stale[i];
      const ch = clean(cr.handle);
      setBulkEnrichProgress({
        cur: i + 1,
        total: stale.length,
        done,
        fail,
        skipped,
        handle: cr.handle,
        line: "",
      });
      try {
        const payload = await runScrapeAndAiPipeline(ch, key.trim(), ak, null, {
          skipAi: !!cr.aiAnalysis?.ibScore,
          tiktokHandle: cr.tiktokHandle || ch,
          instagramHandle: cr.instagramHandle || ch,
          youtubeHandle: cr.youtubeHandle || "",
          twitterHandle: cr.twitterHandle || "",
          existingInstagramData: cr.instagramData,
          onCreditUsed: bumpScrapeCredit,
          brandContext: aiKnowledge.brandContext,
          aiKnowledge,
        });
        const tt = payload.ttData;
        const engagementRate = payload.engagementRate;
        const mergePatch = payload.aiAnalysis ? mergeAiFieldsIntoExisting(cr, payload.aiAnalysis) : {};
        const platformUpdate = {
          tiktokData: { ...DEFAULT_TIKTOK_DATA, ...(cr.tiktokData || {}), ...tt },
          instagramData: { ...DEFAULT_INSTAGRAM_DATA, ...(cr.instagramData || {}), ...payload.igData },
          tiktokBestVideo: payload.tiktokBestVideo ?? cr.tiktokBestVideo,
          engagementRate,
          tiktokEngRate: payload.tiktokEngRate,
          instagramEngRate: payload.instagramEngRate,
          instagramAvgLikes: payload.instagramAvgLikes,
          instagramAvgComments: payload.instagramAvgComments,
          instagramRecentPosts: payload.instagramRecentPosts,
          instagramRecentReels: payload.instagramRecentReels,
          tiktokShopData: payload.tiktokShopData,
          youtubeData: payload.youtubeData || cr.youtubeData,
          twitterData: payload.twitterData || cr.twitterData,
          linkedinData: payload.linkedinData || cr.linkedinData,
          snapchatData: payload.snapchatData || cr.snapchatData,
          facebookData: payload.facebookData || cr.facebookData,
          lastEnriched: new Date().toISOString(),
        };
        const mergedCreator = { ...cr, ...platformUpdate, ...mergePatch };
        const bulkFull = {
          ...platformUpdate,
          ...mergePatch,
          ...enrichPatchWithCpm(cr, mergePatch, mergedCreator, aiKnowledge),
          ...(!cr.name?.trim() && payload.nickname ? { name: payload.nickname } : {}),
        };
        if (payload.discoveredYoutubeHandle && !cr.youtubeHandle) {
          bulkFull.youtubeHandle = payload.discoveredYoutubeHandle;
        }
        if (payload.youtubeData?.title && !String(bulkFull.youtubeHandle || cr.youtubeHandle || "").trim()) {
          bulkFull.youtubeHandle = ch;
        }
        updateCreator(cr.id, bulkFull);

        // Thumbnails already stored inside pipeline — no need to re-store here

        if (payload.discoveredTwitterHandle && !cr.twitterHandle) {
          updateCreator(cr.id, { twitterHandle: payload.discoveredTwitterHandle });
        }
        const hasNotesAfter = String(bulkFull.notes ?? cr.notes ?? "").trim();
        if (!hasNotesAfter && payload.aiAnalysis) {
          const autoNotes = buildAutoNotesFromAi(payload.aiAnalysis);
          if (autoNotes.trim()) {
            updateCreator(cr.id, { notes: autoNotes.trim() });
          }
        }
        const ib = payload.aiAnalysis?.ibScore ?? cr.ibScore;
        const fol = tt.followers;
        setBulkEnrichProgress({
          cur: i + 1,
          total: stale.length,
          done: done + 1,
          fail,
          skipped,
          handle: cr.handle,
          line: `${fol != null ? formatMetricShort(fol) + " followers" : ""}${ib != null ? `, IB ${ib}` : ""}`,
        });
        const score = Number(payload.aiAnalysis?.ibScore ?? cr.ibScore);
        if (Number.isFinite(score) && (!topDiscovery || score > topDiscovery.score)) {
          topDiscovery = { handle: cr.handle, score, followers: fol };
        }
        done++;
      } catch {
        fail++;
      }
      await new Promise((r) => setTimeout(r, ak ? 2000 : 1000));
    }
    setBulkEnrichProgress(null);
    const td = topDiscovery
      ? `\nTop discovery: ${topDiscovery.handle} — IB ${topDiscovery.score}${topDiscovery.followers != null ? `, ${formatMetricShort(topDiscovery.followers)} followers` : ""}`
      : "";
    setCreatorImportToast(
      `Bulk enrichment complete:\n• ${done} creators updated\n• ${skipped} skipped (fresh per your setting)\n• ${fail} failed (handle not found or API error)${td}`
    );
    setTimeout(() => setCreatorImportToast(null), 12000);
  }, [creators, scrapeKey, apiKey, updateCreator, bulkStaleWindow, bumpScrapeCredit, aiKnowledge]);

  const runAddAndEnrich = useCallback(async () => {
    const raw = addHandleInput.trim();
    if (!raw) {
      alert("Paste a TikTok or Instagram handle first.");
      return;
    }
    const cleanHandle = raw.replace(/^@/, "").trim().split(/[/?\s]/)[0];
    if (!cleanHandle) return;

    const dup = creators.find((c) => normalizeHandleKey(c.handle) === cleanHandle.toLowerCase());
    if (dup) {
      setDuplicateModal({ handle: `@${cleanHandle}`, existingId: dup.id });
      return;
    }

    const sk = (scrapeKey || "").trim() || storageGet("intake-scrape-key") || "";
    const ak = (apiKey || "").trim() || storageGet("intake-apikey") || "";

    if (!sk) {
      const id = `c-${Date.now()}`;
      const row = {
        id,
        status: "Active",
        handle: `@${cleanHandle}`,
        name: "",
        email: "",
        niche: "",
        address: "",
        totalVideos: 0,
        notes: "",
        quality: "Standard",
        tiktokUrl: `https://www.tiktok.com/@${cleanHandle}`,
        instagramUrl: `https://www.instagram.com/${cleanHandle}/`,
        tiktokHandle: cleanHandle,
        instagramHandle: cleanHandle,
        youtubeHandle: "",
        twitterHandle: "",
        costPerVideo: "",
        videoLog: [],
        dateAdded: new Date().toISOString().slice(0, 10),
        bestVideos: [],
        outreachStatus: null,
        lastContactDate: null,
        contactMethod: null,
        followUpDue: null,
        campaigns: [],
        payments: [],
      };
      const hydrated = hydrateCreator(row);
      const insRes = await dbUpsertCreator(hydrated);
      if (insRes?.creator) {
        setCreators((p) => [insRes.creator, ...p]);
        setAddHandleInput("");
        setCreatorImportToast("Add your ScrapeCreators API key in Settings to auto-pull creator data");
        setTimeout(() => setCreatorImportToast(null), 8000);
        navigate("creatorDetail", { creatorId: insRes.creator.id });
      } else {
        if (insRes?.error) console.error("[add] Insert failed:", insRes.error);
        setCreators((p) => [hydrated, ...p]);
        setAddHandleInput("");
        setCreatorImportToast("Add your ScrapeCreators API key in Settings to auto-pull creator data");
        setTimeout(() => setCreatorImportToast(null), 8000);
        navigate("creatorDetail", { creatorId: id });
      }
      return;
    }

    setAddEnrichBusy(true);
    setAddEnrichStepState(Object.fromEntries(ENRICH_STEPS.map((s) => [s.id, "pending"])));
    const onStep = (id, status) => {
      setAddEnrichStepState((prev) => ({ ...prev, [id]: status === "ok" ? "ok" : status === "fail" ? "fail" : status === "skip" ? "skip" : status === "run" ? "run" : "pending" }));
    };

    try {
      const payload = await runScrapeAndAiPipeline(cleanHandle, sk, ak, onStep, {
        tiktokHandle: cleanHandle,
        instagramHandle: cleanHandle,
        youtubeHandle: "",
        twitterHandle: "",
        onCreditUsed: bumpScrapeCredit,
        requireTikTokProfile: true,
        brandContext: aiKnowledge.brandContext,
        aiKnowledge,
      });
      const ai = payload.aiAnalysis;
      const ttBio = payload?.ttData?.bio || "";
      const igFromBio = ttBio.match(/(?:ig|insta|instagram)[:\s]*@?([a-zA-Z0-9_.]+)/i)?.[1] || "";
      const ytFromBio = ttBio.match(/(?:yt|youtube)[:\s]*@?([a-zA-Z0-9_.]+)/i)?.[1] || "";
      const localId = `c-${Date.now()}`;
      const stub = {
        niche: "",
        quality: "Standard",
        costPerVideo: "",
        aiAutoFilled: { niche: false, quality: false, costPerVideo: false },
      };
      const patch = ai ? mergeAiFieldsIntoExisting(stub, ai) : {};
      const base = {
        id: localId,
        status: "Active",
        handle: `@${cleanHandle}`,
        name: payload.nickname || "",
        email: "",
        address: "",
        totalVideos: 0,
        notes: "",
        tiktokUrl: `https://www.tiktok.com/@${cleanHandle}`,
        instagramUrl: `https://www.instagram.com/${igFromBio || cleanHandle}/`,
        tiktokHandle: cleanHandle,
        instagramHandle: igFromBio || cleanHandle,
        youtubeHandle: payload.discoveredYoutubeHandle || ytFromBio || (payload.youtubeData?.title ? cleanHandle : "") || "",
        twitterHandle: payload.discoveredTwitterHandle || "",
        videoLog: [],
        dateAdded: new Date().toISOString().slice(0, 10),
        bestVideos: [],
        tiktokData: { ...DEFAULT_TIKTOK_DATA, ...payload.ttData },
        instagramData: { ...DEFAULT_INSTAGRAM_DATA, ...payload.igData },
        engagementRate: payload.engagementRate,
        tiktokEngRate: payload.tiktokEngRate,
        instagramEngRate: payload.instagramEngRate,
        instagramAvgLikes: payload.instagramAvgLikes,
        instagramAvgComments: payload.instagramAvgComments,
        instagramRecentPosts: payload.instagramRecentPosts || [],
        instagramRecentReels: payload.instagramRecentReels || [],
        tiktokShopData: payload.tiktokShopData,
        youtubeData: payload.youtubeData,
        twitterData: payload.twitterData,
        linkedinData: payload.linkedinData,
        snapchatData: payload.snapchatData,
        facebookData: payload.facebookData,
        ibScore: ai?.ibScore ?? null,
        ibScoreLabel: ai?.scoreLabel ?? null,
        ibScoreBreakdown: ai?.scoreBreakdown ?? null,
        lastEnriched: new Date().toISOString(),
        aiAnalysis: ai || null,
        tiktokBestVideo: payload.tiktokBestVideo ?? null,
        outreachStatus: null,
        lastContactDate: null,
        contactMethod: null,
        followUpDue: null,
        campaigns: [],
        payments: [],
      };
      const merged = { ...base, ...patch };
      const newCreator = { ...merged, ...enrichPatchWithCpm(stub, patch, merged, aiKnowledge) };
      const hydratedNew = hydrateCreator(newCreator);
      const insRes = await dbUpsertCreator(hydratedNew);
      if (insRes?.creator) {
        setCreators((p) => [insRes.creator, ...p]);
        setAddHandleInput("");
        if (payload.notes.length) {
          setCreatorImportToast(payload.notes.filter(Boolean).join(" "));
          setTimeout(() => setCreatorImportToast(null), 10000);
        }
        navigate("creatorDetail", { creatorId: insRes.creator.id });
      } else {
        if (insRes?.error) console.error("[add] Enrich insert failed:", insRes.error);
        setCreators((p) => [hydratedNew, ...p]);
        setAddHandleInput("");
        if (payload.notes.length) {
          setCreatorImportToast(payload.notes.filter(Boolean).join(" "));
          setTimeout(() => setCreatorImportToast(null), 10000);
        }
        navigate("creatorDetail", { creatorId: localId });
      }
    } catch (e) {
      const msg = e?.message || String(e);
      if (msg === "NOT_FOUND" || e?.status === 404) {
        alert(`Couldn't find @${cleanHandle} on TikTok — check the handle and try again`);
      } else {
        alert(msg || "Enrichment failed");
      }
    } finally {
      setAddEnrichBusy(false);
      setAddEnrichStepState(null);
    }
  }, [addHandleInput, creators, scrapeKey, apiKey, navigate, bumpScrapeCredit, aiKnowledge]);

  const runReEnrichExisting = useCallback(async () => {
    if (!duplicateModal) return;
    const { existingId, handle: h } = duplicateModal;
    const cleanHandle = h.replace(/^@/, "").trim();
    setDuplicateModal(null);
    const sk = (scrapeKey || "").trim() || storageGet("intake-scrape-key") || "";
    const ak = (apiKey || "").trim() || storageGet("intake-apikey") || "";
    if (!sk) {
      alert("Add your ScrapeCreators API key in Settings to re-enrich.");
      return;
    }
    setAddEnrichBusy(true);
    try {
      const existing = creators.find((c) => c.id === existingId);
      if (!existing) return;
      const payload = await runScrapeAndAiPipeline(cleanHandle, sk, ak, null, {
        tiktokHandle: existing.tiktokHandle || cleanHandle,
        instagramHandle: existing.instagramHandle || cleanHandle,
        youtubeHandle: existing.youtubeHandle || "",
        twitterHandle: existing.twitterHandle || "",
        existingInstagramData: existing.instagramData,
        onCreditUsed: bumpScrapeCredit,
        brandContext: aiKnowledge.brandContext,
        aiKnowledge,
      });
      const merged = mergeAiFieldsIntoExisting(existing, payload.aiAnalysis);
      const platformUpdate = {
        tiktokData: { ...DEFAULT_TIKTOK_DATA, ...(existing.tiktokData || {}), ...payload.ttData },
        instagramData: { ...DEFAULT_INSTAGRAM_DATA, ...(existing.instagramData || {}), ...payload.igData },
        tiktokBestVideo: payload.tiktokBestVideo ?? existing.tiktokBestVideo,
        engagementRate: payload.engagementRate,
        tiktokEngRate: payload.tiktokEngRate,
        instagramEngRate: payload.instagramEngRate,
        instagramAvgLikes: payload.instagramAvgLikes,
        instagramAvgComments: payload.instagramAvgComments,
        instagramRecentPosts: payload.instagramRecentPosts,
        instagramRecentReels: payload.instagramRecentReels,
        tiktokShopData: payload.tiktokShopData,
        youtubeData: payload.youtubeData || existing.youtubeData,
        twitterData: payload.twitterData || existing.twitterData,
        linkedinData: payload.linkedinData || existing.linkedinData,
        snapchatData: payload.snapchatData || existing.snapchatData,
        facebookData: payload.facebookData || existing.facebookData,
        lastEnriched: new Date().toISOString(),
      };
      const mergedCreator = { ...existing, ...platformUpdate, ...merged };
      updateCreator(existingId, {
        ...platformUpdate,
        ...merged,
        ...enrichPatchWithCpm(existing, merged, mergedCreator, aiKnowledge),
        ...(!existing.name?.trim() && payload.nickname ? { name: payload.nickname } : {}),
        ...(payload.discoveredYoutubeHandle && !existing.youtubeHandle ? { youtubeHandle: payload.discoveredYoutubeHandle } : {}),
        ...(payload.youtubeData?.title && !String(existing.youtubeHandle || "").trim() && !payload.discoveredYoutubeHandle ? { youtubeHandle: cleanHandle } : {}),
        ...(payload.discoveredTwitterHandle && !existing.twitterHandle ? { twitterHandle: payload.discoveredTwitterHandle } : {}),
      });
      if (payload.notes.length) {
        setCreatorImportToast(payload.notes[0]);
        setTimeout(() => setCreatorImportToast(null), 8000);
      }
      navigate("creatorDetail", { creatorId: existingId });
    } catch (e) {
      alert(e?.message || "Re-enrich failed");
    } finally {
      setAddEnrichBusy(false);
    }
  }, [duplicateModal, creators, scrapeKey, apiKey, updateCreator, navigate, bumpScrapeCredit, aiKnowledge]);

  const handleCsvImport = useCallback(
    (file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = String(ev.target?.result || "");
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        let col = null;
        for (let i = 0; i < lines.length; i++) {
          const cells = parseCSVLine(lines[i]);
          const c0 = (cells[0] || "").trim().toLowerCase();
          if (c0 === "status" && cells.some((c) => String(c).toLowerCase().includes("handle"))) {
            col = {};
            cells.forEach((h, j) => {
              const k = String(h).trim().toLowerCase();
              if (k === "status") col.status = j;
              if (k === "creator handle" || k.includes("handle")) col.handle = j;
              if (k === "niche") col.niche = j;
              if (k === "email") col.email = j;
              if (k === "name") col.name = j;
              if (k === "address") col.address = j;
              if (k === "videos") col.videos = j;
              if (k === "views") col.views = j;
              if (k === "notes") col.notes = j;
              if (k === "quality") col.quality = j;
            });
            break;
          }
        }
        if (!col || col.handle == null) {
          setCreatorImportToast("Could not find a valid header row in CSV.");
          setTimeout(() => setCreatorImportToast(null), 5000);
          return;
        }
        let newCount = 0;
        let updateCount = 0;
        setCreators((prev) => {
          const next = [...prev];
          const idxByHandle = new Map(next.map((c, i) => [normalizeHandleKey(c.handle), i]));
          for (let i = 0; i < lines.length; i++) {
            const cells = parseCSVLine(lines[i]);
            if (!cells.length) continue;
            const c0 = (cells[0] || "").trim().toLowerCase();
            if (c0 === "status" || c0 === "a list" || c0.includes("ugc army creators")) continue;
            const handleRaw = (cells[col.handle] || "").trim();
            if (!handleRaw) continue;
            const handle = handleRaw.startsWith("@") ? handleRaw : `@${handleRaw}`;
            const key = normalizeHandleKey(handle);
            const status = (cells[col.status] || "").trim() || "Active";
            const niche = (cells[col.niche] || "").trim();
            const email = (cells[col.email] || "").trim();
            const name = (cells[col.name] || "").trim();
            const address = (cells[col.address] || "").trim();
            const totalVideos = parseInt(cells[col.videos], 10);
            const notes = (cells[col.notes] || "").trim();
            const quality = (cells[col.quality] || "").trim() || "Standard";
            const rowObj = backfillCreatorSocialUrls({
              status,
              handle,
              name,
              email,
              niche,
              address,
              totalVideos: Number.isFinite(totalVideos) ? totalVideos : 0,
              notes,
              quality,
              tiktokUrl: tiktokUrlFromHandle(handle),
              instagramUrl: "",
              costPerVideo: "",
              bestVideos: [],
              videoLog: [],
              dateAdded: new Date().toISOString().slice(0, 10),
            });
            if (idxByHandle.has(key)) {
              const ix = idxByHandle.get(key);
              next[ix] = hydrateCreator({
                ...next[ix],
                ...rowObj,
                id: next[ix].id,
                videoLog: Array.isArray(next[ix].videoLog) ? next[ix].videoLog : [],
              });
              dbUpsertCreator(next[ix]).then((r) => {
                if (r?.error) console.warn("[save] CSV creator update failed:", r.error);
              }).catch((e) => console.error("[save] CSV creator update exception:", e));
              updateCount++;
            } else {
              const id = `c-import-${Date.now()}-${newCount}-${Math.random().toString(36).slice(2, 7)}`;
              const added = hydrateCreator({ id, ...rowObj });
              next.push(added);
              dbUpsertCreator(added).then((r) => {
                if (r?.error) console.warn("[save] CSV creator insert failed:", r.error);
              }).catch((e) => console.error("[save] CSV creator insert exception:", e));
              idxByHandle.set(key, next.length - 1);
              newCount++;
            }
          }
          return next;
        });
        const msg =
          newCount && updateCount
            ? `Imported ${newCount} new, updated ${updateCount}`
            : newCount
              ? `Imported ${newCount} new creators`
              : updateCount
                ? `Updated ${updateCount} existing creators`
                : "No rows imported";
        setCreatorImportToast(msg);
        setTimeout(() => setCreatorImportToast(null), 5000);
      };
      reader.readAsText(file);
    },
    [setCreators]
  );

  // ── API Connection Test ──
  const [apiStatus, setApiStatus] = useState(null); // null | "testing" | "ok" | "fail"
  const [apiMsg, setApiMsg] = useState("");
  const [scrapeStatus, setScrapeStatus] = useState(null);
  const [scrapeMsg, setScrapeMsg] = useState("");

  const saveApiKey = (key) => {
    setApiKey(key);
    setApiStatus(null);
    setApiMsg("");
    storageSet("intake-apikey", key);
    dbSetSetting("anthropic-api-key", key).catch((e) => console.error("[settings] Save API key failed:", e));
    return key;
  };

  const saveScrapeKey = (key) => {
    setScrapeKey(key);
    setScrapeStatus(null);
    setScrapeMsg("");
    storageSet("intake-scrape-key", key);
    dbSetSetting("scrapecreators-api-key", key).catch((e) => console.error("[settings] Save scrape key failed:", e));
    return key;
  };

  const testScrapeApi = async (keyOverride) => {
    const key = keyOverride ?? scrapeKey;
    if (!key?.trim()) {
      setScrapeStatus("fail");
      setScrapeMsg("Paste your ScrapeCreators API key first.");
      return;
    }
    setScrapeStatus("testing");
    setScrapeMsg("");
    try {
      const res = await fetch("https://api.scrapecreators.com/v1/credit-balance", {
        headers: { "x-api-key": key.trim() },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setScrapeStatus("fail");
        setScrapeMsg(data?.message || data?.error || `HTTP ${res.status}`);
        return;
      }
      const credits =
        data?.credits ??
        data?.balance ??
        data?.remaining ??
        data?.data?.credits ??
        (typeof data === "number" ? data : null);
      setScrapeStatus("ok");
      setScrapeMsg(
        credits != null && credits !== ""
          ? `Connected — ${Number(credits).toLocaleString()} credits remaining.`
          : "Connected — API key is valid."
      );
    } catch (err) {
      setScrapeStatus("fail");
      setScrapeMsg(err.message || "Request failed.");
    }
  };

  const getApiHeaders = (keyOverride) => {
    const key = keyOverride || apiKey;
    const headers = {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    };
    if (key) headers["x-api-key"] = key;
    return headers;
  };

  const testApi = async (keyOverride) => {
    const key = keyOverride || apiKey;
    if (!key) { setApiStatus("fail"); setApiMsg("Paste your key first."); return; }
    setApiStatus("testing");
    setApiMsg("");
    const start = Date.now();
    try {
      const res = await Promise.race([
        fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: getApiHeaders(key),
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 30,
            messages: [{ role: "user", content: 'Say exactly: {"status":"connected"}' }],
          }),
        }),
        new Promise((_, rej) => setTimeout(() => rej(new Error("TIMEOUT")), 20000)),
      ]);
      const ms = Date.now() - start;
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        const msg = e.error?.message || `HTTP ${res.status}`;
        setApiStatus("fail");
        setApiMsg(res.status === 401 ? "Invalid API key. Check your key at console.anthropic.com." :
                  res.status === 403 ? "Key doesn't have permission. Check your API key settings." :
                  `${msg} (${ms}ms)`);
        return;
      }
      await res.json();
      setApiStatus("ok");
      setApiMsg(`Connected in ${ms}ms — IB-Ai is ready.`);
    } catch (err) {
      setApiStatus("fail");
      setApiMsg(err.message === "TIMEOUT" ? "No response after 20s. Check your network or API key." : err.message);
    }
  };

  const startStepAnimation = useCallback(() => {
    stepTimers.current.forEach((tm) => clearTimeout(tm));
    stepTimers.current = [];
    setAiSteps([]);

    let accumulated = 0;
    AI_STEPS.forEach((step, index) => {
      const showTimer = setTimeout(() => {
        setAiSteps((prev) => [...prev, { ...step, status: "active" }]);
      }, accumulated);
      stepTimers.current.push(showTimer);

      accumulated += step.duration;
      const doneTimer = setTimeout(() => {
        setAiSteps((prev) => prev.map((s, i) => (i === index ? { ...s, status: "done" } : s)));
      }, accumulated);
      stepTimers.current.push(doneTimer);
    });
  }, []);

  const stopStepAnimation = useCallback((markAllDone = false) => {
    stepTimers.current.forEach((tm) => clearTimeout(tm));
    stepTimers.current = [];
    if (markAllDone) {
      setAiSteps(AI_STEPS.map((s) => ({ ...s, status: "done" })));
    } else {
      setAiSteps((prev) => prev.map((st) => ({ ...st, status: "done" })));
    }
  }, []);

  const saveAiKnowledge = useCallback(async (field, value) => {
    const keyMap = {
      approvedClaims: "ai_approved_claims",
      bannedClaims: "ai_banned_claims",
      products: "ai_products",
      defaultRejections: "ai_default_rejections",
      toneHooks: "ai_tone_hooks",
      platformNotes: "ai_platform_notes",
      lengthGuide: "ai_length_guide",
      personas: "ai_personas",
      brandContext: "ai_brand_context",
      ibScoreWeights: "ai_ib_score_weights",
      ibScoreLabels: "ai_ib_score_labels",
      creatorAnalysisPrompt: "ai_creator_analysis_prompt",
      outreachStyle: "ai_outreach_style",
      cpmTiers: "ai_cpm_tiers",
      cpmCap: "ai_cpm_cap",
      rateFloor: "ai_rate_floor",
      rateCeiling: "ai_rate_ceiling",
      alignmentKeywords: "ai_alignment_keywords",
      competitorKeywords: "ai_competitor_keywords",
    };
    const key = keyMap[field];
    if (!key) return;
    const storeVal =
      field === "brandContext" || field === "creatorAnalysisPrompt" || field === "outreachStyle"
        ? String(value)
        : JSON.stringify(value);
    await dbSetSetting(key, storeVal);
    setAiKnowledge((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleGenerate = useCallback(async (formData) => {
    if (formData.mode === "template") {
      await saveBrief(generateBrief(formData, aiKnowledge), formData);
      return;
    }

    // IB-Ai mode
    const liveKey = localStorage.getItem("intake-apikey") || "";
    if (!liveKey) {
      setAiError("No API key set. Go to Settings and add your Anthropic API key.");
      return;
    }
    cancelledRef.current = false;
    setAiLoading(true);
    startStepAnimation();
    setAiError(null);
    setElapsed(0);
    const start = Date.now();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);

    let deferredSuccess = false;
    try {
      const response = await Promise.race([
        fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
            "x-api-key": liveKey,
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 3000,
            messages: [{ role: "user", content: buildAIPrompt(formData, aiKnowledge) }],
          }),
        }),
        new Promise((_, rej) => setTimeout(() => rej(new Error("TIMEOUT")), 60000)),
      ]);

      if (cancelledRef.current) return;
      if (!response.ok) {
        const e = await response.json().catch(() => ({}));
        const msg = e.error?.message || `API returned ${response.status}`;
        if (response.status === 401) throw new Error("Invalid API key. Check Settings.");
        throw new Error(msg);
      }

      const data = await response.json();
      if (cancelledRef.current) return;

      const text = data.content.map(i => i.text || "").join("");
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("IB-Ai didn't return valid JSON. Try again or use Instant Draft.");

      let brief;
      try { brief = JSON.parse(match[0]); }
      catch { throw new Error("JSON parse failed — response may have been cut off. Try again."); }

      delete brief.proof;
      delete brief.disclosure;

      const mergedRej = buildRejectionsArray(formData, aiKnowledge?.defaultRejections);
      if (!Array.isArray(brief.rejections) || brief.rejections.length === 0) brief.rejections = mergedRej;

      deferredSuccess = true;
      stopStepAnimation(true);
      setTimeout(() => {
        void (async () => {
          await saveBrief(brief, formData);
          setAiLoading(false);
        })();
      }, 600);
    } catch (err) {
      if (cancelledRef.current) return;
      setAiError(err.message === "TIMEOUT"
        ? "Timed out after 60s. Try again or use Instant Draft."
        : err.message);
    } finally {
      clearInterval(timerRef.current);
      if (!deferredSuccess && !cancelledRef.current) {
        stopStepAnimation();
        setAiLoading(false);
      }
    }
  }, [startStepAnimation, stopStepAnimation, saveBrief, aiKnowledge]);

  const handleCancel = () => {
    cancelledRef.current = true;
    clearInterval(timerRef.current);
    stopStepAnimation();
    setAiLoading(false);
    setAiError(null);
  };

  const handleRegenTemplate = useCallback(async () => {
    if (currentFormData) await saveBrief(generateBrief(currentFormData, aiKnowledge), { ...currentFormData, mode: "template" });
  }, [currentFormData, saveBrief, aiKnowledge]);

  const handleRegenAI = useCallback(() => {
    if (currentFormData) handleGenerate({ ...currentFormData, mode: "ai" });
  }, [currentFormData, handleGenerate]);

  const allNiches = useMemo(() => {
    const set = new Set();
    creators.forEach((c) => {
      if (c.niche) {
        String(c.niche)
          .split(",")
          .forEach((n) => {
            const t = n.trim();
            if (t) set.add(t);
          });
      }
    });
    return ["All", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [creators]);

  const sortedCreators = useMemo(() => {
    let list = [...creators];

    if (filters.status !== "All") list = list.filter((c) => c.status === filters.status);
    if (filters.quality !== "All") list = list.filter((c) => (c.quality || "Standard") === filters.quality);
    if (filters.niche !== "All") {
      const needle = filters.niche.toLowerCase();
      list = list.filter((c) =>
        String(c.niche || "")
          .split(",")
          .some((n) => n.trim().toLowerCase() === needle)
      );
    }
    if (filters.owner !== "All") {
      list = list.filter(c => {
        const owners = getCreatorOwners(c.id);
        return owners.some(o => o.name === filters.owner);
      });
    }
    if (creatorSearch.trim()) {
      const q = creatorSearch.trim().toLowerCase();
      list = list.filter(
        (c) =>
          (c.handle || "").toLowerCase().includes(q) ||
          (c.name || "").toLowerCase().includes(q) ||
          (c.niche || "").toLowerCase().includes(q) ||
          (c.email || "").toLowerCase().includes(q) ||
          (c.notes || "").toLowerCase().includes(q)
      );
    }

    const statusOrder = { Active: 0, "One-time": 1, "Off-boarded": 2 };
    list.sort((a, b) => {
      let valA;
      let valB;
      switch (sortCol) {
        case "status":
          valA = statusOrder[a.status] ?? 99;
          valB = statusOrder[b.status] ?? 99;
          break;
        case "handle":
          valA = (a.handle || "").toLowerCase();
          valB = (b.handle || "").toLowerCase();
          break;
        case "niche":
          valA = (a.niche || "").toLowerCase();
          valB = (b.niche || "").toLowerCase();
          break;
        case "videos":
          valA = Math.max(Number(a.totalVideos) || 0, (a.videoLog || []).length);
          valB = Math.max(Number(b.totalVideos) || 0, (b.videoLog || []).length);
          break;
        case "avgViews":
          valA = a.tiktokData?.avgViews ?? -1;
          valB = b.tiktokData?.avgViews ?? -1;
          break;
        case "engRate":
          valA = parseFloat(a.instagramEngRate ?? a.engagementRate ?? a.tiktokEngRate);
          valB = parseFloat(b.instagramEngRate ?? b.engagementRate ?? b.tiktokEngRate);
          if (!Number.isFinite(valA)) valA = -1;
          if (!Number.isFinite(valB)) valB = -1;
          break;
        case "ibScore":
          valA = a.ibScore != null ? Number(a.ibScore) : -1;
          valB = b.ibScore != null ? Number(b.ibScore) : -1;
          if (!Number.isFinite(valA)) valA = -1;
          if (!Number.isFinite(valB)) valB = -1;
          break;
        case "quality":
          valA = a.quality === "High" ? 0 : 1;
          valB = b.quality === "High" ? 0 : 1;
          break;
        default:
          valA = (a.handle || "").toLowerCase();
          valB = (b.handle || "").toLowerCase();
      }
      if (valA < valB) return sortDir === "asc" ? -1 : 1;
      if (valA > valB) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }, [creators, filters, creatorSearch, sortCol, sortDir]);

  const toggleSort = useCallback((col) => {
    setSortCol((prev) => {
      if (prev === col) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDir("asc");
      return col;
    });
  }, []);

  const clearCreatorFilters = useCallback(() => {
    setFilters({ status: "All", niche: "All", quality: "All" });
    setCreatorSearch("");
  }, []);

  const creatorDetailId =
    view === "creatorDetail" && typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("id")
      : null;
  const detailCreator = creatorDetailId ? creators.find((c) => c.id === creatorDetailId) : null;

  const isPublicBriefView = view === "publicBrief";
  const isCreatorPortalView = CREATOR_PORTAL_VIEWS.includes(view);
  const hideManagerShell = isCreatorPortalView || isPublicBriefView;

  const isCreatorView = CREATOR_PORTAL_VIEWS.includes(view);
  const bypassManagerAuth = isCreatorView || isPublicBriefView;

  const isCreatorViewAllowed = currentRole !== ROLES.CREATOR || CREATOR_ALLOWED_VIEWS.includes(view);

  if (!bypassManagerAuth && authChecking) {
    return (
      <ThemeContext.Provider value={ctx}>
        <div style={S.app}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", color: t.textMuted }}>Loading...</div>
        </div>
      </ThemeContext.Provider>
    );
  }

  if (!bypassManagerAuth && !managerAuthed) {
    return (
      <ThemeContext.Provider value={ctx}>
        <div style={S.app}>
          <ManagerLogin onLogin={() => setManagerAuthed(true)} t={t} />
        </div>
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider value={ctx}>
      <div style={S.app}>
        <style>{`
          @keyframes fadeIn { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
          @keyframes spin { to { transform: rotate(360deg) } }
          @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.8); } }
          * { box-sizing:border-box }
          input::placeholder,textarea::placeholder { color:${t.textFaint} }
          ::-webkit-scrollbar { width:6px }
          ::-webkit-scrollbar-thumb { background:${t.scrollThumb}; border-radius:3px }
          select option { background:${t.card}; color:${t.text} }
          @media print {
            .no-print { display: none !important; }
            body { background: #fff !important; color: #111 !important; }
            .brief-print-root { max-width: 100% !important; padding: 0 !important; }
            .brief-rejection-block {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              background: #fff8e7 !important;
              border: 2px solid #e67e00 !important;
              page-break-inside: avoid;
            }
          }
        `}</style>

        {/* STORAGE LOADING */}
        {!storageReady && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 24px", color: t.textMuted, fontSize: 13, gap: 8 }}>
            <div style={{ width: 14, height: 14, border: `2px solid ${t.border}`, borderTop: `2px solid ${t.green}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            Loading…
          </div>
        )}

        {storageReady && <>
        {hideManagerShell && (
          <>
            {view === "publicBrief" && <PublicBriefView t={t} />}
            {view === "creatorLogin" && <CreatorLogin navigate={navigate} t={t} />}
            {view === "creatorOnboard" && creatorProfile && <CreatorOnboard creatorProfile={creatorProfile} navigate={navigate} t={t} />}
            {view === "creatorOnboard" && !creatorProfile && creatorSession && (
              <div style={{ minHeight: "100vh", background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", color: t.textMuted }}>Loading profile…</div>
            )}
            {view === "creatorDashboard" && creatorProfile && <CreatorDashboard creatorProfile={creatorProfile} navigate={navigate} t={t} />}
            {view === "creatorDashboard" && !creatorProfile && creatorSession && (
              <div style={{ minHeight: "100vh", background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", color: t.textMuted }}>Loading…</div>
            )}
            {view === "creatorProfile" && creatorProfile && (
              <CreatorProfileEdit creatorProfile={creatorProfile} navigate={navigate} t={t} onProfileUpdate={() => loadCreatorProfile(creatorSession?.user?.email)} />
            )}
            {view === "creatorBriefView" && <CreatorBriefView navigate={navigate} t={t} />}
            {view === "creatorMessages" && creatorProfile && <CreatorMessages creatorProfile={creatorProfile} navigate={navigate} t={t} />}
          </>
        )}
        {!hideManagerShell && <>

        {/* NAV — context-aware (creators: UGC Army library only) */}
        {(() => {
          if (currentRole === ROLES.CREATOR) {
            return (
              <div className="no-print" style={S.nav}>
                <div style={S.navLogo}>
                  <img
                    src="/favicon-32.png"
                    alt="Intake"
                    style={{ width: 28, height: 28, cursor: "pointer" }}
                    onError={(e) => { e.target.style.display = "none"; }}
                    onClick={() => navigate("library")}
                  />
                  <div onClick={() => navigate("library")} style={{ cursor: "pointer" }}>
                    <div style={S.navTitle}>Intake Breathing</div>
                    <div style={S.navSub}>{NAV_SUB_LABELS.ugcArmy}</div>
                  </div>
                </div>
                <div style={S.navLinks}>
                  <button type="button" style={S.navBtn(view === "library" || view === "display")} onClick={() => navigate("library")}>Library{library.length > 0 ? ` (${library.length})` : ""}</button>
                </div>
              </div>
            );
          }
          const section = getCurrentSection(view);
          const navSubText = NAV_SUB_LABELS[section] ?? NAV_SUB_LABELS.dashboard;
          const dashBtn = { ...S.navBtn(false), color: t.textFaint, fontWeight: 600 };
          return (
            <div className="no-print" style={S.nav}>
              <div style={S.navLogo}>
                <img
                  src="/favicon-32.png"
                  alt="Intake"
                  style={{ width: 28, height: 28, cursor: "pointer" }}
                  onError={(e) => { e.target.style.display = "none"; }}
                  onClick={() => navigate("home")}
                />
                <div onClick={() => navigate("home")} style={{ cursor: "pointer" }}>
                  <div style={S.navTitle}>Intake Breathing</div>
                  <div style={S.navSub}>{navSubText}</div>
                </div>
              </div>
              <div style={S.navLinks}>
                {section !== "dashboard" && (
                  <button type="button" style={dashBtn} onClick={() => navigate("home")}>← Dashboard</button>
                )}
                {section === "ugcArmy" && (
                  <>
                    <button type="button" style={S.navBtn(view === "ugcDashboard")} onClick={() => navigate("ugcDashboard")}>UGC Army</button>
                    <button type="button" style={S.navBtn(view === "creators" || view === "creatorDetail")} onClick={() => navigate("creators")}>Creators</button>
                    <button type="button" style={S.navBtn(view === "create")} onClick={() => { setBriefPrefill(null); navigate("create"); setFormKey((k) => k + 1); }}>New Brief</button>
                    <button type="button" style={S.navBtn(view === "library")} onClick={() => navigate("library")}>Library{library.length > 0 ? ` (${library.length})` : ""}</button>
                    <button type="button" style={S.navBtn(view === "settings")} onClick={() => navigate("settings")}>Settings</button>
                  </>
                )}
                {section === "tools" && (
                  <>
                    <button type="button" style={S.navBtn(view === "tools" || view === "videotool")} onClick={() => navigate("tools")}>All Tools</button>
                    <button type="button" style={S.navBtn(view === "settings")} onClick={() => navigate("settings")}>Settings</button>
                  </>
                )}
                {section === "pipeline" && (
                  <button type="button" style={S.navBtn(view === "settings")} onClick={() => navigate("settings")}>Settings</button>
                )}
                {section === "influencer" && (
                  <button type="button" style={S.navBtn(view === "settings")} onClick={() => navigate("settings")}>Settings</button>
                )}
                {section === "dashboard" && (
                  <button type="button" style={S.navBtn(view === "settings")} onClick={() => navigate("settings")}>Settings</button>
                )}
                <div style={{ width: 1, height: 16, background: t.border, margin: "0 4px" }} />
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem("intake-manager-auth");
                    setManagerAuthed(false);
                  }}
                  style={{
                    padding: "7px 12px", borderRadius: 8, border: "none",
                    background: "transparent", color: t.textFaint,
                    fontSize: 12, cursor: "pointer",
                  }}
                >
                  Sign Out
                </button>
                <button type="button" onClick={() => setIsDark(!isDark)} style={S.themeToggle} title={isDark ? "Switch to light" : "Switch to dark"}>
                  <div style={S.themeKnob(isDark)} />
                </button>
              </div>
            </div>
          );
        })()}

        {dbError && (
          <div
            style={{
              background: "#ff4444",
              color: "#fff",
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              zIndex: 100,
            }}
          >
            <span>⚠️ Database save failed: {dbError}</span>
            <button
              type="button"
              onClick={() => setDbError(null)}
              style={{
                background: "rgba(255,255,255,0.2)",
                border: "none",
                color: "#fff",
                padding: "4px 12px",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              Dismiss
            </button>
          </div>
        )}

        {currentRole === ROLES.CREATOR && (
          <div className="no-print" style={{ background: t.orange + "15", borderBottom: `1px solid ${t.orange}30`, padding: "8px 24px", fontSize: 12, display: "flex", justifyContent: "space-between", alignItems: "center", color: t.text, gap: 12, flexWrap: "wrap" }}>
            <span>👁 Viewing as Creator — read-only · Creators only see briefs</span>
            <button type="button" onClick={() => { setCurrentRole(ROLES.MANAGER); navigate("home"); }} style={{ ...S.btnS, fontSize: 12, padding: "6px 14px", borderColor: t.orange + "50", color: t.orange, flexShrink: 0 }}>Switch to Manager</button>
          </div>
        )}

        {/* IB-Ai loading */}
        {aiLoading && (
          <div style={{ maxWidth: 480, margin: "0 auto", padding: "80px 24px", animation: "fadeIn 0.3s ease" }}>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: t.text, marginBottom: 6 }}>IB-Ai is writing your brief</div>
              <div style={{ fontSize: 13, color: t.textMuted }}>{elapsed}s elapsed</div>
            </div>

            <div style={{ background: t.card, borderRadius: 12, border: "1px solid " + t.border, padding: 24, boxShadow: t.shadow }}>
              {AI_STEPS.map((step, i) => {
                const liveStep = aiSteps.find((s) => s.id === step.id);
                const status = liveStep ? liveStep.status : "waiting";

                return (
                  <div
                    key={step.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 0",
                      borderBottom: i < AI_STEPS.length - 1 ? "1px solid " + t.border : "none",
                      opacity: status === "waiting" ? 0.3 : 1,
                      transition: "opacity 0.4s ease",
                    }}
                  >
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        background: status === "done" ? t.green : status === "active" ? "transparent" : t.border + "50",
                        border: status === "active" ? "2px solid " + t.green : "none",
                        transition: "all 0.3s ease",
                      }}
                    >
                      {status === "done" && <Icon name="checkSm" size={14} color="#000" />}
                      {status === "active" && (
                        <div style={{ width: 8, height: 8, borderRadius: 4, background: t.green, animation: "pulse 1s ease-in-out infinite" }} />
                      )}
                    </div>

                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: status === "active" ? 600 : 400,
                        color: status === "done" ? t.green : status === "active" ? t.text : t.textFaint,
                        transition: "all 0.3s ease",
                      }}
                    >
                      {step.label}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ textAlign: "center", marginTop: 20 }}>
              <button onClick={handleCancel} style={{ ...S.btnS, fontSize: 13, padding: "9px 20px" }}>Cancel</button>
            </div>
          </div>
        )}

        {/* IB-Ai error */}
        {aiError && !aiLoading && (
          <div style={{ margin: "20px auto", maxWidth: 600, padding: "16px 18px", background: t.red+"12", border: `1px solid ${t.red}35`, borderRadius: 10 }}>
            <div style={{ fontSize: 13, color: t.red, marginBottom: 10, display: "flex", alignItems: "flex-start", gap: 8 }}><Icon name="alertTriangle" size={16} color={t.red} /><span>{aiError}</span></div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setAiError(null)} style={{ background: "none", border: `1px solid ${t.border}`, borderRadius: 8, color: t.textMuted, cursor: "pointer", fontSize: 12, padding: "8px 16px" }}>Dismiss</button>
            </div>
          </div>
        )}

        {/* HOME — card grid (managers only; creators use library) */}
        {!aiLoading && isCreatorViewAllowed && view === "home" && (() => {
          const activeCreatorCount = creators.filter((c) => c.status === "Active").length;
          const homeCard = (accentColor) => ({
            background: t.card, border: `2px solid ${accentColor}60`, borderRadius: 14, padding: 22,
            cursor: "pointer", boxShadow: `0 2px 8px ${accentColor}08`,
            transition: "border-color 0.2s, box-shadow 0.2s",
          });
          const homeHoverIn = (e, accentColor) => { e.currentTarget.style.borderColor = accentColor; e.currentTarget.style.boxShadow = `0 4px 16px ${accentColor}15`; };
          const homeHoverOut = (e, accentColor) => { e.currentTarget.style.borderColor = accentColor + "60"; e.currentTarget.style.boxShadow = `0 2px 8px ${accentColor}08`; };

          return (
            <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px 60px", animation: "fadeIn 0.3s ease" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", color: t.green, textTransform: "uppercase", marginBottom: 6 }}>Intake Breathing</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: t.text, letterSpacing: "-0.03em", marginBottom: 24 }}>Creator Partnerships</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 32 }}>
                <div style={homeCard(t.green)} onClick={() => navigate("ugcDashboard")}
                  onMouseEnter={(e) => homeHoverIn(e, t.green)} onMouseLeave={(e) => homeHoverOut(e, t.green)}>
                  <div style={{ marginBottom: 14 }}><CardIcon type="ugc" color={t.green} /></div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: t.text, marginBottom: 4 }}>UGC Army</div>
                  <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.5, marginBottom: 14 }}>Create briefs, manage creators, and track content</div>
                  <div style={{ fontSize: 12, color: t.green, fontWeight: 600 }}>{library.length} briefs · {activeCreatorCount} creators</div>
                </div>

                <div style={homeCard(t.orange)} onClick={() => navigate("pipeline")}
                  onMouseEnter={(e) => homeHoverIn(e, t.orange)} onMouseLeave={(e) => homeHoverOut(e, t.orange)}>
                  <div style={{ marginBottom: 14 }}><CardIcon type="pipeline" color={t.orange} /></div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: t.text, marginBottom: 4 }}>Channel Pipeline</div>
                  <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.5, marginBottom: 14 }}>Performance, spend, and operations across all channels</div>
                  <div style={{ fontSize: 12, color: t.orange, fontWeight: 600 }}>8 tabs · Live data</div>
                </div>

                <div style={{ ...homeCard(t.textFaint), cursor: "default", opacity: 0.5 }}>
                  <div style={{ marginBottom: 14 }}><CardIcon type="influencer" color={t.textFaint} /></div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: t.text, marginBottom: 4 }}>Influencer Buys</div>
                  <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.5, marginBottom: 14 }}>Manage campaigns, rates, and spend</div>
                  <div style={{ fontSize: 12, color: t.textFaint, fontWeight: 600 }}>Coming soon</div>
                </div>

                <div style={homeCard(t.blue)} onClick={() => navigate("tools")}
                  onMouseEnter={(e) => homeHoverIn(e, t.blue)} onMouseLeave={(e) => homeHoverOut(e, t.blue)}>
                  <div style={{ marginBottom: 14 }}><CardIcon type="tools" color={t.blue} /></div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: t.text, marginBottom: 4 }}>Tools</div>
                  <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.5, marginBottom: 14 }}>Video reformatter and team utilities</div>
                  <div style={{ fontSize: 12, color: t.blue, fontWeight: 600 }}>1 tool available</div>
                </div>

                <div style={homeCard(t.blue)} onClick={() => navigate("messaging")}
                  onMouseEnter={(e) => homeHoverIn(e, t.blue)} onMouseLeave={(e) => homeHoverOut(e, t.blue)}>
                  <div style={{ marginBottom: 14 }}><CardIcon type="brief" color={t.blue} /></div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: t.text, marginBottom: 4 }}>Messaging</div>
                  <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.5, marginBottom: 14 }}>Creator outreach, conversation threads, AI drafting</div>
                  <div style={{ fontSize: 12, color: t.blue, fontWeight: 600 }}>All conversations</div>
                </div>

                <div style={homeCard(t.orange)} onClick={() => navigate("campaigns")}
                  onMouseEnter={(e) => homeHoverIn(e, t.orange)} onMouseLeave={(e) => homeHoverOut(e, t.orange)}>
                  <div style={{ marginBottom: 14 }}><CardIcon type="ugc" color={t.orange} /></div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: t.text, marginBottom: 4 }}>Campaigns</div>
                  <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.5, marginBottom: 14 }}>Create campaigns, match creators, bulk AI invites</div>
                  <div style={{ fontSize: 12, color: t.orange, fontWeight: 600 }}>Manage campaigns</div>
                </div>

                <div style={homeCard(t.purple)} onClick={() => navigate("sourceOfTruth")}
                  onMouseEnter={(e) => homeHoverIn(e, t.purple)} onMouseLeave={(e) => homeHoverOut(e, t.purple)}>
                  <div style={{ marginBottom: 14 }}><CardIcon type="brain" color={t.purple} /></div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: t.text, marginBottom: 4 }}>IB-Ai Source of Truth</div>
                  <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.5, marginBottom: 14 }}>What IB-Ai knows — products, claims, scoring, rates, outreach</div>
                  <div style={{ fontSize: 12, color: t.purple, fontWeight: 600 }}>Editable by managers</div>
                </div>

                <div style={homeCard(t.textMuted)} onClick={() => navigate("settings")}
                  onMouseEnter={(e) => homeHoverIn(e, t.textMuted)} onMouseLeave={(e) => homeHoverOut(e, t.textMuted)}>
                  <div style={{ marginBottom: 14 }}><CardIcon type="settings" color={t.textMuted} /></div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: t.text, marginBottom: 4 }}>Settings</div>
                  <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.5, marginBottom: 14 }}>API keys, team password, database connection</div>
                  <div style={{ fontSize: 12, color: t.textMuted, fontWeight: 600 }}>v{APP_VERSION}</div>
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: t.text, letterSpacing: "-0.01em" }}>Creator Flow Chart</div>
                  <button onClick={() => setFlowChartFullscreen(true)} style={{ fontSize: 11, padding: "4px 12px", borderRadius: 6, border: "1px solid " + t.border, background: t.card, color: t.textMuted, cursor: "pointer", fontWeight: 600 }}>Fullscreen</button>
                </div>
                <div style={{ background: t.card, border: "1px solid " + t.border, borderRadius: 14, overflow: "hidden", boxShadow: t.shadow }}>
                  <div style={{ position: "relative", overflow: "hidden", borderRadius: 14 }}>
                    <div style={{ position: "relative", width: "100%", height: 0, paddingTop: "75%", overflow: "hidden", filter: flowChartLoaded ? "none" : "blur(8px)", transition: "filter 0.5s", pointerEvents: flowChartLoaded ? "auto" : "none" }}>
                      <iframe loading="lazy" style={{ position: "absolute", width: "100%", height: "100%", top: 0, left: 0, border: "none" }} src="https://lucid.app/documents/embedded/41a72a0b-5268-401c-933f-6e8a37895362" allowFullScreen />
                    </div>
                    {!flowChartLoaded ? (
                      <div onClick={() => setFlowChartLoaded(true)} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 2, background: "linear-gradient(180deg, " + t.card + "90, " + t.card + "60)", backdropFilter: "blur(4px)", transition: "opacity 0.3s" }}>
                        <div style={{ background: t.card, border: "1px solid " + t.border, borderRadius: 12, padding: "20px 32px", textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 4 }}>Creator Partnerships Flow Chart</div>
                          <div style={{ fontSize: 12, color: t.textMuted }}>Click to load interactive diagram</div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: t.text, letterSpacing: "-0.01em", marginBottom: 10 }}>2025 In Review</div>
                <div style={{ background: t.card, border: "1px solid " + t.border, borderRadius: 14, overflow: "hidden", boxShadow: t.shadow }}>
                  <div style={{ position: "relative", overflow: "hidden", borderRadius: 14 }}>
                    <div style={{ position: "relative", width: "100%", height: 0, paddingTop: "56.25%", overflow: "hidden", filter: canvaLoaded ? "none" : "blur(8px)", transition: "filter 0.5s", pointerEvents: canvaLoaded ? "auto" : "none" }}>
                      <iframe loading="lazy" style={{ position: "absolute", width: "100%", height: "100%", top: 0, left: 0, border: "none" }} src="https://www.canva.com/design/DAG6eUzBH8g/zCFsO_eLBK-A9L1C2xCxBQ/view?embed" allowFullScreen allow="fullscreen" />
                    </div>
                    {!canvaLoaded ? (
                      <div onClick={() => setCanvaLoaded(true)} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 2, background: "linear-gradient(180deg, " + t.card + "90, " + t.card + "60)", backdropFilter: "blur(4px)", transition: "opacity 0.3s" }}>
                        <div style={{ background: t.card, border: "1px solid " + t.border, borderRadius: 12, padding: "20px 32px", textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 4 }}>2025 In Review</div>
                          <div style={{ fontSize: 12, color: t.textMuted }}>Click to load presentation</div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {flowChartFullscreen ? (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, background: t.bg }}>
                  <button onClick={() => setFlowChartFullscreen(false)} style={{ position: "fixed", top: 16, right: 16, zIndex: 10000, fontSize: 12, padding: "8px 16px", borderRadius: 8, border: "1px solid " + t.border, background: t.card, color: t.text, cursor: "pointer", fontWeight: 700, boxShadow: "0 2px 12px rgba(0,0,0,0.15)" }}>Exit fullscreen</button>
                  <iframe style={{ width: "100%", height: "100%", border: "none" }} src="https://lucid.app/documents/embedded/41a72a0b-5268-401c-933f-6e8a37895362" allowFullScreen />
                </div>
              ) : null}

              <div style={{ textAlign: "center", fontSize: 11, color: t.textFaint + "60" }}>v{APP_VERSION}</div>
            </div>
          );
        })()}

        {!aiLoading && isCreatorViewAllowed && view === "ugcDashboard" && (
          <UGCDashboard
            navigate={navigate}
            library={library}
            creators={creators}
            t={t}
            S={S}
            onOpenBrief={openLibraryItem}
            onNewBrief={() => { setBriefPrefill(null); navigate("create"); setFormKey((k) => k + 1); }}
            CardIcon={CardIcon}
          />
        )}

        {!aiLoading && isCreatorViewAllowed && view === "pipeline" && (
          <ChannelPipeline navigate={navigate} creators={creators} t={t} S={S} />
        )}
        {!aiLoading && isCreatorViewAllowed && view === "influencer" && (
          <ComingSoonPage
            title="Influencer Buys"
            message="Influencer Buys — Coming Soon. Manage influencer campaigns and spend in one place."
            onBack={() => navigate("home")}
          />
        )}
        {!aiLoading && isCreatorViewAllowed && view === "tools" && <ToolsPage onBack={() => navigate("home")} onOpenVideo={() => navigate("videotool")} />}
        {!aiLoading && isCreatorViewAllowed && view === "videotool" && <VideoReformatter onBack={() => navigate("tools")} />}

        {/* SOURCE OF TRUTH */}
        {!aiLoading && isCreatorViewAllowed && view === "sourceOfTruth" && (
          <div style={{ maxWidth: 960, margin: "0 auto", padding: "40px 24px 80px", animation: "fadeIn 0.3s ease" }}>
            <button type="button" onClick={() => navigate("home")} style={{ ...S.btnS, fontSize: 13, padding: "9px 18px", marginBottom: 24 }}>← Back</button>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 6, color: t.text }}>IB-Ai Source of Truth</div>
            <div style={{ fontSize: 14, color: t.textMuted, marginBottom: 32 }}>Everything IB-Ai uses to generate briefs, score creators, calculate rates, and write outreach.</div>
            <IBAiSourceOfTruth t={t} aiKnowledge={aiKnowledge} onSave={saveAiKnowledge} startOpen />
          </div>
        )}

        {/* CAMPAIGNS */}
        {!aiLoading && isCreatorViewAllowed && view === "campaigns" && (
          <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px 80px", animation: "fadeIn 0.3s ease" }}>
            <button type="button" onClick={() => navigate("home")} style={{ ...S.btnS, fontSize: 13, padding: "9px 18px", marginBottom: 24 }}>← Back</button>
            <CampaignsPage t={t} S={S} teamMembers={teamMembers} creators={creators} navigate={navigate} />
          </div>
        )}

        {/* MESSAGING */}
        {!aiLoading && isCreatorViewAllowed && view === "messaging" && (
          <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px 80px", animation: "fadeIn 0.3s ease" }}>
            <button type="button" onClick={() => navigate("home")} style={{ ...S.btnS, fontSize: 13, padding: "9px 18px", marginBottom: 24 }}>← Back</button>
            <MessagingHub t={t} S={S} teamMembers={teamMembers} creators={creators} navigate={navigate} />
          </div>
        )}

        {/* CHANGE REQUESTS */}
        {!aiLoading && isCreatorViewAllowed && view === "changeRequests" && (
          <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px 80px", animation: "fadeIn 0.3s ease" }}>
            <button type="button" onClick={() => navigate("home")} style={{ ...S.btnS, fontSize: 13, padding: "9px 18px", marginBottom: 24 }}>← Back</button>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 6, color: t.text }}>Change Requests</div>
            <div style={{ fontSize: 14, color: t.textMuted, marginBottom: 32 }}>All open and completed requests from the team.</div>
            <ChangeRequestsPage t={t} S={S} navigate={navigate} refreshOpenCount={() => { supabase.from("change_requests").select("id").eq("status", "open").then(({ data }) => setOpenChangeRequests((data || []).length)); }} />
          </div>
        )}

        {/* SETTINGS */}
        {!aiLoading && isCreatorViewAllowed && view === "settings" && (
          <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px 80px", animation: "fadeIn 0.3s ease" }}>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 6, color: t.text }}>Settings</div>
            <div style={{ fontSize: 12, color: t.textFaint, fontWeight: 500, marginBottom: 8 }}>v{APP_VERSION}</div>
            <div style={{ fontSize: 14, color: t.textMuted, marginBottom: 32 }}>Configure API keys, team password, and database.</div>

            <SettingsPanel
              instanceId="settings-page"
              t={t}
              creators={creators}
              library={library}
              supabase={supabase}
              dbSetSetting={dbSetSetting}
              dbGetSetting={dbGetSetting}
              apiKey={apiKey}
              scrapeKey={scrapeKey}
              setApiStatus={setApiStatus}
              setApiMsg={setApiMsg}
              apiStatus={apiStatus}
              apiMsg={apiMsg}
              saveApiKey={saveApiKey}
              testApi={testApi}
              setScrapeStatus={setScrapeStatus}
              setScrapeMsg={setScrapeMsg}
              scrapeStatus={scrapeStatus}
              scrapeMsg={scrapeMsg}
              saveScrapeKey={saveScrapeKey}
              testScrapeApi={testScrapeApi}
              currentRole={currentRole}
              setCurrentRole={setCurrentRole}
              navigate={navigate}
              CHANGELOG={CHANGELOG}
              APP_VERSION={APP_VERSION}
              ROLES={ROLES}
            />
          </div>
        )}

        {!aiLoading && isCreatorViewAllowed && view === "create" && (
          <div style={{ animation: "fadeIn 0.3s ease" }}>
            <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 24px" }}>
              <UploadOldBrief
                extractionPrompt={buildBriefExtractionPrompt(aiKnowledge.products)}
                aiKnowledge={aiKnowledge}
                onExtracted={(fields) => {
                  setBriefPrefill(fields);
                  setFormKey((k) => k + 1);
                }}
                t={t}
              />
            </div>
            <BriefForm key={`b-${formKey}`} prefill={briefPrefill || undefined} onGenerate={handleGenerate} aiKnowledge={aiKnowledge} />
            <IBAiSourceOfTruth t={t} aiKnowledge={aiKnowledge} onSave={saveAiKnowledge} />
          </div>
        )}
        {!aiLoading && isCreatorViewAllowed && view === "display" && currentBrief && <div style={{ animation: "fadeIn 0.3s ease" }}><BriefDisplay brief={currentBrief} formData={currentFormData} currentRole={currentRole} creators={creators} onBack={() => navigate("library")} onRegenerate={handleRegenTemplate} onRegenerateAI={handleRegenAI} /></div>}

        {creatorImportToast && (
          <div className="no-print" style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 300, background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: "12px 20px", fontSize: 13, color: t.textSecondary, boxShadow: t.shadow, maxWidth: 520, whiteSpace: "pre-line" }}>
            {creatorImportToast}
          </div>
        )}

        {!aiLoading && isCreatorViewAllowed && view === "creators" && (() => {
          const fmtHandle = (h) => {
            const x = String(h || "").trim();
            if (!x) return "—";
            return x.startsWith("@") ? x : `@${x}`;
          };
          const cellBase = {
            padding: "6px 10px",
            fontSize: 12,
            color: t.textSecondary,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            lineHeight: "32px",
            minWidth: 0,
          };
          const ttLinkStyle = {
            fontWeight: 800,
            fontSize: 10,
            color: t.textMuted,
            cursor: "pointer",
            textDecoration: "none",
            display: "inline-block",
          };
          const sortArrow = (key) => (sortCol === key ? (sortDir === "asc" ? "↑" : "↓") : "");
          const filterActive = (fk) =>
            fk === "status"
              ? filters.status !== "All"
              : fk === "niche"
                ? filters.niche !== "All"
                : fk === "quality"
                  ? filters.quality !== "All"
                  : false;
          const renderHeaderCell = (col) => {
            if (col.key === "avatar") {
              const cw = colWidths[col.key] ?? col.width ?? 36;
              return (
                <div key={col.key} style={{ position: "relative", padding: "8px 6px", width: cw, minWidth: cw, maxWidth: cw }} aria-hidden>
                  <div
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleColResize(col.key, e.clientX, colWidths[col.key] ?? col.width ?? 36);
                    }}
                    style={{
                      position: "absolute",
                      right: 0,
                      top: 0,
                      bottom: 0,
                      width: 5,
                      cursor: "col-resize",
                      zIndex: 3,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = `${t.green}40`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  />
                </div>
              );
            }
            const fk = col.filterable ? col.key : null;
            const fa = fk ? filterActive(fk) : false;
            const sortOn = col.sortable && sortCol === col.key;
            const labelColor = sortOn || fa ? t.green : t.textFaint;
            const jc = col.align === "right" ? "flex-end" : "flex-start";
            return (
              <div
                key={col.key}
                data-creator-sheet-filter={fk || undefined}
                style={{
                  position: "relative",
                  ...(col.width != null
                    ? {
                        width: colWidths[col.key] ?? col.width ?? 80,
                        minWidth: colWidths[col.key] ?? col.width ?? 80,
                        maxWidth: colWidths[col.key] ?? col.width ?? 80,
                      }
                    : { minWidth: 0 }),
                  padding: "8px 10px",
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: labelColor,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  cursor: col.sortable ? "pointer" : "default",
                  userSelect: "none",
                  whiteSpace: "nowrap",
                  justifyContent: jc,
                }}
              >
                <span
                  role={col.sortable ? "button" : undefined}
                  tabIndex={col.sortable ? 0 : undefined}
                  onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                  onKeyDown={col.sortable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleSort(col.key); } } : undefined}
                  style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0, color: sortOn ? t.green : fa && fk === col.key ? t.green : t.textFaint }}
                >
                  {col.label}
                  {col.sortable ? <span style={{ fontSize: 9, opacity: 0.85 }}>{sortArrow(col.key)}</span> : null}
                </span>
                {fk ? (
                  <button
                    type="button"
                    data-creator-sheet-filter
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenFilter((o) => (o === fk ? null : fk));
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: fa ? t.green : t.textFaint,
                      cursor: "pointer",
                      fontSize: 9,
                      padding: "0 2px",
                      lineHeight: 1,
                    }}
                    aria-label={`Filter ${col.label}`}
                  >
                    ▾
                  </button>
                ) : null}
                {openFilter === fk && fk === "status" ? (
                  <div
                    data-creator-sheet-filter
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      minWidth: 160,
                      maxHeight: 240,
                      overflowY: "auto",
                      background: t.card,
                      border: `1px solid ${t.border}`,
                      borderRadius: 8,
                      boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
                      zIndex: 20,
                      padding: "4px 0",
                    }}
                  >
                    {["All", "Active", "One-time", "Off-boarded"].map((opt) => (
                      <div
                        key={opt}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          setFilters((f) => ({ ...f, status: opt }));
                          setOpenFilter(null);
                        }}
                        style={{
                          padding: "6px 12px",
                          fontSize: 12,
                          cursor: "pointer",
                          color: filters.status === opt ? t.green : t.textSecondary,
                          fontWeight: filters.status === opt ? 600 : 400,
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = t.cardAlt; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                      >
                        {opt}
                      </div>
                    ))}
                  </div>
                ) : null}
                {openFilter === fk && fk === "niche" ? (
                  <div
                    data-creator-sheet-filter
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      minWidth: 160,
                      maxHeight: 240,
                      overflowY: "auto",
                      background: t.card,
                      border: `1px solid ${t.border}`,
                      borderRadius: 8,
                      boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
                      zIndex: 20,
                      padding: "4px 0",
                    }}
                  >
                    {allNiches.map((opt) => (
                      <div
                        key={opt}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          setFilters((f) => ({ ...f, niche: opt }));
                          setOpenFilter(null);
                        }}
                        style={{
                          padding: "6px 12px",
                          fontSize: 12,
                          cursor: "pointer",
                          color: filters.niche === opt ? t.green : t.textSecondary,
                          fontWeight: filters.niche === opt ? 600 : 400,
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = t.cardAlt; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                      >
                        {opt}
                      </div>
                    ))}
                  </div>
                ) : null}
                {openFilter === fk && fk === "quality" ? (
                  <div
                    data-creator-sheet-filter
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      minWidth: 160,
                      maxHeight: 240,
                      overflowY: "auto",
                      background: t.card,
                      border: `1px solid ${t.border}`,
                      borderRadius: 8,
                      boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
                      zIndex: 20,
                      padding: "4px 0",
                    }}
                  >
                    {[
                      { v: "All", lab: "All" },
                      { v: "High", lab: "★ High" },
                      { v: "Standard", lab: "Standard" },
                    ].map(({ v, lab }) => (
                      <div
                        key={v}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          setFilters((f) => ({ ...f, quality: v }));
                          setOpenFilter(null);
                        }}
                        style={{
                          padding: "6px 12px",
                          fontSize: 12,
                          cursor: "pointer",
                          color: filters.quality === v ? t.green : t.textSecondary,
                          fontWeight: filters.quality === v ? 600 : 400,
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = t.cardAlt; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                      >
                        {lab}
                      </div>
                    ))}
                  </div>
                ) : null}
                {openFilter === fk && fk === "owner" ? (
                  <div data-creator-sheet-filter style={{ position: "absolute", top: "100%", left: 0, minWidth: 160, maxHeight: 240, overflowY: "auto", background: t.card, border: `1px solid ${t.border}`, borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.25)", zIndex: 20, padding: "4px 0" }}>
                    {["All", ...teamMembers.map(m => m.name)].map((opt) => (
                      <div key={opt} role="button" tabIndex={0} onClick={() => { setFilters(f => ({ ...f, owner: opt })); setOpenFilter(null); }} style={{ padding: "6px 12px", fontSize: 12, cursor: "pointer", color: filters.owner === opt ? t.green : t.textSecondary, fontWeight: filters.owner === opt ? 600 : 400 }} onMouseEnter={(e) => { e.currentTarget.style.background = t.cardAlt; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                        {opt}
                      </div>
                    ))}
                  </div>
                ) : null}
                {col.width != null ? (
                  <div
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleColResize(col.key, e.clientX, colWidths[col.key] ?? col.width ?? 80);
                    }}
                    style={{
                      position: "absolute",
                      right: 0,
                      top: 0,
                      bottom: 0,
                      width: 5,
                      cursor: "col-resize",
                      zIndex: 3,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = `${t.green}40`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  />
                ) : null}
              </div>
            );
          };

          const renderBodyCell = (c, col) => {
            const align = col.align === "right" ? { textAlign: "right" } : {};
            const fixedColStyle =
              col.width == null
                ? {}
                : {
                    width: colWidths[col.key] ?? col.width ?? 80,
                    minWidth: colWidths[col.key] ?? col.width ?? 80,
                    maxWidth: colWidths[col.key] ?? col.width ?? 80,
                  };
            const stopNav = col.editable
              ? { onClick: (e) => e.stopPropagation() }
              : {};
            const base = { ...cellBase, ...fixedColStyle, ...align };

            if (col.key === "status") {
              const s = c.status || "Active";
              const colors = {
                Active: t.green,
                Applied: t.purple,
                Pause: t.orange,
                "Under Review": t.blue,
                "Off-boarded": t.textFaint,
                "One-time": t.blue,
              };
              const colSt = colors[s] || t.textFaint;
              return (
                <div key={col.key} style={{ ...base, display: "flex", alignItems: "center" }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 10,
                      background: `${colSt}15`,
                      color: colSt,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: "100%",
                    }}
                  >
                    {s}
                  </span>
                </div>
              );
            }
            if (col.key === "owner") {
              const owners = getCreatorOwners(c.id);
              return (
                <div key={col.key} style={{ ...base, display: "flex", alignItems: "center" }}>
                  {owners.length > 0 ? (
                    <div style={{ display: "flex", alignItems: "center" }}>
                      {owners.slice(0, 3).map((member, i) => (
                        <div key={member.id} style={{ marginLeft: i > 0 ? -8 : 0, zIndex: 3 - i }}>
                          {member.avatar_url ? (
                            <img src={member.avatar_url} alt="" title={member.name} style={{ width: 24, height: 24, borderRadius: 12, objectFit: "cover", border: "2px solid " + t.card }} onError={(e) => { e.target.style.display = "none"; }} />
                          ) : (
                            <div style={{ width: 24, height: 24, borderRadius: 12, background: t.green + "15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: t.green, border: "2px solid " + t.card }} title={member.name}>{member.name?.[0]}</div>
                          )}
                        </div>
                      ))}
                      {owners.length > 3 ? <span style={{ fontSize: 9, color: t.textFaint, marginLeft: 4 }}>+{owners.length - 3}</span> : null}
                      {owners.length <= 2 ? <span style={{ fontSize: 10, color: t.text, marginLeft: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{owners.map(o => o.name.split(" ")[0]).join(", ")}</span> : null}
                    </div>
                  ) : (
                    <span style={{ fontSize: 11, color: t.textFaint }}>—</span>
                  )}
                </div>
              );
            }
            if (col.key === "avatar") {
              const letter = String(c.handle || "?").replace(/^@/, "").charAt(0).toUpperCase() || "?";
              const attempts = buildAvatarSrcAttempts(c);
              return (
                <div key={col.key} style={{ ...base, display: "flex", alignItems: "center", justifyContent: "center", padding: "6px 4px" }}>
                  {attempts.length ? (
                    <div style={{ width: 28, height: 28, position: "relative", flexShrink: 0 }}>
                      <img
                        src={attempts[0]}
                        alt=""
                        referrerPolicy="no-referrer"
                        data-av-idx="0"
                        style={{ width: 28, height: 28, borderRadius: 14, objectFit: "cover", background: t.cardAlt, display: "block" }}
                        onError={(e) => {
                          const img = e.currentTarget;
                          const idx = Number(img.dataset.avIdx || 0) + 1;
                          if (idx < attempts.length) {
                            img.dataset.avIdx = String(idx);
                            img.src = attempts[idx];
                            return;
                          }
                          img.style.display = "none";
                          const el = img.nextSibling;
                          if (el) el.style.display = "flex";
                        }}
                      />
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                          background: t.cardAlt,
                          display: "none",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 12,
                          fontWeight: 700,
                          color: t.textFaint,
                          position: "absolute",
                          left: 0,
                          top: 0,
                        }}
                      >
                        {letter}
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        background: t.cardAlt,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 700,
                        color: t.textFaint,
                        flexShrink: 0,
                      }}
                    >
                      {letter}
                    </div>
                  )}
                </div>
              );
            }
            if (col.key === "handle") {
              const hDisp = fmtHandle(c.handle);
              const nm = (c.name || "").trim();
              return (
                <div key={col.key} style={{ ...base }} title={nm ? `${hDisp} · ${nm}` : hDisp}>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: t.text,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {hDisp}
                    </div>
                    {nm ? (
                      <div
                        style={{
                          fontSize: 11,
                          color: t.textFaint,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {nm}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            }
            if (col.key === "niche") {
              const raw = String(c.niche || "");
              const isEditing = editingCell?.creatorId === c.id && editingCell?.column === "niche";
              return (
                <div key={col.key} style={base} {...stopNav}>
                  {isEditing ? (
                    <input
                      autoFocus
                      defaultValue={raw}
                      style={{
                        width: "100%",
                        border: "none",
                        outline: "none",
                        background: t.green + "10",
                        color: t.text,
                        fontSize: 12,
                        fontFamily: "inherit",
                        padding: "2px 4px",
                        borderRadius: 3,
                        boxSizing: "border-box",
                      }}
                      onBlur={(e) => {
                        if (skipCreatorCellBlurRef.current) {
                          skipCreatorCellBlurRef.current = false;
                          return;
                        }
                        const af0 = c.aiAutoFilled && typeof c.aiAutoFilled === "object" ? c.aiAutoFilled : {};
                        updateCreator(c.id, { niche: e.target.value, aiAutoFilled: { ...af0, niche: false } });
                        setEditingCell(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.target.blur();
                        if (e.key === "Escape") {
                          e.preventDefault();
                          skipCreatorCellBlurRef.current = true;
                          setEditingCell(null);
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setEditingCell({ creatorId: c.id, column: "niche" });
                      }}
                      title="Double-click to edit"
                      style={{ fontSize: 11, color: t.textMuted }}
                    >
                      {raw.trim() ? raw : "—"}
                    </span>
                  )}
                </div>
              );
            }
            if (col.key === "tt") {
              const ttHandle = String(c.tiktokHandle || c.handle || "").replace(/^@/, "").trim();
              const ttUrl = ((c.tiktokUrl || "").trim() || (ttHandle ? `https://www.tiktok.com/@${ttHandle}` : "")).trim();
              return (
                <div key={col.key} style={{ ...base, textAlign: "center" }}>
                  {ttUrl ? (
                    <a
                      href={ttUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={ttLinkStyle}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = t.green;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = t.textMuted;
                      }}
                    >
                      TT
                    </a>
                  ) : (
                    <span style={{ color: t.textFaint }}>—</span>
                  )}
                </div>
              );
            }
            if (col.key === "ig") {
              const igHandle = String(c.instagramHandle || c.handle || "").replace(/^@/, "").trim();
              const igUrl = ((c.instagramUrl || "").trim() || (igHandle ? `https://www.instagram.com/${igHandle}/` : "")).trim();
              return (
                <div key={col.key} style={{ ...base, textAlign: "center" }}>
                  {igUrl ? (
                    <a
                      href={igUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={ttLinkStyle}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = "#E1306C";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = t.textMuted;
                      }}
                    >
                      IG
                    </a>
                  ) : (
                    <span style={{ color: t.textFaint }}>—</span>
                  )}
                </div>
              );
            }
            if (col.key === "videos") {
              const vc = creatorDisplayVideoCount(c);
              return (
                <div key={col.key} style={{ ...base, fontWeight: 600, color: vc ? t.text : t.textFaint }}>
                  {vc}
                </div>
              );
            }
            if (col.key === "avgViews") {
              const av = c.tiktokData?.avgViews;
              return (
                <div key={col.key} style={{ ...base, fontWeight: 600, color: av != null ? t.text : t.textFaint }}>
                  {av != null ? formatMetricShort(av) : "—"}
                </div>
              );
            }
            if (col.key === "ibScore") {
              const ib = c.ibScore != null ? Number(c.ibScore) : null;
              const ok = Number.isFinite(ib);
              return (
                <div key={col.key} style={{ ...base, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                  {ok ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          background: ibScoreTierColor(ib),
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 10,
                          fontWeight: 800,
                          color: "#fff",
                        }}
                      >
                        {Math.round(ib)}
                      </div>
                    </div>
                  ) : (
                    <span style={{ color: t.textFaint }}>—</span>
                  )}
                </div>
              );
            }
            if (col.key === "engRate") {
              const er = parseFloat(c.instagramEngRate ?? c.engagementRate ?? c.tiktokEngRate);
              let erc = t.textSecondary;
              if (Number.isFinite(er)) {
                if (er > 6) erc = t.green;
                else if (er < 3) erc = t.orange;
              }
              return (
                <div key={col.key} style={{ ...base, fontWeight: 600, color: Number.isFinite(er) ? erc : t.textFaint }}>
                  {Number.isFinite(er) ? `${er.toFixed(2)}%` : "—"}
                </div>
              );
            }
            if (col.key === "quality") {
              return (
                <div key={col.key} style={base}>
                  {c.quality === "High" ? (
                    <span style={{ color: "#f59e0b", fontWeight: 600, fontSize: 11 }}>★ High</span>
                  ) : (
                    <span style={{ color: t.textFaint, fontSize: 11 }}>Standard</span>
                  )}
                </div>
              );
            }
            if (col.key === "cost") {
              const rawCost = String(c.costPerVideo || "").trim();
              const costShow = rawCost ? (rawCost.startsWith("$") ? rawCost : `$${rawCost}`) : "—";
              const isEditing = editingCell?.creatorId === c.id && editingCell?.column === "cost";
              return (
                <div key={col.key} style={base} {...stopNav}>
                  {isEditing ? (
                    <input
                      autoFocus
                      defaultValue={rawCost}
                      style={{
                        width: "100%",
                        border: "none",
                        outline: "none",
                        background: t.green + "10",
                        color: t.text,
                        fontSize: 12,
                        fontFamily: "inherit",
                        padding: "2px 4px",
                        borderRadius: 3,
                        boxSizing: "border-box",
                      }}
                      onBlur={(e) => {
                        if (skipCreatorCellBlurRef.current) {
                          skipCreatorCellBlurRef.current = false;
                          return;
                        }
                        const af0 = c.aiAutoFilled && typeof c.aiAutoFilled === "object" ? c.aiAutoFilled : {};
                        updateCreator(c.id, { costPerVideo: e.target.value, aiAutoFilled: { ...af0, costPerVideo: false } });
                        setEditingCell(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.target.blur();
                        if (e.key === "Escape") {
                          e.preventDefault();
                          skipCreatorCellBlurRef.current = true;
                          setEditingCell(null);
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setEditingCell({ creatorId: c.id, column: "cost" });
                      }}
                      title="Double-click to edit"
                      style={{ color: rawCost ? t.textMuted : t.textFaint }}
                    >
                      {costShow}
                    </span>
                  )}
                </div>
              );
            }
            if (col.key === "notes") {
              const n = (c.notes || "").trim();
              const isEditing = editingCell?.creatorId === c.id && editingCell?.column === "notes";
              return (
                <div key={col.key} style={{ ...base, ...stopNav }} title={n}>
                  {isEditing ? (
                    <input
                      autoFocus
                      defaultValue={n}
                      style={{
                        width: "100%",
                        border: "none",
                        outline: "none",
                        background: t.green + "10",
                        color: t.text,
                        fontSize: 12,
                        fontFamily: "inherit",
                        padding: "2px 4px",
                        borderRadius: 3,
                        boxSizing: "border-box",
                      }}
                      onBlur={(e) => {
                        if (skipCreatorCellBlurRef.current) {
                          skipCreatorCellBlurRef.current = false;
                          return;
                        }
                        updateCreator(c.id, { notes: e.target.value });
                        setEditingCell(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.target.blur();
                        if (e.key === "Escape") {
                          e.preventDefault();
                          skipCreatorCellBlurRef.current = true;
                          setEditingCell(null);
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setEditingCell({ creatorId: c.id, column: "notes" });
                      }}
                      title="Double-click to edit"
                      style={{
                        display: "block",
                        fontSize: 11,
                        color: t.textMuted,
                        maxWidth: 150,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {n || "—"}
                    </span>
                  )}
                </div>
              );
            }
            return <div key={col.key} style={base} />;
          };

          return (
          <div style={{ maxWidth: "100%", margin: "0 auto", padding: "32px 24px 60px", animation: "fadeIn 0.3s ease" }}>
            <button type="button" onClick={() => navigate("ugcDashboard")} style={{ ...S.btnS, fontSize: 13, padding: "9px 18px", marginBottom: 12 }}>← Back</button>
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: t.text, letterSpacing: "-0.02em", marginBottom: 4 }}>Creators</div>
                  <div style={{ fontSize: 13, color: t.textMuted }}>
                    {creators.filter((cr) => cr.status === "Active").length} active · {creators.filter((cr) => cr.ibScore != null).length} scored · {creators.length} total
                  </div>
                  {creators.length > 0 &&
                    creators.filter((c) => c.instagramData?.avatarUrl || c.tiktokData?.avatarUrl).length < creators.length * 0.3 && (
                      <div style={{ fontSize: 11, color: t.orange, marginTop: 4 }}>
                        Most creators need enrichment to show avatars. Use Bulk Enrich or click into each profile → Refresh Metrics.
                      </div>
                    )}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddCreatorPanel((prev) => {
                        if (!prev) setTimeout(() => addHandleInputRef.current?.focus(), 0);
                        return !prev;
                      });
                    }}
                    style={{ ...S.btnP, height: 34, padding: "0 16px", fontSize: 13, display: "inline-flex", alignItems: "center" }}
                  >
                    + Add Creator
                  </button>
                  <button type="button" disabled={bulkEnrichProgress} onClick={runBulkEnrichAll} style={{ ...S.btnS, height: 34, padding: "0 14px", fontSize: 13, opacity: bulkEnrichProgress ? 0.6 : 1, display: "inline-flex", alignItems: "center" }}>
                    Enrich All
                  </button>
                  <button type="button" onClick={() => csvInputRef.current?.click()} style={{ ...S.btnS, height: 34, padding: "0 14px", fontSize: 13, display: "inline-flex", alignItems: "center" }}>Import CSV</button>
                  <input
                    ref={csvInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleCsvImport(f);
                      e.target.value = "";
                    }}
                  />
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
              <input
                type="text"
                value={creatorSearch}
                onChange={(e) => setCreatorSearch(e.target.value)}
                placeholder="Search creators..."
                style={{ flex: 1, maxWidth: 300, height: 34, padding: "0 12px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 13, boxSizing: "border-box" }}
              />
              <label style={{ fontSize: 12, color: t.textMuted, display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                <span>Skip if enriched within:</span>
                <select
                  value={bulkStaleWindow}
                  onChange={(e) => setBulkStaleWindow(e.target.value)}
                  style={{
                    height: 34,
                    padding: "0 8px",
                    borderRadius: 8,
                    border: `1px solid ${t.border}`,
                    background: t.inputBg,
                    color: t.inputText,
                    fontSize: 12,
                    maxWidth: 200,
                  }}
                >
                  <option value="24h">24 hours</option>
                  <option value="7d">7 days</option>
                  <option value="30d">30 days</option>
                  <option value="never">Never skip (re-pull all)</option>
                </select>
              </label>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 12, color: t.textFaint }}>
                Credits used this session: {creditsUsed}
              </span>
              <span style={{ fontSize: 12, color: t.textFaint }}>
                {sortedCreators.length} of {creators.length}
              </span>
            </div>

            {showAddCreatorPanel ? (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                <input
                  ref={addHandleInputRef}
                  type="text"
                  value={addHandleInput}
                  onChange={(e) => setAddHandleInput(e.target.value)}
                  disabled={addEnrichBusy}
                  placeholder="Paste a TikTok or Instagram handle (e.g. @natedank)"
                  onKeyDown={(e) => { if (e.key === "Enter" && !addEnrichBusy) runAddAndEnrich(); }}
                  style={{ flex: 1, minWidth: 220, padding: "10px 14px", borderRadius: 10, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 14 }}
                />
                <button type="button" disabled={addEnrichBusy} onClick={runAddAndEnrich} style={{ ...S.btnP, padding: "10px 18px", fontSize: 13, opacity: addEnrichBusy ? 0.65 : 1 }}>
                  {addEnrichBusy ? "Enriching…" : "Add & Enrich"}
                </button>
              </div>
              {addEnrichStepState ? (
                <div style={{ marginTop: 14, padding: 16, background: t.cardAlt, borderRadius: 12, border: `1px solid ${t.border}` }}>
                  {ENRICH_STEPS.map((step) => {
                    const st = addEnrichStepState[step.id];
                    const done = st === "ok";
                    const fail = st === "fail";
                    const run = st === "run" || st === "pending";
                    return (
                      <div key={step.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, fontSize: 13, color: done ? t.green : fail ? t.red : run ? t.text : t.textFaint }}>
                        <span style={{ width: 18, textAlign: "center" }}>{done ? "✓" : fail ? "✗" : run ? "…" : "○"}</span>
                        {step.label}
                      </div>
                    );
                  })}
                </div>
              ) : null}
              {duplicateModal ? (
                <div style={{ marginTop: 12, padding: 14, background: t.cardAlt, borderRadius: 12, border: `1px solid ${t.orange}55` }}>
                  <div style={{ fontSize: 13, marginBottom: 10, color: t.text }}>{duplicateModal.handle} already exists in your database</div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button type="button" onClick={() => { navigate("creatorDetail", { creatorId: duplicateModal.existingId }); setDuplicateModal(null); }} style={{ ...S.btnP, padding: "8px 14px", fontSize: 12 }}>View Existing</button>
                    <button type="button" disabled={addEnrichBusy} onClick={runReEnrichExisting} style={{ ...S.btnS, padding: "8px 14px", fontSize: 12 }}>Re-enrich</button>
                    <button type="button" onClick={() => setDuplicateModal(null)} style={{ ...S.btnS, padding: "8px 14px", fontSize: 12 }}>Cancel</button>
                  </div>
                </div>
              ) : null}
            </div>
            ) : null}

            {bulkEnrichProgress ? (
              <div
                style={{
                  position: "sticky",
                  top: 0,
                  zIndex: 50,
                  background: t.card,
                  borderBottom: `2px solid ${t.green}`,
                  padding: "12px 20px",
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                  marginBottom: 12,
                  borderRadius: 10,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>
                    Enriching {bulkEnrichProgress.cur}/{bulkEnrichProgress.total} — @
                    {String(bulkEnrichProgress.handle || "").replace(/^@/, "")}
                  </div>
                  <div style={{ fontSize: 11, color: t.textMuted }}>
                    {bulkEnrichProgress.done ?? 0} done · {bulkEnrichProgress.fail ?? 0} failed · {bulkEnrichProgress.skipped ?? 0} skipped
                  </div>
                  {bulkEnrichProgress.line ? <div style={{ fontSize: 11, color: t.green }}>{bulkEnrichProgress.line}</div> : null}
                </div>
                <div style={{ width: 200, height: 6, borderRadius: 3, background: t.border, overflow: "hidden", flexShrink: 0 }}>
                  <div
                    style={{
                      width: `${bulkEnrichProgress.total ? (bulkEnrichProgress.cur / bulkEnrichProgress.total) * 100 : 0}%`,
                      height: "100%",
                      background: t.green,
                      borderRadius: 3,
                      transition: "width 0.3s",
                    }}
                  />
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: t.green, flexShrink: 0 }}>
                  {bulkEnrichProgress.total ? Math.round((bulkEnrichProgress.cur / bulkEnrichProgress.total) * 100) : 0}%
                </div>
                <button
                  type="button"
                  onClick={() => {
                    bulkEnrichAbortRef.current = true;
                  }}
                  style={{ ...S.btnS, flexShrink: 0, fontSize: 12, padding: "6px 12px" }}
                >
                  Cancel
                </button>
              </div>
            ) : null}

            <div
              style={{
                overflowX: "auto",
                overflowY: "auto",
                maxHeight: "calc(100vh - 160px)",
                border: `1px solid ${t.border}`,
                borderRadius: 10,
                background: t.card,
              }}
            >
              <div style={{ minWidth: 1280 }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: buildCreatorGridTemplate(colWidths),
                    background: t.cardAlt,
                    borderBottom: `2px solid ${t.border}`,
                    position: "sticky",
                    top: 0,
                    zIndex: 10,
                  }}
                >
                  {CREATOR_COLUMNS.map((col) => renderHeaderCell(col))}
                </div>
                {sortedCreators.length === 0 ? (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: buildCreatorGridTemplate(colWidths),
                      padding: "40px 16px",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ gridColumn: "1 / -1", color: t.textMuted, fontSize: 14 }}>
                      <div style={{ marginBottom: 12 }}>No creators match your filters</div>
                      <button type="button" onClick={clearCreatorFilters} style={{ ...S.btnS, padding: "8px 16px", fontSize: 13 }}>Clear filters</button>
                    </div>
                  </div>
                ) : (
                  sortedCreators.map((c, rowIdx) => {
                    const isApplied = c.status === "Applied";
                    const stripeBg = rowIdx % 2 === 1 ? t.cardAlt + "30" : "transparent";
                    const defaultRowBg = isApplied ? t.purple + "06" : stripeBg;
                    return (
                    <div
                      key={c.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate("creatorDetail", { creatorId: c.id })}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("creatorDetail", { creatorId: c.id }); } }}
                      style={{
                        display: "grid",
                        gridTemplateColumns: buildCreatorGridTemplate(colWidths),
                        padding: 0,
                        borderBottom: `1px solid ${t.border}30`,
                        cursor: "pointer",
                        transition: "background 0.1s",
                        background: defaultRowBg,
                        borderLeft: isApplied ? `3px solid ${t.purple}` : "none",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = t.cardAlt + "80";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = defaultRowBg;
                      }}
                    >
                      {CREATOR_COLUMNS.map((col) => renderBodyCell(c, col))}
                    </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
          );
        })()}

        {!aiLoading && isCreatorViewAllowed && view === "creatorDetail" && (
          !detailCreator ? (
            <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px 60px", animation: "fadeIn 0.3s ease" }}>
              <button type="button" onClick={() => navigate("creators")} style={{ ...S.btnS, marginBottom: 16 }}>← Back</button>
              <div style={{ color: t.textMuted }}>Creator not found.</div>
            </div>
          ) : (
            <CreatorDetailErrorBoundary t={t}>
              <CreatorDetailView
                key={detailCreator.id}
                c={detailCreator}
                updateCreator={updateCreator}
                library={library}
                navigate={navigate}
                scrapeKey={scrapeKey}
                apiKey={apiKey}
                t={t}
                S={S}
                onScrapeCreditUsed={bumpScrapeCredit}
                setDbError={setDbError}
                aiKnowledge={aiKnowledge}
                teamMembers={teamMembers}
                setTeamMembers={setTeamMembers}
                getCreatorOwners={getCreatorOwners}
                creatorAssignments={creatorAssignments}
                setCreatorAssignments={setCreatorAssignments}
              />
            </CreatorDetailErrorBoundary>
          )
        )}

        {!aiLoading && isCreatorViewAllowed && view === "library" && (
          <div style={{ maxWidth: 960, margin: "0 auto", padding: "40px 24px 60px", animation: "fadeIn 0.3s ease" }}>
            <div style={{ ...S.formTitle, marginBottom: 24 }}>Brief Library</div>
            {library.length === 0 ? (
              <div style={S.empty}>
                <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}><Icon name="folder" size={32} color={t.textFaint} /></div>
                <div style={{ fontSize: 15, marginBottom: 8 }}>No briefs yet</div>
                <div style={{ fontSize: 13, marginBottom: currentRole === ROLES.CREATOR ? 0 : 24 }}>
                  {currentRole === ROLES.CREATOR ? "Briefs shared with you will appear here." : "Generated briefs will appear here."}
                </div>
                {currentRole !== ROLES.CREATOR && <button style={S.btnP} onClick={() => { setBriefPrefill(null); navigate("create"); setFormKey((k) => k + 1); }}>Create Your First Brief</button>}
              </div>
            ) : library.map(item => (
              <div
                key={item.id}
                style={S.listItem}
                onMouseEnter={currentRole === ROLES.CREATOR ? undefined : (e)=>{e.currentTarget.style.borderColor=t.green+"50"}}
                onMouseLeave={currentRole === ROLES.CREATOR ? undefined : (e)=>{e.currentTarget.style.borderColor=t.border}}
              >
                <div style={{ cursor: "pointer", flex: 1 }} onClick={()=>openLibraryItem(item)}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: t.textFaint, marginTop: 2 }}>{managerDisplayName(item.formData)} · {item.formData.vibe === "Other" && item.formData.customVibe?.trim() ? item.formData.customVibe.trim() : item.formData.vibe} · {formatPlatformsDisplay(item.formData)} · {formatToneDisplay(item.formData)} · {item.formData.videoLength}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ fontSize: 12, color: t.textFaint }}>{item.date}</div>
                  {currentRole !== ROLES.CREATOR && (
                    <button type="button" onClick={(e)=>{e.stopPropagation();deleteBrief(item.id)}} style={{ background: "none", border: "none", color: t.red, cursor: "pointer", fontSize: 14, padding: "4px 6px", borderRadius: 4, opacity: 0.6, display: "flex", alignItems: "center" }} title="Delete brief"><Icon name="x" size={16} color={t.red} /></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        </>}
        </>}

        {/* Change Request Widget — appears on every page */}
        {(() => {
          const pageNames = {
            home: "Homepage",
            ugcDashboard: "UGC Army Dashboard",
            creators: "Creators List",
            creatorDetail: "Creator Profile" + (detailCreator ? ` — ${detailCreator.handle || detailCreator.id}` : ""),
            create: "Brief Creator",
            library: "Brief Library",
            display: "Brief Display",
            pipeline: "Channel Pipeline",
            influencer: "Influencer Buys",
            tools: "Tools",
            videotool: "Video Tool",
            settings: "Settings",
            creatorDashboard: "Creator Portal — Dashboard",
            creatorProfile: "Creator Portal — Profile",
            creatorBriefView: "Creator Portal — Brief",
            creatorMessages: "Creator Portal — Messages",
            creatorLogin: "Creator Portal — Login",
            creatorOnboard: "Creator Portal — Onboarding",
            publicBrief: "Public Brief",
          };
          const currentPage = pageNames[view] || view || "Unknown";
          return <ChangeRequestWidget currentPage={currentPage} t={t} navigate={navigate} refreshOpenCount={() => { supabase.from("change_requests").select("id").eq("status", "open").then(({ data }) => setOpenChangeRequests((data || []).length)); }} />;
        })()}
      </div>
    </ThemeContext.Provider>
  );
}
