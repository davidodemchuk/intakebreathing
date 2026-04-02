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
} from "./supabaseDb.js";
import { supabase } from "./supabase.js";

// FUTURE: Arrow keys to navigate between cells, Tab to move right, Enter to edit

const CREATOR_COLUMNS = [
  { key: "status", label: "Status", width: 100, filterable: true, sortable: true },
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
const APP_VERSION = "5.34.0";
const CHANGELOG = [
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
    "One-click 'Download All Formats' button — ZIP with 1x1, 4x5, 9x16, 16x9",
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
    "Products: Starter Kit Black, Starter Kit Clear, Mouth Tape, Sports Tabs, Refills, Case, Other",
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
    bg: "#0a0a0f", card: "#161620", cardAlt: "#111118",
    border: "#252530", borderLight: "#333",
    navBg: "rgba(10,10,15,0.95)",
    text: "#ffffff", textSecondary: "#cccccc", textMuted: "#999999", textFaint: "#666666",
    inputBg: "#0d0d0d", inputText: "#ffffff",
    green: "#00FEA9", blue: "#63B7BA", red: "#ff6b6b", orange: "#ffaa3b", purple: "#c084fc",
    discBg: "rgba(0,0,0,0.3)",
    scrollThumb: "#222",
    isLight: false,
    shadow: "0 2px 8px rgba(0,0,0,0.4)",
  },
  light: {
    bg: "#f0f0f2", card: "#ffffff", cardAlt: "#f5f5f7",
    border: "#c8c8cc", borderLight: "#b0b0b5",
    navBg: "rgba(240,240,242,0.95)",
    text: "#0a0a0a", textSecondary: "#1a1a1a", textMuted: "#444444", textFaint: "#707070",
    inputBg: "#ffffff", inputText: "#0a0a0a",
    green: "#008c56", blue: "#2a7a7d", red: "#c62828", orange: "#b86e00", purple: "#6d28d9",
    discBg: "rgba(0,0,0,0.05)",
    scrollThumb: "#aaa",
    isLight: true,
    shadow: "0 1px 4px rgba(0,0,0,0.08), 0 0 1px rgba(0,0,0,0.12)",
  },
};

const ThemeContext = createContext();

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
  return ROUTES[path] || "home";
}

function Icon({ name, size = 20, color = "currentColor" }) {
  const icons = {
    film: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="2" />
        <line x1="2" y1="8" x2="22" y2="8" />
        <line x1="8" y1="2" x2="8" y2="8" />
        <line x1="16" y1="2" x2="16" y2="8" />
        <line x1="8" y1="2" x2="6" y2="8" />
        <line x1="16" y1="2" x2="14" y2="8" />
      </svg>
    ),
    send: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 2L11 13" />
        <path d="M22 2L15 22L11 13L2 9L22 2Z" />
      </svg>
    ),
    dollarSign: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5C8.57174 5 7.6815 5.36875 7.02513 6.02513C6.36875 6.6815 6 7.57174 6 8.5C6 9.42826 6.36875 10.3185 7.02513 10.9749C7.6815 11.6313 8.57174 12 9.5 12H14.5C15.4283 12 16.3185 12.3687 16.9749 13.0251C17.6313 13.6815 18 14.5717 18 15.5C18 16.4283 17.6313 17.3185 16.9749 17.9749C16.3185 18.6313 15.4283 19 14.5 19H6" />
      </svg>
    ),
    wrench: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    ),
    user: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
    target: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    ),
    barChart: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
    shield: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    alertTriangle: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    sliders: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="21" x2="4" y2="14" />
        <line x1="4" y1="10" x2="4" y2="3" />
        <line x1="12" y1="21" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12" y2="3" />
        <line x1="20" y1="21" x2="20" y2="16" />
        <line x1="20" y1="12" x2="20" y2="3" />
        <line x1="1" y1="14" x2="7" y2="14" />
        <line x1="9" y1="8" x2="15" y2="8" />
        <line x1="17" y1="16" x2="23" y2="16" />
      </svg>
    ),
    pen: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
    users: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    videoCamera: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </svg>
    ),
    anchor: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="5" r="3" />
        <line x1="12" y1="22" x2="12" y2="8" />
        <path d="M5 12H2a10 10 0 0 0 20 0h-3" />
      </svg>
    ),
    checkCircle: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    smartphone: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
        <line x1="12" y1="18" x2="12.01" y2="18" />
      </svg>
    ),
    package: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
    upload: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 16 12 12 8 16" />
        <line x1="12" y1="12" x2="12" y2="21" />
        <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
      </svg>
    ),
    video: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
        <line x1="7" y1="2" x2="7" y2="22" />
        <line x1="17" y1="2" x2="17" y2="22" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <line x1="2" y1="7" x2="7" y2="7" />
        <line x1="2" y1="17" x2="7" y2="17" />
        <line x1="17" y1="7" x2="22" y2="7" />
        <line x1="17" y1="17" x2="22" y2="17" />
      </svg>
    ),
    ban: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
      </svg>
    ),
    x: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    ),
    checkSm: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
    eye: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
    folder: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    ),
    zap: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    construction: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="6" width="20" height="8" rx="1" />
        <path d="M6 14v6M10 14v6M14 14v6M18 14v6" />
        <path d="M6 6V4M18 6V4" />
      </svg>
    ),
    arrowRight: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
      </svg>
    ),
  };
  return icons[name] || null;
}

// ═══════════════════════════════════════════════════════════
// DYNAMIC STYLES — generated per theme
// ═══════════════════════════════════════════════════════════

function getS(t) {
  return {
    app: { background: t.bg, minHeight: "100vh", color: t.text, fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif", transition: "background 0.3s, color 0.3s" },
    nav: { borderBottom: `1px solid ${t.border}`, padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: t.navBg, backdropFilter: "blur(12px)", zIndex: 100, transition: "background 0.3s", boxShadow: t.isLight ? "0 1px 3px rgba(0,0,0,0.06)" : "none" },
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

const PRODUCTS = ["Starter Kit Black", "Starter Kit Clear", "Mouth Tape", "Sports Tabs", "Refills", "Case", "Other"];

const VIBES = ["Fun & Entertaining", "Educational / How-To", "Trend / Challenge", "Unboxing / First Impressions", "Lifestyle / Routine", "Before & After", "Storytelling / Testimonial", "ASMR / Satisfying", "Other"];

const AGE_RANGES = ["18-24", "25-34", "35-44", "45-54", "55+"];
const GENDERS = ["Men & Women", "Men", "Women"];

const APPROVED_CLAIMS = [
  "Opens wider, holds stronger, and never collapses",
  "Drug-free — nothing to ingest, nothing wears off",
  "Magnetic lift expands from the sides",
  "Sweat-proof — designed for motocross and high-intensity training",
  "Reusable band — only replace the tabs",
  "Skin safe — hypoallergenic, latex-free, medical grade",
  "FDA registered, made in USA",
  "Starter Kit includes 4 sizes (S, M, L, XL) + 15 tab sets",
  "90-day risk-free trial",
  "Originally engineered for athletes, loved by everyone",
  "Nothing goes inside your nose — fully external",
];
const BANNED_CLAIMS = [
  '"Cures" or "treats" any medical condition',
  '"Clears congestion" or "decongestant"',
  '"Replaces medication" or "alternative to medication"',
  '"Clinically proven" without substantiation or proper citation',
  '"FDA approved" or "FDA cleared" — it is FDA registered, not approved',
  '"Guarantees" fit or results',
  '"Medical device" — it is an external nasal dilator',
  'Any diagnosis language like "you have sleep apnea"',
  '"Permanently" changes anything — effects are while wearing only',
];

const DEFAULT_REJECTIONS = [
  "Band is worn upside down — revisions will be required",
  "Adhesive tabs are not fully adhered to the nose — both sides must be flat and sealed before filming",
  "Applicator tool visible in the video — the applicator is for personal use only, not on camera",
];

function parseCustomRejections(text) {
  if (!text || typeof text !== "string") return [];
  return text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
}

function buildRejectionsArray(d, defaultRejectionsOverride) {
  const custom = parseCustomRejections(d?.customRejections);
  const base = Array.isArray(defaultRejectionsOverride) && defaultRejectionsOverride.length ? defaultRejectionsOverride : DEFAULT_REJECTIONS;
  return [...base, ...custom];
}

const ROLES = { MANAGER: "manager", CREATOR: "creator" };
const CREATOR_ALLOWED_VIEWS = ["library", "display"];

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (line[i] === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }
    current += line[i];
  }
  result.push(current.trim());
  return result;
}

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
function formatMetricShort(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const x = Number(n);
  if (x < 1000) return String(Math.round(x));
  if (x < 1_000_000) return `${(x / 1000).toFixed(x >= 10_000 ? 0 : 1)}K`;
  return `${(x / 1_000_000).toFixed(x >= 10_000_000 ? 1 : 2)}M`.replace(/\.0M$/, "M");
}

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
function calculateCreatorCPM(creator) {
  // ─── Step 1: Get actual view data ───
  const ttAvgViews = creator.tiktokData?.avgViews || creator.tiktokAvgViews || 0;
  const igRecentPosts = creator.instagramRecentPosts || [];
  const igRecentReels = creator.instagramRecentReels || [];

  // Instagram: use reel views if available, otherwise estimate from likes
  let igAvgViews = 0;
  if (igRecentReels.length > 0) {
    const reelViews = igRecentReels.map((r) => r.video_view_count || r.view_count || r.views || 0).filter((v) => v > 0);
    if (reelViews.length > 0) igAvgViews = Math.round(reelViews.reduce((a, b) => a + b, 0) / reelViews.length);
  }
  if (igAvgViews === 0 && igRecentPosts.length > 0) {
    // Conservative estimate: likes × 8 (industry average is 5-12x)
    const avgLikes = igRecentPosts.reduce((sum, p) => sum + (p.likes || p.like_count || 0), 0) / igRecentPosts.length;
    igAvgViews = Math.round(avgLikes * 8);
  }

  // Pick the platform with better data
  let avgViews;
  let platform;
  let videoCount;
  let platformFollowers;
  if (ttAvgViews > 0) {
    avgViews = ttAvgViews;
    platform = "TikTok";
    videoCount = (creator.tiktokData?.recentVideos || []).length || 15;
    platformFollowers = creator.tiktokData?.followers || 0;
  } else if (igAvgViews > 0) {
    avgViews = igAvgViews;
    platform = "Instagram";
    videoCount = igRecentReels.length || igRecentPosts.length;
    platformFollowers = creator.instagramData?.followers || 0;
  } else {
    return null; // No view data — can't calculate
  }

  // ─── Step 2: Base CPM by tier (CAPPED AT $25) ───
  const totalFollowers = Math.max(creator.instagramData?.followers || 0, creator.tiktokData?.followers || 0);

  let cpmBase;
  let tier;
  if (totalFollowers < 5000) {
    cpmBase = 5;
    tier = "Nano (<5K)";
  } else if (totalFollowers < 15000) {
    cpmBase = 8;
    tier = "Micro (5-15K)";
  } else if (totalFollowers < 50000) {
    cpmBase = 12;
    tier = "Rising (15-50K)";
  } else if (totalFollowers < 150000) {
    cpmBase = 16;
    tier = "Mid (50-150K)";
  } else if (totalFollowers < 500000) {
    cpmBase = 20;
    tier = "Established (150-500K)";
  } else {
    cpmBase = 25;
    tier = "Major (500K+)";
  }
  // CPM never exceeds $25
  const cpmFinal = Math.min(cpmBase, 25);

  // ─── Step 3: Content alignment multiplier ───
  // Check if creator's content aligns with Intake's categories
  const niche = (creator.niche || "").toLowerCase();
  const ttBio = (creator.tiktokData?.bio || "").toLowerCase();
  const igBio = (creator.instagramData?.bio || "").toLowerCase();
  const allBios = `${niche} ${ttBio} ${igBio}`;
  const aiAnalysis = creator.aiAnalysis || {};

  // Intake-aligned keywords
  const intakeKeywords = [
    "breath",
    "nasal",
    "sleep",
    "running",
    "fitness",
    "athlete",
    "sports",
    "wellness",
    "health",
    "gym",
    "workout",
    "exercise",
    "recovery",
    "performance",
    "endurance",
    "cardio",
    "mma",
    "boxing",
    "cycling",
    "triathlon",
    "crossfit",
    "yoga",
    "meditation",
    "airway",
    "snoring",
    "cpap",
  ];
  const competitorKeywords = ["breathe right", "rhinomed", "mute snoring", "airmax", "intake competitor"];

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

  // Floor: $50 minimum (beginner UGC rate)
  rateLow = Math.max(50, rateLow);
  rateHigh = Math.max(75, rateHigh);

  // Cap: $500 max per video (Intake's UGC budget range)
  // Anything above $500 is influencer territory, not UGC
  rateLow = Math.min(rateLow, 400);
  rateHigh = Math.min(rateHigh, 500);

  // Make sure low < high
  if (rateLow >= rateHigh) rateHigh = rateLow + 25;

  const rateDisplay = `$${rateLow}-${rateHigh}`;

  // ─── Build explanation ───
  const explanation = [
    `Base: ${formatMetricShort(avgViews)} avg views × $${cpmFinal} CPM (${tier}) = $${Math.round((avgViews / 1000) * cpmFinal)}`,
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

/** After enrichment, attach cpmData and optionally auto-fill costPerVideo from CPM (or legacy AI rate). */
function enrichPatchWithCpm(creatorBefore, patch, mergedCreator) {
  const prevAf =
    creatorBefore && creatorBefore.aiAutoFilled && typeof creatorBefore.aiAutoFilled === "object"
      ? creatorBefore.aiAutoFilled
      : { niche: false, quality: false, costPerVideo: false };
  const baseAf = patch && patch.aiAutoFilled && typeof patch.aiAutoFilled === "object" ? patch.aiAutoFilled : {};
  const emptyCost = !String((creatorBefore && creatorBefore.costPerVideo) || "").trim();
  const cpmCalc = calculateCreatorCPM(mergedCreator);
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
  if (n >= 90) return "#00FEA9";
  if (n >= 75) return "#22c55e";
  if (n >= 60) return "#3b82f6";
  if (n >= 40) return "#f59e0b";
  return "#ef4444";
}

/** Build all enrichment structs from 11 parallel API raw responses. */
function processElevenPlatformApiResults(cleanHandle, igHandle, raw, existingInstagramData = {}) {
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
    const recent = videos.slice(0, 15);
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
    const recent = posts.slice(0, 12);
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
    igRecentReels = reels.slice(0, 10).map((r) => ({
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

  const brandBlock = (ctx.brandContext && String(ctx.brandContext).trim())
    ? `BRAND / COMPANY CONTEXT (use for content alignment, outreach tone, and "why Intake"):\n${String(ctx.brandContext).trim()}\n\n`
    : `BRAND / COMPANY CONTEXT: Intake Breathing — magnetic external nasal dilator for better breathing, sleep, and athletic performance. FDA registered, made in USA.\n\n`;

  const prompt = `You are the IB Score calculator for Intake Breathing, a magnetic nasal dilator company for better breathing, sleep, and athletic performance.

${brandBlock}CREATOR: @${cleanHandle}
NAME: ${tiktokData?.displayName || instagramData?.fullName || "Unknown"}

INSTAGRAM (primary platform — weight 45%):
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

TIKTOK (weight 30%):
  Followers: ${safeNum(tiktokData?.followers)}
  Total Hearts: ${safeNum(tiktokData?.hearts)}
  TT Videos: ${safeNum(tiktokData?.videoCount)}
  TT Engagement Rate: ${safeRate(ttEngRate)}
  Avg Views per video: ${safeNum(tiktokData?.avgViews)}
  Bio: ${tiktokData?.bio || "none"}
  Verified: ${tiktokData?.verified || false}
  Has TikTok Shop: ${tiktokShopData?.hasShop || false} (${tiktokShopData?.productCount || 0} products)
  Recent video captions: ${ttCaptions || "none"}

CROSS-PLATFORM PRESENCE (weight 10%):
  YouTube: ${youtubeData ? `${safeNum(youtubeData.subscribers)} subscribers` : "not found"}
  Twitter/X: ${twitterData ? `${safeNum(twitterData.followers)} followers` : "not found"}
  LinkedIn: ${linkedinData ? "present" : "not found"}
  Facebook: ${facebookData ? `${safeNum(facebookData.followers)} followers` : "not found"}
  Snapchat: ${snapchatData ? "present" : "not found"}

Return ONLY a JSON object:
{
  "ibScore": <number 1-100>,
  "scoreBreakdown": {
    "instagramScore": <0-45>,
    "instagramReason": "<1 sentence explaining the Instagram score>",
    "tiktokScore": <0-30>,
    "tiktokReason": "<1 sentence explaining the TikTok score>",
    "crossPlatform": <0-10>,
    "crossPlatformReason": "<1 sentence explaining cross-platform score>",
    "contentAlignment": <0-15>,
    "contentAlignmentReason": "<1 sentence explaining content alignment score>"
  },
  "scoreLabel": <"Elite" | "Excellent" | "Strong" | "Promising" | "Low Fit">,
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
  "outreachDM": "<2-3 sentence Instagram DM personalized to this creator's content. Mention Intake Breathing, reference something specific about their content, keep it casual and authentic. Do not mention payment.>",
  "outreachEmail": "<3-4 sentence email for partnership proposal. Professional but warm. Mention their specific content themes and why Intake is a fit.>",
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

  // Debug logging — shows actual API response structures
  if (typeof window !== "undefined" && window.console) {
    console.group("[Enrich] Raw API responses for @" + cleanHandle);
    console.log("TT Profile:", JSON.stringify(ttProfileRaw)?.substring(0, 500));
    console.log("TT Videos:", JSON.stringify(ttVideosRaw)?.substring(0, 500));
    console.log("IG Profile:", JSON.stringify(igProfileRaw)?.substring(0, 500));
    console.log("IG Posts:", JSON.stringify(igPostsRaw)?.substring(0, 500));
    console.log("YouTube:", JSON.stringify(ytFinal)?.substring(0, 500));
    console.log("Twitter:", JSON.stringify(twFinal)?.substring(0, 500));
    console.log("LinkedIn:", JSON.stringify(liRaw)?.substring(0, 500));
    console.log("Snapchat:", JSON.stringify(snapRaw)?.substring(0, 500));
    console.log("Facebook:", JSON.stringify(fbRaw)?.substring(0, 500));
    console.groupEnd();
  }

  if (opts?.requireTikTokProfile && !ttProfileRaw) {
    const e = new Error("NOT_FOUND");
    e.status = 404;
    throw e;
  }

  const processed = processElevenPlatformApiResults(cleanHandle, igHandle, {
    ttProfileRaw,
    ttVideosRaw,
    ttShopRaw,
    igProfileRaw,
    igPostsRaw,
    igReelsRaw,
    ytData: ytFinal,
    twData: twFinal,
    liData: liRaw,
    snapData: snapRaw,
    fbData: fbRaw,
  }, opts?.existingInstagramData || {});

  let aiAnalysis = null;
  if (!skipAi && ak) {
    onStep?.("ai_score", "run");
    aiAnalysis = await runIbScoreClaude({
      apiKey: ak,
      brandContext: opts?.brandContext,
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
    liRaw,
    snapRaw,
    fbRaw,
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

function genShareId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `share-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

const PLATFORMS = ["TikTok", "Instagram Reels", "YouTube Shorts", "Facebook", "Other"];

const MANAGERS = ["Summer", "Mike Max", "David", "Chris", "Alex", "Other"];

const AI_STEPS = [
  { id: "analyze", label: "Analyzing campaign inputs", duration: 2000 },
  { id: "audience", label: "Profiling target audience", duration: 3000 },
  { id: "hooks", label: "Writing scroll-stopping hooks", duration: 4000 },
  { id: "story", label: "Building Problem → Agitate → Solution arc", duration: 6000 },
  { id: "compliance", label: "Checking compliance guardrails", duration: 3000 },
  { id: "overlays", label: "Generating overlay & visual ideas", duration: 3000 },
  { id: "polish", label: "Polishing final brief", duration: 3000 },
];

const VIDEO_REFORMAT_GROUPS = [
  {
    title: "META ADS",
    items: [
      { id: "meta-feed-sq", name: "Feed Square", ratio: "1:1", dimensions: "1080×1080", placement: "Facebook & Instagram Feed", recommended: true },
      { id: "meta-feed-v", name: "Feed Vertical", ratio: "4:5", dimensions: "1080×1350", placement: "FB & IG Feed (mobile optimized)", recommended: true },
      { id: "meta-stories", name: "Stories & Reels", ratio: "9:16", dimensions: "1080×1920", placement: "FB/IG Stories, Reels", recommended: true },
      { id: "meta-instream", name: "In-Stream", ratio: "16:9", dimensions: "1920×1080", placement: "Facebook In-Stream, Video Feed" },
      { id: "meta-carousel", name: "Carousel", ratio: "1:1", dimensions: "1080×1080", placement: "FB & IG Carousel" },
    ],
  },
  {
    title: "YOUTUBE ADS",
    items: [
      { id: "yt-instream", name: "In-Stream / Pre-Roll", ratio: "16:9", dimensions: "1920×1080", placement: "Skippable & Non-Skippable", recommended: true },
      { id: "yt-shorts", name: "Shorts", ratio: "9:16", dimensions: "1080×1920", placement: "YouTube Shorts", recommended: true },
      { id: "yt-discovery", name: "Discovery", ratio: "1:1", dimensions: "1080×1080", placement: "YouTube Home & Search" },
      { id: "yt-bumper", name: "Bumper", ratio: "16:9", dimensions: "1920×1080", placement: "6-second Bumper Ads" },
    ],
  },
  {
    title: "TIKTOK",
    items: [
      { id: "tt-native", name: "TikTok Native", ratio: "9:16", dimensions: "1080×1920", placement: "TikTok Feed", recommended: true },
    ],
  },
];

function formatCount(n) {
  const x = Number(n);
  if (!x || x === 0) return "0";
  if (x >= 1000000) return (x / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (x >= 1000) return (x / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(Math.round(x));
}

function durationToSeconds(d) {
  if (typeof d === "number") return d > 1000 ? Math.round(d / 1000) : d;
  return 0;
}

function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}

function aspectRatioLabel(w, h) {
  if (!w || !h) return "—";
  const g = gcd(w, h);
  return `${w / g}:${h / g}`;
}

const LENGTHS = ["15-30s", "30-60s", "60-90s", "90s+"];
const TONES = ["Real & relatable", "Funny & casual", "Aspirational", "Educational", "Dramatic/storytelling", "ASMR/satisfying", "Other"];

const SUPERVISION_LEVELS = [
  { value: "full", label: "Full Review", desc: "Manager will request edits before approval" },
  { value: "light", label: "Light Touch", desc: "Minor feedback may be given, but mostly trust the creator" },
  { value: "handsoff", label: "Hands Off", desc: "Submit and done — no revision rounds expected" },
];

const SUPERVISION_FORM_HINTS = {
  full: "You'll request edits before approving",
  light: "Minor feedback possible, mostly trust the creator",
  handsoff: "Submit and done — no back and forth",
};

function buildBriefExtractionPrompt(productsOverride) {
  const pList = Array.isArray(productsOverride) && productsOverride.length ? productsOverride : PRODUCTS;
  return `You are reading an old creator/UGC brief. Extract the key information and map it to Intake Breathing's brief format.

Intake Breathing makes nasal breathing strips for athletes and sleep. Return ONLY a JSON object with these fields (string values unless noted):

{
  "productName": "<one of: ${pList.join("', '")}>",
  "customProductName": "<if productName is Other, the specific product name; else empty string>",
  "campaignName": "<campaign name or empty string>",
  "vibe": "<one of: ${VIBES.join("', '")}>",
  "customVibe": "<if vibe is Other, describe; else empty string>",
  "mission": "<the core message or goal in 1-2 sentences — do not quote the source verbatim>",
  "problem": "<audience problem from the brief's perspective>",
  "ageRange": "<one of: ${AGE_RANGES.join("', '")}>",
  "gender": "<one of: ${GENDERS.join("', '")}>",
  "platforms": <JSON array of strings, each one of: ${PLATFORMS.join(", ")} — use multiple if needed>,
  "videoLength": "<one of: ${LENGTHS.join("', '")}>",
  "tone": "<one of: ${TONES.join("', '")}>",
  "customTone": "<if tone is Other, describe; else empty string>",
  "notes": "<extra instructions, talking points, or requirements that do not fit other fields>",
  "contentQuantity": "<number of videos as string, default '1'>",
  "budgetPerVideo": "<digits only, no $; default '100' if unknown>",
  "manager": "<one of: ${MANAGERS.join("', '")} — if a specific person is named who is not listed, use Other and put their name in customManager>",
  "customManager": "<if manager is Other, the person's name; else empty string>"
}

Rules:
- Map concepts to Intake's enums; pick the closest option when unsure.
- If the old brief mentions a competitor product, still map to the closest Intake product or Other with a sensible custom name.
- Extract the SPIRIT of the brief; paraphrase — do not paste verbatim phrases from the source.
- If a field cannot be determined, use sensible defaults aligned with a nasal dilator brand.
- notes should hold unique requirements that do not fit elsewhere.
- Return ONLY the JSON object, no markdown fences or commentary.`;
}

const DEFAULTS = {
  manager: "Summer", customManager: "", contentQuantity: "1",
  budgetPerVideo: "100",
  supervisionLevel: "full",
  productName: "Starter Kit Black", customProductName: "", campaignName: "", vibe: "Fun & Entertaining", customVibe: "", mission: "",
  ageRange: "25-34", gender: "Men & Women", problem: "",
  platforms: ["TikTok"], customPlatform: "", videoLength: "15-30s", tone: "Real & relatable", customTone: "", notes: "",
  customRejections: "",
  approvedClaims: [...APPROVED_CLAIMS.slice(0, 5)],
  bannedClaims: [...BANNED_CLAIMS.slice(0, 5)],
};

// ═══════════════════════════════════════════════════════════
// BRIEF GENERATOR
// ═══════════════════════════════════════════════════════════

function splitSentences(text) {
  if (!text) return [];
  return text.split(/(?<=[.!?])\s+|;\s*/).map(s => s.trim().replace(/\.$/, "")).filter(s => s.length > 5);
}
function pick(arr, n) { return [...arr].sort(() => Math.random() - 0.5).slice(0, Math.min(n, arr.length)); }

const TONE_HOOKS = {
  "Real & relatable": ["Okay this is not a drill…", "Why did nobody tell me about this sooner?", "I was today years old when I found out…", "Real talk — I was skeptical too."],
  "Funny & casual": ["I look ridiculous but hear me out…", "My partner thinks I've lost it but LOOK—", "POV: you discover you've been breathing wrong your whole life", "Wait… it comes with HOW many sizes??"],
  "Aspirational": ["The one change that leveled up my performance.", "What elite athletes know that you don't.", "This is the difference between good sleep and GREAT sleep.", "Stop settling for half-breaths."],
  "Educational": ["Here's something most people don't know about nasal breathing…", "Did you know your nose has a 'right size'?", "Let me show you how this actually works.", "The science behind why this feels so different."],
  "Dramatic/storytelling": ["Three months ago I couldn't sleep through the night…", "I didn't believe it until I tried Level 3.", "This tiny thing changed my entire morning routine.", "What happened when I finally found my size…"],
  "ASMR/satisfying": ["*click* — hear that magnetic snap?", "The sound of it clicking on is everything.", "Watch it open up in real time…", "There's something so satisfying about this…"],
};

const PLATFORM_NOTES = {
  "TikTok": "Post natively in TikTok. Use trending sounds. Vertical 9:16, 1080×1920 min. Captions MANDATORY — 80% watched on mute. First frame must hook in 1 second. No watermarks.",
  "Instagram Reels": "Post as Reel (not Story). Vertical 9:16. Hook in first 2 seconds. Cover image matters. Hashtags in caption, not on-screen.",
  "YouTube Shorts": "Vertical 9:16, max 60s. Audience skews older — be direct. Front-load the hook. Review auto-captions.",
  "Facebook": "Vertical or square (1:1). Older audience — lean into credibility. Longer formats perform better. Clear CTA.",
  "Other": "Follow that platform's native specs for aspect ratio, length, and safe zones. Vertical 9:16 is standard for short-form unless the platform specifies otherwise.",
};
const LENGTH_GUIDE = {
  "15-30s": "Hook by second 2, problem by 5, solution by 15, CTA in last 3.",
  "30-60s": "Hook in 3s, 15s problem/agitate, 20s solution/demo, CTA at end.",
  "60-90s": "Fuller story arc. Build tension. Still front-load the hook.",
  "90s+": "Break into chapters. Keep energy high. Don't let the middle drag.",
};
const PERSONAS = ["The Curious Scroller", "The Skeptical Shopper", "The Scroll-Past Skeptic", "The Late-Night Browser", "The Try-Anything Explorer", "The Sleep Seeker", "The Mouth-Breather in Denial"];

function getDefaultAiKnowledge() {
  return {
    approvedClaims: [...APPROVED_CLAIMS],
    bannedClaims: [...BANNED_CLAIMS],
    products: [...PRODUCTS],
    defaultRejections: [...DEFAULT_REJECTIONS],
    toneHooks: { ...TONE_HOOKS },
    platformNotes: { ...PLATFORM_NOTES },
    lengthGuide: { ...LENGTH_GUIDE },
    personas: [...PERSONAS],
    brandContext:
      "Intake Breathing Technology makes magnetic external nasal dilators. Originally designed for motocross athletes. Opens wider, holds stronger, never collapses. FDA registered, made in USA. Medical grade, hypoallergenic, latex-free. 90-day risk-free trial. Starter Kit includes 4 sizes (S, M, L, XL) + 15 tab sets.",
  };
}

function normalizePlatforms(d) {
  if (Array.isArray(d.platforms) && d.platforms.length) return d.platforms;
  if (d.platform) return [d.platform];
  return ["TikTok"];
}

function formatPlatformsDisplay(fd) {
  const plats = normalizePlatforms(fd);
  return plats.map((p) => (p === "Other" && fd.customPlatform?.trim() ? fd.customPlatform.trim() : p)).join(", ");
}

function managerDisplayName(d) {
  if (!d) return "";
  if (d.manager === "Other" && (d.customManager || "").trim()) return (d.customManager || "").trim();
  return d.manager || "Summer";
}

function formatToneDisplay(fd) {
  if (fd.tone === "Other" && fd.customTone?.trim()) return fd.customTone.trim();
  return fd.tone || "";
}

function generateBrief(d, knowledge) {
  const k = knowledge && typeof knowledge === "object" ? knowledge : null;
  const personas = k?.personas?.length ? k.personas : PERSONAS;
  const toneHooks = k?.toneHooks && typeof k.toneHooks === "object" ? k.toneHooks : TONE_HOOKS;
  const platformNotes = k?.platformNotes && typeof k.platformNotes === "object" ? k.platformNotes : PLATFORM_NOTES;
  const lengthGuide = k?.lengthGuide && typeof k.lengthGuide === "object" ? k.lengthGuide : LENGTH_GUIDE;
  const approvedFallback = k?.approvedClaims?.length ? k.approvedClaims : APPROVED_CLAIMS;
  const bannedFallback = k?.bannedClaims?.length ? k.bannedClaims : BANNED_CLAIMS;

  const productLabel = d.productName === "Other" ? (d.customProductName || "").trim() : d.productName;
  const fullProduct = productLabel ? `Intake Breathing — ${productLabel}` : "Intake Breathing";
  const mission = d.mission || `Discover what ${fullProduct} can do for you.`;
  const ageRange = d.ageRange || "25-34";
  const genderLabel = d.gender || "Men & Women";
  const age = `${ageRange} · ${genderLabel}`;
  const problemText = (d.problem || d.customProblem || "").trim();
  const problemSentences = splitSentences(problemText);
  const persona = personas[Math.floor(Math.random() * personas.length)];
  const psycho = problemText.length > 20
    ? `Target: ${genderLabel}, ages ${ageRange}. ${problemText}`
    : `Target: ${genderLabel}, ages ${ageRange}. They've seen the product in their feed but haven't pulled the trigger. Open-minded but need proof. They trust real people over polished ads.`;
  const isStarterKit = productLabel.startsWith("Starter Kit");
  const isMouthTape = productLabel === "Mouth Tape";
  const solBase = isStarterKit ? "The Starter Kit includes 4 magnetic bands (S, M, L, XL) and 15 adhesive tab sets. It's magnetic, reusable, and stays on through workouts and sleep." : isMouthTape ? "Intake Mouth Tape keeps your mouth closed so you breathe through your nose all night. Pair with the nasal dilator for max airflow." : `${fullProduct} is part of the Intake Breathing system for better nasal breathing.`;
  const solutionSentences = splitSentences(solBase);
  const theyAre = ["Curious but cautious — needs a push, not a pitch", "Scrolls fast — 2 seconds to hook or gone", "Trusts real reactions over polished ads", "Open to trying if the risk feels low"];
  const theyAreNot = ["Already a loyal customer — this is for NEW eyes", "Looking for a medical solution or prescription", "Going to watch a 3-minute infomercial", "Impressed by corporate jargon"];
  const probInst = problemSentences.length > 0 ? `Open with the core misconception: ${problemSentences[0]}` : "Start with the viewer's doubt — why haven't they tried this yet?";
  const probLines = problemSentences.length >= 2 ? pick(problemSentences, 3) : ["I always assumed this was one-size-fits-all", "I saw this online and thought no way", "Everyone's talking about it but I figured it was hype"];
  const probOverlays = ["Text: the misconception in big bold quotes", "Reenact the 'scroll past' moment", "Split screen: skeptical face vs. product"];
  const agInst = "Twist the knife — make them feel the cost of NOT trying.";
  const agLines = ["You're literally leaving better sleep on the table", "Every night without this is a night you're not breathing fully", "Over a million people already figured this out"];
  const agOverlays = ["Counter: '1,000,000+ customers'", "'Still scrolling past?' with raised eyebrow", "Quick montage of real reactions"];
  const solInst = solutionSentences.length > 0 ? `Deliver the payoff: ${solutionSentences[0]}` : "Show the product in action.";
  const solLines = solutionSentences.length >= 2 ? pick(solutionSentences, 3) : ["This changed everything", "I can't believe the difference", "I'm never going back"];
  const solOverlays = ["Before/after or progression reveal", "Product in action — the key moment", "End card: product + CTA + 90-day trial"];
  const toneResolved = d.tone === "Other" ? (d.customTone || "").trim() : (d.tone || "");
  const hookKey = d.tone === "Other" ? "Real & relatable" : d.tone;
  const hooks = toneHooks[hookKey] || toneHooks["Real & relatable"];
  const vibeLabel = d.vibe === "Other" ? (d.customVibe || "").trim() : d.vibe;
  const vibePrefix = d.vibe === "Other" && vibeLabel ? `Campaign vibe: ${vibeLabel}\n\n` : "";
  const tonePrefix = toneResolved ? `Tone / voice: ${toneResolved}\n\n` : "";
  const platformsArr = normalizePlatforms(d);
  const noteBlocks = platformsArr.map((p) => {
    const base = (platformNotes[p] || "").trim();
    if (platformNotes[p]) {
      if (p === "Other" && (d.customPlatform || "").trim()) {
        const o = (d.customPlatform || "").trim();
        return base ? `${base}\nNamed platform: ${o}` : `Platform: ${o}`;
      }
      return base;
    }
    const otherBase = (platformNotes["Other"] || "").trim();
    return otherBase ? `${otherBase}\nNamed platform: ${p}` : `Platform: ${p}`;
  }).filter(Boolean);
  const lg = lengthGuide[d.videoLength] || "";
  const platNotes = vibePrefix + tonePrefix + noteBlocks.join("\n\n—\n\n") + (noteBlocks.length && lg ? "\n\n" : "") + lg;
  const platLabel = (p) => {
    if (p === "Other" && (d.customPlatform || "").trim()) return (d.customPlatform || "").trim();
    return p;
  };
  const mgr = managerDisplayName(d);
  const qty = String(d.contentQuantity ?? "1").trim() || "1";
  const rawBudget = String(d.budgetPerVideo ?? "").trim().replace(/^\$/, "");
  const budgetStr = rawBudget ? `$${rawBudget}/video` : "TBD";
  const supVal = d.supervisionLevel || "full";
  const supervisionLabel = SUPERVISION_LEVELS.find((s) => s.value === supVal)?.label || "Full Review";
  let supervisionExtra = "";
  if (supVal === "handsoff") supervisionExtra = " No revision rounds — submit your best take.";
  else if (supVal === "full") supervisionExtra = " Expect 1-2 rounds of revisions before final approval.";
  else if (supVal === "light") supervisionExtra = " Minor feedback may be provided but revisions are unlikely.";
  const deliverables = `Submitted by: ${mgr}. Content requested: ${qty} videos. Submit for: ${platformsArr.map(platLabel).join(", ")}. Budget: ${budgetStr}. Supervision: ${supervisionLabel}.${supervisionExtra} (1) Final video — vertical 9:16, 1080×1920 min, ${d.videoLength}. (2) Raw footage. (3) One thumbnail still. Upload via creator portal.`;
  const rejections = buildRejectionsArray(d, k?.defaultRejections);
  const approvedForBrief = Array.isArray(d.approvedClaims) && d.approvedClaims.length ? [...d.approvedClaims] : [...approvedFallback.slice(0, 5)];
  const bannedForBrief = Array.isArray(d.bannedClaims) && d.bannedClaims.length ? [...d.bannedClaims] : [...bannedFallback.slice(0, 5)];
  return { mission, persona, age, psycho, theyAre, theyAreNot, probInst, probLines, probOverlays, agInst, agLines, agOverlays, solInst, solLines, solOverlays, hooks, sayThis: approvedForBrief, notThis: bannedForBrief, platNotes, deliverables, rejections };
}

// ═══════════════════════════════════════════════════════════
// FORM
// ═══════════════════════════════════════════════════════════

function mergeExtractedBriefToPrefill(extracted, knowledge) {
  const k = knowledge && typeof knowledge === "object" ? knowledge : null;
  const productsList = k?.products?.length ? k.products : PRODUCTS;
  const baseDefaults = {
    ...DEFAULTS,
    approvedClaims: [...(k?.approvedClaims?.length ? k.approvedClaims.slice(0, 5) : APPROVED_CLAIMS.slice(0, 5))],
    bannedClaims: [...(k?.bannedClaims?.length ? k.bannedClaims.slice(0, 5) : BANNED_CLAIMS.slice(0, 5))],
  };
  const base = {
    ...baseDefaults,
    approvedClaims: [...baseDefaults.approvedClaims],
    bannedClaims: [...baseDefaults.bannedClaims],
  };
  if (!extracted || typeof extracted !== "object") return base;

  const out = { ...base };

  const pName = extracted.productName;
  if (typeof pName === "string" && productsList.includes(pName)) {
    out.productName = pName;
    out.customProductName = pName === "Other" ? String(extracted.customProductName ?? "").trim() : "";
  } else if (typeof pName === "string" && pName.trim()) {
    out.productName = "Other";
    out.customProductName = pName.trim();
  }

  if (extracted.campaignName != null) out.campaignName = String(extracted.campaignName);

  const vibe = extracted.vibe;
  if (typeof vibe === "string" && VIBES.includes(vibe)) {
    out.vibe = vibe;
    out.customVibe = vibe === "Other" ? String(extracted.customVibe ?? "").trim() : "";
  } else if (typeof vibe === "string" && vibe.trim()) {
    out.vibe = "Other";
    out.customVibe = vibe.trim();
  }

  if (extracted.mission != null) out.mission = String(extracted.mission);
  if (extracted.problem != null) out.problem = String(extracted.problem);

  const ar = extracted.ageRange;
  if (typeof ar === "string" && AGE_RANGES.includes(ar)) out.ageRange = ar;

  const g = extracted.gender;
  if (typeof g === "string" && GENDERS.includes(g)) out.gender = g;

  if (Array.isArray(extracted.platforms) && extracted.platforms.length) {
    const mapPlat = (p) => {
      if (typeof p !== "string") return null;
      const s = p.trim();
      if (!s) return null;
      if (PLATFORMS.includes(s)) return s;
      if (/instagram/i.test(s)) return "Instagram Reels";
      if (/youtube/i.test(s) && /short/i.test(s)) return "YouTube Shorts";
      if (/^tiktok$/i.test(s) || /^tik tok$/i.test(s)) return "TikTok";
      if (/facebook/i.test(s)) return "Facebook";
      return s;
    };
    const pl = extracted.platforms.map(mapPlat).filter(Boolean);
    if (pl.length) out.platforms = pl;
  }

  const vl = extracted.videoLength;
  if (typeof vl === "string" && LENGTHS.includes(vl)) out.videoLength = vl;

  const tone = extracted.tone;
  if (typeof tone === "string") {
    if (TONES.includes(tone)) {
      out.tone = tone;
      out.customTone = tone === "Other" ? String(extracted.customTone ?? "").trim() : "";
    } else if (tone.trim()) {
      out.tone = "Other";
      out.customTone = tone.trim();
    }
  }

  if (extracted.notes != null) out.notes = String(extracted.notes);

  if (extracted.contentQuantity != null) {
    const q = String(extracted.contentQuantity).replace(/\D/g, "") || "1";
    out.contentQuantity = String(Math.max(1, parseInt(q, 10) || 1));
  }
  if (extracted.budgetPerVideo != null) {
    out.budgetPerVideo = String(extracted.budgetPerVideo).replace(/^\$/, "").replace(/[^\d.]/g, "") || DEFAULTS.budgetPerVideo;
  }

  const mgr = extracted.manager;
  if (typeof mgr === "string" && MANAGERS.includes(mgr)) {
    out.manager = mgr;
    out.customManager = mgr === "Other" ? String(extracted.customManager ?? "").trim() : "";
  } else if (typeof mgr === "string" && mgr.trim()) {
    out.manager = "Other";
    out.customManager = mgr.trim();
  } else if (typeof extracted.customManager === "string" && extracted.customManager.trim()) {
    out.manager = "Other";
    out.customManager = extracted.customManager.trim();
  }

  return out;
}

function getBriefFormBaseDefaults(ak) {
  const a = ak && typeof ak === "object" ? ak : null;
  return {
    ...DEFAULTS,
    approvedClaims: [...(a?.approvedClaims?.length ? a.approvedClaims.slice(0, 5) : APPROVED_CLAIMS.slice(0, 5))],
    bannedClaims: [...(a?.bannedClaims?.length ? a.bannedClaims.slice(0, 5) : BANNED_CLAIMS.slice(0, 5))],
  };
}

function UploadOldBrief({ onExtracted, t, extractionPrompt, aiKnowledge }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const apiKey = localStorage.getItem("intake-apikey") || "";
      if (!apiKey.trim()) throw new Error("Add your Anthropic API key in Settings first");

      const lower = file.name.toLowerCase();
      const ext = lower.includes(".") ? lower.slice(lower.lastIndexOf(".") + 1) : "";
      if (/^(doc|docx)$/.test(ext) || file.type.includes("wordprocessingml") || file.type === "application/msword") {
        throw new Error("Word files aren't supported. Export as PDF or plain text (.txt).");
      }

      const isPdf = file.type === "application/pdf" || ext === "pdf";
      const isImage =
        (file.type && file.type.startsWith("image/")) ||
        ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"].includes(ext);

      let content;
      if (isImage || isPdf) {
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const mediaType = isPdf ? "application/pdf" : file.type || "image/jpeg";
        content = [
          { type: isPdf ? "document" : "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          { type: "text", text: extractionPrompt },
        ];
      } else {
        const text = await file.text();
        content = [
          { type: "text", text: `Here is the old brief content:\n\n---\n${text}\n---\n\n${extractionPrompt}` },
        ];
      }

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          messages: [{ role: "user", content }],
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `API error ${res.status}`);
      }

      const data = await res.json();
      const aiText = (data.content || []).map((b) => b.text || "").join("") || "";
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("AI couldn't parse the brief. Try a clearer PDF, image, or text file.");

      let parsed;
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        throw new Error("AI returned invalid JSON. Try again.");
      }

      onExtracted(mergeExtractedBriefToPrefill(parsed, aiKnowledge));
      alert("Brief imported! Review the fields below and click Generate to create your Intake brief.");
    } catch (err) {
      setError(err.message || "Failed to process brief");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div style={{ marginBottom: 24, padding: 16, border: `2px dashed ${t.border}`, borderRadius: 12, textAlign: "center", background: t.cardAlt }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 4 }}>Import an Existing Brief</div>
      <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 12 }}>
        Upload any old brief (PDF, image, or text) and our AI will rewrite it into Intake's format
      </div>
      {uploading ? (
        <div style={{ fontSize: 13, color: t.green }}>Reading brief and extracting fields...</div>
      ) : (
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: 8, background: t.green, color: t.isLight ? "#fff" : "#000", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          Upload Brief
          <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.txt,.md,.doc,.docx" style={{ display: "none" }} onChange={handleUpload} />
        </label>
      )}
      {error ? <div style={{ fontSize: 12, color: "#ef4444", marginTop: 8 }}>{error}</div> : null}
    </div>
  );
}

function IBAiSourceOfTruth({ t, aiKnowledge, onSave, homepage }) {
  const ak = aiKnowledge && typeof aiKnowledge === "object" ? aiKnowledge : getDefaultAiKnowledge();
  const [open, setOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("products");
  const [editing, setEditing] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const sections = [
    { id: "products", label: "Products" },
    { id: "approved", label: "Approved Claims" },
    { id: "banned", label: "Banned Claims" },
    { id: "rejections", label: "Revision Criteria" },
    { id: "tones", label: "Tone & Hooks" },
    { id: "platforms", label: "Platform Specs" },
    { id: "lengths", label: "Video Length Guides" },
    { id: "scoring", label: "IB Score Weighting" },
    { id: "brand", label: "Brand Context" },
  ];

  const startEdit = (field, currentValue) => {
    setEditing(field);
    if (Array.isArray(currentValue)) {
      setEditDraft(currentValue.join("\n"));
    } else if (typeof currentValue === "object" && currentValue !== null) {
      setEditDraft(JSON.stringify(currentValue, null, 2));
    } else {
      setEditDraft(String(currentValue || ""));
    }
  };

  const saveEdit = async (field) => {
    setSaving(true);
    try {
      let value;
      if (field === "brandContext") {
        value = editDraft;
      } else if (field === "toneHooks" || field === "platformNotes" || field === "lengthGuide") {
        value = JSON.parse(editDraft);
      } else {
        value = editDraft.split("\n").map((s) => s.trim()).filter(Boolean);
      }
      await onSave(field, value);
      setEditing(null);
    } catch (e) {
      alert("Save failed: " + (e.message || String(e)));
    } finally {
      setSaving(false);
    }
  };

  const renderEditableList = (field, items, color, sym) => {
    const list = Array.isArray(items) ? items : [];
    if (editing === field) {
      return (
        <div>
          <textarea
            value={editDraft}
            onChange={(e) => setEditDraft(e.target.value)}
            style={{ width: "100%", minHeight: 200, padding: 10, borderRadius: 8, border: `1px solid ${t.green}`, background: t.inputBg, color: t.inputText, fontSize: 12, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}
            placeholder="One item per line"
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button type="button" onClick={() => saveEdit(field)} disabled={saving} style={{ padding: "6px 16px", borderRadius: 6, border: "none", background: t.green, color: t.isLight ? "#fff" : "#000", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{saving ? "Saving..." : "Save"}</button>
            <button type="button" onClick={() => setEditing(null)} style={{ padding: "6px 16px", borderRadius: 6, border: `1px solid ${t.border}`, background: "transparent", color: t.textMuted, fontSize: 12, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      );
    }
    return (
      <div>
        {list.map((c, i) => (
          <div key={i} style={{ padding: "6px 0", fontSize: 12, color: t.text, borderBottom: `1px solid ${t.border}10`, display: "flex", gap: 8 }}>
            <span style={{ color, flexShrink: 0 }}>{sym}</span> {c}
          </div>
        ))}
        <button type="button" onClick={() => startEdit(field, list)} style={{ marginTop: 8, padding: "4px 12px", borderRadius: 6, border: `1px dashed ${t.border}`, background: "transparent", color: t.textFaint, fontSize: 11, cursor: "pointer" }}>✎ Edit</button>
      </div>
    );
  };

  const renderEditableText = (field, text) => {
    if (editing === field) {
      return (
        <div>
          <textarea
            value={editDraft}
            onChange={(e) => setEditDraft(e.target.value)}
            style={{ width: "100%", minHeight: 250, padding: 10, borderRadius: 8, border: `1px solid ${t.green}`, background: t.inputBg, color: t.inputText, fontSize: 12, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button type="button" onClick={() => saveEdit(field)} disabled={saving} style={{ padding: "6px 16px", borderRadius: 6, border: "none", background: t.green, color: t.isLight ? "#fff" : "#000", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{saving ? "Saving..." : "Save"}</button>
            <button type="button" onClick={() => setEditing(null)} style={{ padding: "6px 16px", borderRadius: 6, border: `1px solid ${t.border}`, background: "transparent", color: t.textMuted, fontSize: 12, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      );
    }
    return (
      <div>
        <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.7, whiteSpace: "pre-line" }}>{text}</div>
        <button type="button" onClick={() => startEdit(field, text)} style={{ marginTop: 8, padding: "4px 12px", borderRadius: 6, border: `1px dashed ${t.border}`, background: "transparent", color: t.textFaint, fontSize: 11, cursor: "pointer" }}>✎ Edit</button>
      </div>
    );
  };

  const renderEditableJSON = (field, obj) => {
    const o = obj && typeof obj === "object" ? obj : {};
    if (editing === field) {
      return (
        <div>
          <textarea
            value={editDraft}
            onChange={(e) => setEditDraft(e.target.value)}
            style={{ width: "100%", minHeight: 300, padding: 10, borderRadius: 8, border: `1px solid ${t.green}`, background: t.inputBg, color: t.inputText, fontSize: 11, fontFamily: "monospace", resize: "vertical", boxSizing: "border-box" }}
          />
          <div style={{ fontSize: 10, color: t.textFaint, marginTop: 4 }}>Edit as JSON. Keep the same structure.</div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button type="button" onClick={() => saveEdit(field)} disabled={saving} style={{ padding: "6px 16px", borderRadius: 6, border: "none", background: t.green, color: t.isLight ? "#fff" : "#000", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{saving ? "Saving..." : "Save"}</button>
            <button type="button" onClick={() => setEditing(null)} style={{ padding: "6px 16px", borderRadius: 6, border: `1px solid ${t.border}`, background: "transparent", color: t.textMuted, fontSize: 12, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      );
    }
    return (
      <div>
        {Object.entries(o).map(([key, val]) => (
          <div key={key} style={{ marginBottom: 12, padding: 10, background: t.cardAlt, borderRadius: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: t.green, marginBottom: 4 }}>{key}</div>
            {Array.isArray(val) ? val.map((v, i) => (
              <div key={i} style={{ fontSize: 12, color: t.textMuted, paddingLeft: 12, lineHeight: 1.6 }}>{`"${v}"`}</div>
            )) : (
              <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.6 }}>{String(val)}</div>
            )}
          </div>
        ))}
        <button type="button" onClick={() => startEdit(field, o)} style={{ marginTop: 4, padding: "4px 12px", borderRadius: 6, border: `1px dashed ${t.border}`, background: "transparent", color: t.textFaint, fontSize: 11, cursor: "pointer" }}>✎ Edit JSON</button>
      </div>
    );
  };

  const products = ak.products?.length ? ak.products : PRODUCTS;

  const outerStyle = homepage
    ? {
        background: t.card,
        border: `1px solid ${t.border}`,
        borderRadius: 14,
        padding: 0,
        marginBottom: 20,
        overflow: "hidden",
        maxWidth: 1000,
        marginLeft: "auto",
        marginRight: "auto",
      }
    : {
        maxWidth: 960,
        margin: "0 auto",
        padding: "0 24px 40px",
      };

  const innerOpenStyle = homepage
    ? {
        background: t.card,
        borderTop: `1px solid ${t.border}`,
        borderRadius: "0 0 14px 14px",
        padding: "20px 24px 24px",
      }
    : {
        background: t.card,
        border: `1px solid ${t.border}`,
        borderTop: "none",
        borderRadius: "0 0 10px 10px",
        padding: 20,
      };

  return (
    <div style={outerStyle}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          padding: homepage ? "20px 24px" : "14px 20px",
          borderRadius: homepage ? (open ? "14px 14px 0 0" : 14) : 10,
          border: homepage ? "none" : `1px solid ${t.border}`,
          background: t.card,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
          fontSize: homepage ? 16 : 14,
          fontWeight: 700,
          color: t.text,
        }}
      >
        <div style={{ textAlign: "left" }}>
          <span>🧠 IB-Ai Source of Truth</span>
          {homepage ? (
            <div style={{ fontSize: 12, fontWeight: 400, color: t.textMuted, marginTop: 2 }}>Everything IB-Ai knows — editable by managers</div>
          ) : null}
        </div>
        <span style={{ fontSize: 12, color: t.textMuted, flexShrink: 0, marginLeft: 12 }}>
          {homepage ? (open ? "▲" : "▼") : open ? "▲ Close" : "▼ View what IB-Ai knows"}
        </span>
      </button>

      {open && (
        <div style={innerOpenStyle}>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 16, borderBottom: `1px solid ${t.border}`, paddingBottom: 8 }}>
            {sections.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveSection(s.id)}
                style={{
                  padding: "6px 12px",
                  fontSize: 11,
                  fontWeight: activeSection === s.id ? 700 : 500,
                  color: activeSection === s.id ? t.green : t.textMuted,
                  background: activeSection === s.id ? t.green + "10" : "transparent",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          {activeSection === "products" && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 8 }}>Intake Breathing Products</div>
              {editing === "products" ? (
                <div>
                  <textarea
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    style={{ width: "100%", minHeight: 200, padding: 10, borderRadius: 8, border: `1px solid ${t.green}`, background: t.inputBg, color: t.inputText, fontSize: 12, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}
                    placeholder="One product name per line (must match form dropdown options)"
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button type="button" onClick={() => saveEdit("products")} disabled={saving} style={{ padding: "6px 16px", borderRadius: 6, border: "none", background: t.green, color: t.isLight ? "#fff" : "#000", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{saving ? "Saving..." : "Save"}</button>
                    <button type="button" onClick={() => setEditing(null)} style={{ padding: "6px 16px", borderRadius: 6, border: `1px solid ${t.border}`, background: "transparent", color: t.textMuted, fontSize: 12, cursor: "pointer" }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.7 }}>
                    {products.map((p, i) => (
                      <div key={i} style={{ padding: "4px 0", borderBottom: `1px solid ${t.border}10` }}>
                        <strong style={{ color: t.text }}>{p}</strong>
                        {p === "Starter Kit Black" || p === "Starter Kit Clear"
                          ? " — Includes 4 sizes (S, M, L, XL) + 15 tab sets. Magnetic nasal dilator with reusable band."
                          : ""}
                        {p === "Mouth Tape" ? " — Sleep strips for mouth breathing prevention." : ""}
                        {p === "Sports Tabs" ? " — High-adhesion tabs for intense activity." : ""}
                        {p === "Refills" ? " — Replacement adhesive tab sets." : ""}
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => startEdit("products", products)} style={{ marginTop: 8, padding: "4px 12px", borderRadius: 6, border: `1px dashed ${t.border}`, background: "transparent", color: t.textFaint, fontSize: 11, cursor: "pointer" }}>✎ Edit</button>
                </div>
              )}
              <div style={{ fontSize: 11, color: t.textFaint, marginTop: 12, lineHeight: 1.5 }}>
                <strong>Company:</strong> Intake Breathing Technology<br />
                <strong>Product type:</strong> Magnetic external nasal dilator<br />
                <strong>Key differentiator:</strong> Opens from the sides using magnetic lift — never collapses like adhesive strips<br />
                <strong>Originally designed for:</strong> Motocross athletes<br />
                <strong>FDA status:</strong> FDA registered (NOT FDA approved — important distinction)<br />
                <strong>Materials:</strong> Medical grade, hypoallergenic, latex-free<br />
                <strong>Trial:</strong> 90-day risk-free
              </div>
            </div>
          )}

          {activeSection === "approved" && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.green, marginBottom: 8 }}>✓ Creators CAN Say These</div>
              {renderEditableList("approvedClaims", ak.approvedClaims, t.green, "✓")}
            </div>
          )}

          {activeSection === "banned" && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#ef4444", marginBottom: 8 }}>✗ Creators Must NEVER Say These</div>
              {renderEditableList("bannedClaims", ak.bannedClaims, "#ef4444", "✗")}
            </div>
          )}

          {activeSection === "rejections" && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.orange, marginBottom: 8 }}>⚠ Revision Required If...</div>
              {renderEditableList("defaultRejections", ak.defaultRejections, t.orange, "⚠")}
              <div style={{ fontSize: 11, color: t.textFaint, marginTop: 8 }}>Managers can add custom rejection criteria per brief.</div>
            </div>
          )}

          {activeSection === "tones" && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 8 }}>Tone Options & Example Hooks</div>
              {renderEditableJSON("toneHooks", ak.toneHooks)}
            </div>
          )}

          {activeSection === "platforms" && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 8 }}>Platform Specifications</div>
              {renderEditableJSON("platformNotes", ak.platformNotes)}
            </div>
          )}

          {activeSection === "lengths" && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 8 }}>Video Length Pacing Guides</div>
              {renderEditableJSON("lengthGuide", ak.lengthGuide)}
              <div style={{ fontSize: 11, color: t.textFaint, marginTop: 12 }}>
                <strong>Target personas IB-Ai uses (edit below):</strong>
              </div>
              <div style={{ marginTop: 8 }}>{renderEditableList("personas", ak.personas, t.blue, "•")}</div>
            </div>
          )}

          {activeSection === "scoring" && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 8 }}>IB Score Calculation (1-100)</div>
              <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.7 }}>
                {[
                  { label: "Instagram", weight: "45%", detail: "Followers, engagement rate, post quality, bio relevance, business account, category alignment" },
                  { label: "TikTok", weight: "30%", detail: "Followers, hearts, video count, engagement rate, avg views, bio, TikTok Shop status" },
                  { label: "Cross-Platform Presence", weight: "10%", detail: "YouTube subscribers, Twitter followers, LinkedIn, Facebook, Snapchat presence" },
                  { label: "Content Alignment", weight: "15%", detail: "How well their content themes match Intake's mission (fitness, sleep, breathing, wellness, sports)" },
                ].map((item, i) => (
                  <div key={i} style={{ padding: "8px 0", borderBottom: `1px solid ${t.border}10` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ color: t.text }}>{item.label}</strong>
                      <span style={{ fontSize: 14, fontWeight: 800, color: t.green }}>{item.weight}</span>
                    </div>
                    <div style={{ fontSize: 11, color: t.textFaint, marginTop: 2 }}>{item.detail}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, padding: 10, background: t.cardAlt, borderRadius: 8, fontSize: 11, color: t.textMuted, lineHeight: 1.5 }}>
                <strong>Score Labels:</strong>
                <br />
                80-100 = Elite · 65-79 = Excellent · 50-64 = Strong · 35-49 = Promising · 1-34 = Low Fit
                <br />
                <br />
                <strong>Also generated per creator:</strong>
                <br />
                One-sentence summary · Content style · Why Intake · Risk assessment · Suggested campaigns · Best platform analysis · Partnership notes · Outreach DM/Email · Competitor check · Brand safety
              </div>
            </div>
          )}

          {activeSection === "brand" && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 8 }}>Brand Context Given to IB-Ai</div>
              {renderEditableText("brandContext", ak.brandContext || "")}
            </div>
          )}

          <div style={{ marginTop: 16, fontSize: 10, color: t.textFaint, textAlign: "center" }}>
            Edits save to Supabase and apply to IB-Ai brief generation, compliance, templates, uploads, and scoring context immediately.
          </div>
        </div>
      )}
    </div>
  );
}

const BriefForm = memo(function BriefForm({ prefill, onGenerate, aiKnowledge }) {
  const { t, S } = useContext(ThemeContext);
  const ak = aiKnowledge && typeof aiKnowledge === "object" ? aiKnowledge : null;
  const approvedSource = ak?.approvedClaims?.length ? ak.approvedClaims : APPROVED_CLAIMS;
  const bannedSource = ak?.bannedClaims?.length ? ak.bannedClaims : BANNED_CLAIMS;
  const productOpts = ak?.products?.length ? ak.products : PRODUCTS;
  const defaultRejectionsDisplay = ak?.defaultRejections?.length ? ak.defaultRejections : DEFAULT_REJECTIONS;
  const pf = { ...getBriefFormBaseDefaults(ak), ...(prefill || {}) };
  const [ageRange, setAgeRange] = useState(pf.ageRange ?? DEFAULTS.ageRange);
  const [gender, setGender] = useState(pf.gender ?? DEFAULTS.gender);
  const [showCustomProduct, setShowCustomProduct] = useState((pf.productName || DEFAULTS.productName) === "Other");
  const [showCustomVibe, setShowCustomVibe] = useState((pf.vibe || DEFAULTS.vibe) === "Other");
  const [showCustomTone, setShowCustomTone] = useState((pf.tone || DEFAULTS.tone) === "Other");
  const [showCustomManager, setShowCustomManager] = useState((pf.manager || DEFAULTS.manager) === "Other");
  const [managerSel, setManagerSel] = useState(pf.manager ?? DEFAULTS.manager);
  const [contentQty, setContentQty] = useState(pf.contentQuantity ?? DEFAULTS.contentQuantity);
  const [supervisionLevel, setSupervisionLevel] = useState(pf.supervisionLevel ?? DEFAULTS.supervisionLevel);
  const [otherPlatformDraft, setOtherPlatformDraft] = useState("");
  const [platformDropdownOpen, setPlatformDropdownOpen] = useState(false);
  const platformDropRef = useRef(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState(() => {
    const p = pf.platforms ?? DEFAULTS.platforms;
    if (Array.isArray(p) && p.length) return [...p];
    if (pf.platform) return [pf.platform];
    return ["TikTok"];
  });
  const [selectedApproved, setSelectedApproved] = useState(() => [...(pf.approvedClaims ?? DEFAULTS.approvedClaims)]);
  const [selectedBanned, setSelectedBanned] = useState(() => [...(pf.bannedClaims ?? DEFAULTS.bannedClaims)]);
  const [complianceLoading, setComplianceLoading] = useState(false);
  const complianceTimer = useRef(null);
  const [addApprovedDraft, setAddApprovedDraft] = useState("");
  const [addBannedDraft, setAddBannedDraft] = useState("");
  const vals = useRef({
    manager: pf.manager ?? DEFAULTS.manager,
    customManager: pf.customManager ?? DEFAULTS.customManager,
    contentQuantity: pf.contentQuantity ?? DEFAULTS.contentQuantity,
    productName: pf.productName || DEFAULTS.productName,
    customProductName: pf.customProductName ?? DEFAULTS.customProductName,
    campaignName: pf.campaignName || DEFAULTS.campaignName,
    vibe: pf.vibe || DEFAULTS.vibe,
    customVibe: pf.customVibe ?? DEFAULTS.customVibe,
    mission: pf.mission || "",
    problem: pf.problem ?? DEFAULTS.problem,
    ageRange: pf.ageRange ?? DEFAULTS.ageRange,
    gender: pf.gender ?? DEFAULTS.gender,
    customPlatform: pf.customPlatform ?? DEFAULTS.customPlatform,
    videoLength: pf.videoLength || DEFAULTS.videoLength,
    tone: pf.tone || DEFAULTS.tone,
    customTone: pf.customTone ?? DEFAULTS.customTone,
    notes: pf.notes || "",
    customRejections: pf.customRejections ?? DEFAULTS.customRejections,
    budgetPerVideo: pf.budgetPerVideo ?? DEFAULTS.budgetPerVideo,
    supervisionLevel: pf.supervisionLevel ?? DEFAULTS.supervisionLevel,
  });

  const suggestCompliance = useCallback(async () => {
    const key = localStorage.getItem("intake-apikey");
    if (!key) return;

    const v = vals.current;
    const context = [v.productName, v.campaignName, v.mission, v.vibe, v.problem, v.ageRange, v.gender].filter(Boolean).join(", ");
    if (context.length < 10) return;

    setComplianceLoading(true);
    try {
      const res = await Promise.race([
        fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
            "x-api-key": key,
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 300,
            messages: [{ role: "user", content: `You are a compliance officer for Intake Breathing, a magnetic nasal dilator company. Given this campaign context: "${context}".

Here are ALL available approved claims: ${JSON.stringify(approvedSource)}

Here are ALL available banned claims: ${JSON.stringify(bannedSource)}

Select the most relevant approved claims (5-7) and banned claims (5-7) for this specific campaign. Return ONLY a JSON object like: {"approved": ["claim1", "claim2"], "banned": ["claim1", "claim2"]}. Pick claims that are most relevant to the product, audience, and campaign described. Return ONLY the JSON, nothing else.` }],
          }),
        }),
        new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 10000)),
      ]);
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      const text = data.content.map(i => i.text || "").join("");
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          const normalize = (s) => String(s ?? "").trim().toLowerCase();
          const result = JSON.parse(match[0]);
          if (Array.isArray(result.approved) && result.approved.length > 0) {
            const ok = result.approved.filter((c) =>
              approvedSource.some((ac) => normalize(ac) === normalize(c))
            );
            if (ok.length > 0) setSelectedApproved(ok);
          }
          if (Array.isArray(result.banned) && result.banned.length > 0) {
            const ok = result.banned.filter((c) =>
              bannedSource.some((bc) => normalize(bc) === normalize(c))
            );
            if (ok.length > 0) setSelectedBanned(ok);
          }
        } catch { /* ignore malformed JSON */ }
      }
    } catch { /* ignore */ }
    finally { setComplianceLoading(false); }
  }, [approvedSource, bannedSource]);

  const triggerComplianceSuggest = useCallback(() => {
    if (complianceTimer.current) clearTimeout(complianceTimer.current);
    complianceTimer.current = setTimeout(() => suggestCompliance(), 2500);
  }, [suggestCompliance]);

  const fireFormSuggest = useCallback(() => {
    triggerComplianceSuggest();
  }, [triggerComplianceSuggest]);

  useEffect(() => {
    return () => {
      if (complianceTimer.current) clearTimeout(complianceTimer.current);
    };
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (platformDropRef.current && !platformDropRef.current.contains(e.target)) setPlatformDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const platformSummaryText = useMemo(() => {
    if (!selectedPlatforms.length) return "None selected";
    return selectedPlatforms.join(", ");
  }, [selectedPlatforms]);

  const togglePlatform = (name) => {
    setSelectedPlatforms((prev) => (prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]));
  };

  const addCustomPlatform = useCallback(() => {
    const name = otherPlatformDraft.trim();
    if (!name) return;
    setSelectedPlatforms((prev) => {
      let next = prev.filter((x) => x !== "Other");
      if (!next.includes(name)) next = [...next, name];
      return next;
    });
    setOtherPlatformDraft("");
  }, [otherPlatformDraft]);

  const go = useCallback((mode) => {
    const v = vals.current;
    v.manager = managerSel;
    v.contentQuantity = String(contentQty || "1");
    if (v.manager === "Other" && !v.customManager.trim()) { alert("Please enter your name."); return; }
    if (!v.problem.trim()) { alert("Please describe the core problem."); return; }
    if (v.productName === "Other" && !v.customProductName.trim()) { alert("Please enter a product name."); return; }
    if (v.vibe === "Other" && !v.customVibe.trim()) { alert("Please describe your campaign vibe."); return; }
    if (v.tone === "Other" && !v.customTone.trim()) { alert("Please describe your tone."); return; }
    if (selectedPlatforms.length === 0) { alert("Please select at least one platform."); return; }
    const problemTrim = v.problem.trim();
    const qtyStr = String(Math.max(1, parseInt(String(contentQty || "1"), 10) || 1));
    const budgetRaw = (v.budgetPerVideo ?? "").trim().replace(/^\$/, "") || DEFAULTS.budgetPerVideo;
    v.budgetPerVideo = budgetRaw;
    v.supervisionLevel = supervisionLevel;
    onGenerate({
      mode,
      manager: managerSel,
      customManager: (v.customManager || "").trim(),
      contentQuantity: qtyStr,
      budgetPerVideo: budgetRaw,
      supervisionLevel,
      productName: v.productName, customProductName: v.customProductName.trim(), campaignName: v.campaignName, vibe: v.vibe, customVibe: v.customVibe.trim(), mission: v.mission,
      ageRange, gender, problem: problemTrim,
      platforms: [...selectedPlatforms], customPlatform: (v.customPlatform || "").trim(), videoLength: v.videoLength, tone: v.tone, customTone: (v.customTone || "").trim(), notes: v.notes,
      customRejections: (v.customRejections || "").trim(),
      _audience: `Ages ${ageRange} — ${gender}`,
      _problem: problemTrim,
      approvedClaims: [...selectedApproved],
      bannedClaims: [...selectedBanned],
      _approved: selectedApproved.join(". "),
      _banned: selectedBanned.join(". "),
      _rejections: buildRejectionsArray({ customRejections: v.customRejections || "" }, ak?.defaultRejections?.length ? ak.defaultRejections : DEFAULT_REJECTIONS),
    });
  }, [onGenerate, ageRange, gender, selectedPlatforms, selectedApproved, selectedBanned, managerSel, contentQty, supervisionLevel, ak]);
  const mkSel = (key, label, opts) => (
    <div style={S.fg}><label style={S.label}>{label}</label>
      <select style={S.select} defaultValue={vals.current[key]} onChange={e=>{vals.current[key]=e.target.value}}>
        {opts.map(o=><option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

  return (
    <div style={S.formWrap}>
      <div style={{ marginBottom: 36 }}>
        <div style={S.formTitle}>Create New Brief</div>
        <div style={S.formSub}>Select options below. Brief generates instantly.</div>
      </div>
      <div style={S.section}>
        <div style={S.secLabel}><Icon name="user" size={16} color={t.green} /><span>Brief Details</span></div>
        <div style={S.r3}>
          <div style={S.fg}>
            <label style={S.label}>Submitted By</label>
            <select
              style={S.select}
              value={managerSel}
              onChange={(e) => {
                const v = e.target.value;
                vals.current.manager = v;
                setManagerSel(v);
                setShowCustomManager(v === "Other");
              }}
            >
              {MANAGERS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div style={S.fg}>
            <label style={S.label}># of Videos Needed</label>
            <input
              type="number"
              min={1}
              style={S.input}
              value={contentQty}
              onChange={(e) => {
                const v = e.target.value;
                setContentQty(v);
                vals.current.contentQuantity = v;
              }}
              onFocus={(e) => { e.target.style.borderColor = t.green; }}
              onBlur={(e) => { e.target.style.borderColor = t.border; }}
              placeholder="e.g. 6"
            />
          </div>
          <div ref={platformDropRef} style={{ ...S.fg, minWidth: 0, position: "relative" }}>
            <label style={S.label}>Platform</label>
            <div
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setPlatformDropdownOpen((o) => !o); } }}
              onClick={() => setPlatformDropdownOpen((o) => !o)}
              style={{
                ...S.select,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0, color: selectedPlatforms.length ? t.text : t.textFaint }}>
                {platformSummaryText}
              </span>
              <span style={{ opacity: 0.55, fontSize: 10, flexShrink: 0 }}>▾</span>
            </div>
            {platformDropdownOpen && (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: "100%",
                  marginTop: 4,
                  zIndex: 50,
                  background: t.card,
                  border: `1px solid ${t.border}`,
                  borderRadius: 8,
                  boxShadow: t.shadow || "0 4px 16px rgba(0,0,0,0.2)",
                  padding: "4px 0",
                  maxHeight: 240,
                  overflowY: "auto",
                }}
              >
                {PLATFORMS.map((p) => {
                  const sel = selectedPlatforms.includes(p);
                  return (
                    <div key={p}>
                      <div
                        onClick={() => togglePlatform(p)}
                        onMouseEnter={(e) => { e.currentTarget.style.background = t.cardAlt; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                        style={{
                          padding: "8px 14px",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          cursor: "pointer",
                          fontSize: 13,
                          color: t.text,
                        }}
                      >
                        <span
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: 4,
                            border: `1px solid ${sel ? t.green : t.border}`,
                            background: sel ? t.green : "transparent",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          {sel ? <Icon name="checkSm" size={10} color={t.isLight ? "#fff" : "#000"} /> : null}
                        </span>
                        <span>{p}</span>
                      </div>
                      {p === "Other" && selectedPlatforms.includes("Other") && (
                        <div
                          style={{ padding: "4px 14px 10px", borderBottom: `1px solid ${t.border}` }}
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            <input
                              style={{ ...S.input, flex: 1, minWidth: 120, marginBottom: 0 }}
                              value={otherPlatformDraft}
                              onChange={(e) => setOtherPlatformDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key !== "Enter") return;
                                e.preventDefault();
                                addCustomPlatform();
                              }}
                              onFocus={(e) => { e.target.style.borderColor = t.green; }}
                              onBlur={(e) => { e.target.style.borderColor = t.border; }}
                              placeholder="e.g. Snapchat, Twitter/X, Pinterest..."
                            />
                            <button
                              type="button"
                              onClick={addCustomPlatform}
                              style={{ padding: "9px 14px", borderRadius: 8, border: "none", background: t.green, color: t.isLight ? "#fff" : "#000", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {selectedPlatforms
                  .filter((p) => !PLATFORMS.includes(p))
                  .map((p) => (
                      <div
                        key={`extra-${p}`}
                        onClick={() => togglePlatform(p)}
                        onMouseEnter={(e) => { e.currentTarget.style.background = t.cardAlt; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                        style={{
                          padding: "8px 14px",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          cursor: "pointer",
                          fontSize: 13,
                          color: t.text,
                        }}
                      >
                        <span
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: 4,
                            border: `1px solid ${t.green}`,
                            background: t.green,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <Icon name="checkSm" size={10} color={t.isLight ? "#fff" : "#000"} />
                        </span>
                        <span>{p}</span>
                      </div>
                  ))}
              </div>
            )}
          </div>
        </div>
        <div style={S.r2}>
          <div style={S.fg}>
            <label style={S.label}>Budget per Video</label>
            <div style={{ display: "flex", alignItems: "stretch" }}>
              <span
                style={{
                  background: t.cardAlt,
                  border: `1px solid ${t.border}`,
                  borderRight: "none",
                  borderRadius: "8px 0 0 8px",
                  padding: "11px 12px",
                  color: t.textMuted,
                  fontSize: 14,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  flexShrink: 0,
                }}
              >
                $
              </span>
              <input
                type="text"
                inputMode="decimal"
                style={{
                  ...S.input,
                  borderRadius: "0 8px 8px 0",
                  borderLeft: "none",
                  flex: 1,
                  minWidth: 0,
                }}
                defaultValue={vals.current.budgetPerVideo}
                placeholder="100"
                onChange={(e) => { vals.current.budgetPerVideo = e.target.value; }}
                onFocus={(e) => { e.target.style.borderColor = t.green; }}
                onBlur={(e) => { e.target.style.borderColor = t.border; }}
              />
            </div>
          </div>
          <div style={S.fg}>
            <label style={S.label}>Supervision Level</label>
            <select
              style={S.select}
              value={supervisionLevel}
              onChange={(e) => {
                const v = e.target.value;
                vals.current.supervisionLevel = v;
                setSupervisionLevel(v);
              }}
            >
              {SUPERVISION_LEVELS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <div style={{ fontSize: 11, color: t.textFaint, fontStyle: "italic", marginTop: 4 }}>
              {SUPERVISION_FORM_HINTS[supervisionLevel] || SUPERVISION_FORM_HINTS.full}
            </div>
          </div>
        </div>
        {showCustomManager && (
          <div style={{ ...S.fg, marginTop: 14, marginBottom: 0 }}>
            <label style={S.label}>Enter your name</label>
            <input
              style={S.input}
              defaultValue={vals.current.customManager}
              onChange={(e) => { vals.current.customManager = e.target.value; }}
              onFocus={(e) => { e.target.style.borderColor = t.green; }}
              onBlur={(e) => { e.target.style.borderColor = t.border; }}
              placeholder="Enter your name"
            />
          </div>
        )}
      </div>
      <div style={S.section}>
        <div style={S.secLabel}><Icon name="target" size={16} color={t.green} /><span>Product & Campaign</span></div>
        <div style={S.r2}>
          <div style={S.fg}><label style={S.label}>Product *</label>
            <select style={S.select} defaultValue={vals.current.productName} onChange={e => { const v = e.target.value; vals.current.productName = v; setShowCustomProduct(v === "Other"); fireFormSuggest(); }}>
              {productOpts.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            {showCustomProduct && <div style={S.fg}><label style={S.label}>Product Name</label>
              <input style={S.input} defaultValue={vals.current.customProductName} onChange={e => { vals.current.customProductName = e.target.value; }} onFocus={e => { e.target.style.borderColor = t.green; }} onBlur={e => { e.target.style.borderColor = t.border; }} placeholder="Enter your product name" />
            </div>}
          </div>
          <div style={S.fg}><label style={S.label}>Campaign Vibe</label>
            <select style={S.select} defaultValue={vals.current.vibe} onChange={e => { const v = e.target.value; vals.current.vibe = v; setShowCustomVibe(v === "Other"); fireFormSuggest(); }}>
              {VIBES.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            {showCustomVibe && <div style={S.fg}><label style={S.label}>Campaign Vibe</label>
              <input style={S.input} defaultValue={vals.current.customVibe} onChange={e => { vals.current.customVibe = e.target.value; }} onFocus={e => { e.target.style.borderColor = t.green; }} onBlur={e => { e.target.style.borderColor = t.border; }} placeholder="Describe your campaign vibe" />
            </div>}
          </div>
        </div>
        <div style={S.r2}>
          <div style={S.fg}><label style={S.label}>Campaign Name</label>
            <input style={S.input} defaultValue={vals.current.campaignName} onChange={e=>{vals.current.campaignName=e.target.value; fireFormSuggest();}} onFocus={e=>{e.target.style.borderColor=t.green}} onBlur={e=>{e.target.style.borderColor=t.border}} placeholder='e.g. "The Level Up"' /></div>
          <div style={S.fg}><label style={S.label}>One-Line Mission</label>
            <input style={S.input} defaultValue={vals.current.mission} onChange={e=>{vals.current.mission=e.target.value; fireFormSuggest();}} onFocus={e=>{e.target.style.borderColor=t.green}} onBlur={e=>{e.target.style.borderColor=t.border}} placeholder="The soul of this campaign" /></div>
        </div>
      </div>
      <div style={S.section}>
        <div style={S.secLabel}><Icon name="users" size={16} color={t.green} /><span>Audience & Problem</span></div>
        <div style={S.r2}>
          <div style={S.fg}><label style={S.label}>Age Range</label>
            <select style={S.select} value={ageRange} onChange={e=>{ const v = e.target.value; vals.current.ageRange = v; setAgeRange(v); fireFormSuggest(); }}>
              {AGE_RANGES.map((a)=><option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div style={S.fg}><label style={S.label}>Gender</label>
            <select style={S.select} value={gender} onChange={e=>{ const v = e.target.value; vals.current.gender = v; setGender(v); fireFormSuggest(); }}>
              {GENDERS.map((g)=><option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </div>
        <div style={S.fg}><label style={S.label}>Core Problem *</label>
          <textarea style={S.textarea} defaultValue={vals.current.problem} onChange={e=>{vals.current.problem=e.target.value; fireFormSuggest();}} onFocus={e=>{e.target.style.borderColor=t.green}} onBlur={e=>{e.target.style.borderColor=t.border}} placeholder="What misconception, frustration, or emotional block are we solving? Write it like you'd explain it to a creator." rows={4} />
        </div>
      </div>
      <div style={S.section}>
        <div style={S.secLabel}>
          <Icon name="shield" size={16} color={t.green} />
          <span>Compliance</span>
          {complianceLoading ? <span style={{ fontSize: 11, color: t.orange, fontWeight: 500, marginLeft: 4 }}>— IB-Ai updating...</span> : <span style={{ fontSize: 11, color: t.textFaint, fontWeight: 500, marginLeft: 4 }}>— auto-selected by IB-Ai, edit as needed</span>}
        </div>
        <div style={S.cols2}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: t.green, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}><Icon name="checkCircle" size={14} color={t.green} />Approved Claims</div>
            {selectedApproved.map((c, i) => (
              <div key={`a-${i}-${c.slice(0, 24)}`} style={{ background: t.card, borderRadius: 8, padding: "8px 12px", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center", border: `1px solid ${t.green}20` }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 6, flex: 1, minWidth: 0 }}><Icon name="checkSm" size={14} color={t.green} /><span style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.5 }}>{c}</span></div>
                <button type="button" onClick={() => setSelectedApproved((prev) => prev.filter((_, idx) => idx !== i))} style={{ flexShrink: 0, marginLeft: 8, border: "none", background: "transparent", color: t.textFaint, cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 4px", display: "flex", alignItems: "center" }} title="Remove"><Icon name="x" size={14} color={t.textFaint} /></button>
              </div>
            ))}
            <input
              style={{ ...S.input, marginTop: 4 }}
              value={addApprovedDraft}
              onChange={(e) => setAddApprovedDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                const v = addApprovedDraft.trim();
                if (v) { setSelectedApproved((prev) => [...prev, v]); setAddApprovedDraft(""); }
              }}
              onFocus={(e) => { e.target.style.borderColor = t.green; }}
              onBlur={(e) => { e.target.style.borderColor = t.border; }}
              placeholder="Add approved claim..."
            />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: t.red, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}><Icon name="ban" size={14} color={t.red} />Banned Claims</div>
            {selectedBanned.map((c, i) => (
              <div key={`b-${i}-${c.slice(0, 24)}`} style={{ background: t.card, borderRadius: 8, padding: "8px 12px", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center", border: `1px solid ${t.red}20` }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 6, flex: 1, minWidth: 0 }}><Icon name="x" size={14} color={t.red} /><span style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.5 }}>{c}</span></div>
                <button type="button" onClick={() => setSelectedBanned((prev) => prev.filter((_, idx) => idx !== i))} style={{ flexShrink: 0, marginLeft: 8, border: "none", background: "transparent", color: t.textFaint, cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 4px", display: "flex", alignItems: "center" }} title="Remove"><Icon name="x" size={14} color={t.textFaint} /></button>
              </div>
            ))}
            <input
              style={{ ...S.input, marginTop: 4 }}
              value={addBannedDraft}
              onChange={(e) => setAddBannedDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                const v = addBannedDraft.trim();
                if (v) { setSelectedBanned((prev) => [...prev, v]); setAddBannedDraft(""); }
              }}
              onFocus={(e) => { e.target.style.borderColor = t.red; }}
              onBlur={(e) => { e.target.style.borderColor = t.border; }}
              placeholder="Add banned claim..."
            />
          </div>
        </div>
      </div>
      <div style={S.section}>
        <div style={S.secLabel}><Icon name="alertTriangle" size={16} color={t.orange} /><span>Revision Criteria</span></div>
        <div style={{ ...S.hint, marginBottom: 12, fontStyle: "normal" }}>Revisions will be needed if any of the following are present. Add custom rules below.</div>
        <div style={S.roBox}>{defaultRejectionsDisplay.map((c, i) => (
          <div key={i} style={{ ...S.roItem(), display: "flex", alignItems: "flex-start", gap: 6 }}><span style={{ flexShrink: 0, marginTop: 2 }}><Icon name="x" size={14} color={t.orange} /></span>{c}</div>
        ))}</div>
        <div style={{ ...S.fg, marginTop: 14 }}>
          <label style={S.label}>Additional Revision Rules</label>
          <textarea style={S.textarea} defaultValue={vals.current.customRejections} onChange={e => { vals.current.customRejections = e.target.value; }} onFocus={e => { e.target.style.borderColor = t.orange; }} onBlur={e => { e.target.style.borderColor = t.border; }} placeholder="Add any campaign-specific revision criteria — one per line" rows={4} />
        </div>
      </div>
      <div style={S.section}>
        <div style={S.secLabel}><Icon name="sliders" size={16} color={t.green} /><span>Format & Tone</span></div>
        <div style={S.r2}>
          {mkSel("videoLength", "Video Length", LENGTHS)}
          <div style={S.fg}><label style={S.label}>Tone</label>
            <select style={S.select} defaultValue={vals.current.tone} onChange={e => { const v = e.target.value; vals.current.tone = v; setShowCustomTone(v === "Other"); }}>
              {TONES.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            {showCustomTone && <div style={S.fg}><label style={S.label}>Describe your tone</label>
              <input style={S.input} defaultValue={vals.current.customTone} onChange={e => { vals.current.customTone = e.target.value; }} onFocus={e => { e.target.style.borderColor = t.green; }} onBlur={e => { e.target.style.borderColor = t.border; }} placeholder='e.g. "Sarcastic but warm", "Gen Z chaos energy", "Whisper ASMR with humor"' />
            </div>}
          </div>
        </div>
      </div>
      <div style={S.section}>
        <div style={S.secLabel}><Icon name="pen" size={16} color={t.green} /><span>Creative Direction</span></div>
        <div style={S.fg}><label style={S.label}>Notes for Creators</label>
          <textarea style={{ ...S.textarea, minHeight: 120 }} defaultValue={vals.current.notes} onChange={e=>{vals.current.notes=e.target.value}} onFocus={e=>{e.target.style.borderColor=t.green}} onBlur={e=>{e.target.style.borderColor=t.border}} placeholder="Format instructions, hook ideas, visual direction…" rows={5} />
          <div style={S.hint}>Main free-text field. Everything else is from the Intake playbook.</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
        <button style={{ ...S.genBtn, flex: 1, marginTop: 0 }} onClick={() => go("ai")}>IB-Ai</button>
        <button style={{ ...S.genBtn, flex: 1, marginTop: 0, background: t.border, color: t.text, fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={() => go("template")}><Icon name="zap" size={16} color={t.text} />Instant Draft</button>
      </div>
      <div style={{ ...S.hint, textAlign: "center", marginTop: 8 }}>IB-Ai uses Claude to write original creative. Instant Draft uses templates — fast but generic.</div>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════
// BRIEF DISPLAY
// ═══════════════════════════════════════════════════════════

function EditableField({ value, style, t, editable = true }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && ref.current.textContent !== value) ref.current.textContent = value ?? "";
  }, [value]);
  if (!editable) {
    return <div style={{ ...style, cursor: "default" }}>{value}</div>;
  }
  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      style={{ ...style, cursor: "text", outline: "none", borderBottom: "1px dashed transparent" }}
      onFocus={(e) => { e.target.style.borderBottomColor = t.green + "50"; }}
      onBlur={(e) => { e.target.style.borderBottomColor = "transparent"; }}
    />
  );
}

function EditableRejectionLine({ value, t, editable = true }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && ref.current.textContent !== value) ref.current.textContent = value ?? "";
  }, [value]);
  if (!editable) {
    return (
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
        <span style={{ flexShrink: 0, display: "flex" }}><Icon name="x" size={14} color={t.orange} /></span>
        <div style={{ fontSize: 14, color: t.text, lineHeight: 1.7, flex: 1, minWidth: 0 }}>{value}</div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
      <span style={{ flexShrink: 0, display: "flex" }}><Icon name="x" size={14} color={t.orange} /></span>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        style={{ fontSize: 14, color: t.text, lineHeight: 1.7, flex: 1, cursor: "text", outline: "none", borderBottom: "1px dashed transparent", minWidth: 0 }}
        onFocus={(e) => { e.target.style.borderBottomColor = t.orange + "50"; }}
        onBlur={(e) => { e.target.style.borderBottomColor = "transparent"; }}
      />
    </div>
  );
}

function RejectionAddRow({ t, onCommit, editable = true }) {
  const ref = useRef(null);
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState("");
  const showHint = !focused && !draft.trim();
  if (!editable) return null;
  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px dashed ${t.orange}30` }}>
      <div style={{ position: "relative" }}>
        {showHint && (
          <div style={{ position: "absolute", left: 0, top: 0, fontSize: 13, color: t.textFaint, fontStyle: "italic", pointerEvents: "none" }}>Click to add another revision rule...</div>
        )}
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          style={{ fontSize: 14, color: t.text, lineHeight: 1.7, minHeight: 22, outline: "none", borderBottom: "1px dashed transparent", cursor: "text" }}
          onFocus={(e) => { setFocused(true); e.target.style.borderBottomColor = t.orange + "50"; }}
          onInput={(e) => { setDraft(e.currentTarget.textContent || ""); }}
          onBlur={(e) => {
            e.target.style.borderBottomColor = "transparent";
            setFocused(false);
            const text = (e.target.textContent || "").replace(/\u200b/g, "").trim();
            setDraft("");
            if (text) {
              onCommit(text);
              e.target.textContent = "";
            }
          }}
        />
      </div>
    </div>
  );
}

function buildBriefPrintHtml(b, fd, esc) {
  const escSafe = esc || ((str) => String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"));

  const plats = normalizePlatforms(fd).map((p) => (p === "Other" && fd.customPlatform?.trim() ? fd.customPlatform.trim() : p));
  const toneDisp = fd.tone === "Other" && fd.customTone?.trim() ? fd.customTone.trim() : fd.tone;
  const vibeDisp = fd.vibe === "Other" && fd.customVibe?.trim() ? fd.customVibe.trim() : fd.vibe;
  const prodDisp = fd.productName === "Other" && fd.customProductName?.trim() ? fd.customProductName.trim() : fd.productName;
  const docTitle = escSafe(fd.campaignName || prodDisp || "Brief");
  const productTag = escSafe(prodDisp);
  const vibeTag = escSafe(vibeDisp);
  const platformTagsHtml = plats.map((p) => `<span class="doc-tag">${escSafe(p)}</span>`).join("");
  const theyAreHtml = (b.theyAre || []).map((x) => `<div class="col-item"><span class="dot green">+</span>${escSafe(x)}</div>`).join("");
  const theyNotHtml = (b.theyAreNot || []).map((x) => `<div class="col-item"><span class="dot red">–</span>${escSafe(x)}</div>`).join("");
  const beatDefs = [
    { label: "PROBLEM", cls: "problem", inst: b.probInst, lines: b.probLines || [], overlays: b.probOverlays || [] },
    { label: "AGITATE", cls: "agitate", inst: b.agInst, lines: b.agLines || [], overlays: b.agOverlays || [] },
    { label: "SOLUTION", cls: "solution", inst: b.solInst, lines: b.solLines || [], overlays: b.solOverlays || [] },
  ];
  const beatsInnerHtml = beatDefs
    .map((bt) => {
      const lines = (bt.lines || []).map((l) => `<div class="riff">"${escSafe(l)}"</div>`).join("");
      const ovs = (bt.overlays || []).map((o) => `<div class="riff">${escSafe(o)}</div>`).join("");
      return (
        `<div class="beat ${bt.cls}">` +
        `<div class="beat-label">${bt.label}</div>` +
        `<div class="beat-inst">${escSafe(bt.inst)}</div>` +
        `<div class="beat-sub">Riff lines</div>` +
        lines +
        `<div class="beat-sub">Overlays</div>` +
        ovs +
        `</div>`
      );
    })
    .join("");
  const beatsHtml = beatsInnerHtml;
  const hooksHtml = (b.hooks || [])
    .map((h, i) => `<div class="hook"><div class="hook-num">${i + 1}</div><div class="hook-text">${escSafe(h)}</div></div>`)
    .join("");
  const sayHtml = (b.sayThis || []).map((s) => `<div class="compliance-item"><span class="mark">+</span>${escSafe(s)}</div>`).join("");
  const notHtml = (b.notThis || []).map((s) => `<div class="compliance-item"><span class="mark">–</span>${escSafe(s)}</div>`).join("");
  const rejList = Array.isArray(b.rejections) && b.rejections.length ? b.rejections : buildRejectionsArray(fd);
  const rejHtml = rejList.map((r) => `<div class="revision-item"><span class="rx">•</span>${escSafe(r)}</div>`).join("");
  const platNotesHtml = escSafe(b.platNotes || "").replace(/\n/g, "<br>");
  const deliverablesHtml = escSafe(b.deliverables || "").replace(/\n/g, "<br>");
  const mgrLine = escSafe(managerDisplayName(fd));
  const qtyLine = escSafe(String(fd.contentQuantity ?? "—"));
  const rawBudgetPdf = String(fd.budgetPerVideo ?? "").trim().replace(/^\$/, "");
  const budgetStrPdf = rawBudgetPdf ? escSafe(`$${rawBudgetPdf}/video`) : "TBD";
  const supervisionLabelPdf = escSafe(SUPERVISION_LEVELS.find((s) => s.value === (fd.supervisionLevel || "full"))?.label || "Full Review");
  const genDate = escSafe(new Date().toLocaleDateString());

  return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
@page { margin: 0.5in 0.6in; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Inter', Helvetica, Arial, sans-serif;
  color: #1a1a1a;
  font-size: 11px;
  line-height: 1.55;
  max-width: 100%;
  padding: 24px 32px 24px;
  background: #fff;
}

/* ── Header ── */
.doc-header {
  text-align: center;
  padding-bottom: 16px;
  margin-bottom: 20px;
  border-bottom: 2px solid #111;
}
.doc-brand {
  font-size: 9px; font-weight: 700; letter-spacing: 0.18em;
  color: #999; text-transform: uppercase; margin-bottom: 8px;
}
.doc-title {
  font-size: 24px; font-weight: 800; letter-spacing: -0.02em;
  color: #111; margin-bottom: 2px; line-height: 1.2;
}
.doc-mission {
  font-size: 12px; color: #666; font-style: italic; margin-bottom: 10px;
}
.doc-meta {
  display: flex; gap: 4px; justify-content: center; flex-wrap: wrap;
}
.doc-tag {
  padding: 2px 8px; border-radius: 3px; font-size: 9px; font-weight: 600;
  background: #f0f0f0; color: #555; text-transform: uppercase; letter-spacing: 0.04em;
}
.doc-manager {
  font-size: 10px; color: #999; margin-top: 8px;
}

/* ── Section headers ── */
.section-title {
  font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;
  color: #888; border-bottom: 1px solid #e0e0e0; padding-bottom: 4px;
  margin-top: 20px; margin-bottom: 10px;
}

/* ── Grid layouts ── */
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.three-col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }

/* ── Persona card — compact ── */
.persona-card {
  background: #f8f8f8; border: 1px solid #e5e5e5; border-radius: 6px; padding: 14px;
}
.persona-name { font-size: 15px; font-weight: 700; color: #111; margin-bottom: 1px; }
.persona-age { font-size: 11px; font-weight: 600; color: #4a9a9d; margin-bottom: 6px; }
.persona-psycho { font-size: 11px; color: #444; line-height: 1.5; margin-bottom: 10px; }
.col-title { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px; }
.col-title.green { color: #1a7a4e; }
.col-title.red { color: #b71c1c; }
.col-item { font-size: 10px; color: #333; line-height: 1.6; }
.col-item .dot { font-weight: 700; margin-right: 4px; }
.col-item .dot.green { color: #1a7a4e; }
.col-item .dot.red { color: #b71c1c; }

/* ── Story beats — compact, no wasted space ── */
.beats-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
.beat {
  padding: 12px; margin-bottom: 0; background: #fafafa; border: 1px solid #e5e5e5;
  border-top: 3px solid #ccc; border-radius: 6px;
}
.beat.problem { border-top-color: #c62828; }
.beat.agitate { border-top-color: #e67e00; }
.beat.solution { border-top-color: #1a7a4e; }
.beat-label {
  font-size: 9px; font-weight: 800; letter-spacing: 0.12em;
  text-transform: uppercase; margin-bottom: 6px;
}
.beat.problem .beat-label { color: #c62828; }
.beat.agitate .beat-label { color: #e67e00; }
.beat.solution .beat-label { color: #1a7a4e; }
.beat-inst { font-size: 11px; color: #333; line-height: 1.5; margin-bottom: 8px; }
.beat-sub {
  font-size: 8px; font-weight: 700; color: #aaa; text-transform: uppercase;
  letter-spacing: 0.06em; margin-bottom: 3px; margin-top: 6px;
}
.riff {
  font-size: 10px; color: #444; line-height: 1.5; padding-left: 8px;
  border-left: 2px solid #ddd; margin-bottom: 2px;
}

/* ── Hooks — inline numbered list ── */
.hooks-list { }
.hook { display: flex; gap: 8px; align-items: flex-start; margin-bottom: 6px; }
.hook-num {
  min-width: 18px; height: 18px; border-radius: 4px;
  background: #fff3e0; color: #e67e00; display: flex; align-items: center;
  justify-content: center; font-size: 9px; font-weight: 800; border: 1px solid #ffe0b2;
  flex-shrink: 0;
}
.hook-text { font-size: 11px; color: #333; line-height: 1.5; }
.hook-hint { font-size: 9px; color: #aaa; font-style: italic; margin-bottom: 8px; }

/* ── Compliance columns ── */
.compliance-col { border: 1px solid #e5e5e5; border-radius: 6px; padding: 12px; }
.compliance-col.approve { border-left: 3px solid #1a7a4e; }
.compliance-col.ban { border-left: 3px solid #c62828; }
.compliance-header { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px; }
.compliance-col.approve .compliance-header { color: #1a7a4e; }
.compliance-col.ban .compliance-header { color: #c62828; }
.compliance-item { font-size: 10px; color: #333; line-height: 1.6; }
.compliance-item .mark { font-weight: 700; margin-right: 4px; }
.compliance-col.approve .mark { color: #1a7a4e; }
.compliance-col.ban .mark { color: #c62828; }

/* ── Revision box — compact ── */
.revision-box {
  border: 1.5px solid #e67e00; border-radius: 6px; padding: 12px; margin-top: 6px;
  background: #fffbf5;
}
.revision-header { font-size: 9px; font-weight: 800; color: #b86e00; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 3px; }
.revision-warning { font-size: 10px; color: #b86e00; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid #ffe0b2; }
.revision-item { font-size: 10px; color: #333; line-height: 1.6; margin-bottom: 2px; }
.revision-item .rx { color: #e67e00; font-weight: 700; margin-right: 6px; }

/* ── Info boxes ── */
.info-box {
  background: #f8f8f8; border: 1px solid #e5e5e5; border-radius: 6px;
  padding: 10px 14px; font-size: 11px; color: #333; line-height: 1.6; white-space: pre-line;
}

/* ── Footer ── */
.doc-footer {
  text-align: center; margin-top: 24px; padding-top: 10px;
  border-top: 1px solid #e0e0e0; font-size: 8px; color: #bbb;
  text-transform: uppercase; letter-spacing: 0.1em;
}

/* ── Page breaks — only before major new sections ── */
.page-break { page-break-before: always; }

@media print {
  body { padding: 0; }
  .no-print { display: none; }
}
</style>
</head><body>

<div class="doc-header">
  <div class="doc-brand">Intake Breathing — Creator Partnerships</div>
  <div class="doc-title">${docTitle}</div>
  <div class="doc-mission">"${escSafe(b.mission)}"</div>
  <div class="doc-meta">
    <span class="doc-tag">${productTag}</span>
    <span class="doc-tag">${vibeTag}</span>
    ${platformTagsHtml}
    <span class="doc-tag">${escSafe(fd.videoLength)}</span>
    <span class="doc-tag">${escSafe(toneDisp)}</span>
  </div>
  <div class="doc-manager">
    Submitted by: ${mgrLine} ·
    Videos: ${qtyLine} ·
    Budget: ${budgetStrPdf} ·
    Supervision: ${supervisionLabelPdf} ·
    Generated: ${genDate}
  </div>
</div>

<div class="section-title">Who You&apos;re Talking To</div>
<div class="persona-card">
  <div class="persona-name">${escSafe(b.persona)}</div>
  <div class="persona-age">${escSafe(b.age)}</div>
  <div class="persona-psycho">${escSafe(b.psycho)}</div>
  <div class="two-col">
    <div>
      <div class="col-title green">They Are</div>
      ${theyAreHtml}
    </div>
    <div>
      <div class="col-title red">They Are Not</div>
      ${theyNotHtml}
    </div>
  </div>
</div>

<div class="section-title">Story Arc — Problem · Agitate · Solution</div>
<div class="beats-grid">
${beatsHtml}
</div>

<div class="section-title">Hook Options — First 3 Seconds</div>
<div class="hook-hint">If they don&apos;t feel it here, they scroll.</div>
<div class="hooks-list">${hooksHtml}</div>

<div class="section-title">Say This / Not This</div>
<div class="two-col">
  <div class="compliance-col approve">
    <div class="compliance-header">Say This</div>
    ${sayHtml}
  </div>
  <div class="compliance-col ban">
    <div class="compliance-header">Not This</div>
    ${notHtml}
  </div>
</div>

<div class="section-title">Revision Criteria</div>
<div class="revision-box">
  <div class="revision-header">Revisions will be needed if</div>
  <div class="revision-warning">If any of the following are present in your submission, revisions will be required before approval.</div>
  ${rejHtml}
</div>

<div class="section-title">Platform Notes</div>
<div class="info-box">${platNotesHtml}</div>

<div class="section-title">Deliverables</div>
<div class="info-box">${deliverablesHtml}</div>

<div class="doc-footer">Confidential — For Creator Use Only · Intake Breathing Technology LLC · ${genDate}</div>

</body></html>`;
}

function RejectionSection({ brief, formData, t, S, editable = true }) {
  const syncKey = `${(brief.rejections && brief.rejections.join?.("¦")) || ""}|${formData?.customRejections || ""}`;
  const [items, setItems] = useState(() =>
    Array.isArray(brief.rejections) && brief.rejections.length ? [...brief.rejections] : buildRejectionsArray(formData),
  );
  useEffect(() => {
    const next = Array.isArray(brief.rejections) && brief.rejections.length ? [...brief.rejections] : buildRejectionsArray(formData);
    setItems(next);
  }, [syncKey]);
  return (
    <div style={S.bSec}>
      <div style={S.bSecTitle}><Icon name="alertTriangle" size={16} color={t.orange} /><span>REVISION REQUIRED — Revisions Will Be Needed If:</span></div>
      <div className="brief-rejection-block" style={{ background: t.orange + "08", border: `2px solid ${t.orange}40`, borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 13, color: t.orange, fontWeight: 600, marginBottom: 14 }}>If any of the following are present in your submission, revisions will be required before approval.</div>
        {items.map((line, i) => (
          <EditableRejectionLine key={`rej-${i}-${line.slice(0, 24)}`} value={line} t={t} editable={editable} />
        ))}
        <RejectionAddRow t={t} editable={editable} onCommit={(text) => setItems((prev) => [...prev, text])} />
      </div>
    </div>
  );
}

function BriefDisplay({ brief: b, formData: fd, onBack, onRegenerate, onRegenerateAI, currentRole, creators = [] }) {
  const { t, S } = useContext(ThemeContext);
  const wasAI = fd.mode === "ai";
  const isManager = currentRole === ROLES.MANAGER;
  const [shareToast, setShareToast] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignSearch, setAssignSearch] = useState("");
  const [assignedIds, setAssignedIds] = useState(() => new Set());
  const [assignLoading, setAssignLoading] = useState(false);

  useEffect(() => {
    if (!showAssignModal || !fd?.shareId) return;
    (async () => {
      const { data: briefRow } = await supabase.from("briefs").select("id").eq("share_id", fd.shareId).maybeSingle();
      if (!briefRow?.id) return;
      const { data: existing } = await supabase.from("brief_assignments").select("creator_id").eq("brief_id", briefRow.id);
      if (existing) setAssignedIds(new Set(existing.map((a) => a.creator_id)));
    })();
  }, [showAssignModal, fd?.shareId]);

  const downloadPDF = () => {
    const esc = (str) => String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(buildBriefPrintHtml(b, fd, esc));
    doc.close();
    setTimeout(() => {
      iframe.contentWindow.print();
      setTimeout(() => { document.body.removeChild(iframe); }, 1000);
    }, 500);
  };

  const copyShareLink = () => {
    const id = (fd.shareId && String(fd.shareId).trim()) || "";
    if (!id) {
      setShareToast("No share ID on this brief — go back and generate again");
      setTimeout(() => setShareToast(null), 3500);
      return;
    }
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/brief?id=${encodeURIComponent(id)}`;
    navigator.clipboard.writeText(url).then(() => {
      setShareToast("Share link copied");
      setTimeout(() => setShareToast(null), 3500);
    }).catch(() => setShareToast("Could not copy to clipboard"));
  };

  return (
    <div style={S.bWrap} className="brief-print-root">
      {shareToast && (
        <div className="no-print" style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 200, background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: "12px 20px", fontSize: 13, color: t.textSecondary, boxShadow: t.shadow }}>
          {shareToast}
        </div>
      )}
      <div className="no-print" style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" onClick={onBack} style={{ ...S.btnS, fontSize: 13, padding: "9px 18px" }}>← Back</button>
        {isManager && (
          <>
            <button type="button" onClick={onRegenerateAI} style={{ ...S.btnS, fontSize: 13, padding: "9px 18px", borderColor: t.green+"50", color: t.green }}>IB-Ai Regenerate</button>
            <button type="button" onClick={onRegenerate} style={{ ...S.btnS, fontSize: 13, padding: "9px 18px", display: "inline-flex", alignItems: "center", gap: 8 }}><Icon name="zap" size={14} color={t.text} />Quick Regen</button>
          </>
        )}
        <button type="button" onClick={downloadPDF} style={{ ...S.btnS, fontSize: 13, padding: "9px 18px", borderColor: t.blue + "55", color: t.blue }}>Download PDF</button>
        {isManager && (
          <>
            <button type="button" onClick={() => setShowAssignModal(true)} style={{ ...S.btnS, fontSize: 13, padding: "9px 18px", borderColor: t.purple + "55", color: t.purple }}>Assign to Creators</button>
            <button type="button" onClick={copyShareLink} style={{ ...S.btnS, fontSize: 13, padding: "9px 18px", borderColor: t.border, color: t.textMuted }}>Copy Share Link</button>
          </>
        )}
      </div>
      <div style={{ marginBottom: 24 }}>
        <span style={{ ...S.badge(wasAI ? t.green : t.textFaint), fontSize: 11, display: "inline-flex", alignItems: "center", gap: 6 }}>{wasAI ? "IB-Ai" : <><Icon name="zap" size={12} color={t.textFaint} />Template Draft</>}</span>
      </div>
      <div style={S.bHeader}>
        <div style={S.bCampaign}>{fd.campaignName || (fd.productName === "Other" && fd.customProductName?.trim() ? fd.customProductName.trim() : fd.productName)}</div>
        <EditableField editable={isManager} value={`"${b.mission}"`} style={S.bMission} t={t} />
        <div style={S.badges}>
          <span style={S.badge(t.text)}>{fd.productName === "Other" && fd.customProductName?.trim() ? fd.customProductName.trim() : fd.productName}</span>
          <span style={S.badge(t.purple)}>{fd.vibe === "Other" && fd.customVibe?.trim() ? fd.customVibe.trim() : fd.vibe}</span>
          {normalizePlatforms(fd).map((p, i) => (
            <span key={`${p}-${i}`} style={S.badge(t.blue)}>{p === "Other" && fd.customPlatform?.trim() ? fd.customPlatform.trim() : p}</span>
          ))}
          <span style={S.badge(t.orange)}>{fd.videoLength}</span>
          <span style={S.badge(t.green)}>{fd.tone === "Other" && fd.customTone?.trim() ? fd.customTone.trim() : fd.tone}</span>
        </div>
        <div style={{ fontSize: 13, color: t.textMuted, marginTop: 14, lineHeight: 1.65 }}>
          {(() => {
            const rawB = String(fd.budgetPerVideo ?? "").trim().replace(/^\$/, "");
            const budgetLine = rawB ? `$${rawB}/video` : "TBD";
            const supL = SUPERVISION_LEVELS.find((s) => s.value === (fd.supervisionLevel || "full"))?.label || "Full Review";
            return (
              <div>
                Submitted by: {managerDisplayName(fd)}
                {" "}
                · Videos: {fd.contentQuantity ?? "1"}
                {" "}
                · Budget: {budgetLine}
                {" "}
                · Supervision: {supL}
              </div>
            );
          })()}
        </div>
        {isManager && <div style={{ fontSize: 12, color: t.textFaint, marginTop: 14, fontStyle: "italic" }}>Click any text to edit</div>}
      </div>
      <div style={S.bSec}>
        <div style={S.bSecTitle}><Icon name="users" size={16} color={t.textFaint} /><span>Who You&apos;re Talking To</span></div>
        <div style={S.card}>
          <EditableField editable={isManager} value={b.persona} style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, color: t.text }} t={t} />
          <EditableField editable={isManager} value={b.age} style={{ fontSize: 13, color: t.blue, fontWeight: 600, marginBottom: 10 }} t={t} />
          <EditableField editable={isManager} value={b.psycho} style={{ fontSize: 14, color: t.textMuted, lineHeight: 1.6, marginBottom: 16 }} t={t} />
          <div style={S.cols2}>
            <div><div style={{ ...S.sayH(t.green), display: "flex", alignItems: "center", gap: 6 }}><Icon name="checkSm" size={14} color={t.green} />They Are</div>{b.theyAre.map((x,i)=><div key={i} style={{ ...S.li, display: "flex", alignItems: "flex-start", gap: 6 }}><Icon name="checkSm" size={14} color={t.green} /><EditableField editable={isManager} value={x} style={{ flex: 1, fontSize: 13, color: t.textSecondary, lineHeight: 1.7, minWidth: 0 }} t={t} /></div>)}</div>
            <div><div style={{ ...S.sayH(t.red), display: "flex", alignItems: "center", gap: 6 }}><Icon name="x" size={14} color={t.red} />They Are Not</div>{b.theyAreNot.map((x,i)=><div key={i} style={{ ...S.li, display: "flex", alignItems: "flex-start", gap: 6 }}><Icon name="x" size={14} color={t.red} /><EditableField editable={isManager} value={x} style={{ flex: 1, fontSize: 13, color: t.textSecondary, lineHeight: 1.7, minWidth: 0 }} t={t} /></div>)}</div>
          </div>
        </div>
      </div>
      <div style={S.bSec}>
        <div style={S.bSecTitle}><Icon name="videoCamera" size={16} color={t.textFaint} /><span>Story Arc — Problem · Agitate · Solution</span></div>
        {[
          { label: "PROBLEM", color: t.red, inst: b.probInst, lines: b.probLines, overlays: b.probOverlays },
          { label: "AGITATE", color: t.orange, inst: b.agInst, lines: b.agLines, overlays: b.agOverlays },
          { label: "SOLUTION", color: t.green, inst: b.solInst, lines: b.solLines, overlays: b.solOverlays },
        ].map(bt=>(
          <div key={bt.label} style={S.beat(bt.color)}>
            <div style={S.beatLabel(bt.color)}>{bt.label}</div>
            <EditableField editable={isManager} value={bt.inst} style={S.beatInst} t={t} />
            <div style={S.beatSub}>Lines to riff on</div>
            {bt.lines.map((l,i)=><EditableField key={i} editable={isManager} value={`"${l}"`} style={S.beatLine} t={t} />)}
            <div style={{ ...S.beatSub, marginTop: 12 }}>Overlay ideas</div>
            {bt.overlays.map((o,i)=><div key={i} style={{ marginBottom: 4 }}><EditableField editable={isManager} value={o} style={{ ...S.beatLine, borderLeftColor: bt.color+"40" }} t={t} /></div>)}
          </div>
        ))}
      </div>
      <div style={S.bSec}>
        <div style={S.bSecTitle}><Icon name="anchor" size={16} color={t.textFaint} /><span>Hook Options — First 3 Seconds</span></div>
        <div style={{ fontSize: 12, color: t.textFaint, fontStyle: "italic", marginBottom: 14 }}>If they don't feel it here, they scroll.</div>
        <div style={S.card}>{b.hooks.map((h,i)=>(<div key={i} style={S.hookItem}><div style={S.hookNum}>{i+1}</div><EditableField editable={isManager} value={h} style={S.hookText} t={t} /></div>))}</div>
      </div>
      <div style={S.bSec}>
        <div style={S.bSecTitle}><Icon name="checkCircle" size={16} color={t.textFaint} /><span>Say This / Not This</span></div>
        <div style={S.cols2}>
          <div style={S.sayCol}><div style={{ ...S.sayH(t.green), display: "flex", alignItems: "center", gap: 6 }}><Icon name="checkCircle" size={14} color={t.green} />Say This</div>{b.sayThis.map((s,i)=><div key={i} style={{ ...S.li, display: "flex", alignItems: "flex-start", gap: 6 }}><Icon name="checkSm" size={14} color={t.green} /><EditableField editable={isManager} value={s} style={{ flex: 1, fontSize: 13, color: t.textSecondary, lineHeight: 1.7, minWidth: 0 }} t={t} /></div>)}</div>
          <div style={S.dontCol}><div style={{ ...S.sayH(t.red), display: "flex", alignItems: "center", gap: 6 }}><Icon name="ban" size={14} color={t.red} />Not This</div>{b.notThis.map((s,i)=><div key={i} style={{ ...S.li, display: "flex", alignItems: "flex-start", gap: 6 }}><Icon name="x" size={14} color={t.red} /><EditableField editable={isManager} value={s} style={{ flex: 1, fontSize: 13, color: t.textSecondary, lineHeight: 1.7, minWidth: 0 }} t={t} /></div>)}</div>
        </div>
      </div>
      <RejectionSection brief={b} formData={fd} t={t} S={S} editable={isManager} />
      <div style={S.bSec}>
        <div style={S.bSecTitle}><Icon name="smartphone" size={16} color={t.textFaint} /><span>Platform Notes</span></div>
        <div style={S.card}><EditableField editable={isManager} value={b.platNotes} style={{ fontSize: 14, color: t.textSecondary, lineHeight: 1.6, whiteSpace: "pre-wrap" }} t={t} /></div>
      </div>
      <div style={S.bSec}>
        <div style={S.bSecTitle}><Icon name="package" size={16} color={t.textFaint} /><span>Deliverables</span></div>
        <div style={S.card}><EditableField editable={isManager} value={b.deliverables} style={{ fontSize: 14, color: t.textSecondary, lineHeight: 1.6 }} t={t} /></div>
      </div>
      <div style={S.bSec}>
        <div style={S.bSecTitle}><Icon name="upload" size={16} color={t.textFaint} /><span>Creator Submissions</span></div>
        <div style={{ border: `2px dashed ${t.border}`, borderRadius: 12, padding: "40px 20px", textAlign: "center", color: t.textFaint, fontSize: 14 }}>Upload zone coming soon.</div>
      </div>

      {showAssignModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={() => setShowAssignModal(false)} role="presentation">
          <div onClick={(e) => e.stopPropagation()} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 24, width: "100%", maxWidth: 500, maxHeight: "80vh", overflow: "auto" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 4 }}>Assign Brief</div>
            <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 16 }}>Select creators to receive this brief</div>
            <input value={assignSearch} onChange={(e) => setAssignSearch(e.target.value)} placeholder="Search creators..." style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 13, marginBottom: 12, outline: "none", boxSizing: "border-box" }} />
            {(creators || []).filter((c) => c.status === "Active" && (!assignSearch.trim() || `${c.handle} ${c.name} ${c.email}`.toLowerCase().includes(assignSearch.toLowerCase()))).map((c) => {
              const assigned = assignedIds.has(c.id);
              return (
                <div
                  key={c.id}
                  onClick={async () => {
                    if (assigned || assignLoading) return;
                    setAssignLoading(true);
                    let { data: briefRow } = await supabase.from("briefs").select("id").eq("share_id", fd.shareId).maybeSingle();
                    if (!briefRow?.id) {
                      const { data: inserted } = await supabase
                        .from("briefs")
                        .insert({
                          share_id: fd.shareId,
                          name: fd.campaignName || fd.productName || "Brief",
                          brief_data: b,
                          form_data: fd,
                          mode: fd.mode || "template",
                          created_by: fd.manager || "",
                        })
                        .select()
                        .single();
                      briefRow = inserted;
                    }
                    if (briefRow?.id) {
                      await supabase.from("brief_assignments").insert({ brief_id: briefRow.id, creator_id: c.id, status: "assigned" });
                      setAssignedIds((prev) => new Set([...prev, c.id]));
                    }
                    setAssignLoading(false);
                  }}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, cursor: assigned ? "default" : "pointer", marginBottom: 4, background: assigned ? t.green + "08" : "transparent", border: `1px solid ${assigned ? t.green + "25" : "transparent"}` }}
                  onMouseEnter={(e) => { if (!assigned) e.currentTarget.style.background = t.cardAlt; }}
                  onMouseLeave={(e) => { if (!assigned) e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{ width: 32, height: 32, borderRadius: 16, background: t.cardAlt, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: t.textFaint, flexShrink: 0 }}>{(c.handle || "?").replace("@", "").charAt(0).toUpperCase()}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{c.handle}</div>
                    <div style={{ fontSize: 11, color: t.textFaint }}>{c.email || "no email"}</div>
                  </div>
                  {assigned ? <span style={{ fontSize: 11, color: t.green, fontWeight: 700 }}>✓ Assigned</span> : <span style={{ fontSize: 11, color: t.textFaint }}>Click to assign</span>}
                </div>
              );
            })}
            <button type="button" onClick={() => setShowAssignModal(false)} style={{ width: "100%", padding: 10, borderRadius: 8, border: `1px solid ${t.border}`, background: "transparent", color: t.textMuted, fontSize: 13, cursor: "pointer", marginTop: 12 }}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ManagerCreatorChat({ creatorId, t }) {
  const [msgs, setMsgs] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!creatorId) return;
    (async () => {
      const { data } = await supabase.from("messages").select("*").eq("creator_id", creatorId).order("created_at", { ascending: true });
      setMsgs(data || []);
      await supabase.from("messages").update({ read: true }).eq("creator_id", creatorId).eq("sender", "creator").eq("read", false);
      setLoading(false);
    })();

    const ch = supabase
      .channel(`mgr-msg-${creatorId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `creator_id=eq.${creatorId}` }, (p) => {
        setMsgs((prev) => [...prev, p.new]);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [creatorId]);

  const send = async () => {
    if (!draft.trim()) return;
    const m = draft.trim();
    setDraft("");
    await supabase.from("messages").insert({ creator_id: creatorId, sender: "manager", message: m });
  };

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: t.text, marginBottom: 12 }}>Messages</div>
      <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 16, maxHeight: 300, overflowY: "auto" }}>
        {loading ? <div style={{ color: t.textFaint, fontSize: 12 }}>Loading...</div> : null}
        {!loading && msgs.length === 0 ? <div style={{ color: t.textFaint, fontSize: 12 }}>No messages yet.</div> : null}
        {msgs.map((m) => (
          <div key={m.id} style={{ display: "flex", justifyContent: m.sender === "manager" ? "flex-end" : "flex-start", marginBottom: 6 }}>
            <div style={{ maxWidth: "75%", padding: "8px 12px", borderRadius: 10, background: m.sender === "manager" ? t.blue + "15" : t.cardAlt, border: `1px solid ${m.sender === "manager" ? t.blue + "25" : t.border}` }}>
              <div style={{ fontSize: 12, color: t.text, lineHeight: 1.5 }}>{m.message}</div>
              <div style={{ fontSize: 9, color: t.textFaint, marginTop: 2 }}>{new Date(m.created_at).toLocaleString()}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Message creator..." style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 12, outline: "none" }} />
        <button type="button" onClick={send} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: t.blue, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Send</button>
      </div>
    </div>
  );
}

function CreatorLogin({ navigate, t }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState("email");
  const [error, setError] = useState(null);

  const sendCode = async () => {
    const clean = email.trim().toLowerCase();
    if (!clean || !clean.includes("@")) {
      setError("Enter a valid email.");
      return;
    }
    setStep("sending");
    setError(null);
    try {
      const { error: e } = await supabase.auth.signInWithOtp({ email: clean, options: { shouldCreateUser: true } });
      if (e) throw e;
      setStep("code");
    } catch (e) {
      setError(e.message || "Failed to send code.");
      setStep("email");
    }
  };

  const verify = async () => {
    if (code.length !== 6) {
      setError("Enter the 6-digit code.");
      return;
    }
    setStep("verifying");
    setError(null);
    try {
      const { error: e } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code, type: "email" });
      if (e) throw e;

      const { data: creator } = await supabase.from("creators").select("id, onboarded").eq("email", email.trim().toLowerCase()).maybeSingle();

      if (!creator) {
        setError("Your email isn't in our creator database. Contact your Intake manager to get invited.");
        await supabase.auth.signOut();
        setStep("email");
        return;
      }

      navigate(creator.onboarded ? "creatorDashboard" : "creatorOnboard");
    } catch (e) {
      setError(e.message || "Invalid code.");
      setStep("code");
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <img src="/favicon-32.png" alt="Intake" style={{ width: 48, height: 48, marginBottom: 12 }} onError={(e) => { e.target.style.display = "none"; }} />
          <div style={{ fontSize: 22, fontWeight: 800, color: t.text }}>Creator Portal</div>
          <div style={{ fontSize: 13, color: t.textMuted, marginTop: 4 }}>Intake Breathing</div>
        </div>

        <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 28 }}>
          {step === "email" || step === "sending" ? (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 4 }}>Sign in</div>
              <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 20 }}>We&apos;ll send a 6-digit code to your email</div>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendCode()} placeholder="your@email.com" autoFocus style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 12 }} />
              <button type="button" onClick={sendCode} disabled={step === "sending"} style={{ width: "100%", padding: 12, borderRadius: 8, border: "none", background: t.green, color: t.isLight ? "#fff" : "#000", fontSize: 14, fontWeight: 700, cursor: step === "sending" ? "wait" : "pointer", opacity: step === "sending" ? 0.6 : 1 }}>
                {step === "sending" ? "Sending..." : "Send Code"}
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 4 }}>Check your email</div>
              <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 20 }}>Code sent to <strong style={{ color: t.text }}>{email}</strong></div>
              <input type="text" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} onKeyDown={(e) => e.key === "Enter" && verify()} placeholder="000000" autoFocus style={{ width: "100%", padding: 14, borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 24, fontWeight: 800, textAlign: "center", letterSpacing: "0.3em", outline: "none", boxSizing: "border-box", marginBottom: 12 }} />
              <button type="button" onClick={verify} disabled={step === "verifying"} style={{ width: "100%", padding: 12, borderRadius: 8, border: "none", background: t.green, color: t.isLight ? "#fff" : "#000", fontSize: 14, fontWeight: 700, cursor: step === "verifying" ? "wait" : "pointer", opacity: step === "verifying" ? 0.6 : 1 }}>
                {step === "verifying" ? "Verifying..." : "Sign In"}
              </button>
              <button type="button" onClick={() => { setStep("email"); setCode(""); setError(null); }} style={{ width: "100%", marginTop: 8, padding: 10, border: "none", background: "transparent", color: t.textFaint, fontSize: 12, cursor: "pointer" }}>Different email</button>
            </>
          )}
          {error ? <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, background: t.red + "10", border: `1px solid ${t.red}25`, fontSize: 13, color: t.red }}>{error}</div> : null}
        </div>
        <div style={{ textAlign: "center", marginTop: 20, fontSize: 11, color: t.textFaint }}>Contact your Intake manager if you don&apos;t have access.</div>
      </div>
    </div>
  );
}

function CreatorOnboard({ creatorProfile: cp, navigate, t }) {
  const [form, setForm] = useState({
    name: cp?.name || "",
    instagramHandle: cp?.instagramHandle || (cp?.handle || "").replace("@", ""),
    tiktokHandle: cp?.tiktokHandle || (cp?.handle || "").replace("@", ""),
    address: cp?.address || "",
    costPerVideo: cp?.costPerVideo || "",
    niche: cp?.niche || "",
  });
  const [saving, setSaving] = useState(false);
  const upd = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) {
      alert("Enter your name.");
      return;
    }
    setSaving(true);
    const ig = form.instagramHandle.replace("@", "").trim();
    const tt = form.tiktokHandle.replace("@", "").trim();
    const { error } = await supabase
      .from("creators")
      .update({
        name: form.name.trim(),
        instagram_handle: ig,
        tiktok_handle: tt,
        instagram_url: ig ? `https://www.instagram.com/${ig}/` : "",
        tiktok_url: tt ? `https://www.tiktok.com/@${tt}` : "",
        address: form.address.trim(),
        cost_per_video: form.costPerVideo.trim(),
        niche: form.niche.trim(),
        onboarded: true,
        onboarded_at: new Date().toISOString(),
      })
      .eq("id", cp.id);
    setSaving(false);
    if (error) {
      alert("Save failed: " + error.message);
      return;
    }
    navigate("creatorDashboard");
  };

  const inp = (label, key, ph, opts) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, color: t.textFaint, marginBottom: 4 }}>{label}</div>
      {opts?.multi ? (
        <textarea value={form[key]} onChange={(e) => upd(key, e.target.value)} placeholder={ph} rows={3} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 13, resize: "vertical", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
      ) : (
        <input value={form[key]} onChange={(e) => upd(key, e.target.value)} placeholder={ph} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
      )}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: t.bg, padding: 24 }}>
      <div style={{ maxWidth: 480, margin: "0 auto", paddingTop: 40 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: t.text }}>Welcome to Intake</div>
          <div style={{ fontSize: 13, color: t.textMuted, marginTop: 4 }}>Set up your creator profile</div>
        </div>
        <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 24 }}>
          {inp("Your Name *", "name", "First and last name")}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {inp("Instagram Handle", "instagramHandle", "handle")}
            {inp("TikTok Handle", "tiktokHandle", "handle")}
          </div>
          {inp("Content Niches", "niche", "e.g. Fitness, Lifestyle, Health")}
          {inp("Rate per Video ($)", "costPerVideo", "e.g. 100")}
          {inp("Shipping Address", "address", "Street, City, State, ZIP — we'll send you product here", { multi: true })}
          <button type="button" onClick={save} disabled={saving} style={{ width: "100%", padding: 14, borderRadius: 10, border: "none", background: t.green, color: t.isLight ? "#fff" : "#000", fontSize: 14, fontWeight: 700, cursor: saving ? "wait" : "pointer", marginTop: 8, opacity: saving ? 0.6 : 1 }}>
            {saving ? "Saving..." : "Save & Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreatorDashboard({ creatorProfile: cp, navigate, t }) {
  const [assignments, setAssignments] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!cp?.id) return;
    (async () => {
      const { data: a } = await supabase.from("brief_assignments").select("*, briefs(*)").eq("creator_id", cp.id).order("assigned_at", { ascending: false });
      setAssignments(a || []);
      const { count } = await supabase.from("messages").select("id", { count: "exact", head: true }).eq("creator_id", cp.id).eq("sender", "manager").eq("read", false);
      setUnread(count || 0);
      setLoading(false);
    })();
  }, [cp?.id]);

  if (loading) return <div style={{ minHeight: "100vh", background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", color: t.textMuted }}>Loading...</div>;

  return (
    <div style={{ minHeight: "100vh", background: t.bg, padding: 24 }}>
      <div style={{ maxWidth: 660, margin: "0 auto", paddingTop: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: t.text }}>Hey, {cp?.name?.split(" ")[0] || "Creator"}</div>
            <div style={{ fontSize: 13, color: t.textMuted }}>Intake Breathing</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => navigate("creatorProfile")} style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.cardAlt, color: t.text, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Profile</button>
            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate("creatorLogin");
              }}
              style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${t.border}`, background: "transparent", color: t.textFaint, fontSize: 12, cursor: "pointer" }}
            >
              Sign Out
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 24 }}>
          {[
            { v: assignments.length, l: "Briefs", c: t.blue, click: null },
            { v: unread, l: "Messages", c: t.orange, click: () => navigate("creatorMessages") },
            { v: cp?.ibScore ?? "—", l: "IB Score", c: t.green, click: null },
          ].map((s, i) => (
            <div
              key={i}
              onClick={s.click || undefined}
              style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: 16, textAlign: "center", cursor: s.click ? "pointer" : "default", position: "relative" }}
            >
              <div style={{ fontSize: 22, fontWeight: 800, color: s.c }}>{s.v}</div>
              <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>{s.l}</div>
              {s.l === "Messages" && unread > 0 ? <div style={{ position: "absolute", top: 6, right: 6, width: 8, height: 8, borderRadius: 4, background: t.red }} /> : null}
            </div>
          ))}
        </div>

        <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 10 }}>Your Briefs</div>
        {assignments.length === 0 ? (
          <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: 24, textAlign: "center", color: t.textFaint, fontSize: 13 }}>No briefs yet. Your manager will assign them when ready.</div>
        ) : (
          assignments.map((a) => {
            const br = a.briefs;
            const sc = { assigned: t.blue, viewed: t.orange, submitted: t.purple, approved: t.green, revision: t.red }[a.status] || t.textFaint;
            return (
              <div
                key={a.id}
                onClick={() => {
                  if (a.status === "assigned") supabase.from("brief_assignments").update({ status: "viewed", viewed_at: new Date().toISOString() }).eq("id", a.id);
                  navigate("creatorBriefView", { assignmentId: a.id, briefId: br?.id });
                }}
                style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: 14, marginBottom: 8, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.green + "50"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{br?.name || "Brief"}</div>
                  <div style={{ fontSize: 11, color: t.textFaint }}>
                    {(br?.created_by ?? br?.form_data?.manager) || ""} · {a.assigned_at ? new Date(a.assigned_at).toLocaleDateString() : ""}
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 10, background: sc + "15", color: sc }}>{a.status === "assigned" ? "New" : a.status}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function CreatorBriefView({ navigate, t }) {
  const [brief, setBrief] = useState(null);
  const [formData, setFormData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const briefId = params.get("briefId") || params.get("id");
    if (!briefId) {
      setLoading(false);
      return;
    }

    (async () => {
      const { data } = await supabase.from("briefs").select("*").eq("id", briefId).maybeSingle();
      if (data) {
        setBrief(data.brief_data);
        setFormData(data.form_data);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <div style={{ minHeight: "100vh", background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", color: t.textMuted }}>Loading brief...</div>;
  if (!brief) return <div style={{ minHeight: "100vh", background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", color: t.textFaint }}>Brief not found.</div>;

  return (
    <div style={{ minHeight: "100vh", background: t.bg }}>
      <div style={{ padding: "12px 24px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 12 }}>
        <button type="button" onClick={() => navigate("creatorDashboard")} style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.cardAlt, color: t.text, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>← Back to Dashboard</button>
        <span style={{ fontSize: 13, color: t.textMuted }}>Viewing brief</span>
      </div>
      <BriefDisplay brief={brief} formData={formData || {}} currentRole={ROLES.CREATOR} creators={[]} onBack={() => navigate("creatorDashboard")} onRegenerate={() => {}} onRegenerateAI={() => {}} />
    </div>
  );
}

function CreatorMessages({ creatorProfile: cp, navigate, t }) {
  const [msgs, setMsgs] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const endRef = useRef(null);

  useEffect(() => {
    if (!cp?.id) return;
    (async () => {
      const { data } = await supabase.from("messages").select("*").eq("creator_id", cp.id).order("created_at", { ascending: true });
      setMsgs(data || []);
      await supabase.from("messages").update({ read: true }).eq("creator_id", cp.id).eq("sender", "manager").eq("read", false);
      setLoading(false);
    })();

    const ch = supabase
      .channel(`msg-${cp.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `creator_id=eq.${cp.id}` }, (p) => {
        setMsgs((prev) => [...prev, p.new]);
        if (p.new.sender === "manager") supabase.from("messages").update({ read: true }).eq("id", p.new.id);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [cp?.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  const send = async () => {
    if (!draft.trim() || !cp?.id) return;
    const m = draft.trim();
    setDraft("");
    await supabase.from("messages").insert({ creator_id: cp.id, sender: "creator", message: m });
  };

  return (
    <div style={{ minHeight: "100vh", background: t.bg, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "12px 24px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 12 }}>
        <button type="button" onClick={() => navigate("creatorDashboard")} style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.cardAlt, color: t.text, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>← Back</button>
        <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Messages</span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px", maxWidth: 600, margin: "0 auto", width: "100%" }}>
        {loading ? <div style={{ color: t.textFaint, textAlign: "center", padding: 40 }}>Loading...</div> : null}
        {!loading && msgs.length === 0 ? <div style={{ color: t.textFaint, textAlign: "center", padding: 40, fontSize: 13 }}>No messages yet. Send one below.</div> : null}
        {msgs.map((m) => (
          <div key={m.id} style={{ display: "flex", justifyContent: m.sender === "creator" ? "flex-end" : "flex-start", marginBottom: 8 }}>
            <div
              style={{
                maxWidth: "75%",
                padding: "10px 14px",
                borderRadius: 12,
                background: m.sender === "creator" ? t.green + "18" : t.cardAlt,
                border: `1px solid ${m.sender === "creator" ? t.green + "30" : t.border}`,
              }}
            >
              <div style={{ fontSize: 13, color: t.text, lineHeight: 1.5 }}>{m.message}</div>
              <div style={{ fontSize: 10, color: t.textFaint, marginTop: 4 }}>{new Date(m.created_at).toLocaleString()}</div>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div style={{ borderTop: `1px solid ${t.border}`, padding: "12px 24px" }}>
        <div style={{ display: "flex", gap: 8, maxWidth: 600, margin: "0 auto" }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Type a message..." style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 13, outline: "none" }} />
          <button type="button" onClick={send} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: t.green, color: t.isLight ? "#fff" : "#000", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Send</button>
        </div>
      </div>
    </div>
  );
}

function CreatorProfileEdit({ creatorProfile: cp, navigate, t, onProfileUpdate }) {
  const [form, setForm] = useState({
    name: cp?.name || "",
    instagramHandle: cp?.instagramHandle || "",
    tiktokHandle: cp?.tiktokHandle || "",
    address: cp?.address || "",
    costPerVideo: cp?.costPerVideo || "",
    niche: cp?.niche || "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const upd = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    setSaved(false);
    const ig = form.instagramHandle.replace("@", "").trim();
    const tt = form.tiktokHandle.replace("@", "").trim();
    const { error } = await supabase
      .from("creators")
      .update({
        name: form.name.trim(),
        instagram_handle: ig,
        tiktok_handle: tt,
        instagram_url: ig ? `https://www.instagram.com/${ig}/` : "",
        tiktok_url: tt ? `https://www.tiktok.com/@${tt}` : "",
        address: form.address.trim(),
        cost_per_video: form.costPerVideo.trim(),
        niche: form.niche.trim(),
      })
      .eq("id", cp.id);
    setSaving(false);
    if (!error) {
      setSaved(true);
      if (onProfileUpdate) onProfileUpdate();
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const inp = (label, key, ph, opts) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, color: t.textFaint, marginBottom: 4 }}>{label}</div>
      {opts?.multi ? (
        <textarea value={form[key]} onChange={(e) => upd(key, e.target.value)} placeholder={ph} rows={3} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 13, resize: "vertical", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
      ) : (
        <input value={form[key]} onChange={(e) => upd(key, e.target.value)} placeholder={ph} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
      )}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: t.bg, padding: 24 }}>
      <div style={{ maxWidth: 480, margin: "0 auto", paddingTop: 24 }}>
        <button type="button" onClick={() => navigate("creatorDashboard")} style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.cardAlt, color: t.text, fontSize: 12, fontWeight: 600, cursor: "pointer", marginBottom: 20 }}>← Back</button>
        <div style={{ fontSize: 20, fontWeight: 800, color: t.text, marginBottom: 20 }}>Your Profile</div>
        <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 24 }}>
          {inp("Name", "name", "Your name")}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {inp("Instagram", "instagramHandle", "handle")}
            {inp("TikTok", "tiktokHandle", "handle")}
          </div>
          {inp("Niches", "niche", "Fitness, Lifestyle...")}
          {inp("Rate / video ($)", "costPerVideo", "100")}
          {inp("Shipping Address", "address", "Street, City, State, ZIP", { multi: true })}
          <button type="button" onClick={save} disabled={saving} style={{ width: "100%", padding: 12, borderRadius: 8, border: "none", background: t.green, color: t.isLight ? "#fff" : "#000", fontSize: 14, fontWeight: 700, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Saving..." : saved ? "✓ Saved" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PublicBriefView({ t }) {
  const [brief, setBrief] = useState(null);
  const [formData, setFormData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const shareId = new URLSearchParams(window.location.search).get("id");
    if (!shareId?.trim()) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase.from("briefs").select("*").eq("share_id", shareId.trim()).maybeSingle();
      if (data) {
        setBrief(data.brief_data);
        setFormData(data.form_data || {});
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <div style={{ minHeight: "100vh", background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", color: t.textMuted }}>Loading brief...</div>;
  if (!brief) return <div style={{ minHeight: "100vh", background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", color: t.textFaint, padding: 24 }}>Brief not found or invalid link.</div>;

  return (
    <div style={{ minHeight: "100vh", background: t.bg, padding: "16px 24px 40px" }}>
      <BriefDisplay brief={brief} formData={formData || {}} currentRole={ROLES.CREATOR} creators={[]} onBack={() => window.history.back()} onRegenerate={() => {}} onRegenerateAI={() => {}} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// IB-Ai — prompt builder (Claude)
// ═══════════════════════════════════════════════════════════

function buildAIPrompt(d, knowledge) {
  const k = knowledge && typeof knowledge === "object" ? knowledge : null;
  const ageR = d.ageRange || "25-34";
  const gen = d.gender || "Men & Women";
  const productResolved = d.productName === "Other" ? (d.customProductName || "").trim() : d.productName;
  const vibeResolved = d.vibe === "Other" ? (d.customVibe || "").trim() : d.vibe;
  const prob = (d.problem ?? d._problem ?? d.customProblem ?? "").trim();
  const audienceCompact = `${gen} ${ageR}`;
  const audienceForm = d._audience || `Ages ${ageR} — ${gen}`;
  const plats = normalizePlatforms(d);
  const platLine = plats.map((p) => {
    if (p === "Other" && (d.customPlatform || "").trim()) return `Other (${(d.customPlatform || "").trim()})`;
    return p;
  }).join(", ");
  const toneResolved = d.tone === "Other" ? (d.customTone || "").trim() : (d.tone || "");
  const rejectionsLine = Array.isArray(d._rejections) && d._rejections.length
    ? d._rejections.join(". ")
    : buildRejectionsArray(d, k?.defaultRejections).join(". ");
  const mgrName = managerDisplayName(d);
  const qtyVideos = String(d.contentQuantity ?? "1").trim() || "1";
  const rawBudgetAi = String(d.budgetPerVideo ?? "").trim().replace(/^\$/, "");
  const budgetStrAi = rawBudgetAi ? `$${rawBudgetAi}` : "TBD";
  const supValAi = d.supervisionLevel || "full";
  const supEntry = SUPERVISION_LEVELS.find((s) => s.value === supValAi) || SUPERVISION_LEVELS[0];
  const supervisionLabelAi = supEntry.label;
  const supervisionDescAi = supEntry.desc;
  const supervisionToneNote =
    supValAi === "handsoff"
      ? "Supervision is Hands Off: the brief must be extra clear and detailed — creators will not have revision rounds, so every requirement, format spec, and CTA must be self-contained and unambiguous."
      : supValAi === "full"
        ? "Supervision is Full Review: you may keep the creative direction slightly looser knowing 1-2 revision rounds will refine the work — but still be specific on compliance and deliverables."
        : "Supervision is Light Touch: balance clarity with brevity — minor feedback may occur but avoid relying on heavy revision cycles.";
  const brandBlock = k?.brandContext && String(k.brandContext).trim()
    ? `BRAND CONTEXT (internal — match tone and claims to this):\n${String(k.brandContext).trim()}\n\n`
    : "";
  return `You are an expert UGC (user-generated content) brief writer for Intake Breathing, a magnetic nasal dilator company. Write a complete creator brief. Be specific, creative, and tailored to this exact campaign — not generic.

${brandBlock}PRODUCT: ${productResolved} by Intake Breathing
CAMPAIGN NAME: ${d.campaignName || "Untitled"}
CAMPAIGN VIBE: ${vibeResolved}
MISSION: ${d.mission || "N/A"}
SUBMITTED BY: ${mgrName}
CONTENT QUANTITY: ${qtyVideos} videos needed
BUDGET: ${budgetStrAi} per video
SUPERVISION LEVEL: ${supervisionLabelAi} — ${supervisionDescAi}
${supervisionToneNote}
TARGET AUDIENCE: ${audienceCompact}
AUDIENCE (form selection, ageRange + gender): ${audienceForm}
CORE PROBLEM: ${prob}
APPROVED CLAIMS (creators CAN say): ${d._approved || ""}
BANNED CLAIMS (NEVER say): ${d._banned || ""}
REVISION REQUIRED CRITERIA (revisions will be needed if any of these appear): ${rejectionsLine}

Include these revision criteria in the brief and make sure the creative direction avoids all of them.

PLATFORMS: ${platLine}
VIDEO LENGTH: ${d.videoLength || ""}
TONE: ${toneResolved}
CREATIVE NOTES: ${d.notes || "None"}

TONE DIRECTION: The creative tone for this brief is "${toneResolved}". Match this voice consistently in hooks, on-camera delivery, pacing, overlay text, and every line of copy — do not default to a generic influencer voice.

The deliverables JSON field must clearly state that ${qtyVideos} video(s) are requested for this campaign, in addition to format and upload requirements.

Write the brief as JSON. Be CREATIVE and SPECIFIC to this campaign — don't be generic. Write hooks that would actually stop someone mid-scroll. Write riff lines that sound like a real person talking, not marketing copy. Overlay ideas should be specific visual directions.

Return ONLY this JSON (no other text):
{"mission":"one line mission statement","persona":"creative persona name for the target viewer","age":"age range","psycho":"2-3 sentences describing their mindset, fears, desires — be vivid and specific","theyAre":["4 psychographic traits that describe this viewer"],"theyAreNot":["4 things this viewer is NOT — help creators avoid wrong assumptions"],"probInst":"directive for the PROBLEM beat — tell the creator exactly what to show/say in the opening","probLines":["3 specific lines creators can say or riff on for the problem beat — conversational, not corporate"],"probOverlays":["3 specific text overlay or visual ideas for the problem beat"],"agInst":"directive for the AGITATE beat — how to twist the knife and create urgency","agLines":["3 agitate lines — make the viewer feel the cost of inaction"],"agOverlays":["3 overlay/visual ideas for the agitate beat"],"solInst":"directive for the SOLUTION beat — the payoff, the reveal, the transformation","solLines":["3 solution lines — the relief, the wow moment, the conversion push"],"solOverlays":["3 overlay/visual ideas for the solution beat"],"hooks":["4 scroll-stopping hook options for the first 2-3 seconds — these must be thumb-stoppers"],"sayThis":["5 approved phrases creators should use"],"notThis":["5 phrases creators must NEVER say"],"rejections":["array of strings — every revision-required rule listed above; include all criteria verbatim"],"platNotes":"platform-specific tips for all selected platforms (${platLine}) at ${d.videoLength}","deliverables":"what creators need to submit and format specs"}`;
}

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
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.green + "50"; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; }}
        style={{
          background: t.card,
          border: `1px solid ${t.border}`,
          borderRadius: 16,
          padding: 28,
          cursor: "pointer",
          boxShadow: t.shadow,
          transition: "border-color 0.15s",
        }}
      >
        <div style={{ marginBottom: 12, display: "flex", justifyContent: "flex-start" }}><Icon name="video" size={32} color={t.blue} /></div>
        <div style={{ fontSize: 18, fontWeight: 700, color: t.text, marginBottom: 4 }}>Video Reformatter</div>
        <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.55 }}>
          Paste a TikTok or Instagram URL or upload a file — download the original and use the ad format reference for Meta, YouTube, and TikTok placements
        </div>
      </div>
    </div>
  );
}

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
        const videoUrls = [
          ...(v?.download_addr?.url_list || []),
          ...brSorted.flatMap((br) => br.play_addr?.url_list || []),
          ...(v?.play_addr?.url_list || []),
        ].filter(Boolean);
        if (ad?.download_url) videoUrls.unshift(ad.download_url);
        if (data.download_url) videoUrls.unshift(data.download_url);
        if (data.video_url) videoUrls.unshift(data.video_url);
        const uniqueUrls = [...new Set(videoUrls)];
        console.log("[VideoReformatter] Found", uniqueUrls.length, "video URLs");

        parsed = {
          platform: "TikTok",
          author: ad?.author?.nickname || "Unknown",
          authorHandle: ad?.author?.unique_id || "",
          caption: ad?.desc || "",
          videoUrl: uniqueUrls[0] || "",
          videoUrls: uniqueUrls,
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
              {video.coverUrl ? (
                <img
                  src={video.coverUrl}
                  alt="Video thumbnail"
                  referrerPolicy="no-referrer"
                  style={{ width: 180, maxHeight: 320, objectFit: "cover", borderRadius: 8, background: t.cardAlt, display: "block" }}
                  onError={(e) => {
                    e.target.style.display = "none";
                    const ph = e.target.nextElementSibling;
                    if (ph) ph.style.display = "flex";
                  }}
                />
              ) : null}
              <div
                style={{
                  width: 180,
                  height: 240,
                  borderRadius: 8,
                  background: t.cardAlt,
                  display: video.coverUrl ? "none" : "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 32,
                  color: t.textFaint,
                }}
              >
                ▶
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
                    1×1 Square · 4×5 Feed · 9×16 Story · 16×9 Landscape
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
    this.state = { error: null, info: null };
  }
  static getDerivedStateFromError(error) {
    return { error: error.message };
  }
  componentDidCatch(error, info) {
    console.error("[CreatorDetail crash]", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, maxWidth: 800, margin: "0 auto" }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#ff4444", marginBottom: 12 }}>Something went wrong</div>
          <pre style={{ background: "#1a1a1a", padding: 16, borderRadius: 8, color: "#ff8800", overflow: "auto", fontSize: 12, marginBottom: 16 }}>{this.state.error}</pre>
          <button
            type="button"
            onClick={() => {
              this.setState({ error: null });
              window.history.back();
            }}
            style={{ padding: "10px 20px", background: "#00FEA9", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13 }}
          >
            ← Go Back
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function CreatorDetailView({ c, updateCreator, library, navigate, scrapeKey, apiKey, t, S, onScrapeCreditUsed = () => {}, setDbError, aiBrandContext }) {
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
  const [igPullBusy, setIgPullBusy] = useState(false);

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
        brandContext: aiBrandContext,
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
      const cpmExtra = enrichPatchWithCpm(c, patch, mergedCreator);
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
    const ak = (apiKey || "").trim() || (typeof localStorage !== "undefined" ? localStorage.getItem("intake-apikey") : "") || "";
    if (!ak.trim()) {
      alert("Add your Anthropic API key in Settings to enable IB Score");
      return;
    }
    setEnriching(true);
    setEnrichMsg("IB-Ai calculating IB Score…");
    try {
      const tt = c.tiktokData || {};
      const ig = c.instagramData || {};
      const ai = await runIbScoreClaude({
        apiKey: ak.trim(),
        brandContext: aiBrandContext,
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
        const row = { ...patch, ...enrichPatchWithCpm(c, patch, mergedCreator) };
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
                crossOrigin="anonymous"
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

      {(ai.oneSentence || enrichMsg) ? (
        <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
          {ai.oneSentence ? (
            <div style={{ fontSize: 13, color: t.textMuted, fontStyle: "italic", lineHeight: 1.6 }}>{ai.oneSentence}</div>
          ) : null}
          {enrichMsg ? (
            <div style={{ fontSize: 12, color: enrichMsg.includes("complete") || enrichMsg.includes("updated") ? t.green : t.orange, marginTop: ai.oneSentence ? 8 : 0 }}>{enrichMsg}</div>
          ) : null}
        </div>
      ) : null}

      {(() => {
        const igF = Number(c.instagramData?.followers) || 0;
        const ttF = Number(c.tiktokData?.followers) || 0;
        const ytF = Number(c.youtubeData?.subscribers) || 0;
        const totalReach = igF + ttF + ytF;
        const avgViews = c.tiktokData?.avgViews || c.tiktokAvgViews || null;
        const engRate = c.engagementRate ?? c.tiktokEngRate ?? c.instagramEngRate ?? null;
        const cpmD = calculateCreatorCPM(c);
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
          avgViews ? { value: formatMetricShort(avgViews), label: "Avg Views" } : null,
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
          const ttVideos = (c.tiktokData?.recentVideos || c.tiktokRecentVideos || []).slice(0, 8);
          const igPosts = (c.instagramRecentPosts || []).slice(0, 8);
          const igReels = (c.instagramRecentReels || []).slice(0, 8);

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
                caption: v.caption || v.desc || "",
                url: v.url || "",
                date: v.date || "",
                type: "video",
              })),
            },
            {
              name: "Instagram Reels",
              color: "#E1306C",
              icon: "◎",
              avatar: c.instagramData?.avatarUrl || "",
              handle: c.instagramHandle || c.handle?.replace("@", "") || "",
              profileUrl: c.instagramHandle ? `https://www.instagram.com/${c.instagramHandle}/reels/` : "",
              followers: c.instagramData?.followers,
              items: igReels.map((r) => ({
                cover: r.coverUrl || r.imageUrl || "",
                views: r.playCount || r.play_count || r.views || 0,
                likes: r.likes || 0,
                caption: r.caption || "",
                url: r.url || "",
                date: r.date || "",
                type: "reel",
              })),
            },
            {
              name: "Instagram Posts",
              color: "#E1306C",
              icon: "▣",
              avatar: c.instagramData?.avatarUrl || "",
              handle: c.instagramHandle || c.handle?.replace("@", "") || "",
              profileUrl: c.instagramHandle ? `https://www.instagram.com/${c.instagramHandle}/` : "",
              followers: null, // Don't repeat followers for second IG row
              items: igPosts.map((p) => ({
                cover: p.imageUrl || p.thumbnail_url || "",
                views: 0, // Posts don't have view counts typically
                likes: p.likes || 0,
                caption: p.caption || "",
                url: p.url || "",
                date: p.date || "",
                type: p.mediaType === "video" ? "video" : "post",
              })),
            },
          ].filter((p) => p.items.length > 0);

          if (platforms.length === 0) return null;

          return (
            <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.textFaint, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Recent Content</div>

              {platforms.map((plat, pi) => (
                <div key={pi} style={{ marginBottom: 16 }}>
                  {/* Platform header row — avatar + name + handle + follower count */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    {plat.avatar ? (
                      <img
                        src={plat.avatar}
                        alt=""
                        referrerPolicy="no-referrer"
                        crossOrigin="anonymous"
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
                      <a
                        key={ii}
                        href={item.url || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          flexShrink: 0,
                          width: 130,
                          textDecoration: "none",
                          borderRadius: 8,
                          overflow: "hidden",
                          border: `1px solid ${t.border}`,
                          background: t.card,
                          transition: "border-color 0.2s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = `${plat.color}50`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = t.border;
                        }}
                      >
                        <div style={{ width: 130, height: 170, position: "relative", background: t.cardAlt, overflow: "hidden" }}>
                          {item.cover ? (
                            <img
                              src={item.cover}
                              alt=""
                              referrerPolicy="no-referrer"
                              crossOrigin="anonymous"
                              loading="lazy"
                              style={{ width: 130, height: 170, objectFit: "cover", display: "block" }}
                              onError={(e) => {
                                e.target.style.display = "none";
                                const fallback = e.target.nextSibling;
                                if (fallback) fallback.style.display = "flex";
                              }}
                            />
                          ) : null}
                          <div
                            style={{
                              width: 130,
                              height: 170,
                              display: item.cover ? "none" : "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              background: `linear-gradient(135deg, ${plat.color}15, ${t.cardAlt})`,
                              gap: 6,
                            }}
                          >
                            <span style={{ fontSize: 28, opacity: 0.4 }}>{item.type === "post" ? "📷" : "🎬"}</span>
                            {item.views > 0 ? (
                              <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{formatMetricShort(item.views)} ▶</span>
                            ) : item.likes > 0 ? (
                              <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{formatMetricShort(item.likes)} ♥</span>
                            ) : null}
                            {item.date ? <span style={{ fontSize: 9, color: t.textFaint }}>{item.date}</span> : null}
                          </div>
                        </div>
                        <div style={{ padding: "6px 8px" }}>
                          {item.views > 0 ? (
                            <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>
                              {formatMetricShort(item.views)} ▶
                            </div>
                          ) : item.likes > 0 ? (
                            <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>
                              {formatMetricShort(item.likes)} ♥
                            </div>
                          ) : null}
                          {item.views > 0 && item.likes > 0 ? <div style={{ fontSize: 10, color: t.textFaint }}>{formatMetricShort(item.likes)} ♥</div> : null}
                          {item.date ? <div style={{ fontSize: 9, color: t.textFaint, marginTop: 2 }}>{item.date}</div> : null}
                          {item.caption ? (
                            <div style={{ fontSize: 9, color: t.textFaint, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 114 }}>
                              {String(item.caption).substring(0, 50)}
                            </div>
                          ) : null}
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
            const cpmData = calculateCreatorCPM(c);
            const aiRate = ai.estimatedRate;

            if (!cpmData && !aiRate) return null;

            if (cpmData) {
              const vidLabel = cpmData.platform === "Instagram" ? "posts" : "videos";
              return (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: t.textFaint, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Estimated Rate per Video</div>
                  <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: 16 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
                      <span style={{ fontSize: 28, fontWeight: 800, color: t.green }}>{cpmData.rateDisplay}</span>
                      <span style={{ fontSize: 13, color: t.textMuted }}>per video</span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 14 }}>
                      <div style={{ background: t.cardAlt, borderRadius: 8, padding: "8px 10px" }}>
                        <div style={{ fontSize: 9, color: t.textFaint, textTransform: "uppercase", marginBottom: 2 }}>Avg Views</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{formatMetricShort(cpmData.avgViews)}</div>
                        <div style={{ fontSize: 10, color: t.textFaint }}>
                          {cpmData.videoCount} {cpmData.platform} {vidLabel}
                        </div>
                      </div>
                      <div style={{ background: t.cardAlt, borderRadius: 8, padding: "8px 10px" }}>
                        <div style={{ fontSize: 9, color: t.textFaint, textTransform: "uppercase", marginBottom: 2 }}>CPM Rate</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>${cpmData.cpmFinal}</div>
                        <div style={{ fontSize: 10, color: t.textFaint }}>{cpmData.cpmTier}</div>
                      </div>
                      <div style={{ background: t.cardAlt, borderRadius: 8, padding: "8px 10px" }}>
                        <div style={{ fontSize: 9, color: t.textFaint, textTransform: "uppercase", marginBottom: 2 }}>Content Fit</div>
                        <div
                          style={{
                            fontSize: 15,
                            fontWeight: 700,
                            color: (cpmData.alignmentMultiplier ?? 1) > 1.1 ? t.green : (cpmData.alignmentMultiplier ?? 1) < 0.9 ? t.orange : t.text,
                          }}
                        >
                          ×{(cpmData.alignmentMultiplier ?? 1).toFixed(2)}
                        </div>
                        <div style={{ fontSize: 10, color: t.textFaint }}>
                          {cpmData?.hasIntakeContent ? "Intake creator ✓" : cpmData?.hasCompetitor ? "Competitor ⚠" : "Neutral"}
                        </div>
                      </div>
                      <div style={{ background: t.cardAlt, borderRadius: 8, padding: "8px 10px" }}>
                        <div style={{ fontSize: 9, color: t.textFaint, textTransform: "uppercase", marginBottom: 2 }}>Engagement</div>
                        <div
                          style={{
                            fontSize: 15,
                            fontWeight: 700,
                            color: (cpmData.engMultiplier ?? 1) > 1.1 ? t.green : (cpmData.engMultiplier ?? 1) < 0.9 ? t.orange : t.text,
                          }}
                        >
                          ×{(cpmData.engMultiplier ?? 1).toFixed(2)}
                        </div>
                        <div style={{ fontSize: 10, color: t.textFaint }}>
                          {cpmData?.engRate != null && Number.isFinite(Number(cpmData?.engRate)) ? `${Number(cpmData?.engRate).toFixed(1)}% rate` : "No data"}
                        </div>
                      </div>
                    </div>

                    {(cpmData?.alignmentReasons?.length > 0 || cpmData?.engReasons?.length > 0) ? (
                      <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.6, marginBottom: 10 }}>
                        {[...(cpmData?.alignmentReasons || []), ...(cpmData?.engReasons || [])].map((r, i) => (
                          <div key={i} style={{ color: r.includes("+") ? t.green : r.includes("-") ? t.orange : t.textMuted }}>• {r}</div>
                        ))}
                      </div>
                    ) : null}

                    <div style={{ fontSize: 10, color: t.textFaint, borderTop: `1px solid ${t.border}`, paddingTop: 8, lineHeight: 1.5 }}>
                      <strong>Formula:</strong> {formatMetricShort(cpmData.avgViews)} views ÷ 1,000 × ${cpmData.cpmFinal} CPM × {(cpmData.alignmentMultiplier ?? 1).toFixed(2)} fit × {(cpmData.engMultiplier ?? 1).toFixed(2)} eng = ${cpmData?.rawRate}/video
                      <br />
                      <strong>Industry avg (2026):</strong> $150-300/video for UGC · Beginner $50-150 · Mid $150-300 · Established $300-500
                    </div>

                    <ExpandableInsight
                      t={t}
                      label=""
                      value="Full calculation breakdown"
                      valueColor={t.textMuted}
                      valueFontSize={12}
                      explanation={cpmData?.explanation}
                    />
                  </div>
                </div>
              );
            }

            return (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: t.textFaint, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Estimated Rate per Video</div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: t.green, marginBottom: 4 }}>
                    {af.costPerVideo ? <span style={{ fontSize: 10, color: t.green, marginRight: 4 }}>✦</span> : null}
                    {aiRate}
                    <span style={{ fontSize: 12, fontWeight: 500, color: t.textMuted, marginLeft: 8 }}>per video (AI estimate)</span>
                  </div>
                  <div style={{ fontSize: 11, color: t.textFaint }}>Enrich this creator to get a CPM-based calculation from actual video data.</div>
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

      {bestHighlight && bestHighlight.url ? (
        <div style={{ marginBottom: 20 }}>
          <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: 14, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.textFaint, textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>Top Performer</div>
            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>
                {bestHighlight.kind === "tt"
                  ? `${formatMetricShort(bestHighlight.views)} views · ${formatMetricShort(bestHighlight.likes)} likes`
                  : `${formatMetricShort(bestHighlight.likes)} likes · ${formatMetricShort(bestHighlight.comments)} comments`}
              </div>
              <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bestHighlight.caption || "—"}</div>
            </div>
            <a href={bestHighlight.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: t.blue, textDecoration: "none", flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
              View →
            </a>
          </div>
        </div>
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
// UGC ARMY DASHBOARD (hub)
// ═══════════════════════════════════════════════════════════

function UGCDashboard({ navigate, library, creators, t, S, onOpenBrief, onNewBrief }) {
  const active = creators.filter((c) => c.status === "Active").length;
  const scored = creators.filter((c) => c.ibScore != null).length;
  const vids = creators.reduce((s, c) => s + Math.max((c.videoLog || []).length, c.totalVideos || 0), 0);

  const cardStyle = (accent) => ({
    background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 24,
    cursor: "pointer", transition: "border-color 0.2s, box-shadow 0.2s",
  });
  const hoverIn = (e, accent) => { e.currentTarget.style.borderColor = accent + "50"; e.currentTarget.style.boxShadow = `0 4px 20px ${accent}08`; };
  const hoverOut = (e) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.boxShadow = "none"; };

  const goNewBrief = () => (onNewBrief ? onNewBrief() : navigate("create"));

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px 60px", animation: "fadeIn 0.3s ease" }}>
      <div style={{ fontSize: 28, fontWeight: 800, color: t.text, letterSpacing: "-0.02em", marginBottom: 4 }}>UGC Army</div>
      <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 28 }}>Manage creators, build briefs, and track your UGC pipeline</div>

      <div style={{ display: "flex", gap: 16, marginBottom: 32, flexWrap: "wrap" }}>
        {[
          { v: active, l: "Active Creators", c: t.green },
          { v: library.length, l: "Briefs Created", c: t.blue },
          { v: vids, l: "Videos Tracked", c: t.orange },
          { v: scored, l: "Creators Scored", c: t.purple },
        ].map((s, i) => (
          <div key={i} style={{ flex: "1 1 120px", minWidth: 120 }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.c }}>{s.v}</div>
            <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>{s.l}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 32 }}>
        <div style={cardStyle(t.green)} onClick={() => navigate("creators")}
          onMouseEnter={(e) => hoverIn(e, t.green)} onMouseLeave={hoverOut}>
          <div style={{ height: 3, width: 40, borderRadius: 2, background: t.green, marginBottom: 16 }} />
          <div style={{ fontSize: 18, fontWeight: 700, color: t.text, marginBottom: 4 }}>Creators</div>
          <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.5, marginBottom: 14 }}>View, search, and manage your creator roster. Enrich profiles with live data.</div>
          <div style={{ fontSize: 12, color: t.green, fontWeight: 600 }}>{active} active · {scored} scored</div>
        </div>

        <div style={cardStyle(t.blue)} onClick={goNewBrief}
          onMouseEnter={(e) => hoverIn(e, t.blue)} onMouseLeave={hoverOut}>
          <div style={{ height: 3, width: 40, borderRadius: 2, background: t.blue, marginBottom: 16 }} />
          <div style={{ fontSize: 18, fontWeight: 700, color: t.text, marginBottom: 4 }}>New Brief</div>
          <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.5, marginBottom: 14 }}>Create a new UGC creator brief with IB-Ai or Instant Draft templates.</div>
          <div style={{ fontSize: 12, color: t.blue, fontWeight: 600 }}>✦ IB-Ai powered</div>
        </div>

        <div style={cardStyle(t.orange)} onClick={() => navigate("library")}
          onMouseEnter={(e) => hoverIn(e, t.orange)} onMouseLeave={hoverOut}>
          <div style={{ height: 3, width: 40, borderRadius: 2, background: t.orange, marginBottom: 16 }} />
          <div style={{ fontSize: 18, fontWeight: 700, color: t.text, marginBottom: 4 }}>Brief Library</div>
          <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.5, marginBottom: 14 }}>Browse, edit, and regenerate your saved briefs.</div>
          <div style={{ fontSize: 12, color: t.orange, fontWeight: 600 }}>{library.length} brief{library.length !== 1 ? "s" : ""}</div>
        </div>

        <div style={cardStyle(t.orange)} onClick={() => navigate("pipeline")}
          onMouseEnter={(e) => hoverIn(e, t.orange)} onMouseLeave={hoverOut}>
          <div style={{ height: 3, width: 40, borderRadius: 2, background: t.orange, marginBottom: 16 }} />
          <div style={{ fontSize: 18, fontWeight: 700, color: t.text, marginBottom: 4 }}>Channel Pipeline</div>
          <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.5, marginBottom: 14 }}>Performance, spend, and operations across all channels</div>
          <div style={{ fontSize: 12, color: t.orange, fontWeight: 600 }}>8 tabs · Live data</div>
        </div>

        <div style={{ ...cardStyle(t.textFaint), cursor: "default", opacity: 0.6 }}>
          <div style={{ height: 3, width: 40, borderRadius: 2, background: t.textFaint, marginBottom: 16 }} />
          <div style={{ fontSize: 18, fontWeight: 700, color: t.text, marginBottom: 4 }}>Campaigns</div>
          <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.5, marginBottom: 14 }}>Track active campaigns, assign creators, and monitor performance.</div>
          <div style={{ fontSize: 12, color: t.textFaint, fontWeight: 600 }}>Coming soon</div>
        </div>
      </div>

      {library.length > 0 ? (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.textFaint, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Recent Briefs</div>
          {library.slice(0, 5).map((item) => (
            <div
              key={item.id}
              onClick={() => onOpenBrief?.(item)}
              style={{ ...S.listItem, marginBottom: 6, cursor: onOpenBrief ? "pointer" : "default" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.green + "50"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{item.name}</div>
                <div style={{ fontSize: 11, color: t.textFaint, marginTop: 2 }}>{item.formData?.manager || ""} · {item.date}</div>
              </div>
              <span style={{ fontSize: 11, color: t.textFaint }}>→</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MANAGER LOGIN (shared team password; hash in Supabase app_settings)
// ═══════════════════════════════════════════════════════════

function ManagerLogin({ onLogin, t }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(false);

  const handleLogin = async () => {
    if (!password.trim()) { setError("Enter the team password."); return; }
    setChecking(true);
    setError(null);

    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(password.trim());
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      const storedHash = await dbGetSetting("manager-password-hash");

      if (!storedHash) {
        await dbSetSetting("manager-password-hash", hash);
        localStorage.setItem("intake-manager-auth", hash);
        onLogin();
        return;
      }

      if (hash === storedHash) {
        localStorage.setItem("intake-manager-auth", hash);
        onLogin();
      } else {
        setError("Wrong password.");
      }
    } catch (e) {
      setError("Login failed: " + (e?.message || String(e)));
    } finally {
      setChecking(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <img src="/favicon-32.png" alt="Intake" style={{ width: 48, height: 48, marginBottom: 12 }} onError={(e) => { e.target.style.display = "none"; }} />
          <div style={{ fontSize: 22, fontWeight: 800, color: t.text }}>Manager Dashboard</div>
          <div style={{ fontSize: 13, color: t.textMuted, marginTop: 4 }}>Intake Breathing — Creator Partnerships</div>
        </div>

        <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 28 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 16 }}>Sign in</div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleLogin(); }}
            placeholder="Team password"
            autoFocus
            style={{
              width: "100%", padding: "12px 14px", borderRadius: 8,
              border: `1px solid ${t.border}`, background: t.inputBg,
              color: t.inputText, fontSize: 14, outline: "none",
              boxSizing: "border-box", marginBottom: 12,
            }}
          />
          <button
            type="button"
            onClick={() => void handleLogin()}
            disabled={checking}
            style={{
              width: "100%", padding: 12, borderRadius: 8, border: "none",
              background: t.green, color: t.isLight ? "#fff" : "#000",
              fontSize: 14, fontWeight: 700,
              cursor: checking ? "wait" : "pointer",
              opacity: checking ? 0.6 : 1,
            }}
          >
            {checking ? "Checking..." : "Sign In"}
          </button>
          {error && (
            <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, background: t.red + "10", border: `1px solid ${t.red}25`, fontSize: 13, color: t.red }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ textAlign: "center", marginTop: 16 }}>
          <a href="/creator" style={{ fontSize: 12, color: t.textFaint, textDecoration: "none" }}>
            Creator? Sign in here →
          </a>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// CHANNEL PIPELINE — live Google Sheets (via /api/sheets proxy)
// ═══════════════════════════════════════════════════════════

const PIPELINE_TAB_MAP = {
  overview: "Creator Monthly",
  spend: "Partnership Spend",
  tts: "TTS Weekly",
  instagram: "Instagram Weekly",
  ugc: "UGC Weekly",
  youtube: "YT Weekly",
  sops: null,
  kpis: "Ashleighs KPIs",
};

const PIPELINE_SOP_TABS = [
  "TikTok SOP",
  "Instagram SOP",
  "UGC Army SOP",
  "Superfiliate SOP",
  "Admin SOP",
  "YouTube SOP",
  "Influencer Buys SOP",
];

/** 0-based column index → A1 letters (A, B, … Z, AA, …). */
function pipelineColIndexToA1(colIndex) {
  let n = colIndex + 1;
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function ChannelPipeline({ navigate, creators: _creators, t, S: _S }) {
  const [tab, setTab] = useState("overview");
  const [sheetData, setSheetData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [editCellVal, setEditCellVal] = useState("");
  const [saving, setSaving] = useState(false);
  const skipBlurSaveRef = useRef(false);

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "spend", label: "Spend" },
    { id: "tts", label: "TTS" },
    { id: "instagram", label: "Instagram" },
    { id: "ugc", label: "UGC" },
    { id: "youtube", label: "YouTube" },
    { id: "sops", label: "SOPs" },
    { id: "kpis", label: "Team KPIs" },
  ];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        if (tab === "sops") {
          const results = {};
          for (const sopTab of PIPELINE_SOP_TABS) {
            try {
              const res = await fetch(`/api/sheets/${encodeURIComponent(sopTab)}`);
              if (res.ok) results[sopTab] = await res.json();
            } catch {
              /* skip failed SOP tab */
            }
          }
          if (!cancelled) setSheetData((prev) => ({ ...prev, ...results }));
          return;
        }
        const sheetTab = PIPELINE_TAB_MAP[tab];
        if (!sheetTab) {
          return;
        }
        const res = await fetch(`/api/sheets/${encodeURIComponent(sheetTab)}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        if (!cancelled) setSheetData((prev) => ({ ...prev, [sheetTab]: data }));
      } catch (e) {
        if (!cancelled) setError(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab]);

  const refresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      await fetch("/api/sheets-refresh", { method: "POST" });
      setSheetData({});
      if (tab === "sops") {
        const results = {};
        for (const sopTab of PIPELINE_SOP_TABS) {
          const res = await fetch(`/api/sheets/${encodeURIComponent(sopTab)}`);
          if (res.ok) results[sopTab] = await res.json();
        }
        setSheetData(results);
      } else {
        const sheetTab = PIPELINE_TAB_MAP[tab];
        if (sheetTab) {
          const res = await fetch(`/api/sheets/${encodeURIComponent(sheetTab)}`);
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `HTTP ${res.status}`);
          }
          const data = await res.json();
          setSheetData((prev) => ({ ...prev, [sheetTab]: data }));
        }
      }
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setRefreshing(false);
    }
  };

  const saveCell = async (tabName, rowIdxInRows, colIndex, value) => {
    const colLetter = pipelineColIndexToA1(colIndex);
    const sheetRow = rowIdxInRows + 1;
    const cell = `${colLetter}${sheetRow}`;
    setSaving(true);
    try {
      const res = await fetch("/api/sheets/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tab: tabName, cell, value }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        window.alert("Save failed: " + (err.error || `HTTP ${res.status}`));
      } else {
        setSheetData((prev) => {
          const updated = { ...prev };
          if (updated[tabName]?.rows) {
            const newRows = updated[tabName].rows.map((r) => [...(r || [])]);
            if (newRows[rowIdxInRows]) {
              newRows[rowIdxInRows] = [...newRows[rowIdxInRows]];
              newRows[rowIdxInRows][colIndex] = value;
            }
            updated[tabName] = { ...updated[tabName], rows: newRows, fetchedAt: new Date().toISOString() };
          }
          return updated;
        });
      }
    } catch (e) {
      window.alert("Save failed: " + (e.message || String(e)));
    } finally {
      setSaving(false);
      setEditingCell(null);
    }
  };

  const renderSheetTable = (tabName, opts = {}) => {
    const data = sheetData[tabName];
    if (!data?.rows?.length) {
      return <div style={{ padding: 40, textAlign: "center", color: t.textFaint }}>No data loaded</div>;
    }

    const rows = data.rows;
    const headerRow = rows[opts.headerRowIndex || 0] || [];
    const dataRows = rows.slice((opts.headerRowIndex || 0) + 1);
    const maxCols = Math.max(
      1,
      ...rows.map((r) => (Array.isArray(r) ? r.length : 0)),
      headerRow.length,
    );

    return (
      <div style={{ overflowX: "auto", borderRadius: 10, border: `1px solid ${t.border}` }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, minWidth: Math.min(maxCols * 80, 3000) }}>
          <thead>
            <tr>
              {Array.from({ length: maxCols }, (_, i) => headerRow[i]).map((cell, i) => (
                <th
                  key={i}
                  style={{
                    padding: "6px 8px",
                    textAlign: i === 0 ? "left" : "right",
                    fontSize: 9,
                    fontWeight: 700,
                    color: t.text,
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                    position: i === 0 ? "sticky" : "static",
                    left: i === 0 ? 0 : "auto",
                    background: t.cardAlt,
                    zIndex: i === 0 ? 2 : 0,
                    minWidth: i === 0 ? 140 : 70,
                    borderBottom: `2px solid ${t.border}`,
                    borderRight: `1px solid ${t.border}30`,
                  }}
                >
                  {String(cell ?? "").replace(/\n/g, " ")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataRows.map((row, ri) => {
              const firstCell = String(row?.[0] ?? "").trim();
              const isTotal = /total/i.test(firstCell) || /^Q\d/i.test(firstCell);
              const isMilestone =
                /join/i.test(firstCell) ||
                /takes over/i.test(firstCell) ||
                /goals/i.test(firstCell) ||
                /video/i.test(firstCell);
              const isMonthHeader =
                /^\d{4}-\d{2}/.test(firstCell) ||
                /^(January|February|March|April|May|June|July|August|September|October|November|December)/i.test(firstCell);
              const isSectionHeader = (row || []).filter((c) => c && String(c).trim()).length <= 2 && firstCell.length > 2;
              const isEmpty = !row || row.every((c) => !c || String(c).trim() === "");

              if (isEmpty) return null;

              let rowStyle = {};
              const isEvenRow = ri % 2 === 0;
              if (isTotal || isMonthHeader) {
                rowStyle = { background: t.cardAlt, fontWeight: 700 };
              } else if (isMilestone) {
                rowStyle = { background: (t.purple || "#a78bfa") + "10", fontStyle: "italic" };
              } else if (isSectionHeader) {
                rowStyle = { background: (t.green || "#00e0b4") + "10" };
              } else {
                rowStyle = { background: isEvenRow ? "transparent" : t.cardAlt + "40" };
              }

              return (
                <tr key={ri} style={rowStyle}>
                  {Array.from({ length: maxCols }, (_, ci) => {
                    const val = row?.[ci] ?? "";
                    const isFirst = ci === 0;
                    let color = t.text;
                    const s = String(val).trim();
                    if (s === "—" || s === "" || s === "#REF!" || s === "#DIV/0!") color = t.textFaint;
                    else if (s === "0" || s === "$0" || s === "$0.00" || s === "0.00" || s === "$-") color = t.textFaint;
                    else if (s.startsWith("-$") || (s.startsWith("-") && /\d/.test(s) && !s.includes("%"))) color = "#ef4444";
                    else if (s.endsWith("%")) {
                      const pctVal = parseFloat(s);
                      color = pctVal < 0 ? "#ef4444" : t.textMuted;
                    } else if (s.startsWith("$")) color = t.text;

                    if (ci === 0 && /^(Active|Pause|Under Review|Complete)$/i.test(s)) {
                      const sc = { active: t.green, pause: t.orange, "under review": t.blue, complete: t.green };
                      color = sc[s.toLowerCase()] || t.textFaint;
                    }

                    const display = s === "#REF!" || s === "#DIV/0!" ? "—" : val;
                    const rowIdxInRows = (opts.headerRowIndex || 0) + 1 + ri;
                    const isEditing =
                      editingCell?.tabName === tabName &&
                      editingCell?.rowIdxInRows === rowIdxInRows &&
                      editingCell?.col === ci;
                    const canEdit = ci > 0 && !isTotal && !isMilestone && !isMonthHeader && !isSectionHeader;

                    return (
                      <td
                        key={ci}
                        onClick={() => {
                          if (canEdit) {
                            setEditingCell({ tabName, rowIdxInRows, col: ci });
                            setEditCellVal(val === null || val === undefined ? "" : String(val));
                          }
                        }}
                        style={{
                          padding: "5px 8px",
                          textAlign: isFirst ? "left" : "right",
                          color: isTotal ? t.text : color,
                          fontWeight: isTotal || isFirst ? (isTotal ? 700 : 600) : 400,
                          fontSize: isMilestone ? 10 : 11,
                          whiteSpace: "nowrap",
                          maxWidth: ci > 0 ? 120 : 200,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          position: isFirst ? "sticky" : "static",
                          left: isFirst ? 0 : "auto",
                          background: isFirst
                            ? isTotal || isMonthHeader
                              ? t.cardAlt
                              : t.card
                            : isTotal || isMonthHeader
                              ? t.cardAlt
                              : "transparent",
                          zIndex: isFirst ? 1 : 0,
                          fontVariantNumeric: "tabular-nums",
                          cursor: canEdit ? "pointer" : "default",
                          outline: isEditing ? `2px solid ${t.green}` : "none",
                          borderBottom: `1px solid ${t.border}40`,
                          borderRight: `1px solid ${t.border}20`,
                          borderTop: isTotal || isMonthHeader ? `2px solid ${t.border}` : "none",
                        }}
                      >
                        {isEditing ? (
                          <input
                            type="text"
                            autoFocus
                            value={editCellVal}
                            onChange={(e) => setEditCellVal(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                skipBlurSaveRef.current = true;
                                void saveCell(tabName, rowIdxInRows, ci, editCellVal);
                              }
                              if (e.key === "Escape") {
                                e.preventDefault();
                                skipBlurSaveRef.current = true;
                                setEditingCell(null);
                              }
                            }}
                            onBlur={() => {
                              if (skipBlurSaveRef.current) {
                                skipBlurSaveRef.current = false;
                                return;
                              }
                              void saveCell(tabName, rowIdxInRows, ci, editCellVal);
                            }}
                            style={{
                              width: "100%",
                              minWidth: 0,
                              padding: "2px 4px",
                              border: `1px solid ${t.green}`,
                              borderRadius: 3,
                              background: t.inputBg,
                              color: t.inputText,
                              fontSize: 11,
                              textAlign: isFirst ? "left" : "right",
                              outline: "none",
                              boxSizing: "border-box",
                            }}
                          />
                        ) : s === "#REF!" || s === "#DIV/0!" ? (
                          "—"
                        ) : (
                          display
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const activeSheetName = PIPELINE_TAB_MAP[tab];
  const lastFetchedRaw =
    tab === "sops"
      ? Object.values(sheetData)
          .map((d) => d?.fetchedAt)
          .filter(Boolean)
          .sort()
          .pop()
      : activeSheetName
        ? sheetData[activeSheetName]?.fetchedAt
        : null;

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "32px 24px 60px", animation: "fadeIn 0.3s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, color: t.text, letterSpacing: "-0.02em", marginBottom: 4 }}>Channel Pipeline</div>
          <div style={{ fontSize: 13, color: t.textMuted }}>Live from Google Sheets — click a cell to edit (saves on Enter); cache ~2 min</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {saving ? (
            <span style={{ fontSize: 12, color: t.orange, fontWeight: 600 }}>Saving...</span>
          ) : null}
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: `1px solid ${t.border}`,
              background: t.cardAlt,
              color: t.text,
              fontSize: 12,
              fontWeight: 600,
              cursor: refreshing ? "not-allowed" : "pointer",
              opacity: refreshing ? 0.5 : 1,
            }}
          >
            {refreshing ? "Refreshing..." : "↻ Refresh"}
          </button>
          <a
            href="https://docs.google.com/spreadsheets/d/1aM51vSoGUhuhDJu8VyukeIp59XS2G_yv3alJxTJ2Aak/edit"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: `1px solid ${t.border}`,
              background: "transparent",
              color: t.textMuted,
              fontSize: 12,
              fontWeight: 600,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            Open in Sheets ↗
          </a>
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 24, overflowX: "auto", borderBottom: `1px solid ${t.border}` }}>
        {tabs.map((tb) => (
          <button
            key={tb.id}
            type="button"
            onClick={() => setTab(tb.id)}
            style={{
              padding: "10px 16px",
              fontSize: 13,
              fontWeight: tab === tb.id ? 700 : 500,
              color: tab === tb.id ? t.green : t.textMuted,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              borderBottom: tab === tb.id ? `2px solid ${t.green}` : "2px solid transparent",
              whiteSpace: "nowrap",
            }}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {error ? (
        <div style={{ padding: "12px 16px", background: t.red + "10", border: `1px solid ${t.red}25`, borderRadius: 8, marginBottom: 16, color: t.red, fontSize: 13 }}>{error}</div>
      ) : null}

      {loading ? <div style={{ padding: 40, textAlign: "center", color: t.textMuted }}>Loading sheet data...</div> : null}

      {!loading && tab !== "sops" && activeSheetName ? (
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 12 }}>{activeSheetName}</div>
          {renderSheetTable(activeSheetName, tab === "instagram" ? { headerRowIndex: 1 } : {})}
        </div>
      ) : null}

      {!loading && tab === "sops" ? (
        <div>
          {PIPELINE_SOP_TABS.map((sopTab) => {
            const data = sheetData[sopTab];
            if (!data?.rows?.length) {
              return (
                <div key={sopTab} style={{ marginBottom: 24, color: t.textFaint, fontSize: 13 }}>
                  {sopTab}: no data
                </div>
              );
            }
            return (
              <div key={sopTab} style={{ marginBottom: 32 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 12 }}>{sopTab}</div>
                {renderSheetTable(sopTab)}
              </div>
            );
          })}
        </div>
      ) : null}

      <div style={{ marginTop: 16, fontSize: 11, color: t.textFaint, opacity: 0.85 }}>
        Data from Google Sheets · Last fetched: {lastFetchedRaw ? new Date(lastFetchedRaw).toLocaleString() : "—"}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════
// CHANGE REQUEST WIDGET (Supabase table: change_requests — see supabase/schema.sql)
// ═══════════════════════════════════════════════════════════

function ChangeRequestWidget({ currentPage, t }) {
  const [open, setOpen] = useState(false);
  const [requests, setRequests] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", priority: "normal" });
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [pageOpenBadge, setPageOpenBadge] = useState(0);

  const refreshPageOpenBadge = useCallback(async () => {
    const { data } = await supabase.from("change_requests").select("id").eq("page", currentPage).eq("status", "open");
    setPageOpenBadge((data || []).length);
  }, [currentPage]);

  useEffect(() => {
    refreshPageOpenBadge();
  }, [refreshPageOpenBadge]);

  // Load requests for current page (and all if showAll)
  useEffect(() => {
    if (!open) return;
    (async () => {
      const query = showAll
        ? supabase.from("change_requests").select("*").order("created_at", { ascending: false })
        : supabase.from("change_requests").select("*").eq("page", currentPage).eq("status", "open").order("created_at", { ascending: false });
      const { data } = await query;
      setRequests(data || []);
    })();
  }, [open, showAll, currentPage]);

  const submit = async () => {
    if (!form.name.trim() || !form.description.trim()) {
      alert("Please enter your name and a description.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("change_requests").insert({
      page: currentPage,
      requested_by: form.name.trim(),
      description: form.description.trim(),
      priority: form.priority,
    });
    if (error) {
      alert("Failed to submit: " + error.message);
    } else {
      setForm({ name: form.name, description: "", priority: "normal" });
      setToast("Request submitted!");
      setTimeout(() => setToast(null), 3000);
      const { data } = await supabase.from("change_requests").select("*").eq("page", currentPage).eq("status", "open").order("created_at", { ascending: false });
      setRequests(data || []);
      refreshPageOpenBadge();
    }
    setSubmitting(false);
  };

  const markComplete = async (id) => {
    await supabase.from("change_requests").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", id);
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: "completed", completed_at: new Date().toISOString() } : r)));
    refreshPageOpenBadge();
  };

  const deleteRequest = async (id) => {
    if (!window.confirm("Delete this request permanently?")) return;
    await supabase.from("change_requests").delete().eq("id", id);
    setRequests((prev) => prev.filter((r) => r.id !== id));
    refreshPageOpenBadge();
  };

  const openCount = open ? requests.filter((r) => r.status === "open").length : pageOpenBadge;
  const priorityColors = { urgent: "#ef4444", high: "#f97316", normal: t.textMuted, low: t.textFaint };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          padding: open ? "10px 16px" : "10px 18px",
          borderRadius: 10,
          background: open ? t.text : t.green,
          color: open ? t.bg : "#000",
          border: "none",
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          gap: 6,
          boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
          zIndex: 1000,
          transition: "all 0.2s",
        }}
      >
        {open ? "✕ Close" : "✎ Request Changes"}
        {!open && openCount > 0 ? (
          <span
            style={{
              width: 18,
              height: 18,
              borderRadius: 9,
              background: "#ef4444",
              color: "#fff",
              fontSize: 10,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginLeft: 2,
            }}
          >
            {openCount}
          </span>
        ) : null}
      </button>

      {open && (
        <div
          style={{
            position: "fixed",
            bottom: 84,
            right: 24,
            width: 380,
            maxHeight: "70vh",
            background: t.card,
            border: `1px solid ${t.border}`,
            borderRadius: 14,
            boxShadow: "0 8px 40px rgba(0,0,0,0.25)",
            zIndex: 999,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "14px 16px", borderBottom: `1px solid ${t.border}` }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Change Requests</div>
            <div style={{ fontSize: 10, color: t.textFaint }}>{currentPage}</div>
          </div>

          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${t.border}` }}>
            <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
              <button
                type="button"
                onClick={() => setShowAll(false)}
                style={{
                  flex: 1,
                  padding: "6px 10px",
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  border: `1px solid ${!showAll ? t.green : t.border}`,
                  background: !showAll ? t.green + "15" : "transparent",
                  color: !showAll ? t.green : t.textFaint,
                  cursor: "pointer",
                }}
              >
                This Page ({currentPage})
              </button>
              <button
                type="button"
                onClick={() => setShowAll(true)}
                style={{
                  flex: 1,
                  padding: "6px 10px",
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  border: `1px solid ${showAll ? t.green : t.border}`,
                  background: showAll ? t.green + "15" : "transparent",
                  color: showAll ? t.green : t.textFaint,
                  cursor: "pointer",
                }}
              >
                All Pages
              </button>
            </div>
          </div>

          {toast ? (
            <div style={{ padding: "8px 16px", background: t.green + "15", color: t.green, fontSize: 12, fontWeight: 600, textAlign: "center" }}>{toast}</div>
          ) : null}

          <div style={{ padding: 14, borderBottom: `1px solid ${t.border}` }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input
                placeholder="Your name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                style={{ flex: 1, padding: "7px 10px", borderRadius: 6, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 12 }}
              />
              <select
                value={form.priority}
                onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}
                style={{ padding: "7px 8px", borderRadius: 6, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 11 }}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <textarea
              placeholder="Describe the change or update needed..."
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              rows={3}
              style={{
                width: "100%",
                padding: "7px 10px",
                borderRadius: 6,
                border: `1px solid ${t.border}`,
                background: t.inputBg,
                color: t.inputText,
                fontSize: 12,
                resize: "vertical",
                boxSizing: "border-box",
                fontFamily: "inherit",
              }}
            />
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              style={{
                marginTop: 8,
                width: "100%",
                padding: "8px",
                borderRadius: 6,
                border: "none",
                background: t.green,
                color: "#000",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                opacity: submitting ? 0.5 : 1,
              }}
            >
              {submitting ? "Submitting..." : "Submit Request"}
            </button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
            {requests.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: t.textFaint, fontSize: 12 }}>No requests {showAll ? "" : "for this page"}</div>
            ) : (
              requests.map((r) => (
                <div
                  key={r.id}
                  style={{
                    padding: "10px 14px",
                    borderBottom: `1px solid ${t.border}10`,
                    opacity: r.status === "completed" ? 0.5 : 1,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: t.text }}>{r.requested_by}</span>
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 600,
                            padding: "1px 6px",
                            borderRadius: 4,
                            background: (priorityColors[r.priority] || t.textFaint) + "15",
                            color: priorityColors[r.priority] || t.textFaint,
                          }}
                        >
                          {r.priority}
                        </span>
                        {r.status === "completed" ? (
                          <span style={{ fontSize: 9, fontWeight: 600, padding: "1px 6px", borderRadius: 4, background: t.green + "15", color: t.green }}>✓ Done</span>
                        ) : null}
                      </div>
                      <div style={{ fontSize: 12, color: t.text, lineHeight: 1.4, marginBottom: 4 }}>{r.description}</div>
                      <div style={{ fontSize: 9, color: t.textFaint }}>
                        {showAll ? `${r.page} · ` : ""}
                        {new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        {r.completed_at
                          ? ` · Completed ${new Date(r.completed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                          : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      {r.status === "open" ? (
                        <button
                          type="button"
                          onClick={() => markComplete(r.id)}
                          title="Mark complete"
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 4,
                            border: `1px solid ${t.border}`,
                            background: "transparent",
                            color: t.green,
                            cursor: "pointer",
                            fontSize: 12,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          ✓
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => deleteRequest(r.id)}
                        title="Delete"
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 4,
                          border: `1px solid ${t.border}`,
                          background: "transparent",
                          color: t.textFaint,
                          cursor: "pointer",
                          fontSize: 12,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}

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
  const [filters, setFilters] = useState({ status: "All", niche: "All", quality: "All" });
  const [colWidths, setColWidths] = useState(() => {
    const w = {};
    CREATOR_COLUMNS.forEach((col) => {
      if (col.width != null) w[col.key] = col.width;
    });
    return w;
  });
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
      ];
      const aiUpdates = {};
      for (const [dbKey, field] of aiSettingPairs) {
        const val = await dbGetSetting(dbKey);
        if (val == null) continue;
        try {
          if (field === "brandContext") {
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
          ...enrichPatchWithCpm(cr, mergePatch, mergedCreator),
          ...(!cr.name?.trim() && payload.nickname ? { name: payload.nickname } : {}),
        };
        if (payload.discoveredYoutubeHandle && !cr.youtubeHandle) {
          bulkFull.youtubeHandle = payload.discoveredYoutubeHandle;
        }
        if (payload.youtubeData?.title && !String(bulkFull.youtubeHandle || cr.youtubeHandle || "").trim()) {
          bulkFull.youtubeHandle = ch;
        }
        updateCreator(cr.id, bulkFull);
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
      const newCreator = { ...merged, ...enrichPatchWithCpm(stub, patch, merged) };
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
        ...enrichPatchWithCpm(existing, merged, mergedCreator),
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
    };
    const key = keyMap[field];
    if (!key) return;
    const storeVal = field === "brandContext" ? String(value) : JSON.stringify(value);
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
          const cardStyle = (accent) => ({
            background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 24,
            cursor: "pointer", transition: "border-color 0.2s, box-shadow 0.2s",
          });
          const hoverIn = (e, accent) => { e.currentTarget.style.borderColor = accent + "50"; e.currentTarget.style.boxShadow = `0 4px 20px ${accent}08`; };
          const hoverOut = (e) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.boxShadow = "none"; };

          return (
            <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px 60px", animation: "fadeIn 0.3s ease" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: t.text, letterSpacing: "-0.02em", marginBottom: 4 }}>Creator Partnerships</div>
              <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 32 }}>Intake Breathing Technology</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 32 }}>
                <div style={cardStyle(t.green)} onClick={() => navigate("ugcDashboard")}
                  onMouseEnter={(e) => hoverIn(e, t.green)} onMouseLeave={hoverOut}>
                  <div style={{ height: 3, width: 40, borderRadius: 2, background: t.green, marginBottom: 16 }} />
                  <div style={{ fontSize: 18, fontWeight: 700, color: t.text, marginBottom: 4 }}>UGC Army</div>
                  <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.5, marginBottom: 14 }}>Create briefs, manage creators, and track content</div>
                  <div style={{ fontSize: 12, color: t.green, fontWeight: 600 }}>{library.length} briefs · {activeCreatorCount} creators</div>
                </div>

                <div style={cardStyle(t.orange)} onClick={() => navigate("pipeline")}
                  onMouseEnter={(e) => hoverIn(e, t.orange)} onMouseLeave={hoverOut}>
                  <div style={{ height: 3, width: 40, borderRadius: 2, background: t.orange, marginBottom: 16 }} />
                  <div style={{ fontSize: 18, fontWeight: 700, color: t.text, marginBottom: 4 }}>Channel Pipeline</div>
                  <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.5, marginBottom: 14 }}>Performance, spend, and operations across all channels</div>
                  <div style={{ fontSize: 12, color: t.orange, fontWeight: 600 }}>8 tabs · Live data</div>
                </div>

                <div style={{ ...cardStyle(t.purple), cursor: "default", opacity: 0.6 }}>
                  <div style={{ height: 3, width: 40, borderRadius: 2, background: t.purple, marginBottom: 16 }} />
                  <div style={{ fontSize: 18, fontWeight: 700, color: t.text, marginBottom: 4 }}>Influencer Buys</div>
                  <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.5, marginBottom: 14 }}>Manage campaigns, rates, and spend</div>
                  <div style={{ fontSize: 12, color: t.textFaint, fontWeight: 600 }}>Coming soon</div>
                </div>

                <div style={cardStyle(t.blue)} onClick={() => navigate("tools")}
                  onMouseEnter={(e) => hoverIn(e, t.blue)} onMouseLeave={hoverOut}>
                  <div style={{ height: 3, width: 40, borderRadius: 2, background: t.blue, marginBottom: 16 }} />
                  <div style={{ fontSize: 18, fontWeight: 700, color: t.text, marginBottom: 4 }}>Tools</div>
                  <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.5, marginBottom: 14 }}>Video reformatter and team utilities</div>
                  <div style={{ fontSize: 12, color: t.blue, fontWeight: 600 }}>1 tool available</div>
                </div>
              </div>

              {/* IB-Ai Source of Truth — same state as brief page; edits sync everywhere */}
              <IBAiSourceOfTruth t={t} aiKnowledge={aiKnowledge} onSave={saveAiKnowledge} homepage />

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

        {/* SETTINGS */}
        {!aiLoading && isCreatorViewAllowed && view === "settings" && (
          <div style={{ maxWidth: 600, margin: "0 auto", padding: "40px 24px 80px", animation: "fadeIn 0.3s ease" }}>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 6, color: t.text }}>Settings</div>
            <div style={{ fontSize: 12, color: t.textFaint, fontWeight: 500, marginBottom: 8 }}>v{APP_VERSION}</div>
            <div style={{ fontSize: 14, color: t.textMuted, marginBottom: 32 }}>Configure your API key to enable IB-Ai.</div>

            <div style={{ background: t.card, borderRadius: 12, border: `1px solid ${t.border}`, padding: 24, marginBottom: 20, boxShadow: t.shadow }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 4 }}>Database Connection</div>
              <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 12 }}>Test that data can be read and written to Supabase</div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const { data: readTest, error: readErr } = await supabase.from("creators").select("id").limit(1);
                    if (readErr) throw new Error(`Read failed: ${readErr.message}`);

                    if (readTest && readTest.length > 0) {
                      const testId = readTest[0].id;
                      const testVal = new Date().toISOString();
                      const { error: writeErr } = await supabase
                        .from("creators")
                        .update({ last_enriched: testVal })
                        .eq("id", testId);
                      if (writeErr) throw new Error(`Write failed: ${writeErr.message}`);

                      const { data: verifyData, error: verifyErr } = await supabase
                        .from("creators")
                        .select("last_enriched")
                        .eq("id", testId)
                        .single();
                      if (verifyErr) throw new Error(`Verify failed: ${verifyErr.message}`);
                      if (verifyData.last_enriched !== testVal) {
                        throw new Error("Write verification failed — value didn't persist");
                      }
                    }

                    alert("✓ Database connection working. Read, write, and verify all passed.");
                  } catch (e) {
                    alert(`✗ Database test FAILED: ${e.message}`);
                  }
                }}
                style={{
                  padding: "11px 20px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  border: "none",
                  background: t.blue,
                  color: "#fff",
                }}
              >
                Test Connection
              </button>
              <div style={{ fontSize: 12, color: t.textFaint, marginTop: 8 }}>
                {creators.length} creators · {library.length} briefs in database
              </div>
              <div style={{ fontSize: 11, color: t.textFaint, marginTop: 10, lineHeight: 1.5 }}>
                API keys are stored in the <code style={{ background: t.cardAlt, padding: "2px 6px", borderRadius: 4, fontSize: 10 }}>app_settings</code> table. If saves fail, run the SQL at the end of <code style={{ background: t.cardAlt, padding: "2px 6px", borderRadius: 4, fontSize: 10 }}>supabase/schema.sql</code> in the Supabase SQL Editor.
              </div>
            </div>

            <div style={{ background: t.card, borderRadius: 12, border: `1px solid ${t.border}`, padding: 24, marginBottom: 20, boxShadow: t.shadow }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 4 }}>Team Password</div>
              <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 16 }}>Change the shared password for manager access (SHA-256 hash stored in Supabase).</div>
              <div style={{ display: "flex", gap: 10 }}>
                <input
                  id="new-password-input"
                  type="password"
                  placeholder="New team password"
                  style={{ flex: 1, padding: "11px 14px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 14, outline: "none", boxSizing: "border-box" }}
                />
                <button
                  type="button"
                  onClick={async () => {
                    const el = document.getElementById("new-password-input");
                    const val = el ? el.value.trim() : "";
                    if (!val || val.length < 4) { alert("Password must be at least 4 characters."); return; }
                    const encoder = new TextEncoder();
                    const data = encoder.encode(val);
                    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
                    const hashArray = Array.from(new Uint8Array(hashBuffer));
                    const hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
                    await dbSetSetting("manager-password-hash", hash);
                    localStorage.setItem("intake-manager-auth", hash);
                    if (el) el.value = "";
                    alert("Password updated. All team members will need to re-login with the new password.");
                  }}
                  style={{ padding: "11px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none", background: t.green, color: t.isLight ? "#fff" : "#000", whiteSpace: "nowrap" }}
                >
                  Update
                </button>
              </div>
            </div>

            {/* API Key Section */}
            <div style={{ background: t.card, borderRadius: 12, border: `1px solid ${t.border}`, padding: 24, marginBottom: 20, boxShadow: t.shadow }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 4 }}>Anthropic API Key</div>
              <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 16, lineHeight: 1.5 }}>
                Get your key from <span style={{ color: t.blue, fontWeight: 600 }}>console.anthropic.com → API Keys</span>. It starts with <code style={{ background: t.cardAlt, padding: "2px 6px", borderRadius: 4, fontSize: 12 }}>sk-ant-</code>
              </div>
              <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                <input
                  id="api-key-input"
                  type="password"
                  defaultValue={apiKey}
                  placeholder="sk-ant-api03-..."
                  style={{
                    flex: 1, padding: "11px 14px", borderRadius: 8, border: `1px solid ${apiKey ? t.green+"50" : t.border}`,
                    background: t.inputBg, color: t.inputText, fontSize: 14, fontFamily: "monospace", outline: "none", boxSizing: "border-box",
                  }}
                  onFocus={e => { e.target.style.borderColor = t.green; }}
                  onBlur={e => { e.target.style.borderColor = apiKey ? t.green+"50" : t.border; }}
                />
                <button
                  onClick={() => {
                    const el = document.getElementById("api-key-input");
                    const val = el ? el.value.trim() : "";
                    if (!val) { setApiStatus("fail"); setApiMsg("Paste your key first."); return; }
                    saveApiKey(val);
                    testApi(val);
                  }}
                  disabled={apiStatus === "testing"}
                  style={{
                    padding: "11px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                    cursor: apiStatus === "testing" ? "not-allowed" : "pointer",
                    border: "none", background: t.green, color: t.isLight ? "#fff" : "#000",
                    opacity: apiStatus === "testing" ? 0.6 : 1, whiteSpace: "nowrap",
                  }}
                >
                  {apiStatus === "testing" ? "Testing…" : "Save & Test"}
                </button>
              </div>

              {/* Status */}
              {apiMsg && (
                <div style={{
                  fontSize: 12, padding: "10px 12px", borderRadius: 8, lineHeight: 1.5, fontFamily: "monospace", wordBreak: "break-word",
                  background: apiStatus === "ok" ? t.green+"10" : t.red+"08",
                  color: apiStatus === "ok" ? t.green : t.red,
                  border: `1px solid ${apiStatus === "ok" ? t.green+"25" : t.red+"25"}`,
                }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{apiStatus === "ok" ? <Icon name="checkSm" size={12} color={t.green} /> : <Icon name="x" size={12} color={t.red} />}{apiMsg}</span>
                </div>
              )}
              {!apiKey && !apiMsg && (
                <div style={{ fontSize: 12, color: t.textFaint, lineHeight: 1.6 }}>
                  Saved to Supabase (shared across browsers) and cached locally. Sent to Anthropic only to authenticate your API calls.
                </div>
              )}
              {apiKey && !apiMsg && (
                <div style={{ fontSize: 12, color: t.green }}>✓ Key saved (synced via Supabase)</div>
              )}
            </div>

            {/* ScrapeCreators API Key */}
            <div style={{ background: t.card, borderRadius: 12, border: `1px solid ${t.border}`, padding: 24, marginBottom: 20, boxShadow: t.shadow }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 4 }}>ScrapeCreators API Key</div>
              <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 16, lineHeight: 1.5 }}>
                Used for creator enrichment and fetching TikTok and Instagram videos (e.g. Video Reformatter). Get your key from{" "}
                <span style={{ color: t.blue, fontWeight: 600 }}>app.scrapecreators.com</span>.
              </div>
              <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                <input
                  id="scrape-key-input"
                  type="password"
                  defaultValue={scrapeKey}
                  placeholder="Your ScrapeCreators API key…"
                  style={{
                    flex: 1, padding: "11px 14px", borderRadius: 8, border: `1px solid ${scrapeKey ? t.green+"50" : t.border}`,
                    background: t.inputBg, color: t.inputText, fontSize: 14, fontFamily: "monospace", outline: "none", boxSizing: "border-box",
                  }}
                  onFocus={e => { e.target.style.borderColor = t.green; }}
                  onBlur={e => { e.target.style.borderColor = scrapeKey ? t.green+"50" : t.border; }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById("scrape-key-input");
                    const val = el ? el.value.trim() : "";
                    if (!val) { setScrapeStatus("fail"); setScrapeMsg("Paste your key first."); return; }
                    saveScrapeKey(val);
                    testScrapeApi(val);
                  }}
                  disabled={scrapeStatus === "testing"}
                  style={{
                    padding: "11px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                    cursor: scrapeStatus === "testing" ? "not-allowed" : "pointer",
                    border: "none", background: t.green, color: t.isLight ? "#fff" : "#000",
                    opacity: scrapeStatus === "testing" ? 0.6 : 1, whiteSpace: "nowrap",
                  }}
                >
                  {scrapeStatus === "testing" ? "Testing…" : "Save & Test"}
                </button>
              </div>
              {scrapeMsg && (
                <div style={{
                  fontSize: 12, padding: "10px 12px", borderRadius: 8, lineHeight: 1.5, fontFamily: "monospace", wordBreak: "break-word",
                  background: scrapeStatus === "ok" ? t.green+"10" : t.red+"08",
                  color: scrapeStatus === "ok" ? t.green : t.red,
                  border: `1px solid ${scrapeStatus === "ok" ? t.green+"25" : t.red+"25"}`,
                }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{scrapeStatus === "ok" ? <Icon name="checkSm" size={12} color={t.green} /> : <Icon name="x" size={12} color={t.red} />}{scrapeMsg}</span>
                </div>
              )}
              {!scrapeKey && !scrapeMsg && (
                <div style={{ fontSize: 12, color: t.textFaint, lineHeight: 1.6 }}>
                  Saved to Supabase (shared across browsers) and cached locally. Sent only to ScrapeCreators when you enrich or fetch videos or test the connection.
                </div>
              )}
              {scrapeKey && !scrapeMsg && (
                <div style={{ fontSize: 12, color: t.green }}>✓ Key saved (synced via Supabase)</div>
              )}
            </div>

            {/* How it works */}
            <div style={{ background: t.card, borderRadius: 12, border: `1px solid ${t.border}`, padding: 24, boxShadow: t.shadow }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 12 }}>How it works</div>
              <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.7 }}>
                <strong style={{ color: t.green }}>IB-Ai</strong> sends your brief form data to Claude Sonnet, which writes original hooks, story beats, persona descriptions, and creative direction tailored to your specific campaign. Requires an API key.
              </div>
              <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.7, marginTop: 10 }}>
                <strong style={{ color: t.textSecondary, display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="zap" size={14} color={t.textSecondary} />Instant Draft</strong> uses built-in templates with Intake's playbook data. No API key needed. Fast but less creative.
              </div>
              <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.7, marginTop: 10 }}>
                Each IB-Ai call uses roughly 3,000 output tokens (~$0.01-0.02 per brief on Claude Sonnet).
              </div>
            </div>

            {/* Preview Mode — developer testing */}
            <div style={{ background: t.card, borderRadius: 12, border: `1px solid ${t.border}`, padding: 24, marginTop: 20, boxShadow: t.shadow }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 6 }}>Preview Mode</div>
              <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 16, lineHeight: 1.6 }}>Preview what creators see — they can only view and download briefs from the UGC Army library. All other sections are hidden.</div>
              <button
                type="button"
                onClick={() => {
                  if (currentRole === ROLES.MANAGER) {
                    setCurrentRole(ROLES.CREATOR);
                    navigate("library");
                  } else {
                    setCurrentRole(ROLES.MANAGER);
                    navigate("home");
                  }
                }}
                style={{
                  padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                  border: `1px solid ${currentRole === ROLES.CREATOR ? t.green + "50" : t.border}`,
                  background: currentRole === ROLES.CREATOR ? t.green + "15" : t.cardAlt,
                  color: currentRole === ROLES.CREATOR ? t.green : t.text,
                  cursor: "pointer",
                }}
              >
                {currentRole === ROLES.CREATOR ? "← Back to Manager view" : "View as Creator"}
              </button>
            </div>

            {/* Version History */}
            <div style={{ background: t.card, borderRadius: 12, border: `1px solid ${t.border}`, padding: 24, marginTop: 20, boxShadow: t.shadow }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 16 }}>Version History</div>
              {CHANGELOG.map((entry, idx) => (
                <div key={entry.version} style={{ marginBottom: idx < CHANGELOG.length - 1 ? 24 : 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: t.green }}>{entry.version}</span>
                    <span style={{ fontSize: 13, color: t.textFaint }}>{entry.date}</span>
                  </div>
                  {entry.changes.map((c, i) => (
                    <div key={i} style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.6, paddingLeft: 12, marginBottom: i < entry.changes.length - 1 ? 4 : 0 }}>· {c}</div>
                  ))}
                </div>
              ))}
            </div>
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
                        crossOrigin="anonymous"
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
            <CreatorDetailErrorBoundary>
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
                aiBrandContext={aiKnowledge.brandContext}
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
          return <ChangeRequestWidget currentPage={currentPage} t={t} />;
        })()}
      </div>
    </ThemeContext.Provider>
  );
}
