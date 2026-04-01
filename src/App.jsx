import { useState, useRef, useCallback, useEffect, useMemo, memo, createContext, useContext } from "react";
import SEED_CREATORS from "./seedCreators.json";

// FUTURE: Arrow keys to navigate between cells, Tab to move right, Enter to edit

const CREATOR_COLUMNS = [
  { key: "status", label: "Status", width: 80, filterable: true, sortable: true },
  { key: "handle", label: "Handle", width: 140, sortable: true },
  { key: "niche", label: "Niche", width: 150, filterable: true, sortable: true, editable: true },
  { key: "email", label: "Email", width: 200, editable: true, isLink: "mailto" },
  { key: "tt", label: "TT", width: 36, isLink: "external" },
  { key: "ig", label: "IG", width: 36, isLink: "external" },
  { key: "videos", label: "Videos", width: 60, sortable: true, align: "right" },
  { key: "quality", label: "Quality", width: 70, filterable: true, sortable: true },
  { key: "cost", label: "Cost", width: 80, editable: true },
  { key: "notes", label: "Notes", width: null, editable: true },
];

const CREATOR_GRID_TEMPLATE = CREATOR_COLUMNS.map((c) => (c.width == null ? "1fr" : `${c.width}px`)).join(" ");

// ═══ UPDATE THIS WITH EVERY PUSH ═══
// Add new version at the TOP of this array
// Bump APP_VERSION to match
// Format: { version: "X.Y.Z", date: "YYYY-MM-DD", changes: ["what changed"] }
const APP_VERSION = "2.9.0";
const CHANGELOG = [
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
  ugcArmy: ["create", "display", "library", "creators", "creatorDetail"],
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
  "/ugc-army": "library",
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
};

const VIEW_TO_PATH = {
  home: "/",
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
};

function getViewFromPath() {
  const path = typeof window !== "undefined" ? window.location.pathname : "/";
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
    proofGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
    proofCard: { background: t.card, borderRadius: 10, border: `1px solid ${t.blue}25`, borderLeft: `3px solid ${t.blue}`, padding: "12px 14px", fontSize: 13, color: t.textSecondary, lineHeight: 1.5, transition: "background 0.3s", boxShadow: t.shadow },
    discBox: { background: t.isLight ? "#fef2f2" : t.red+"0d", borderRadius: 12, border: `2px solid ${t.red}${t.isLight ? "50" : "40"}`, padding: 20 },
    discLabel: { fontSize: 12, fontWeight: 800, color: t.red, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 },
    discText: { fontSize: 14, color: t.text, fontFamily: "'SF Mono','Fira Code',monospace", lineHeight: 1.6, background: t.discBg, padding: 12, borderRadius: 8 },
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

const STAT_OPTIONS = [
  // SleepScore Labs verified (840+ nights analyzed)
  { id: "snoring", label: "88% reduced snoring", full: "88% of users reported a reduction in snoring (SleepScore Labs independent study, 840+ nights analyzed)", category: "sleep" },
  { id: "sleep", label: "87% deeper sleep", full: "87% of users reported deeper & more restful sleep (SleepScore Labs independent study, 840+ nights analyzed)", category: "sleep" },
  { id: "sinus", label: "92% sinus pressure relief", full: "92% of users reported relief from sinus pressure (SleepScore Labs independent study, 840+ nights analyzed)", category: "health" },
  // Verified product facts
  { id: "customers", label: "1,000,000+ customers", full: "Over 1,000,000 customers · 4.5 star rating", category: "trust" },
  { id: "fda", label: "FDA registered, made in USA", full: "FDA registered, medical grade, hypoallergenic, latex-free, made in USA", category: "trust" },
  { id: "starterkit", label: "4 band sizes (S/M/L/XL)", full: "Starter Kit includes 4 magnetic bands (S, M, L, XL) and 15 adhesive tab sets", category: "product" },
  { id: "sweatproof", label: "Sweat-proof, designed for motocross", full: "Originally designed for motocross and high-intensity sports — sweat-proof adhesive stays on through workouts and sleep", category: "product" },
  { id: "trial", label: "90-day risk-free trial", full: "90-day risk-free trial included", category: "trust" },
  { id: "reusable", label: "Reusable band, replace tabs only", full: "Reusable magnetic band — only replace the adhesive tabs, reducing waste and cost vs single-use strips", category: "product" },
  // Industry stats from intakebreathing.com/pages/science
  { id: "airflow", label: "4 out of 5 people are airflow limited", full: "4 out of 5 people are airflow limited — most don't even know it", category: "awareness" },
  { id: "mouthbreath", label: "67% have trouble nose breathing", full: "Over two thirds (67%) of people report trouble breathing through their nose, even while at rest", category: "awareness" },
  { id: "snoring_pop", label: "90M Americans snore nightly", full: "90 million American adults suffer from snoring — 56% suffer nightly", category: "awareness" },
  // Press
  { id: "press", label: "Featured in Yahoo, CNN, FOX, Men's Health", full: "As featured in Yahoo, Mashable, Men's Health, CNN, and FOX", category: "trust" },
];

const STAT_CATEGORY_ORDER = ["sleep", "health", "product", "trust", "awareness"];
const STAT_CATEGORY_LABELS = {
  sleep: "Sleep & Snoring",
  health: "Health",
  product: "Product Features",
  trust: "Trust & Social Proof",
  awareness: "Industry Stats",
};

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
  '"Clinically proven" without the SleepScore Labs citation',
  '"FDA approved" or "FDA cleared" — it is FDA registered, not approved',
  '"Guarantees" fit or results',
  '"Medical device" — it is an external nasal dilator',
  'Any diagnosis language like "you have sleep apnea"',
  '"Permanently" changes anything — effects are while wearing only',
];
const DISCLOSURE = "Source: SleepScore Labs independent study · Participants with sleep tracking · Over 840 nights analyzed. Must appear as text overlay or in caption any time a SleepScore stat is referenced. Read more: intakebreathing.com/blogs/breathing-smarter/what-sleepscore-labs-discovered-about-nasal-strips-for-sleep";

const DEFAULT_REJECTIONS = [
  "Band is worn upside down — revisions will be required",
  "Adhesive tabs are not fully adhered to the nose — both sides must be flat and sealed before filming",
  "Applicator tool visible in the video — the applicator is for personal use only, not on camera",
];

function parseCustomRejections(text) {
  if (!text || typeof text !== "string") return [];
  return text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
}

function buildRejectionsArray(d) {
  const custom = parseCustomRejections(d?.customRejections);
  return [...DEFAULT_REJECTIONS, ...custom];
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
};
const DEFAULT_INSTAGRAM_DATA = {
  followers: null,
  following: null,
  posts: null,
  bio: "",
  avatarUrl: "",
  verified: false,
  lastEnriched: null,
};

// ═══ FUTURE: Outreach & Follow-Up System ═══
// outreachStatus tracks the pipeline: not_contacted → contacted → replied → negotiating → onboarded
// followUpDue triggers reminders in the Channel Pipeline section
// campaigns links creators to specific briefs
// payments tracks cost per creator per campaign

const ENRICH_STEPS = [
  { id: "tt_profile", label: "Pulling TikTok profile...", duration: 2000 },
  { id: "tt_videos", label: "Fetching recent videos...", duration: 3000 },
  { id: "ig_profile", label: "Checking Instagram profile...", duration: 2000 },
  { id: "ai_analyze", label: "IB-Ai analyzing creator fit...", duration: 4000 },
  { id: "saving", label: "Saving to database...", duration: 1000 },
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
  return {
    ...c,
    videoLog: Array.isArray(c.videoLog) ? c.videoLog : [],
    dateAdded: c.dateAdded || "2025-03-31",
    tiktokData: { ...DEFAULT_TIKTOK_DATA, ...tt },
    instagramData: { ...DEFAULT_INSTAGRAM_DATA, ...ig },
    engagementRate: c.engagementRate != null && c.engagementRate !== "" ? c.engagementRate : null,
    aiAnalysis: c.aiAnalysis && typeof c.aiAnalysis === "object" ? c.aiAnalysis : null,
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
  const updates = {};
  if (!String(c.tiktokUrl || "").trim()) updates.tiktokUrl = `https://www.tiktok.com/@${clean}`;
  if (!String(c.instagramUrl || "").trim()) updates.instagramUrl = `https://www.instagram.com/${clean}/`;
  return Object.keys(updates).length ? { ...c, ...updates } : c;
}

/** Compact e.g. 4.1M, 127K */
function formatMetricShort(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const x = Number(n);
  if (x < 1000) return String(Math.round(x));
  if (x < 1_000_000) return `${(x / 1000).toFixed(x >= 10_000 ? 0 : 1)}K`;
  return `${(x / 1_000_000).toFixed(x >= 10_000_000 ? 1 : 2)}M`.replace(/\.0M$/, "M");
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
  if (!raw) return { ...DEFAULT_INSTAGRAM_DATA, lastEnriched: null };
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
}

function tiktokDataFromUserStats(user, stats) {
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

function extractTikTokVideoList(raw) {
  const data = raw?.data ?? raw;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.videos)) return data.videos;
  if (Array.isArray(data?.aweme_list)) return data.aweme_list;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(raw?.videos)) return raw.videos;
  return [];
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
  "estimatedRate": "estimated cost per video in USD based on follower count and engagement (e.g. '$150-250')",
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
  if (!String(creator.niche || "").trim()) out.niche = aiAnalysis.suggestedNiche || creator.niche;
  if (creator.quality === "High") {
    /* keep manager-set High */
  } else if (!creator.quality || creator.quality === "Standard") {
    out.quality = aiAnalysis.qualityTier === "High" ? "High" : "Standard";
  }
  if (!String(creator.costPerVideo || "").trim()) out.costPerVideo = aiAnalysis.estimatedRate || creator.costPerVideo;
  return out;
}

function fitScoreBadgeStyle(score, t) {
  const n = Number(score);
  if (!Number.isFinite(n)) return { bg: t.cardAlt, color: t.textFaint, label: "" };
  if (n >= 8) return { bg: t.green + "22", color: t.green, label: "Great Fit" };
  if (n >= 5) return { bg: t.orange + "22", color: t.orange, label: "Potential Fit" };
  return { bg: t.red + "18", color: t.red, label: "Low Fit" };
}

async function fetchTikTokProfileRaw(cleanHandle, scrapeKey) {
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
  return raw;
}

async function fetchTikTokVideosRaw(cleanHandle, scrapeKey) {
  try {
    const res = await Promise.race([
      fetch(`https://api.scrapecreators.com/v3/tiktok/profile/videos?handle=${encodeURIComponent(cleanHandle)}`, {
        headers: { "x-api-key": scrapeKey },
      }),
      new Promise((_, rej) => setTimeout(() => rej(new Error("TIMEOUT")), 20000)),
    ]);
    if (!res.ok) return null;
    return await res.json().catch(() => null);
  } catch {
    return null;
  }
}

/** Full ScrapeCreators + optional IB-Ai pipeline for one handle (TikTok + videos + IG + AI). onStep(id) fires after each phase starts. opts.skipAi: skip Anthropic (e.g. bulk refresh when aiAnalysis already exists). */
async function runScrapeAndAiPipeline(cleanHandle, scrapeKey, aiKey, onStep, opts) {
  const sk = String(scrapeKey || "").trim();
  const ak = String(aiKey || "").trim();
  const skipAi = !!opts?.skipAi;
  const notes = [];
  onStep?.("tt_profile");
  const ttRaw = await fetchTikTokProfileRaw(cleanHandle, sk);
  const { user, stats } = parseTikTokUserStats(ttRaw);
  onStep?.("tt_videos");
  const vidRaw = await fetchTikTokVideosRaw(cleanHandle, sk);
  const tops = topVideosForAi(vidRaw || {});
  const videoDescriptions = tops.map(videoDesc).filter(Boolean).join("\n");

  onStep?.("ig_profile");
  let igRaw = null;
  try {
    const igRes = await fetch(`https://api.scrapecreators.com/v1/instagram/profile?handle=${encodeURIComponent(cleanHandle)}`, {
      headers: { "x-api-key": sk },
    });
    if (igRes.ok) igRaw = await igRes.json();
    else notes.push("Instagram profile not found — handle may differ. Add manually in the detail view.");
  } catch {
    notes.push("Instagram profile not found — handle may differ. Add manually in the detail view.");
  }

  const igData = igRaw ? instagramDataFromProfileResponse(igRaw) : { ...DEFAULT_INSTAGRAM_DATA, lastEnriched: null };

  onStep?.("ai_analyze");
  let aiAnalysis = null;
  if (!skipAi) {
    if (ak) {
      aiAnalysis = await runCreatorAiAnalysis({
        cleanHandle,
        user,
        stats,
        videoDescriptions,
        apiKey: ak,
      });
      if (!aiAnalysis) notes.push("Add your Anthropic API key in Settings to enable AI analysis");
    } else {
      notes.push("Add your Anthropic API key in Settings to enable AI analysis");
    }
  }

  const ttData = tiktokDataFromUserStats(user, stats);
  const fc = Number(stats?.followerCount ?? stats?.follower_count ?? 0);
  const hc = stats?.heartCount ?? stats?.heart ?? null;
  const engagementRate = fc > 0 && hc != null ? ((Number(hc) / fc) * 100).toFixed(1) : null;
  const nickname = user?.nickname || user?.uniqueId || "";

  onStep?.("saving");
  return {
    user,
    stats,
    ttData,
    igData,
    aiAnalysis,
    engagementRate,
    videoDescriptions,
    nickname,
    notes,
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
  { id: "proof", label: "Selecting proof points", duration: 2000 },
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

/** Heuristic: TikTok often returns duration in ms */
function durationToSeconds(raw) {
  const n = Number(raw) || 0;
  if (n <= 0) return 0;
  return n > 2000 ? Math.round(n / 1000) : Math.round(n);
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

const DEFAULTS = {
  manager: "Summer", customManager: "", contentQuantity: "1",
  budgetPerVideo: "100",
  supervisionLevel: "full",
  productName: "Starter Kit Black", customProductName: "", campaignName: "", vibe: "Fun & Entertaining", customVibe: "", mission: "",
  ageRange: "25-34", gender: "Men & Women", problem: "",
  selectedStats: ["snoring", "sleep", "sinus", "customers", "fda"],
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

function generateBrief(d) {
  const productLabel = d.productName === "Other" ? (d.customProductName || "").trim() : d.productName;
  const fullProduct = productLabel ? `Intake Breathing — ${productLabel}` : "Intake Breathing";
  const mission = d.mission || `Discover what ${fullProduct} can do for you.`;
  const ageRange = d.ageRange || "25-34";
  const genderLabel = d.gender || "Men & Women";
  const age = `${ageRange} · ${genderLabel}`;
  const problemText = (d.problem || d.customProblem || "").trim();
  const problemSentences = splitSentences(problemText);
  const persona = PERSONAS[Math.floor(Math.random() * PERSONAS.length)];
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
  const hasM = d.selectedStats.includes("customers");
  const agInst = "Twist the knife — make them feel the cost of NOT trying.";
  const agLines = ["You're literally leaving better sleep on the table", "Every night without this is a night you're not breathing fully", hasM ? "Over a million people already figured this out" : "Thousands already know"];
  const agOverlays = [hasM ? "Counter: '1,000,000+ customers'" : "'Thousands already know'", "'Still scrolling past?' with raised eyebrow", "Quick montage of real reactions"];
  const solInst = solutionSentences.length > 0 ? `Deliver the payoff: ${solutionSentences[0]}` : "Show the product in action.";
  const solLines = solutionSentences.length >= 2 ? pick(solutionSentences, 3) : ["This changed everything", "I can't believe the difference", "I'm never going back"];
  const solOverlays = ["Before/after or progression reveal", "Product in action — the key moment", "End card: product + CTA + 90-day trial"];
  const toneResolved = d.tone === "Other" ? (d.customTone || "").trim() : (d.tone || "");
  const hookKey = d.tone === "Other" ? "Real & relatable" : d.tone;
  const hooks = TONE_HOOKS[hookKey] || TONE_HOOKS["Real & relatable"];
  const vibeLabel = d.vibe === "Other" ? (d.customVibe || "").trim() : d.vibe;
  const proof = d.selectedStats.map(id => { const s = STAT_OPTIONS.find(o => o.id === id); return s ? s.full : ""; }).filter(Boolean);
  const vibePrefix = d.vibe === "Other" && vibeLabel ? `Campaign vibe: ${vibeLabel}\n\n` : "";
  const tonePrefix = toneResolved ? `Tone / voice: ${toneResolved}\n\n` : "";
  const platformsArr = normalizePlatforms(d);
  const noteBlocks = platformsArr.map((p) => {
    const base = (PLATFORM_NOTES[p] || "").trim();
    if (PLATFORM_NOTES[p]) {
      if (p === "Other" && (d.customPlatform || "").trim()) {
        const o = (d.customPlatform || "").trim();
        return base ? `${base}\nNamed platform: ${o}` : `Platform: ${o}`;
      }
      return base;
    }
    const otherBase = (PLATFORM_NOTES["Other"] || "").trim();
    return otherBase ? `${otherBase}\nNamed platform: ${p}` : `Platform: ${p}`;
  }).filter(Boolean);
  const lg = LENGTH_GUIDE[d.videoLength] || "";
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
  const rejections = buildRejectionsArray(d);
  const approvedForBrief = Array.isArray(d.approvedClaims) && d.approvedClaims.length ? [...d.approvedClaims] : [...APPROVED_CLAIMS.slice(0, 5)];
  const bannedForBrief = Array.isArray(d.bannedClaims) && d.bannedClaims.length ? [...d.bannedClaims] : [...BANNED_CLAIMS.slice(0, 5)];
  return { mission, persona, age, psycho, theyAre, theyAreNot, probInst, probLines, probOverlays, agInst, agLines, agOverlays, solInst, solLines, solOverlays, hooks, sayThis: approvedForBrief, notThis: bannedForBrief, disclosure: DISCLOSURE, proof: proof.length > 0 ? proof.slice(0, 4) : ["88% of users reported a reduction in snoring (SleepScore Labs independent study, 840+ nights analyzed)", "Over 1,000,000 customers · 4.5 star rating", "FDA registered, medical grade, hypoallergenic, latex-free, made in USA", "90-day risk-free trial included"], platNotes, deliverables, rejections };
}

// ═══════════════════════════════════════════════════════════
// FORM
// ═══════════════════════════════════════════════════════════

const BriefForm = memo(function BriefForm({ prefill, onGenerate }) {
  const { t, S } = useContext(ThemeContext);
  const pf = prefill || DEFAULTS;
  const [ageRange, setAgeRange] = useState(pf.ageRange ?? DEFAULTS.ageRange);
  const [gender, setGender] = useState(pf.gender ?? DEFAULTS.gender);
  const [selectedStats, setSelectedStats] = useState([...(pf.selectedStats ?? DEFAULTS.selectedStats)]);
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
  const [statsLoading, setStatsLoading] = useState(false);
  const debounceTimer = useRef(null);
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
  const toggleStat = (id) => setSelectedStats(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);

  const suggestStats = useCallback(async () => {
    const key = localStorage.getItem("intake-apikey");
    if (!key) return;

    const v = vals.current;
    const context = [v.productName, v.campaignName, v.mission, v.vibe, v.problem, v.ageRange, v.gender, selectedPlatforms.join(", ")].filter(Boolean).join(", ");
    if (context.length < 10) return;

    setStatsLoading(true);
    try {
      const statIds = STAT_OPTIONS.map(s => s.id).join(", ");
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
            max_tokens: 100,
            messages: [{ role: "user", content: `You are helping select proof points for a UGC creator brief. Given this campaign context: "${context}". Available stat IDs: ${statIds}. The stats are: ${STAT_OPTIONS.map(s => s.id + "=" + s.label).join(", ")}. Return ONLY a JSON array of the most relevant stat IDs for this campaign, e.g. ["snoring","sleep","starterkit"]. Pick 3-5 most relevant. Use only verified stat IDs from the list. Return ONLY the JSON array, nothing else.` }],
          }),
        }),
        new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 10000)),
      ]);
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      const text = data.content.map(i => i.text || "").join("");
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        try {
          const ids = JSON.parse(match[0]);
          if (!Array.isArray(ids)) return;
          const validIds = ids.filter(id => STAT_OPTIONS.some(s => s.id === id));
          if (validIds.length > 0) setSelectedStats(validIds);
        } catch { /* ignore malformed JSON */ }
      }
    } catch { /* ignore */ }
    finally { setStatsLoading(false); }
  }, [selectedPlatforms]);

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

Here are ALL available approved claims: ${JSON.stringify(APPROVED_CLAIMS)}

Here are ALL available banned claims: ${JSON.stringify(BANNED_CLAIMS)}

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
              APPROVED_CLAIMS.some((ac) => normalize(ac) === normalize(c))
            );
            if (ok.length > 0) setSelectedApproved(ok);
          }
          if (Array.isArray(result.banned) && result.banned.length > 0) {
            const ok = result.banned.filter((c) =>
              BANNED_CLAIMS.some((bc) => normalize(bc) === normalize(c))
            );
            if (ok.length > 0) setSelectedBanned(ok);
          }
        } catch { /* ignore malformed JSON */ }
      }
    } catch { /* ignore */ }
    finally { setComplianceLoading(false); }
  }, []);

  const triggerStatsSuggest = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => suggestStats(), 2000);
  }, [suggestStats]);

  const triggerComplianceSuggest = useCallback(() => {
    if (complianceTimer.current) clearTimeout(complianceTimer.current);
    complianceTimer.current = setTimeout(() => suggestCompliance(), 2500);
  }, [suggestCompliance]);

  const fireFormSuggest = useCallback(() => {
    triggerStatsSuggest();
    triggerComplianceSuggest();
  }, [triggerStatsSuggest, triggerComplianceSuggest]);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
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
      selectedStats, platforms: [...selectedPlatforms], customPlatform: (v.customPlatform || "").trim(), videoLength: v.videoLength, tone: v.tone, customTone: (v.customTone || "").trim(), notes: v.notes,
      customRejections: (v.customRejections || "").trim(),
      _audience: `Ages ${ageRange} — ${gender}`,
      _problem: problemTrim,
      _stats: selectedStats.map(id => { const s = STAT_OPTIONS.find(o => o.id === id); return s ? s.full : ""; }).filter(Boolean).join(". "),
      approvedClaims: [...selectedApproved],
      bannedClaims: [...selectedBanned],
      _approved: selectedApproved.join(". "),
      _banned: selectedBanned.join(". "),
      _disclosure: DISCLOSURE,
      _rejections: buildRejectionsArray({ customRejections: v.customRejections || "" }),
    });
  }, [onGenerate, ageRange, gender, selectedStats, selectedPlatforms, selectedApproved, selectedBanned, managerSel, contentQty, supervisionLevel]);
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
              {PRODUCTS.map(o => <option key={o} value={o}>{o}</option>)}
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
        <div style={S.secLabel}><Icon name="barChart" size={16} color={t.green} /><span>Proof Points</span>{statsLoading ? <span style={{ fontSize: 11, color: t.orange, fontWeight: 500, marginLeft: 4 }}>— IB-Ai selecting...</span> : <span style={{ fontSize: 11, color: t.textFaint, fontWeight: 500, marginLeft: 4 }}>— auto-selected by IB-Ai, tap to adjust</span>}</div>
        <div>
          {STAT_CATEGORY_ORDER.filter(c => STAT_OPTIONS.some(s => s.category === c)).map((cat, catIdx) => {
            const items = STAT_OPTIONS.filter(s => s.category === cat);
            return (
              <div key={cat}>
                <div style={{ fontSize: 11, fontWeight: 600, color: t.textFaint, textTransform: "uppercase", letterSpacing: "0.05em", marginTop: catIdx === 0 ? 0 : 12, marginBottom: 6 }}>{STAT_CATEGORY_LABELS[cat]}</div>
                <div style={S.chipGrid}>
                  {items.map(st => <div key={st.id} style={{ ...S.chip(selectedStats.includes(st.id)), display: "inline-flex", alignItems: "center", gap: 6 }} onClick={()=>toggleStat(st.id)}>{selectedStats.includes(st.id) ? <Icon name="checkSm" size={12} color={t.green} /> : null}{st.label}</div>)}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ ...S.hint, marginTop: 10 }}>Selected stats become proof point cards. Use disclosure when citing SleepScore stats.</div>
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
        <div style={S.roBox}>{DEFAULT_REJECTIONS.map((c, i) => (
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
  const beatsHtml = `<div class="beats-grid">${beatsInnerHtml}</div>`;
  const hooksHtml = (b.hooks || [])
    .map((h, i) => `<div class="hook"><div class="hook-num">${i + 1}</div><div class="hook-text">${escSafe(h)}</div></div>`)
    .join("");
  const sayHtml = (b.sayThis || []).map((s) => `<div class="compliance-item"><span class="mark">+</span>${escSafe(s)}</div>`).join("");
  const notHtml = (b.notThis || []).map((s) => `<div class="compliance-item"><span class="mark">–</span>${escSafe(s)}</div>`).join("");
  const rejList = Array.isArray(b.rejections) && b.rejections.length ? b.rejections : buildRejectionsArray(fd);
  const rejHtml = rejList.map((r) => `<div class="revision-item"><span class="rx">•</span>${escSafe(r)}</div>`).join("");
  const proofHtml = (b.proof || []).map((p) => `<div class="proof-card">${escSafe(p)}</div>`).join("");
  const platNotesHtml = escSafe(b.platNotes || "").replace(/\n/g, "<br>");
  const deliverablesHtml = escSafe(b.deliverables || "").replace(/\n/g, "<br>");
  const disclosureHtml = escSafe(b.disclosure || "").replace(/\n/g, "<br>");
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
  padding: 0;
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
  padding: 12px; background: #fafafa; border: 1px solid #e5e5e5;
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
.beat-inst { font-size: 10px; color: #333; line-height: 1.5; margin-bottom: 8px; }
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

/* ── Proof grid ── */
.proof-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.proof-card {
  background: #f8f8f8; border: 1px solid #e5e5e5; border-left: 3px solid #4a9a9d;
  border-radius: 4px; padding: 8px 10px; font-size: 10px; color: #333; line-height: 1.5;
}

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
${beatsHtml}

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

<div class="section-title">Proof Points</div>
<div class="proof-grid">
  ${proofHtml}
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

function BriefDisplay({ brief: b, formData: fd, onBack, onRegenerate, onRegenerateAI, currentRole }) {
  const { t, S } = useContext(ThemeContext);
  const wasAI = fd.mode === "ai";
  const isManager = currentRole === ROLES.MANAGER;
  const [shareToast, setShareToast] = useState(null);

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
    navigator.clipboard.writeText(id).then(() => {
      setShareToast("Share link copied — creator view coming soon");
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
          <button type="button" onClick={copyShareLink} style={{ ...S.btnS, fontSize: 13, padding: "9px 18px", borderColor: t.border, color: t.textMuted }}>Copy Share Link</button>
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
        <div style={S.bSecTitle}><Icon name="barChart" size={16} color={t.textFaint} /><span>Proof Points</span></div>
        <div style={S.proofGrid}>{b.proof.map((p,i)=><div key={i} style={S.proofCard}><EditableField editable={isManager} value={p} style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.5, width: "100%" }} t={t} /></div>)}</div>
      </div>
      <div style={S.bSec}>
        <div style={S.bSecTitle}><Icon name="alertTriangle" size={16} color={t.orange} /><span>Required Disclosure — Non-Negotiable</span></div>
        <div style={S.discBox}><div style={S.discLabel}>Must appear when any stat is referenced</div><EditableField editable={isManager} value={b.disclosure} style={S.discText} t={t} /></div>
      </div>
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
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// IB-Ai — prompt builder (Claude)
// ═══════════════════════════════════════════════════════════

function buildAIPrompt(d) {
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
    : buildRejectionsArray(d).join(". ");
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
  return `You are an expert UGC (user-generated content) brief writer for Intake Breathing, a magnetic nasal dilator company. Write a complete creator brief. Be specific, creative, and tailored to this exact campaign — not generic.

PRODUCT: ${productResolved} by Intake Breathing
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
PROOF POINTS / STATS: ${d._stats || ""}
APPROVED CLAIMS (creators CAN say): ${d._approved || ""}
BANNED CLAIMS (NEVER say): ${d._banned || ""}
REQUIRED DISCLOSURE: ${d._disclosure || ""}
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
{"mission":"one line mission statement","persona":"creative persona name for the target viewer","age":"age range","psycho":"2-3 sentences describing their mindset, fears, desires — be vivid and specific","theyAre":["4 psychographic traits that describe this viewer"],"theyAreNot":["4 things this viewer is NOT — help creators avoid wrong assumptions"],"probInst":"directive for the PROBLEM beat — tell the creator exactly what to show/say in the opening","probLines":["3 specific lines creators can say or riff on for the problem beat — conversational, not corporate"],"probOverlays":["3 specific text overlay or visual ideas for the problem beat"],"agInst":"directive for the AGITATE beat — how to twist the knife and create urgency","agLines":["3 agitate lines — make the viewer feel the cost of inaction"],"agOverlays":["3 overlay/visual ideas for the agitate beat"],"solInst":"directive for the SOLUTION beat — the payoff, the reveal, the transformation","solLines":["3 solution lines — the relief, the wow moment, the conversion push"],"solOverlays":["3 overlay/visual ideas for the solution beat"],"hooks":["4 scroll-stopping hook options for the first 2-3 seconds — these must be thumb-stoppers"],"sayThis":["5 approved phrases creators should use"],"notThis":["5 phrases creators must NEVER say"],"rejections":["array of strings — every revision-required rule listed above; include all criteria verbatim"],"disclosure":"exact required citation text","proof":["4 formatted stat cards"],"platNotes":"platform-specific tips for all selected platforms (${platLine}) at ${d.videoLength}","deliverables":"what creators need to submit and format specs"}`;
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
  const [urlInput, setUrlInput] = useState("");
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [fetchedVideo, setFetchedVideo] = useState(null);
  const [objectUrl, setObjectUrl] = useState(null);
  const [fileDims, setFileDims] = useState(null);
  const [remoteDims, setRemoteDims] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [downloading, setDownloading] = useState({});
  const fileInputRef = useRef(null);
  const objectUrlRef = useRef(null);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    setFetchedVideo(null);
    setFetchError(null);
    setRemoteDims(null);
  }, [urlInput]);

  /** Prefer uploaded file dimensions when both URL and file exist */
  const displayDims = fileDims || remoteDims;

  const loadFile = (file) => {
    if (!file) return;
    const ok = /\.(mp4|mov|webm)$/i.test(file.name) || /video\/(mp4|quicktime|webm)/i.test(file.type);
    if (!ok) {
      alert("Please choose an .mp4, .mov, or .webm file.");
      return;
    }
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const u = URL.createObjectURL(file);
    objectUrlRef.current = u;
    setObjectUrl(u);
    setFileDims(null);
    setFetchedVideo(null);
    setRemoteDims(null);
    setFetchError(null);
  };

  const handleFetch = async () => {
    let scrapeKey = "";
    try {
      scrapeKey = localStorage.getItem("intake-scrape-key") || "";
    } catch {
      scrapeKey = "";
    }
    if (!scrapeKey.trim()) {
      setFetchError("Add your ScrapeCreators API key in Settings first.");
      setFetchedVideo(null);
      return;
    }
    const url = urlInput.trim();
    if (!url) {
      setFetchError("Paste a video URL first.");
      return;
    }
    let platform;
    if (/tiktok\.com/i.test(url)) platform = "tiktok";
    else if (/instagram\.com/i.test(url)) platform = "instagram";
    else {
      setFetchError("Please paste a TikTok or Instagram URL");
      setFetchedVideo(null);
      return;
    }
    setFetchError(null);
    setFetchedVideo(null);
    setRemoteDims(null);
    setFetchLoading(true);
    try {
      let videoData;
      if (platform === "tiktok") {
        const res = await Promise.race([
          fetch("https://api.scrapecreators.com/v2/tiktok/video?url=" + encodeURIComponent(url), {
            headers: { "x-api-key": scrapeKey },
          }),
          new Promise((_, rej) => setTimeout(() => rej(new Error("TIMEOUT")), 20000)),
        ]);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.message || data?.error || `Request failed (${res.status})`);
        }
        const ad = data.aweme_detail;
        const v = ad?.video;
        const rawDur = v?.duration ?? ad?.music?.duration ?? 0;
        videoData = {
          platform: "TikTok",
          author: ad?.author?.nickname || "Unknown",
          authorHandle: ad?.author?.unique_id || "",
          caption: ad?.desc || "",
          videoUrl: v?.play_addr?.url_list?.[0] || v?.bit_rate?.[0]?.play_addr?.url_list?.[0] || "",
          coverUrl: v?.cover?.url_list?.[0] || v?.ai_dynamic_cover?.url_list?.[0] || "",
          width: v?.width || 0,
          height: v?.height || 0,
          duration: durationToSeconds(rawDur),
          stats: {
            views: ad?.statistics?.play_count || 0,
            likes: ad?.statistics?.digg_count || 0,
            comments: ad?.statistics?.comment_count || 0,
            shares: ad?.statistics?.share_count || 0,
          },
        };
      } else {
        const res = await Promise.race([
          fetch("https://api.scrapecreators.com/v1/instagram/post?url=" + encodeURIComponent(url), {
            headers: { "x-api-key": scrapeKey },
          }),
          new Promise((_, rej) => setTimeout(() => rej(new Error("TIMEOUT")), 20000)),
        ]);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.message || data?.error || `Request failed (${res.status})`);
        }
        const igCaption =
          data.caption?.text ||
          data.edge_media_to_caption?.edges?.[0]?.node?.text ||
          (typeof data.caption === "string" ? data.caption : "") ||
          "";
        let videoUrl = data.video_url || data.video_versions?.[0]?.url || "";
        if (!videoUrl && Array.isArray(data.video_versions)) {
          const sorted = [...data.video_versions].sort((a, b) => (b?.width || 0) - (a?.width || 0));
          videoUrl = sorted[0]?.url || "";
        }
        const coverUrl =
          data.thumbnail_url ||
          data.display_url ||
          data.image_versions2?.candidates?.[0]?.url ||
          "";
        const uname = data.owner?.username || data.user?.username || "";
        videoData = {
          platform: "Instagram",
          author: uname || "Unknown",
          authorHandle: uname || "",
          caption: igCaption,
          videoUrl,
          coverUrl,
          width: data.original_width || data.dimensions?.width || 0,
          height: data.original_height || data.dimensions?.height || 0,
          duration: durationToSeconds(data.video_duration || 0),
          stats: {
            views: data.video_view_count || data.play_count || 0,
            likes: data.like_count || data.edge_media_preview_like?.count || 0,
            comments: data.comment_count || data.edge_media_to_comment?.count || 0,
            shares: 0,
          },
        };
      }
      if (!videoData.videoUrl && !videoData.coverUrl) {
        setFetchError("Could not read video from API response. The post may be private or unavailable.");
        return;
      }
      setFetchedVideo(videoData);
      if (videoData.width && videoData.height) {
        setRemoteDims({ w: videoData.width, h: videoData.height, ar: aspectRatioLabel(videoData.width, videoData.height) });
      }
    } catch (e) {
      const msg = e?.message || "Something went wrong.";
      setFetchError(msg === "TIMEOUT" ? "Request timed out. Try again." : msg);
    } finally {
      setFetchLoading(false);
    }
  };

  const handleReformat = async (format) => {
    if (!fetchedVideo?.videoUrl) return;
    const dimParts = String(format.dimensions || "")
      .split(/[×x]/i)
      .map((s) => s.trim())
      .filter(Boolean);
    const w = Number(dimParts[0]);
    const h = Number(dimParts[1]);
    if (!w || !h) return;

    setDownloading((prev) => ({ ...prev, [format.id]: true }));
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);
    try {
      const res = await fetch("/api/reformat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl: fetchedVideo.videoUrl,
          width: w,
          height: h,
          name: `${fetchedVideo.authorHandle || "video"}_${format.name.replace(/\s+/g, "_")}`,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server returned ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fetchedVideo.authorHandle || "video"}_${format.name.replace(/\s+/g, "_")}_${String(format.dimensions).replace(/[×]/g, "x")}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === "AbortError") {
        alert("Reformat timed out — the video may be too long. Try a shorter clip.");
      } else {
        alert(`Reformat failed: ${err.message}`);
      }
    } finally {
      setDownloading((prev) => ({ ...prev, [format.id]: false }));
    }
  };

  const canReformat = !!(fetchedVideo?.videoUrl);

  const renderFormatReference = () => (
    <div style={{ marginTop: 32 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: t.text, marginBottom: 8 }}>Format Reference — Ad Specs by Platform</div>
      <div style={{ fontSize: 14, color: t.textMuted, marginBottom: 12, lineHeight: 1.55 }}>
        {canReformat
          ? "Click any format to download the reformatted video"
          : "Use these specs when resizing your video in your editor (CapCut, Premiere, Canva, etc.)"}
      </div>
      {VIDEO_REFORMAT_GROUPS.map((group) => (
        <div key={group.title} style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.textFaint, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 10 }}>{group.title}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
            {group.items.map((item) => {
              const loading = !!downloading[item.id];
              const interactive = canReformat && !loading;
              return (
                <div
                  key={item.id}
                  role={canReformat ? "button" : undefined}
                  tabIndex={interactive ? 0 : undefined}
                  onClick={() => {
                    if (!canReformat || loading) return;
                    handleReformat(item);
                  }}
                  onKeyDown={(e) => {
                    if (!interactive) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleReformat(item);
                    }
                  }}
                  style={{
                    background: t.card,
                    border: `1px solid ${t.border}`,
                    borderRadius: 10,
                    padding: "14px 16px",
                    cursor: canReformat ? (loading ? "wait" : "pointer") : "default",
                    opacity: canReformat ? (loading ? 0.7 : 1) : 0.92,
                    pointerEvents: loading ? "none" : "auto",
                    transition: "background 0.15s, border-color 0.15s, opacity 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    if (!canReformat || loading) return;
                    e.currentTarget.style.background = t.green + "08";
                    e.currentTarget.style.borderColor = t.green + "50";
                  }}
                  onMouseLeave={(e) => {
                    if (!canReformat || loading) return;
                    e.currentTarget.style.background = t.card;
                    e.currentTarget.style.borderColor = t.border;
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: t.text, flex: "1 1 auto", minWidth: 0 }}>{item.name}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <div style={{ fontSize: 12, color: t.textFaint, textAlign: "right", whiteSpace: "nowrap" }}>
                        {item.ratio} · {item.dimensions}
                      </div>
                      {canReformat ? (
                        loading ? (
                          <span
                            style={{
                              width: 14,
                              height: 14,
                              border: `2px solid ${t.border}`,
                              borderTop: `2px solid ${t.green}`,
                              borderRadius: "50%",
                              animation: "spin 0.8s linear infinite",
                              display: "inline-block",
                              flexShrink: 0,
                            }}
                            aria-hidden
                          />
                        ) : (
                          <span style={{ fontSize: 15, color: t.green, fontWeight: 700, lineHeight: 1 }} title="Download reformatted video">
                            ↓
                          </span>
                        )
                      ) : null}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.45 }}>{loading ? "Processing..." : item.placement}</div>
                  {item.recommended ? (
                    <div style={{ marginTop: 10, fontSize: 11, fontWeight: 700, color: t.green }}>★ Recommended</div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.6, marginTop: 8, paddingTop: 4 }}>
        Videos are reformatted server-side using FFmpeg. Processing time depends on video length — typically 5-15 seconds.
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px 80px", animation: "fadeIn 0.3s ease" }}>
      <button type="button" onClick={onBack} style={{ ...S.btnS, fontSize: 13, padding: "9px 18px", marginBottom: 20 }}>← Back to Tools</button>
      <div style={{ fontSize: 26, fontWeight: 800, color: t.text, marginBottom: 8 }}>Video Reformatter</div>
      <div style={{ fontSize: 14, color: t.textMuted, marginBottom: 24, lineHeight: 1.5 }}>
        Paste a URL to fetch a preview and download the original, or upload a file. Use the format reference below when resizing in your editor.
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: t.green, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>Paste URL</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "stretch", marginBottom: 12 }}>
        <input
          type="url"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="Paste TikTok or Instagram Reels URL..."
          style={{ ...S.input, flex: "1 1 240px", minWidth: 200, marginBottom: 0 }}
        />
        <button
          type="button"
          disabled={fetchLoading}
          onClick={handleFetch}
          style={{
            padding: "11px 20px",
            borderRadius: 8,
            border: "none",
            background: t.green,
            color: t.isLight ? "#fff" : "#000",
            fontSize: 14,
            fontWeight: 700,
            cursor: fetchLoading ? "not-allowed" : "pointer",
            flexShrink: 0,
            opacity: fetchLoading ? 0.75 : 1,
          }}
        >
          {fetchLoading ? "Fetching…" : "Fetch Video"}
        </button>
      </div>
      {fetchLoading && (
        <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 14 }}>Fetching video data...</div>
      )}
      {fetchError && (
        <div style={{ fontSize: 13, color: t.red, marginBottom: 14, padding: "12px 14px", background: t.red + "10", borderRadius: 8, border: `1px solid ${t.red}35` }}>
          {fetchError}
        </div>
      )}

      {fetchedVideo && (
        <div
          style={{
            background: t.card,
            border: `1px solid ${t.border}`,
            borderRadius: 12,
            padding: 20,
            marginBottom: 24,
            boxShadow: t.shadow,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 20,
              alignItems: "flex-start",
            }}
          >
            <div style={{ flexShrink: 0 }}>
              {fetchedVideo.coverUrl ? (
                <img
                  src={fetchedVideo.coverUrl}
                  alt=""
                  style={{ width: 200, maxWidth: "100%", height: "auto", minHeight: 120, borderRadius: 8, objectFit: "cover", display: "block", background: t.cardAlt }}
                />
              ) : (
                <div
                  style={{
                    width: 200,
                    maxWidth: "100%",
                    minHeight: 200,
                    borderRadius: 8,
                    background: t.isLight ? "#1a1a22" : "#0a0a10",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 48,
                  }}
                >
                  <Icon name="video" size={48} color={t.textFaint} />
                </div>
              )}
            </div>
            <div style={{ flex: "1 1 240px", paddingLeft: 20, minWidth: 0 }}>
              <div style={{ marginBottom: 10 }}>
                <span
                  style={{
                    display: "inline-block",
                    padding: "4px 10px",
                    borderRadius: 20,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    background: fetchedVideo.platform === "Instagram" ? t.purple + (t.isLight ? "22" : "18") : "#fe2c55" + (t.isLight ? "22" : "28"),
                    color: fetchedVideo.platform === "Instagram" ? t.purple : "#fe2c55",
                    border: fetchedVideo.platform === "Instagram" ? `1px solid ${t.purple}40` : "1px solid #fe2c5540",
                  }}
                >
                  {fetchedVideo.platform}
                </span>
              </div>
              <div style={{ marginBottom: 10, lineHeight: 1.4 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{fetchedVideo.author}</span>
                {fetchedVideo.authorHandle ? (
                  <span style={{ fontSize: 14, color: t.textFaint, fontWeight: 500 }}> @{fetchedVideo.authorHandle}</span>
                ) : null}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: t.textSecondary,
                  lineHeight: 1.55,
                  marginBottom: 14,
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {fetchedVideo.caption || "—"}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 12 }}>
                {[
                  { label: "Views", v: fetchedVideo.stats?.views },
                  { label: "Likes", v: fetchedVideo.stats?.likes },
                  { label: "Comments", v: fetchedVideo.stats?.comments },
                  { label: "Shares", v: fetchedVideo.stats?.shares },
                ].map((row) => (
                  <div key={row.label} style={{ textAlign: "center", minWidth: 56 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{formatCount(row.v)}</div>
                    <div style={{ fontSize: 11, color: t.textFaint, marginTop: 2 }}>{row.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12, color: t.textFaint, marginBottom: 14 }}>
                {fetchedVideo.width && fetchedVideo.height
                  ? `${fetchedVideo.width} × ${fetchedVideo.height} (${aspectRatioLabel(fetchedVideo.width, fetchedVideo.height)})${fetchedVideo.duration ? ` · ${fetchedVideo.duration}s` : ""}`
                  : displayDims
                    ? `${displayDims.w} × ${displayDims.h} (${displayDims.ar})${fetchedVideo.duration ? ` · ${fetchedVideo.duration}s` : ""}`
                    : fetchedVideo.duration
                      ? `${fetchedVideo.duration}s`
                      : "—"}
              </div>
              {fetchedVideo.videoUrl ? (
                <button
                  type="button"
                  onClick={() => window.open(fetchedVideo.videoUrl, "_blank", "noopener,noreferrer")}
                  style={{
                    padding: "12px 22px",
                    borderRadius: 8,
                    border: "none",
                    background: t.green,
                    color: t.isLight ? "#fff" : "#000",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Download Original
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <div style={{ fontSize: 13, fontWeight: 600, color: t.textSecondary, marginTop: 8, marginBottom: 10 }}>Or upload a video file directly</div>
      <input ref={fileInputRef} type="file" accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm" style={{ display: "none" }} onChange={(e) => loadFile(e.target.files?.[0])} />
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          loadFile(e.dataTransfer.files?.[0]);
        }}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? t.green : t.border}`,
          borderRadius: 12,
          padding: "24px 20px",
          textAlign: "center",
          cursor: "pointer",
          background: dragOver ? t.green + "08" : t.cardAlt,
          marginBottom: 24,
          transition: "border-color 0.15s, background 0.15s",
        }}
      >
        <div style={{ fontSize: 14, color: t.textSecondary, fontWeight: 600 }}>Drag & drop or click to upload</div>
        <div style={{ fontSize: 12, color: t.textFaint, marginTop: 6 }}>.mp4, .mov, .webm</div>
      </div>

      {objectUrl && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ marginBottom: 12, borderRadius: 12, overflow: "hidden", border: `1px solid ${t.border}`, background: "#000" }}>
            <video
              src={objectUrl}
              controls
              style={{ width: "100%", maxHeight: 420, display: "block" }}
              onLoadedMetadata={(e) => {
                const el = e.target;
                setFileDims({ w: el.videoWidth, h: el.videoHeight, ar: aspectRatioLabel(el.videoWidth, el.videoHeight) });
              }}
            />
          </div>
          {fileDims && (
            <div style={{ fontSize: 14, color: t.textMuted }}>
              <strong style={{ color: t.text }}>Uploaded file:</strong> {fileDims.w}×{fileDims.h}px · aspect {fileDims.ar}
            </div>
          )}
        </div>
      )}

      {renderFormatReference()}

    </div>
  );
}

const VIDEO_LOG_PLATFORMS = ["TikTok", "Instagram", "YouTube Shorts", "Facebook", "Other"];
const VIDEO_LOG_STATUSES = [
  { value: "live", label: "Live" },
  { value: "in_review", label: "In Review" },
  { value: "draft", label: "Draft" },
];

function CreatorDetailView({ c, updateCreator, library, navigate, scrapeKey, apiKey, t, S }) {
  const [showShipping, setShowShipping] = useState(false);
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

  const ttUrl = c.tiktokUrl?.trim() || tiktokUrlFromHandle(c.handle);
  const videoCount = creatorDisplayVideoCount(c);
  const ttD = c.tiktokData || {};
  const igD = c.instagramData || {};
  const lastEnriched = ttD.lastEnriched || igD.lastEnriched;
  const handleLetter = String(c.handle || "?").replace(/^@/, "").slice(0, 1).toUpperCase();

  const enrichProfile = async () => {
    const key = (scrapeKey || "").trim() || (typeof localStorage !== "undefined" ? localStorage.getItem("intake-scrape-key") : "") || "";
    const ak = (apiKey || "").trim() || (typeof localStorage !== "undefined" ? localStorage.getItem("intake-apikey") : "") || "";
    if (!key.trim()) {
      alert("Add your ScrapeCreators API key in Settings");
      return;
    }
    setEnriching(true);
    setEnrichMsg("Pulling live data from TikTok...");
    try {
      const cleanHandle = String(c.handle || "").replace(/^@/, "").trim();
      const payload = await runScrapeAndAiPipeline(cleanHandle, key.trim(), ak);
      const patch = payload.aiAnalysis ? mergeAiFieldsIntoExisting(c, payload.aiAnalysis) : {};
      updateCreator(c.id, {
        tiktokData: { ...DEFAULT_TIKTOK_DATA, ...(c.tiktokData || {}), ...payload.ttData },
        instagramData: { ...DEFAULT_INSTAGRAM_DATA, ...(c.instagramData || {}), ...payload.igData },
        engagementRate: payload.engagementRate,
        ...patch,
        ...(!c.name?.trim() && payload.nickname ? { name: payload.nickname } : {}),
      });
      const f = formatMetricShort(payload.ttData.followers);
      const h = formatMetricShort(payload.ttData.hearts);
      const extra = payload.notes.length ? ` ${payload.notes[0]}` : "";
      setEnrichMsg(`Profile enriched — ${f} followers, ${h} hearts.${extra}`);
    } catch (err) {
      setEnrichMsg(err.message || "Enrichment failed.");
    } finally {
      setEnriching(false);
    }
  };

  const reanalyzeOnly = async () => {
    const ak = (apiKey || "").trim() || (typeof localStorage !== "undefined" ? localStorage.getItem("intake-apikey") : "") || "";
    const sk = (scrapeKey || "").trim() || (typeof localStorage !== "undefined" ? localStorage.getItem("intake-scrape-key") : "") || "";
    if (!ak.trim()) {
      alert("Add your Anthropic API key in Settings to enable AI analysis");
      return;
    }
    setEnriching(true);
    setEnrichMsg("IB-Ai re-analyzing…");
    try {
      const cleanHandle = String(c.handle || "").replace(/^@/, "").trim();
      const vidRaw = sk ? await fetchTikTokVideosRaw(cleanHandle, sk) : null;
      const tops = topVideosForAi(vidRaw || {});
      const videoDescriptions = tops.map(videoDesc).filter(Boolean).join("\n");
      const ttD = c.tiktokData || {};
      const user = { nickname: c.name, signature: ttD.bio, verified: ttD.verified };
      const stats = {
        followerCount: ttD.followers,
        followingCount: ttD.following,
        heartCount: ttD.hearts,
        videoCount: ttD.videoCount,
      };
      const ai = await runCreatorAiAnalysis({
        cleanHandle,
        user,
        stats,
        videoDescriptions,
        apiKey: ak.trim(),
      });
      if (ai) {
        const patch = mergeAiFieldsIntoExisting(c, ai);
        updateCreator(c.id, patch);
        setEnrichMsg("IB-Ai analysis updated.");
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

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px 60px", animation: "fadeIn 0.3s ease" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flex: "1 1 320px", minWidth: 0 }}>
          {ttD.avatarUrl ? (
            <img src={ttD.avatarUrl} alt="" style={{ width: 64, height: 64, borderRadius: 32, objectFit: "cover", flexShrink: 0, border: `1px solid ${t.border}` }} />
          ) : (
            <div style={{ width: 64, height: 64, borderRadius: 32, background: t.cardAlt, border: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: t.textMuted, flexShrink: 0 }}>
              {handleLetter}
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <a href={ttUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 28, fontWeight: 800, color: t.text, textDecoration: "none" }} onClick={(e) => e.stopPropagation()}>
                {c.handle}
              </a>
              {ttD.verified ? (
                <span title="Verified on TikTok" style={{ color: "#1d9bf0", fontSize: 20, lineHeight: 1 }} aria-hidden>
                  ✓
                </span>
              ) : null}
              {c.name?.trim() ? <span style={{ fontSize: 16, color: t.textMuted, fontWeight: 500 }}>{c.name.trim()}</span> : null}
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "4px 12px",
                  borderRadius: 20,
                  background: c.status === "Active" ? t.green + "18" : c.status === "One-time" ? t.orange + "18" : t.red + "18",
                  color: c.status === "Active" ? t.green : c.status === "One-time" ? t.orange : t.red,
                  border: `1px solid ${c.status === "Active" ? t.green + "35" : c.status === "One-time" ? t.orange + "35" : t.red + "35"}`,
                }}
              >
                {c.status}
              </span>
              {c.quality === "High" ? (
                <span style={{ fontSize: 11, fontWeight: 800, padding: "4px 12px", borderRadius: 20, background: "#f59e0b15", color: "#f59e0b", border: "1px solid #f59e0b30" }}>★ High</span>
              ) : (
                <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 20, background: t.cardAlt, color: t.textMuted, border: `1px solid ${t.border}` }}>Standard</span>
              )}
            </div>
            {ttD.bio ? (
              <div style={{ fontSize: 13, color: t.textMuted, fontStyle: "italic", lineHeight: 1.5, padding: "10px 12px", background: t.cardAlt, borderRadius: 8, border: `1px solid ${t.border}` }}>"{ttD.bio}"</div>
            ) : null}
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <button type="button" onClick={() => navigate("creators")} style={{ ...S.btnS, padding: "9px 18px", fontSize: 13 }}>
            ← Back
          </button>
          <button type="button" onClick={() => document.getElementById("creator-notes-section")?.scrollIntoView({ behavior: "smooth" })} style={{ ...S.btnS, padding: "9px 18px", fontSize: 13 }}>
            Edit
          </button>
          <button
            type="button"
            disabled={enriching}
            onClick={enrichProfile}
            style={{ ...S.btnP, padding: "9px 18px", fontSize: 13, opacity: enriching ? 0.65 : 1 }}
          >
            {enriching ? "Pulling live data…" : "Enrich Profile"}
          </button>
        </div>
      </div>
      {enrichMsg ? (
        <div style={{ fontSize: 12, color: enrichMsg.includes("Profile enriched") || enrichMsg.includes("enriched") || enrichMsg.includes("IB-Ai analysis") ? t.green : t.orange, marginBottom: 16 }}>{enrichMsg}</div>
      ) : null}

      <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 22, marginBottom: 24, boxShadow: t.shadow }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 16, color: t.text }}>Live Metrics</div>
        {!lastEnriched ? (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 14, color: t.textMuted, marginBottom: 12 }}>No live data yet</div>
            <button type="button" disabled={enriching} onClick={enrichProfile} style={{ ...S.btnP, padding: "10px 20px", fontSize: 14 }}>
              Enrich Profile
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between", marginBottom: 14 }}>
              {[
                { label: "Followers", val: ttD.followers != null ? formatMetricShort(ttD.followers) : "—" },
                { label: "Hearts", val: ttD.hearts != null ? formatMetricShort(ttD.hearts) : "—" },
                { label: "TT Videos", val: ttD.videoCount != null ? String(ttD.videoCount) : "—" },
                { label: "Eng. Rate", val: c.engagementRate != null ? `${c.engagementRate}%` : "—" },
                { label: "IG Followers", val: igD.followers != null ? formatMetricShort(igD.followers) : "—" },
                { label: "IG Posts", val: igD.posts != null ? String(igD.posts) : "—" },
              ].map((s) => (
                <div key={s.label} style={{ flex: "1 1 100px", textAlign: "center", minWidth: 90 }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: s.val === "—" ? t.textFaint : t.text }}>{s.val}</div>
                  <div style={{ fontSize: 11, color: t.textFaint, marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, justifyContent: "space-between" }}>
              <div style={{ fontSize: 11, color: t.textFaint }}>Last updated: {new Date(lastEnriched).toLocaleString()}</div>
              <button type="button" disabled={enriching} onClick={enrichProfile} style={{ ...S.btnP, padding: "8px 16px", fontSize: 12 }}>
                Enrich Profile
              </button>
            </div>
          </>
        )}
      </div>

      {c.aiAnalysis ? (
        <div
          style={{
            background: `linear-gradient(145deg, ${t.green}10 0%, ${t.card} 45%)`,
            border: `1px solid ${t.green}35`,
            borderRadius: 14,
            padding: 22,
            marginBottom: 24,
            boxShadow: t.shadow,
            position: "relative",
          }}
        >
          <div style={{ position: "absolute", top: 14, right: 16, fontSize: 10, fontWeight: 900, color: t.green, letterSpacing: "0.12em" }}>IB-Ai</div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: t.text }}>IB-Ai Analysis</div>
            <button type="button" disabled={enriching} onClick={reanalyzeOnly} style={{ ...S.btnS, padding: "8px 14px", fontSize: 12 }}>
              Re-analyze
            </button>
          </div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
            {(() => {
              const fs = c.aiAnalysis.fitScore;
              const badge = fitScoreBadgeStyle(fs, t);
              return (
                <div style={{ textAlign: "center", flexShrink: 0 }}>
                  <div
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 36,
                      background: badge.bg,
                      color: badge.color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 26,
                      fontWeight: 800,
                      margin: "0 auto 6px",
                      border: `1px solid ${t.border}`,
                    }}
                  >
                    {Number.isFinite(Number(fs)) ? fs : "—"}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: badge.color }}>{badge.label || "—"}</div>
                  <div style={{ fontSize: 10, color: t.textFaint, marginTop: 4 }}>Fit Score</div>
                </div>
              );
            })()}
            <div style={{ flex: "1 1 260px", minWidth: 0, fontSize: 13, color: t.textSecondary, lineHeight: 1.55 }}>
              {c.aiAnalysis.fitReason ? (
                <div style={{ marginBottom: 10 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: t.textFaint, textTransform: "uppercase" }}>Why fit</span>
                  <div style={{ color: t.text, marginTop: 4 }}>{c.aiAnalysis.fitReason}</div>
                </div>
              ) : null}
              {c.aiAnalysis.contentStyle ? (
                <div style={{ marginBottom: 10 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: t.textFaint, textTransform: "uppercase" }}>Content style</span>
                  <div style={{ marginTop: 4 }}>{c.aiAnalysis.contentStyle}</div>
                </div>
              ) : null}
              {c.aiAnalysis.suggestedCampaigns ? (
                <div style={{ marginBottom: 10 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: t.textFaint, textTransform: "uppercase" }}>Suggested campaigns</span>
                  <div style={{ marginTop: 4 }}>{c.aiAnalysis.suggestedCampaigns}</div>
                </div>
              ) : null}
              {c.aiAnalysis.estimatedRate ? (
                <div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: t.textFaint, textTransform: "uppercase" }}>Estimated rate</span>
                  <div style={{ marginTop: 4, fontWeight: 700, color: t.green }}>{c.aiAnalysis.estimatedRate}</div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ flex: "2 1 420px", minWidth: 300, display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 22, boxShadow: t.shadow }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 16, color: t.text }}>About</div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: t.textFaint, marginBottom: 4 }}>Handle</div>
              <a href={ttUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 18, fontWeight: 700, color: t.green }}>
                {c.handle}
              </a>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: t.textFaint, marginBottom: 4 }}>Name</div>
              <input
                value={c.name || ""}
                onChange={(e) => updateCreator(c.id, { name: e.target.value })}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 14 }}
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: t.textFaint, marginBottom: 4 }}>Niche (comma separated)</div>
              <input
                value={c.niche || ""}
                onChange={(e) => updateCreator(c.id, { niche: e.target.value })}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 14 }}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 11, color: t.textFaint, marginBottom: 4 }}>Quality</div>
                <select value={c.quality || "Standard"} onChange={(e) => updateCreator(c.id, { quality: e.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 14 }}>
                  <option value="High">★ High</option>
                  <option value="Standard">Standard</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, color: t.textFaint, marginBottom: 4 }}>Status</div>
                <select value={c.status || "Active"} onChange={(e) => updateCreator(c.id, { status: e.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 14 }}>
                  <option value="Active">Active</option>
                  <option value="One-time">One-time</option>
                  <option value="Off-boarded">Off-boarded</option>
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: t.textFaint, marginBottom: 4 }}>Cost per video</div>
              <div style={{ display: "flex", alignItems: "stretch" }}>
                <span style={{ background: t.cardAlt, border: `1px solid ${t.border}`, borderRight: "none", borderRadius: "8px 0 0 8px", padding: "10px 12px", color: t.textMuted, fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center" }}>$</span>
                <input
                  value={String(c.costPerVideo || "").replace(/^\$/, "")}
                  onChange={(e) => updateCreator(c.id, { costPerVideo: e.target.value })}
                  placeholder="100"
                  style={{ flex: 1, minWidth: 0, padding: "10px 12px", borderRadius: "0 8px 8px 0", border: `1px solid ${t.border}`, borderLeft: "none", background: t.inputBg, color: t.inputText, fontSize: 14 }}
                />
              </div>
            </div>
            {(c.address || "").trim() ? (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: t.textFaint, marginBottom: 6 }}>Shipping Address</div>
                <button type="button" onClick={() => setShowShipping((v) => !v)} style={{ background: "none", border: "none", color: t.green, fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0, marginBottom: showShipping ? 10 : 0 }}>
                  {showShipping ? "Hide" : "Show"} address {showShipping ? "▲" : "▼"}
                </button>
                {showShipping ? (
                  <div>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                      <div style={{ flex: "1 1 200px", fontSize: 14, color: t.text, lineHeight: 1.5 }}>{(c.address || "").trim()}</div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText((c.address || "").trim());
                        }}
                        style={{ ...S.btnS, padding: "6px 12px", fontSize: 12 }}
                      >
                        Copy
                      </button>
                    </div>
                    <div style={{ fontSize: 11, color: t.textFaint, marginBottom: 6 }}>Edit</div>
                    <textarea
                      value={c.address || ""}
                      onChange={(e) => updateCreator(c.id, { address: e.target.value })}
                      rows={3}
                      placeholder="Shipping / mailing address"
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 14, resize: "vertical" }}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div id="creator-notes-section" style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 22, boxShadow: t.shadow }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12, color: t.text }}>Notes &amp; Performance</div>
            <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 10, lineHeight: 1.5 }}>What this creator excels at, best hooks, audience fit, and performance highlights.</div>
            <textarea
              value={c.notes || ""}
              onChange={(e) => updateCreator(c.id, { notes: e.target.value })}
              rows={12}
              style={{ width: "100%", padding: 14, borderRadius: 10, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 14, lineHeight: 1.55, resize: "vertical", minHeight: 200 }}
              placeholder="Strong hooks, audience notes, campaign wins, what to avoid…"
            />
          </div>

          <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 22, boxShadow: t.shadow }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: t.text }}>Video Log</span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 12, background: t.green + "15", color: t.green }}>{(Array.isArray(c.videoLog) ? c.videoLog : []).length}</span>
              </div>
              <button type="button" onClick={() => setShowVideoForm((v) => !v)} style={{ ...S.btnP, padding: "8px 14px", fontSize: 12 }}>
                + Add Video
              </button>
            </div>

            {showVideoForm ? (
              <div style={{ background: t.cardAlt, border: `1px solid ${t.border}`, borderRadius: 10, padding: 14, marginBottom: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10, marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 10, color: t.textFaint, marginBottom: 4 }}>URL</div>
                    <input value={videoDraft.url} onChange={(e) => setVideoDraft((d) => ({ ...d, url: e.target.value }))} placeholder="https://…" style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 13 }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: t.textFaint, marginBottom: 4 }}>Campaign</div>
                    <input list={`camp-${c.id}`} value={videoDraft.campaign} onChange={(e) => setVideoDraft((d) => ({ ...d, campaign: e.target.value }))} placeholder="Campaign name" style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 13 }} />
                    <datalist id={`camp-${c.id}`}>
                      {campaignNames.map((n) => (
                        <option key={n} value={n} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: t.textFaint, marginBottom: 4 }}>Date</div>
                    <input type="date" value={videoDraft.date} onChange={(e) => setVideoDraft((d) => ({ ...d, date: e.target.value }))} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 13 }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: t.textFaint, marginBottom: 4 }}>Platform</div>
                    <select value={videoDraft.platform} onChange={(e) => setVideoDraft((d) => ({ ...d, platform: e.target.value }))} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 13 }}>
                      {VIDEO_LOG_PLATFORMS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: t.textFaint, marginBottom: 4 }}>Status</div>
                    <select value={videoDraft.status} onChange={(e) => setVideoDraft((d) => ({ ...d, status: e.target.value }))} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 13 }}>
                      {VIDEO_LOG_STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: t.textFaint, marginBottom: 4 }}>Views</div>
                    <input value={videoDraft.views} onChange={(e) => setVideoDraft((d) => ({ ...d, views: e.target.value }))} placeholder="0" style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 13 }} />
                  </div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: t.textFaint, marginBottom: 4 }}>Notes</div>
                  <input value={videoDraft.notes} onChange={(e) => setVideoDraft((d) => ({ ...d, notes: e.target.value }))} placeholder="Optional" style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 13 }} />
                </div>
                <button type="button" onClick={saveVideoLogEntry} style={{ ...S.btnP, padding: "8px 16px", fontSize: 13 }}>
                  Save
                </button>
              </div>
            ) : null}

            {(Array.isArray(c.videoLog) ? c.videoLog : []).length === 0 ? (
              <div style={{ fontSize: 13, color: t.textFaint, fontStyle: "italic" }}>No videos logged yet. Add one to track deliverables and performance.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[...(Array.isArray(c.videoLog) ? c.videoLog : [])]
                  .slice()
                  .reverse()
                  .map((v) => {
                    const sp = statusPill(v.status);
                    return (
                      <div key={v.id || v.url} style={{ border: `1px solid ${t.border}`, borderRadius: 10, padding: "12px 14px", background: t.cardAlt }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 6 }}>
                          <span style={{ fontSize: 12, color: t.textFaint }}>{v.date || "—"}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: t.card, border: `1px solid ${t.border}`, color: t.textMuted }}>{v.platform || "—"}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: sp.bg, color: sp.color, border: `1px solid ${sp.border}` }}>{sp.label}</span>
                          {v.views ? <span style={{ fontSize: 11, color: t.textMuted }}>{Number(v.views).toLocaleString()} views</span> : null}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 4 }}>{v.campaign || "Untitled"}</div>
                        {v.url?.trim() ? (
                          <a href={v.url.trim()} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: t.green, fontWeight: 600 }}>
                            View →
                          </a>
                        ) : null}
                        {v.notes?.trim() ? <div style={{ fontSize: 12, color: t.textMuted, marginTop: 6 }}>{v.notes}</div> : null}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>

        <div style={{ flex: "1 1 300px", minWidth: 260, display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 22, boxShadow: t.shadow }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 14, color: t.text }}>Quick Contact</div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: t.textFaint, marginBottom: 6 }}>Email</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <input
                  value={c.email || ""}
                  onChange={(e) => updateCreator(c.id, { email: e.target.value })}
                  placeholder="email@…"
                  style={{ flex: "1 1 160px", minWidth: 140, padding: "10px 12px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 14 }}
                />
                {c.email?.trim() ? (
                  <a href={`mailto:${c.email.trim()}`} style={{ ...pillLink, textDecoration: "none" }}>
                    Send Email
                  </a>
                ) : null}
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: t.textFaint, marginBottom: 6 }}>TikTok</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <input
                  value={c.tiktokUrl || ""}
                  onChange={(e) => updateCreator(c.id, { tiktokUrl: e.target.value })}
                  placeholder="Profile URL"
                  style={{ flex: "1 1 160px", minWidth: 140, padding: "10px 12px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 13 }}
                />
                <a href={ttUrl} target="_blank" rel="noopener noreferrer" style={{ ...pillLink, textDecoration: "none" }}>
                  Open TikTok
                </a>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: t.textFaint, marginBottom: 6 }}>Instagram</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <input
                  value={c.instagramUrl || ""}
                  onChange={(e) => updateCreator(c.id, { instagramUrl: e.target.value })}
                  placeholder="Profile URL"
                  style={{ flex: "1 1 160px", minWidth: 140, padding: "10px 12px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 13 }}
                />
                {c.instagramUrl?.trim() ? (
                  <a href={c.instagramUrl.trim()} target="_blank" rel="noopener noreferrer" style={{ ...pillLink, textDecoration: "none" }}>
                    Open Instagram
                  </a>
                ) : null}
              </div>
            </div>
          </div>

          <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 22, boxShadow: t.shadow }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 14, color: t.text }}>Stats Snapshot</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: t.green, lineHeight: 1 }}>{videoCount}</div>
            <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 16 }}>Total videos</div>
            <div style={{ fontSize: 14, color: t.text, marginBottom: 8 }}>
              <span style={{ color: t.textMuted }}>Active campaigns: </span>
              <strong>{activeCampaignCount}</strong>
            </div>
            <div style={{ fontSize: 14, color: t.text, marginBottom: 8 }}>
              <span style={{ color: t.textMuted }}>Member since: </span>
              <strong>{c.dateAdded || "—"}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
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

  const navigate = useCallback((newView, opts) => {
    const o = opts && typeof opts === "object" ? opts : {};
    let path = VIEW_TO_PATH[newView] || "/";
    if (newView === "creatorDetail" && o.creatorId) {
      path = `/ugc-army/creator?id=${encodeURIComponent(String(o.creatorId))}`;
    }
    window.history.pushState({ view: newView, creatorId: o.creatorId || null }, "", path);
    setView(newView);
  }, []);

  const [currentBrief, setCurrentBrief] = useState(null);
  const [currentFormData, setCurrentFormData] = useState(null);
  const [library, setLibrary] = useState([]);
  const [formKey, setFormKey] = useState(0);
  const [dashCardHover, setDashCardHover] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [aiSteps, setAiSteps] = useState([]);
  const [storageReady, setStorageReady] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [scrapeKey, setScrapeKey] = useState("");
  const [creators, setCreators] = useState([]);
  const [creatorSearch, setCreatorSearch] = useState("");
  const [sortCol, setSortCol] = useState("handle");
  const [sortDir, setSortDir] = useState("asc");
  const [filters, setFilters] = useState({ status: "All", niche: "All", quality: "All" });
  const [openFilter, setOpenFilter] = useState(null);
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

  // ── Load from storage on mount ──
  useEffect(() => {
    const themeVal = storageGet("intake-theme");
    if (themeVal) setIsDark(themeVal === "dark");

    const libVal = storageGet("intake-library");
    if (libVal) {
      try {
        const parsed = JSON.parse(libVal);
        if (Array.isArray(parsed) && parsed.length > 0) setLibrary(parsed);
      } catch {}
    }

    const keyVal = storageGet("intake-apikey");
    if (keyVal) setApiKey(keyVal);

    const scrapeVal = storageGet("intake-scrape-key");
    if (scrapeVal) setScrapeKey(scrapeVal);

    const creatorsVal = storageGet("intake-creators");
    if (creatorsVal) {
      try {
        const parsed = JSON.parse(creatorsVal);
        if (Array.isArray(parsed)) setCreators(parsed.map(hydrateCreator));
      } catch {}
    } else {
      setCreators(JSON.parse(JSON.stringify(SEED_CREATORS)).map(hydrateCreator));
    }

    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    setCreators((prev) => prev.map(hydrateCreator));
  }, [storageReady]);

  // ── Save library whenever it changes ──
  useEffect(() => {
    if (!storageReady) return;
    storageSet("intake-library", JSON.stringify(library));
  }, [library, storageReady]);

  // ── Save creators roster ──
  useEffect(() => {
    if (!storageReady) return;
    storageSet("intake-creators", JSON.stringify(creators));
  }, [creators, storageReady]);

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
    if (view !== "creatorDetail" || typeof window === "undefined") return;
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) navigate("creators");
  }, [view, navigate]);

  const t = isDark ? THEMES.dark : THEMES.light;
  const S = getS(t);
  const ctx = { t, S };

  const saveBrief = useCallback((brief, formData) => {
    const existing = formData.shareId != null && String(formData.shareId).trim() !== "";
    const shareId = existing ? String(formData.shareId).trim() : genShareId();
    const fd = { ...formData, shareId };
    setCurrentBrief(brief);
    setCurrentFormData(fd);
    setLibrary(prev => [{ id: Date.now(), shareId, name: fd.campaignName || (fd.productName === "Other" && fd.customProductName?.trim() ? fd.customProductName.trim() : fd.productName), brief, formData: fd, date: new Date().toLocaleDateString() }, ...prev]);
    setFormKey(k => k + 1);
    navigate("display");
  }, [navigate]);

  const openLibraryItem = useCallback((item) => {
    let fd = item.formData;
    if (!fd.shareId) {
      const shareId = genShareId();
      fd = { ...fd, shareId };
      setLibrary((prev) => prev.map((x) => (x.id === item.id ? { ...x, formData: fd, shareId } : x)));
    }
    setCurrentBrief(item.brief);
    setCurrentFormData(fd);
    navigate("display");
  }, [navigate]);

  const deleteBrief = useCallback((id) => {
    setLibrary(prev => prev.filter(item => item.id !== id));
  }, []);

  const updateCreator = useCallback((id, updates) => {
    setCreators((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        let next = { ...c, ...updates };
        if (updates.tiktokData && typeof updates.tiktokData === "object") {
          next = {
            ...next,
            tiktokData: { ...DEFAULT_TIKTOK_DATA, ...(c.tiktokData || {}), ...updates.tiktokData },
          };
        }
        if (updates.instagramData && typeof updates.instagramData === "object") {
          next = {
            ...next,
            instagramData: { ...DEFAULT_INSTAGRAM_DATA, ...(c.instagramData || {}), ...updates.instagramData },
          };
        }
        if ("aiAnalysis" in updates) {
          next = { ...next, aiAnalysis: updates.aiAnalysis };
        }
        return next;
      })
    );
  }, []);

  const [bulkEnrichProgress, setBulkEnrichProgress] = useState(null);

  const runBulkEnrichAll = useCallback(async () => {
    const key = (scrapeKey || "").trim() || storageGet("intake-scrape-key") || "";
    const ak = (apiKey || "").trim() || storageGet("intake-apikey") || "";
    if (!key.trim()) {
      alert("Add your ScrapeCreators API key in Settings");
      return;
    }
    const active = creators.filter((c) => c.status === "Active");
    const stale = active.filter((c) => {
      const last = c.tiktokData?.lastEnriched;
      if (!last) return true;
      return Date.now() - new Date(last).getTime() > 24 * 60 * 60 * 1000;
    });
    const skipped = active.length - stale.length;
    if (
      !window.confirm(
        `This will pull live TikTok data for ${stale.length} active creators (skipping ${skipped} enriched in the last 24h). Uses about ${stale.length} ScrapeCreators credits plus IB-Ai for creators missing analysis. Continue?`
      )
    ) {
      return;
    }
    let done = 0;
    let fail = 0;
    let topDiscovery = null;
    const clean = (h) => String(h || "").replace(/^@/, "").trim().toLowerCase();
    for (let i = 0; i < stale.length; i++) {
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
        const payload = await runScrapeAndAiPipeline(ch, key.trim(), ak, null, { skipAi: !!cr.aiAnalysis });
        const tt = payload.ttData;
        const engagementRate = payload.engagementRate;
        const mergePatch = payload.aiAnalysis ? mergeAiFieldsIntoExisting(cr, payload.aiAnalysis) : {};
        updateCreator(cr.id, {
          tiktokData: { ...DEFAULT_TIKTOK_DATA, ...(cr.tiktokData || {}), ...tt },
          instagramData: { ...DEFAULT_INSTAGRAM_DATA, ...(cr.instagramData || {}), ...payload.igData },
          engagementRate,
          ...mergePatch,
          ...(!cr.name?.trim() && payload.nickname ? { name: payload.nickname } : {}),
        });
        const fs = payload.aiAnalysis?.fitScore ?? cr.aiAnalysis?.fitScore;
        const fol = tt.followers;
        setBulkEnrichProgress({
          cur: i + 1,
          total: stale.length,
          done: done + 1,
          fail,
          skipped,
          handle: cr.handle,
          line: `${fol != null ? formatMetricShort(fol) + " followers" : ""}${fs != null ? `, Fit Score: ${fs}` : ""}`,
        });
        const score = Number(payload.aiAnalysis?.fitScore ?? cr.aiAnalysis?.fitScore);
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
      ? `\nTop discovery: ${topDiscovery.handle} — ${topDiscovery.score}/10 fit score${topDiscovery.followers != null ? `, ${formatMetricShort(topDiscovery.followers)} followers` : ""}`
      : "";
    setCreatorImportToast(
      `Bulk enrichment complete:\n• ${done} creators updated\n• ${skipped} skipped (enriched < 24h ago)\n• ${fail} failed (handle not found or API error)${td}`
    );
    setTimeout(() => setCreatorImportToast(null), 12000);
  }, [creators, scrapeKey, apiKey, updateCreator]);

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
      setCreators((p) => [hydrateCreator(row), ...p]);
      setAddHandleInput("");
      setCreatorImportToast("Add your ScrapeCreators API key in Settings to auto-pull creator data");
      setTimeout(() => setCreatorImportToast(null), 8000);
      navigate("creatorDetail", { creatorId: id });
      return;
    }

    setAddEnrichBusy(true);
    const order = ENRICH_STEPS.map((x) => x.id);
    const onStep = (id) => {
      const idx = order.indexOf(id);
      const completed = idx > 0 ? order.slice(0, idx) : [];
      setAddEnrichStepState({ completed, current: id });
    };
    setAddEnrichStepState({ completed: [], current: "tt_profile" });

    try {
      const payload = await runScrapeAndAiPipeline(cleanHandle, sk, ak, onStep);
      const ai = payload.aiAnalysis;
      const id = `c-${Date.now()}`;
      const newCreator = {
        id,
        status: "Active",
        handle: `@${cleanHandle}`,
        name: payload.nickname || "",
        email: "",
        niche: ai?.suggestedNiche || "",
        address: "",
        totalVideos: 0,
        notes: "",
        quality: ai ? normalizeQualityTier(ai.qualityTier) : "Standard",
        tiktokUrl: `https://www.tiktok.com/@${cleanHandle}`,
        instagramUrl: `https://www.instagram.com/${cleanHandle}/`,
        costPerVideo: ai?.estimatedRate || "",
        videoLog: [],
        dateAdded: new Date().toISOString().slice(0, 10),
        bestVideos: [],
        tiktokData: payload.ttData,
        instagramData: payload.igData,
        engagementRate: payload.engagementRate,
        aiAnalysis: ai || null,
        outreachStatus: null,
        lastContactDate: null,
        contactMethod: null,
        followUpDue: null,
        campaigns: [],
        payments: [],
      };
      setCreators((p) => [hydrateCreator(newCreator), ...p]);
      setAddHandleInput("");
      if (payload.notes.length) {
        setCreatorImportToast(payload.notes.filter(Boolean).join(" "));
        setTimeout(() => setCreatorImportToast(null), 10000);
      }
      navigate("creatorDetail", { creatorId: id });
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
  }, [addHandleInput, creators, scrapeKey, apiKey, navigate]);

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
      const payload = await runScrapeAndAiPipeline(cleanHandle, sk, ak);
      const existing = creators.find((c) => c.id === existingId);
      if (!existing) return;
      const merged = mergeAiFieldsIntoExisting(existing, payload.aiAnalysis);
      updateCreator(existingId, {
        tiktokData: { ...DEFAULT_TIKTOK_DATA, ...(existing.tiktokData || {}), ...payload.ttData },
        instagramData: { ...DEFAULT_INSTAGRAM_DATA, ...(existing.instagramData || {}), ...payload.igData },
        engagementRate: payload.engagementRate,
        ...(!existing.name?.trim() && payload.nickname ? { name: payload.nickname } : {}),
        ...merged,
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
  }, [duplicateModal, creators, scrapeKey, apiKey, updateCreator, navigate]);

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
              updateCount++;
            } else {
              const id = `c-import-${Date.now()}-${newCount}-${Math.random().toString(36).slice(2, 7)}`;
              next.push(hydrateCreator({ id, ...rowObj }));
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
    return key;
  };

  const saveScrapeKey = (key) => {
    setScrapeKey(key);
    setScrapeStatus(null);
    setScrapeMsg("");
    storageSet("intake-scrape-key", key);
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

  const handleGenerate = useCallback(async (formData) => {
    if (formData.mode === "template") {
      saveBrief(generateBrief(formData), formData);
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
            messages: [{ role: "user", content: buildAIPrompt(formData) }],
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

      const mergedRej = buildRejectionsArray(formData);
      if (!Array.isArray(brief.rejections) || brief.rejections.length === 0) brief.rejections = mergedRej;

      deferredSuccess = true;
      stopStepAnimation(true);
      setTimeout(() => {
        saveBrief(brief, formData);
        setAiLoading(false);
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
  }, [startStepAnimation, stopStepAnimation, saveBrief]);

  const handleCancel = () => {
    cancelledRef.current = true;
    clearInterval(timerRef.current);
    stopStepAnimation();
    setAiLoading(false);
    setAiError(null);
  };

  const handleRegenTemplate = useCallback(() => {
    if (currentFormData) saveBrief(generateBrief(currentFormData), { ...currentFormData, mode: "template" });
  }, [currentFormData, saveBrief]);

  const handleRegenAI = useCallback(() => {
    if (currentFormData) handleGenerate({ ...currentFormData, mode: "ai" });
  }, [currentFormData, handleGenerate]);

  const activeCreatorCount = useMemo(
    () => creators.filter((c) => c.status === "Active").length,
    [creators]
  );

  const activeVideosTotal = useMemo(
    () =>
      creators
        .filter((c) => c.status === "Active")
        .reduce((sum, c) => sum + creatorDisplayVideoCount(c), 0),
    [creators]
  );

  const mostUsedManagerName = useMemo(() => {
    if (!library.length) return null;
    const counts = {};
    for (const item of library) {
      const name = managerDisplayName(item.formData);
      if (!name) continue;
      counts[name] = (counts[name] || 0) + 1;
    }
    let best = null;
    let bestN = 0;
    for (const [k, v] of Object.entries(counts)) {
      if (v > bestN) {
        bestN = v;
        best = k;
      }
    }
    return best;
  }, [library]);

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

  const isCreatorViewAllowed = currentRole !== ROLES.CREATOR || CREATOR_ALLOWED_VIEWS.includes(view);

  return (
    <ThemeContext.Provider value={ctx}>
      <div style={S.app}>
        <style>{`
          @keyframes fadeIn { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
          @keyframes spin { to { transform: rotate(360deg) } }
          @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.8); } }
          @keyframes pulseGlowOrange { 0%, 100% { box-shadow: 0 0 0 0 rgba(255,170,59,0.3); } 50% { box-shadow: 0 0 8px 2px rgba(255,170,59,0.15); } }
          @keyframes pulseGlowPurple { 0%, 100% { box-shadow: 0 0 0 0 rgba(192,132,252,0.35); } 50% { box-shadow: 0 0 8px 2px rgba(192,132,252,0.18); } }
          .home-dashboard-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }
          @media (max-width: 720px) { .home-dashboard-grid { grid-template-columns: 1fr !important; } }
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

        {/* NAV — context-aware (creators: UGC Army library only) */}
        {(() => {
          if (currentRole === ROLES.CREATOR) {
            return (
              <div className="no-print" style={S.nav}>
                <div style={S.navLogo} onClick={() => navigate("library")}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill={t.green}/><path d="M7 12h10M12 7v10" stroke="#000" strokeWidth="2.5" strokeLinecap="round"/></svg>
                  <div><div style={S.navTitle}>Intake Breathing</div><div style={S.navSub}>{NAV_SUB_LABELS.ugcArmy}</div></div>
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
              <div style={S.navLogo} onClick={() => navigate("home")}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill={t.green}/><path d="M7 12h10M12 7v10" stroke="#000" strokeWidth="2.5" strokeLinecap="round"/></svg>
                <div><div style={S.navTitle}>Intake Breathing</div><div style={S.navSub}>{navSubText}</div></div>
              </div>
              <div style={S.navLinks}>
                {section !== "dashboard" && (
                  <button type="button" style={dashBtn} onClick={() => navigate("home")}>← Dashboard</button>
                )}
                {section === "ugcArmy" && (
                  <>
                    <button type="button" style={S.navBtn(view === "create")} onClick={() => { navigate("create"); setFormKey((k) => k + 1); }}>New Brief</button>
                    <button type="button" style={S.navBtn(view === "creators" || view === "creatorDetail")} onClick={() => navigate("creators")}>Creators</button>
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
                <button type="button" onClick={() => setIsDark(!isDark)} style={S.themeToggle} title={isDark ? "Switch to light" : "Switch to dark"}>
                  <div style={S.themeKnob(isDark)} />
                </button>
              </div>
            </div>
          );
        })()}

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

        {/* HOME — premium dashboard (managers only; creators use library) */}
        {!aiLoading && isCreatorViewAllowed && view === "home" && (() => {
          const hour = new Date().getHours();
          const greetingWord = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
          const greetingLine =
            library.length > 0 && mostUsedManagerName ? `${greetingWord}, ${mostUsedManagerName}` : greetingWord;
          const hoverLiftShadow = t.isLight
            ? "0 12px 40px rgba(0,140,86,0.1), 0 4px 12px rgba(0,0,0,0.08)"
            : "0 12px 40px rgba(0,254,169,0.08), 0 4px 12px rgba(0,0,0,0.3)";
          const statPill = {
            background: t.card,
            border: `1px solid ${t.border}`,
            borderRadius: 20,
            padding: "4px 14px",
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            gap: 6,
          };
          const cardBase = (id) => ({
            position: "relative",
            borderRadius: 20,
            padding: 0,
            overflow: "hidden",
            cursor: "pointer",
            border: `1px solid ${dashCardHover === id ? t.green + "40" : t.border}`,
            background: t.card,
            minHeight: 200,
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            transform: dashCardHover === id ? "translateY(-4px)" : "translateY(0)",
            boxShadow: dashCardHover === id ? hoverLiftShadow : t.shadow,
          });
          return (
            <div style={{ position: "relative", zIndex: 1, animation: "fadeIn 0.3s ease", maxWidth: 960, margin: "0 auto", padding: "32px 24px 60px" }}>
              <div
                aria-hidden
                style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  pointerEvents: "none",
                  zIndex: 0,
                  opacity: 0.015,
                  background: `radial-gradient(circle at 1px 1px, ${t.textFaint} 1px, transparent 0)`,
                  backgroundSize: "40px 40px",
                }}
              />
              <div style={{ position: "relative", zIndex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 20,
                    marginBottom: 28,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: t.text, letterSpacing: "-0.02em", marginBottom: 6 }}>
                      {greetingLine}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        fontWeight: 600,
                        color: t.textFaint,
                      }}
                    >
                      Intake Breathing — Creator Partnerships
                    </div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "flex-end" }}>
                    <div style={statPill}>
                      <span style={{ fontWeight: 800, color: t.green }}>{library.length}</span>
                      <span style={{ fontWeight: 500, color: t.textMuted }}>Briefs</span>
                    </div>
                    <div style={statPill}>
                      <span style={{ fontWeight: 800, color: t.green }}>{activeCreatorCount}</span>
                      <span style={{ fontWeight: 500, color: t.textMuted }}>Creators</span>
                    </div>
                    <div style={statPill}>
                      <span style={{ fontWeight: 800, color: t.green }}>{activeVideosTotal}</span>
                      <span style={{ fontWeight: 500, color: t.textMuted }}>Videos</span>
                    </div>
                    <div style={{ ...statPill, opacity: 0.75 }}>
                      <span style={{ fontWeight: 600, color: t.textFaint, fontSize: 11 }}>v{APP_VERSION}</span>
                    </div>
                  </div>
                </div>

                <div className="home-dashboard-grid">
                  {/* UGC Army */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => { navigate("create"); setFormKey((k) => k + 1); }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("create"); setFormKey((k) => k + 1); } }}
                    onMouseEnter={() => setDashCardHover("ugc")}
                    onMouseLeave={() => setDashCardHover(null)}
                    style={cardBase("ugc")}
                  >
                    <div style={{ height: 3, background: "linear-gradient(135deg, #00FEA9, #63B7BA)", width: "100%" }} />
                    <div style={{ padding: 28, position: "relative", zIndex: 1 }}>
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 14,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "linear-gradient(135deg, rgba(0,254,169,0.2), rgba(99,183,186,0.2))",
                        }}
                      >
                        <Icon name="film" size={26} color={t.green} />
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: t.text, marginTop: 16, marginBottom: 4 }}>UGC Army</div>
                      <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.5, marginBottom: 16 }}>
                        Create briefs, manage creators, and track your UGC content pipeline
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "4px 10px",
                            borderRadius: 20,
                            background: t.green + (t.isLight ? "18" : "15"),
                            color: t.green,
                            border: t.isLight ? `1px solid ${t.green}30` : "none",
                          }}
                        >
                          Active
                        </span>
                        <span style={{ fontSize: 12, color: t.textMuted, fontWeight: 500 }}>
                          {library.length} brief{library.length === 1 ? "" : "s"} · {activeCreatorCount} creator{activeCreatorCount === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>
                    <div style={{ position: "absolute", bottom: -10, right: -10, opacity: 0.04, pointerEvents: "none" }} aria-hidden>
                      <Icon name="film" size={120} color={t.text} />
                    </div>
                  </div>

                  {/* Channel Pipeline */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate("pipeline")}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("pipeline"); } }}
                    onMouseEnter={() => setDashCardHover("pipeline")}
                    onMouseLeave={() => setDashCardHover(null)}
                    style={cardBase("pipeline")}
                  >
                    <div style={{ height: 3, background: "linear-gradient(135deg, #ffaa3b, #ff6b6b)", width: "100%" }} />
                    <div style={{ padding: 28, position: "relative", zIndex: 1 }}>
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 14,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "linear-gradient(135deg, rgba(255,170,59,0.2), rgba(255,107,107,0.2))",
                        }}
                      >
                        <Icon name="send" size={26} color={t.orange} />
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: t.text, marginTop: 16, marginBottom: 4 }}>Channel Pipeline</div>
                      <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.5, marginBottom: 16 }}>
                        Track creator outreach, responses, and partnership status
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "4px 10px",
                            borderRadius: 20,
                            background: t.orange + (t.isLight ? "18" : "15"),
                            color: t.orange,
                            border: t.isLight ? `1px solid ${t.orange}30` : "none",
                            animation: "pulseGlowOrange 2.5s ease-in-out infinite",
                          }}
                        >
                          Coming Soon
                        </span>
                        <span />
                      </div>
                    </div>
                    <div style={{ position: "absolute", bottom: -10, right: -10, opacity: 0.04, pointerEvents: "none" }} aria-hidden>
                      <Icon name="send" size={120} color={t.text} />
                    </div>
                  </div>

                  {/* Influencer Buys */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate("influencer")}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("influencer"); } }}
                    onMouseEnter={() => setDashCardHover("influencer")}
                    onMouseLeave={() => setDashCardHover(null)}
                    style={cardBase("influencer")}
                  >
                    <div style={{ height: 3, background: "linear-gradient(135deg, #c084fc, #818cf8)", width: "100%" }} />
                    <div style={{ padding: 28, position: "relative", zIndex: 1 }}>
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 14,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "linear-gradient(135deg, rgba(192,132,252,0.2), rgba(129,140,248,0.2))",
                        }}
                      >
                        <Icon name="dollarSign" size={26} color={t.purple} />
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: t.text, marginTop: 16, marginBottom: 4 }}>Influencer Buys</div>
                      <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.5, marginBottom: 16 }}>
                        Manage influencer campaigns, negotiate rates, and track spend
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "4px 10px",
                            borderRadius: 20,
                            background: t.purple + (t.isLight ? "18" : "15"),
                            color: t.purple,
                            border: t.isLight ? `1px solid ${t.purple}30` : "none",
                            animation: "pulseGlowPurple 2.5s ease-in-out infinite",
                          }}
                        >
                          Coming Soon
                        </span>
                        <span />
                      </div>
                    </div>
                    <div style={{ position: "absolute", bottom: -10, right: -10, opacity: 0.04, pointerEvents: "none" }} aria-hidden>
                      <Icon name="dollarSign" size={120} color={t.text} />
                    </div>
                  </div>

                  {/* Tools */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate("tools")}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("tools"); } }}
                    onMouseEnter={() => setDashCardHover("tools")}
                    onMouseLeave={() => setDashCardHover(null)}
                    style={cardBase("tools")}
                  >
                    <div style={{ height: 3, background: "linear-gradient(135deg, #63B7BA, #818cf8)", width: "100%" }} />
                    <div style={{ padding: 28, position: "relative", zIndex: 1 }}>
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 14,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "linear-gradient(135deg, rgba(99,183,186,0.2), rgba(129,140,248,0.2))",
                        }}
                      >
                        <Icon name="wrench" size={26} color={t.blue} />
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: t.text, marginTop: 16, marginBottom: 4 }}>Tools</div>
                      <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.5, marginBottom: 16 }}>
                        Video reformatter, content analytics, and team utilities
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "4px 10px",
                            borderRadius: 20,
                            background: t.blue + (t.isLight ? "18" : "15"),
                            color: t.blue,
                            border: t.isLight ? `1px solid ${t.blue}30` : "none",
                          }}
                        >
                          1 tool
                        </span>
                        <span
                          role="link"
                          tabIndex={0}
                          onClick={(e) => { e.stopPropagation(); navigate("videotool"); }}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); navigate("videotool"); } }}
                          style={{ fontSize: 12, color: t.blue, fontWeight: 600, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}
                        >
                          Video Reformatter
                        </span>
                      </div>
                    </div>
                    <div style={{ position: "absolute", bottom: -10, right: -10, opacity: 0.04, pointerEvents: "none" }} aria-hidden>
                      <Icon name="wrench" size={120} color={t.text} />
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: 11, color: t.textFaint, marginTop: 40, textAlign: "center" }}>
                  Built for Intake Breathing&apos;s marketing team · v{APP_VERSION}
                </div>

                {!apiKey && (
                  <div style={{ marginTop: 28, fontSize: 13, color: t.textFaint }}>
                    Want IB-Ai-powered briefs?{" "}
                    <span onClick={() => navigate("settings")} style={{ color: t.green, cursor: "pointer", fontWeight: 600 }}>Add your API key in Settings</span>
                  </div>
                )}
                {apiKey && apiStatus === "ok" && (
                  <div style={{ marginTop: 28, fontSize: 13, color: t.green, fontWeight: 500, display: "flex", alignItems: "center", gap: 8 }}>
                    <Icon name="checkCircle" size={16} color={t.green} />
                    <span>IB-Ai connected and ready</span>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {!aiLoading && isCreatorViewAllowed && view === "pipeline" && (
          <ComingSoonPage
            title="Channel Pipeline"
            message="Channel Pipeline — Coming Soon. Track creator outreach, responses, and partnership status."
            onBack={() => navigate("home")}
          />
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
                  Your key is stored locally in this artifact's storage. It never leaves your browser and is never sent to Anthropic's servers except to authenticate your API calls.
                </div>
              )}
            </div>

            {/* ScrapeCreators API Key */}
            <div style={{ background: t.card, borderRadius: 12, border: `1px solid ${t.border}`, padding: 24, marginBottom: 20, boxShadow: t.shadow }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 4 }}>ScrapeCreators API Key</div>
              <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 16, lineHeight: 1.5 }}>
                Used for fetching TikTok and Instagram videos in the Video Reformatter. Get your key from{" "}
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
                  Stored locally as <code style={{ background: t.cardAlt, padding: "2px 6px", borderRadius: 4, fontSize: 11 }}>intake-scrape-key</code>. Sent only to ScrapeCreators when you fetch videos or test the connection.
                </div>
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

        {!aiLoading && isCreatorViewAllowed && view === "create" && <div style={{ animation: "fadeIn 0.3s ease" }}><BriefForm key={`b-${formKey}`} onGenerate={handleGenerate} /></div>}
        {!aiLoading && isCreatorViewAllowed && view === "display" && currentBrief && <div style={{ animation: "fadeIn 0.3s ease" }}><BriefDisplay brief={currentBrief} formData={currentFormData} currentRole={currentRole} onBack={() => navigate("library")} onRegenerate={handleRegenTemplate} onRegenerateAI={handleRegenAI} /></div>}

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
              </div>
            );
          };

          const renderBodyCell = (c, col) => {
            const align = col.align === "right" ? { textAlign: "right" } : {};
            const stopNav = col.editable
              ? { onClick: (e) => e.stopPropagation() }
              : {};
            const base = { ...cellBase, ...align };

            if (col.key === "status") {
              const dotBg = c.status === "Active" ? t.green : c.status === "One-time" ? t.orange : t.textFaint;
              const stLabel = c.status === "Off-boarded" ? "Off" : c.status === "One-time" ? "One-time" : "Active";
              const stColor = c.status === "Active" ? t.green : c.status === "One-time" ? t.orange : t.textFaint;
              return (
                <div key={col.key} style={{ ...base, display: "flex", alignItems: "center" }}>
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: dotBg, marginRight: 6, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: stColor, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{stLabel}</span>
                </div>
              );
            }
            if (col.key === "handle") {
              const hDisp = fmtHandle(c.handle);
              return (
                <div key={col.key} style={base} title={hDisp}>
                  <span style={{ fontWeight: 600, color: t.text }}>{hDisp}</span>
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
                        updateCreator(c.id, { niche: e.target.value });
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
            if (col.key === "email") {
              const em = (c.email || "").trim();
              const isEditing = editingCell?.creatorId === c.id && editingCell?.column === "email";
              return (
                <div key={col.key} style={base} {...stopNav}>
                  {isEditing ? (
                    <input
                      autoFocus
                      defaultValue={em}
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
                        updateCreator(c.id, { email: e.target.value });
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
                  ) : em ? (
                    <a
                      href={`mailto:${em}`}
                      onClick={(e) => e.stopPropagation()}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setEditingCell({ creatorId: c.id, column: "email" });
                      }}
                      style={{ color: t.blue, textDecoration: "none", fontSize: 12 }}
                      onMouseEnter={(e) => { e.currentTarget.style.textDecoration = "underline"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.textDecoration = "none"; }}
                      title={em}
                    >
                      {em}
                    </a>
                  ) : (
                    <span
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setEditingCell({ creatorId: c.id, column: "email" });
                      }}
                      title="Double-click to edit"
                      style={{ color: t.textFaint }}
                    >
                      —
                    </span>
                  )}
                </div>
              );
            }
            if (col.key === "tt") {
              const ttUrl = ((c.tiktokUrl || "").trim() || tiktokUrlFromHandle(c.handle)).trim();
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
              const igUrl = (c.instagramUrl || "").trim();
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
                        updateCreator(c.id, { costPerVideo: e.target.value });
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
                      style={{ fontSize: 11, color: t.textFaint }}
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
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <input
                type="text"
                value={creatorSearch}
                onChange={(e) => setCreatorSearch(e.target.value)}
                placeholder="Search creators..."
                style={{ flex: 1, maxWidth: 300, height: 34, padding: "0 12px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 13, boxSizing: "border-box" }}
              />
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
              <div style={{ flex: 1 }} />
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
                    const done = addEnrichStepState.completed.includes(step.id);
                    const active = addEnrichStepState.current === step.id;
                    return (
                      <div key={step.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, fontSize: 13, color: done ? t.green : active ? t.text : t.textFaint }}>
                        <span style={{ width: 18, textAlign: "center" }}>{done ? "✓" : active ? "…" : "○"}</span>
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
              <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 10 }}>
                Enriching {bulkEnrichProgress.cur} of {bulkEnrichProgress.total} — {bulkEnrichProgress.handle}
                {bulkEnrichProgress.line ? ` (${bulkEnrichProgress.line})` : ""}
                {bulkEnrichProgress.skipped != null ? ` · skipped ${bulkEnrichProgress.skipped} (< 24h)` : ""}
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
              <div style={{ minWidth: 1100 }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: CREATOR_GRID_TEMPLATE,
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
                      gridTemplateColumns: CREATOR_GRID_TEMPLATE,
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
                  sortedCreators.map((c, rowIdx) => (
                    <div
                      key={c.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate("creatorDetail", { creatorId: c.id })}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("creatorDetail", { creatorId: c.id }); } }}
                      style={{
                        display: "grid",
                        gridTemplateColumns: CREATOR_GRID_TEMPLATE,
                        padding: 0,
                        borderBottom: `1px solid ${t.border}30`,
                        cursor: "pointer",
                        transition: "background 0.1s",
                        background: rowIdx % 2 === 1 ? t.cardAlt + "30" : "transparent",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = t.cardAlt + "80";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = rowIdx % 2 === 1 ? t.cardAlt + "30" : "transparent";
                      }}
                    >
                      {CREATOR_COLUMNS.map((col) => renderBodyCell(c, col))}
                    </div>
                  ))
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
            />
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
                {currentRole !== ROLES.CREATOR && <button style={S.btnP} onClick={()=>navigate("create")}>Create Your First Brief</button>}
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
      </div>
    </ThemeContext.Provider>
  );
}
