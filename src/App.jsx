import { useState, useRef, useCallback, useEffect, useMemo, memo, createContext, useContext } from "react";

// ═══ UPDATE THIS WITH EVERY PUSH ═══
// Add new version at the TOP of this array
// Bump APP_VERSION to match
// Format: { version: "X.Y.Z", date: "YYYY-MM-DD", changes: ["what changed"] }
const APP_VERSION = "2.0.1";
const CHANGELOG = [
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

/** Read at call time so Settings saves apply without reload */
function getScrapeCreatorsKey() {
  try {
    return localStorage.getItem("intake-scrape-key") || "";
  } catch {
    return "";
  }
}

function extractTikTokVideo(data) {
  const ad = data?.aweme_detail;
  if (!ad) return null;
  const v = ad.video;
  const w = v?.width;
  const h = v?.height;
  let playUrl = v?.play_addr?.url_list?.[0] || null;
  if (!playUrl && Array.isArray(v?.bit_rate) && v.bit_rate[0]?.play_addr?.url_list?.[0]) {
    playUrl = v.bit_rate[0].play_addr.url_list[0];
  }
  const thumb =
    v?.cover?.url_list?.[0] ||
    v?.origin_cover?.url_list?.[0] ||
    v?.dynamic_cover?.url_list?.[0] ||
    null;
  const desc = ad.desc || "";
  const author = ad.author?.nickname || ad.author?.unique_id || "—";
  const st = ad.statistics || {};
  return {
    source: "tiktok",
    videoUrl: playUrl,
    thumbUrl: thumb,
    caption: desc,
    author,
    width: w,
    height: h,
    stats: {
      play: st.play_count,
      like: st.digg_count,
      share: st.share_count,
      comment: st.comment_count,
    },
  };
}

function extractInstagramVideo(data) {
  const media = data?.graphql?.shortcode_media || data?.items?.[0] || data;
  let videoUrl =
    data?.video_url ||
    media?.video_url ||
    media?.video_versions?.[0]?.url ||
    data?.graphql?.shortcode_media?.video_url;
  if (!videoUrl && Array.isArray(media?.video_versions)) {
    const sorted = [...media.video_versions].sort((a, b) => (b.width || 0) - (a.width || 0));
    videoUrl = sorted[0]?.url;
  }
  const thumb =
    data?.thumbnail_url ||
    data?.display_url ||
    media?.display_url ||
    media?.image_versions2?.candidates?.[0]?.url ||
    data?.graphql?.shortcode_media?.display_url;
  const caption =
    (typeof data?.caption === "string" ? data.caption : data?.caption?.text) ||
    media?.edge_media_to_caption?.edges?.[0]?.node?.text ||
    "";
  const author =
    data?.owner?.username ||
    media?.owner?.username ||
    data?.user?.username ||
    data?.graphql?.shortcode_media?.owner?.username ||
    "—";
  const w = data?.dimensions?.width || media?.dimensions?.width || data?.graphql?.shortcode_media?.dimensions?.width;
  const h = data?.dimensions?.height || media?.dimensions?.height || data?.graphql?.shortcode_media?.dimensions?.height;
  return {
    source: "instagram",
    videoUrl: videoUrl || null,
    thumbUrl: thumb || null,
    caption,
    author,
    width: w,
    height: h,
    stats: {
      play: data?.video_view_count ?? media?.video_view_count,
      like: data?.like_count ?? media?.edge_media_preview_like?.count,
      comment: data?.comment_count ?? media?.edge_media_to_comment?.count,
      share: data?.share_count,
    },
  };
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

const DEFAULTS = {
  manager: "Summer", customManager: "", contentQuantity: "1",
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
  const deliverables = `Submitted by: ${mgr}. Content requested: ${qty} videos. Submit for: ${platformsArr.map(platLabel).join(", ")}. (1) Final video — vertical 9:16, 1080×1920 min, ${d.videoLength}. (2) Raw footage. (3) One thumbnail still. Upload via creator portal.`;
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
    onGenerate({
      mode,
      manager: managerSel,
      customManager: (v.customManager || "").trim(),
      contentQuantity: qtyStr,
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
  }, [onGenerate, ageRange, gender, selectedStats, selectedPlatforms, selectedApproved, selectedBanned, managerSel, contentQty]);
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
        <div style={S.secLabel}>👤 Brief Details</div>
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
                          {sel ? <span style={{ fontSize: 10, fontWeight: 800, color: t.isLight ? "#fff" : "#000" }}>✓</span> : null}
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
                          <span style={{ fontSize: 10, fontWeight: 800, color: t.isLight ? "#fff" : "#000" }}>✓</span>
                        </span>
                        <span>{p}</span>
                      </div>
                  ))}
              </div>
            )}
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
        <div style={S.secLabel}>🎯 Product & Campaign</div>
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
        <div style={S.secLabel}>👤 Audience & Problem</div>
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
        <div style={S.secLabel}>📊 Proof Points {statsLoading ? <span style={{ fontSize: 11, color: t.orange, fontWeight: 500, marginLeft: 4 }}>— IB-Ai selecting...</span> : <span style={{ fontSize: 11, color: t.textFaint, fontWeight: 500, marginLeft: 4 }}>— auto-selected by IB-Ai, tap to adjust</span>}</div>
        <div>
          {STAT_CATEGORY_ORDER.filter(c => STAT_OPTIONS.some(s => s.category === c)).map((cat, catIdx) => {
            const items = STAT_OPTIONS.filter(s => s.category === cat);
            return (
              <div key={cat}>
                <div style={{ fontSize: 11, fontWeight: 600, color: t.textFaint, textTransform: "uppercase", letterSpacing: "0.05em", marginTop: catIdx === 0 ? 0 : 12, marginBottom: 6 }}>{STAT_CATEGORY_LABELS[cat]}</div>
                <div style={S.chipGrid}>
                  {items.map(st => <div key={st.id} style={S.chip(selectedStats.includes(st.id))} onClick={()=>toggleStat(st.id)}>{selectedStats.includes(st.id) ? "✓ " : ""}{st.label}</div>)}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ ...S.hint, marginTop: 10 }}>Selected stats become proof point cards. Use disclosure when citing SleepScore stats.</div>
      </div>
      <div style={S.section}>
        <div style={S.secLabel}>
          ⚖️ Compliance
          {complianceLoading ? <span style={{ fontSize: 11, color: t.orange, fontWeight: 500, marginLeft: 4 }}>— IB-Ai updating...</span> : <span style={{ fontSize: 11, color: t.textFaint, fontWeight: 500, marginLeft: 4 }}>— auto-selected by IB-Ai, edit as needed</span>}
        </div>
        <div style={S.cols2}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: t.green, marginBottom: 8 }}>✅ Approved Claims</div>
            {selectedApproved.map((c, i) => (
              <div key={`a-${i}-${c.slice(0, 24)}`} style={{ background: t.card, borderRadius: 8, padding: "8px 12px", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center", border: `1px solid ${t.green}20` }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 6, flex: 1, minWidth: 0 }}><span style={{ color: t.green, fontWeight: 700, flexShrink: 0 }}>✓</span><span style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.5 }}>{c}</span></div>
                <button type="button" onClick={() => setSelectedApproved((prev) => prev.filter((_, idx) => idx !== i))} style={{ flexShrink: 0, marginLeft: 8, border: "none", background: "transparent", color: t.textFaint, cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 4px" }} title="Remove">✕</button>
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
            <div style={{ fontSize: 12, fontWeight: 700, color: t.red, marginBottom: 8 }}>❌ Banned Claims</div>
            {selectedBanned.map((c, i) => (
              <div key={`b-${i}-${c.slice(0, 24)}`} style={{ background: t.card, borderRadius: 8, padding: "8px 12px", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center", border: `1px solid ${t.red}20` }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 6, flex: 1, minWidth: 0 }}><span style={{ color: t.red, fontWeight: 700, flexShrink: 0 }}>✗</span><span style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.5 }}>{c}</span></div>
                <button type="button" onClick={() => setSelectedBanned((prev) => prev.filter((_, idx) => idx !== i))} style={{ flexShrink: 0, marginLeft: 8, border: "none", background: "transparent", color: t.textFaint, cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 4px" }} title="Remove">✕</button>
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
        <div style={S.secLabel}>⚠️ Revision Criteria</div>
        <div style={{ ...S.hint, marginBottom: 12, fontStyle: "normal" }}>Revisions will be needed if any of the following are present. Add custom rules below.</div>
        <div style={S.roBox}>{DEFAULT_REJECTIONS.map((c, i) => (
          <div key={i} style={S.roItem()}><span style={S.roMarker(t.orange)}>✗</span>{c}</div>
        ))}</div>
        <div style={{ ...S.fg, marginTop: 14 }}>
          <label style={S.label}>Additional Revision Rules</label>
          <textarea style={S.textarea} defaultValue={vals.current.customRejections} onChange={e => { vals.current.customRejections = e.target.value; }} onFocus={e => { e.target.style.borderColor = t.orange; }} onBlur={e => { e.target.style.borderColor = t.border; }} placeholder="Add any campaign-specific revision criteria — one per line" rows={4} />
        </div>
      </div>
      <div style={S.section}>
        <div style={S.secLabel}>🎬 Format & Tone</div>
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
        <div style={S.secLabel}>📝 Creative Direction</div>
        <div style={S.fg}><label style={S.label}>Notes for Creators</label>
          <textarea style={{ ...S.textarea, minHeight: 120 }} defaultValue={vals.current.notes} onChange={e=>{vals.current.notes=e.target.value}} onFocus={e=>{e.target.style.borderColor=t.green}} onBlur={e=>{e.target.style.borderColor=t.border}} placeholder="Format instructions, hook ideas, visual direction…" rows={5} />
          <div style={S.hint}>Main free-text field. Everything else is from the Intake playbook.</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
        <button style={{ ...S.genBtn, flex: 1, marginTop: 0 }} onClick={() => go("ai")}>✦ IB-Ai</button>
        <button style={{ ...S.genBtn, flex: 1, marginTop: 0, background: t.border, color: t.text, fontWeight: 700, fontSize: 14 }} onClick={() => go("template")}>⚡ Instant Draft</button>
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
        <span style={{ color: t.orange, fontWeight: 700, flexShrink: 0, fontSize: 14 }}>✕</span>
        <div style={{ fontSize: 14, color: t.text, lineHeight: 1.7, flex: 1, minWidth: 0 }}>{value}</div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
      <span style={{ color: t.orange, fontWeight: 700, flexShrink: 0, fontSize: 14 }}>✕</span>
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
  const theyAreHtml = (b.theyAre || []).map((x) => `<div class="col-item"><span class="dot green">✓</span>${escSafe(x)}</div>`).join("");
  const theyNotHtml = (b.theyAreNot || []).map((x) => `<div class="col-item"><span class="dot red">✗</span>${escSafe(x)}</div>`).join("");
  const beatDefs = [
    { label: "PROBLEM", cls: "problem", inst: b.probInst, lines: b.probLines || [], overlays: b.probOverlays || [] },
    { label: "AGITATE", cls: "agitate", inst: b.agInst, lines: b.agLines || [], overlays: b.agOverlays || [] },
    { label: "SOLUTION", cls: "solution", inst: b.solInst, lines: b.solLines || [], overlays: b.solOverlays || [] },
  ];
  const beatsHtml = beatDefs
    .map((bt) => {
      const lines = (bt.lines || []).map((l) => `<div class="riff">"${escSafe(l)}"</div>`).join("");
      const ovs = (bt.overlays || []).map((o) => `<div class="riff">${escSafe(o)}</div>`).join("");
      return (
        `<div class="beat ${bt.cls}">` +
        `<div class="beat-label">${bt.label}</div>` +
        `<div class="beat-inst">${escSafe(bt.inst)}</div>` +
        `<div class="beat-sub">Lines to riff on</div>` +
        lines +
        `<div class="beat-sub">Overlay ideas</div>` +
        ovs +
        `</div>`
      );
    })
    .join("");
  const hooksHtml = (b.hooks || [])
    .map((h, i) => `<div class="hook"><div class="hook-num">${i + 1}</div><div class="hook-text">${escSafe(h)}</div></div>`)
    .join("");
  const sayHtml = (b.sayThis || []).map((s) => `<div class="compliance-item"><span class="mark">✓</span>${escSafe(s)}</div>`).join("");
  const notHtml = (b.notThis || []).map((s) => `<div class="compliance-item"><span class="mark">✗</span>${escSafe(s)}</div>`).join("");
  const rejList = Array.isArray(b.rejections) && b.rejections.length ? b.rejections : buildRejectionsArray(fd);
  const rejHtml = rejList.map((r) => `<div class="rejection-item"><span class="rx">✕</span>${escSafe(r)}</div>`).join("");
  const proofHtml = (b.proof || []).map((p) => `<div class="proof-card">${escSafe(p)}</div>`).join("");
  const platNotesHtml = escSafe(b.platNotes || "").replace(/\n/g, "<br>");
  const deliverablesHtml = escSafe(b.deliverables || "").replace(/\n/g, "<br>");
  const disclosureHtml = escSafe(b.disclosure || "").replace(/\n/g, "<br>");
  const mgrLine = escSafe(managerDisplayName(fd));
  const qtyLine = escSafe(String(fd.contentQuantity ?? "—"));
  const genDate = escSafe(new Date().toLocaleDateString());

  return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  @page { margin: 0.6in; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Inter', Helvetica, Arial, sans-serif;
    color: #222;
    font-size: 13px;
    line-height: 1.7;
    max-width: 720px;
    margin: 0 auto;
    padding: 48px 48px 24px;
    background: #fff;
  }

  /* Header */
  .doc-header { text-align: center; padding-bottom: 24px; margin-bottom: 8px; border-bottom: 2px solid #111; }
  .doc-brand { font-size: 10px; font-weight: 700; letter-spacing: 0.15em; color: #999; text-transform: uppercase; margin-bottom: 12px; }
  .doc-title { font-size: 28px; font-weight: 800; letter-spacing: -0.02em; color: #111; margin-bottom: 4px; }
  .doc-mission { font-size: 14px; color: #555; font-style: italic; margin-bottom: 16px; }
  .doc-meta { display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; }
  .doc-tag { padding: 3px 10px; border-radius: 4px; font-size: 10px; font-weight: 600; background: #f0f0f0; color: #555; text-transform: uppercase; letter-spacing: 0.05em; }
  .doc-manager { font-size: 11px; color: #888; margin-top: 12px; }

  /* Section headers */
  .section-title {
    font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;
    color: #888; border-bottom: 1px solid #e0e0e0; padding-bottom: 6px;
    margin-top: 36px; margin-bottom: 16px;
  }

  /* Persona card */
  .persona-card { background: #f8f8f8; border: 1px solid #e5e5e5; border-radius: 8px; padding: 20px; }
  .persona-name { font-size: 18px; font-weight: 700; color: #111; margin-bottom: 2px; }
  .persona-age { font-size: 12px; font-weight: 600; color: #4a9a9d; margin-bottom: 10px; }
  .persona-psycho { font-size: 13px; color: #444; line-height: 1.7; margin-bottom: 16px; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .col-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; }
  .col-title.green { color: #1a7a4e; }
  .col-title.red { color: #b71c1c; }
  .col-item { font-size: 12px; color: #333; line-height: 1.8; }
  .col-item .dot { font-weight: 700; margin-right: 6px; }
  .col-item .dot.green { color: #1a7a4e; }
  .col-item .dot.red { color: #b71c1c; }

  /* Story beats */
  .beat { padding: 16px 20px; margin-bottom: 12px; background: #fafafa; border: 1px solid #e5e5e5; border-left: 4px solid #ccc; border-radius: 0 8px 8px 0; }
  .beat.problem { border-left-color: #c62828; }
  .beat.agitate { border-left-color: #e67e00; }
  .beat.solution { border-left-color: #1a7a4e; }
  .beat-label { font-size: 10px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 8px; }
  .beat.problem .beat-label { color: #c62828; }
  .beat.agitate .beat-label { color: #e67e00; }
  .beat.solution .beat-label { color: #1a7a4e; }
  .beat-inst { font-size: 13px; color: #333; line-height: 1.7; margin-bottom: 12px; }
  .beat-sub { font-size: 9px; font-weight: 700; color: #aaa; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px; margin-top: 10px; }
  .riff { font-size: 12px; color: #444; line-height: 1.7; padding-left: 12px; border-left: 2px solid #ddd; margin-bottom: 3px; }

  /* Hooks */
  .hook { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 10px; }
  .hook-num { min-width: 22px; height: 22px; border-radius: 6px; background: #fff3e0; color: #e67e00; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; border: 1px solid #ffe0b2; }
  .hook-text { font-size: 13px; color: #333; line-height: 1.6; padding-top: 2px; }
  .hook-hint { font-size: 11px; color: #aaa; font-style: italic; margin-bottom: 12px; }

  /* Say / Don't columns */
  .compliance-col { border: 1px solid #e5e5e5; border-radius: 8px; padding: 16px; }
  .compliance-col.approve { border-left: 3px solid #1a7a4e; }
  .compliance-col.ban { border-left: 3px solid #c62828; }
  .compliance-header { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 10px; }
  .compliance-col.approve .compliance-header { color: #1a7a4e; }
  .compliance-col.ban .compliance-header { color: #c62828; }
  .compliance-item { font-size: 12px; color: #333; line-height: 1.8; }
  .compliance-item .mark { font-weight: 700; margin-right: 6px; }
  .compliance-col.approve .mark { color: #1a7a4e; }
  .compliance-col.ban .mark { color: #c62828; }

  /* Revision-required box */
  .rejection-box { border: 1.5px solid #e67e00; border-radius: 8px; padding: 20px; margin-top: 8px; }
  .rejection-header { font-size: 11px; font-weight: 800; color: #b86e00; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px; }
  .rejection-warning { font-size: 12px; color: #b86e00; font-weight: 500; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid #ffe0b2; }
  .rejection-item { font-size: 13px; color: #333; line-height: 1.8; margin-bottom: 4px; }
  .rejection-item .rx { color: #e67e00; font-weight: 700; margin-right: 8px; }

  /* Proof grid */
  .proof-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .proof-card { background: #f8f8f8; border: 1px solid #e5e5e5; border-left: 3px solid #4a9a9d; border-radius: 6px; padding: 12px 14px; font-size: 12px; color: #333; line-height: 1.6; }

  /* Platform & Deliverables */
  .info-box { background: #f8f8f8; border: 1px solid #e5e5e5; border-radius: 8px; padding: 16px 20px; font-size: 13px; color: #333; line-height: 1.7; white-space: pre-line; }

  /* Footer */
  .doc-footer { text-align: center; margin-top: 48px; padding-top: 16px; border-top: 1px solid #e0e0e0; font-size: 9px; color: #bbb; text-transform: uppercase; letter-spacing: 0.1em; }

  /* Page breaks */
  .page-break { page-break-before: always; }

  @media print {
    body { padding: 24px 0; }
    .no-print { display: none; }
  }
</style>
</head><body>

<!-- HEADER -->
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
    Videos requested: ${qtyLine} ·
    Generated: ${genDate}
  </div>
</div>

<!-- PERSONA -->
<div class="section-title">Who You're Talking To</div>
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

<!-- STORY ARC — new page -->
<div class="section-title page-break">Story Arc — Problem · Agitate · Solution</div>
${beatsHtml}

<!-- HOOKS -->
<div class="section-title">Hook Options — First 3 Seconds</div>
<div class="hook-hint">If they don't feel it here, they scroll.</div>
${hooksHtml}

<!-- SAY / DON'T — new page -->
<div class="section-title page-break">Say This / Not This</div>
<div class="two-col">
  <div class="compliance-col approve">
    <div class="compliance-header">✓ Say This</div>
    ${sayHtml}
  </div>
  <div class="compliance-col ban">
    <div class="compliance-header">✗ Not This</div>
    ${notHtml}
  </div>
</div>

<!-- REVISION CRITERIA -->
<div class="section-title">Revision Required — Revisions Will Be Needed</div>
<div class="rejection-box">
  <div class="rejection-warning">If any of the following are present in your submission, revisions will be required before approval.</div>
  ${rejHtml}
</div>

<!-- PROOF POINTS -->
<div class="section-title">Proof Points</div>
<div class="proof-grid">
  ${proofHtml}
</div>

<!-- REQUIRED DISCLOSURE -->
<div class="section-title">Required Disclosure</div>
<div class="info-box">${disclosureHtml}</div>

<!-- PLATFORM NOTES -->
<div class="section-title">Platform Notes</div>
<div class="info-box">${platNotesHtml}</div>

<!-- DELIVERABLES -->
<div class="section-title">Deliverables</div>
<div class="info-box">${deliverablesHtml}</div>

<!-- FOOTER -->
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
      <div style={S.bSecTitle}>⚠️ REVISION REQUIRED — Revisions Will Be Needed If:</div>
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
        {isManager && <>
          <button type="button" onClick={onRegenerateAI} style={{ ...S.btnS, fontSize: 13, padding: "9px 18px", borderColor: t.green+"50", color: t.green }}>✦ IB-Ai Regenerate</button>
          <button type="button" onClick={onRegenerate} style={{ ...S.btnS, fontSize: 13, padding: "9px 18px" }}>⚡ Quick Regen</button>
          <button type="button" onClick={downloadPDF} style={{ ...S.btnS, fontSize: 13, padding: "9px 18px", borderColor: t.blue + "55", color: t.blue }}>Download PDF</button>
          <button type="button" onClick={copyShareLink} style={{ ...S.btnS, fontSize: 13, padding: "9px 18px", borderColor: t.border, color: t.textMuted }}>Copy Share Link</button>
        </>}
      </div>
      <div style={{ marginBottom: 24 }}>
        <span style={{ ...S.badge(wasAI ? t.green : t.textFaint), fontSize: 11 }}>{wasAI ? "✦ IB-Ai" : "⚡ Template Draft"}</span>
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
          <div>Submitted by: {managerDisplayName(fd)}</div>
          <div>Videos requested: {fd.contentQuantity ?? "1"}</div>
        </div>
        {isManager && <div style={{ fontSize: 12, color: t.textFaint, marginTop: 14, fontStyle: "italic" }}>Click any text to edit</div>}
      </div>
      <div style={S.bSec}>
        <div style={S.bSecTitle}>👤 Who You're Talking To</div>
        <div style={S.card}>
          <EditableField editable={isManager} value={b.persona} style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, color: t.text }} t={t} />
          <EditableField editable={isManager} value={b.age} style={{ fontSize: 13, color: t.blue, fontWeight: 600, marginBottom: 10 }} t={t} />
          <EditableField editable={isManager} value={b.psycho} style={{ fontSize: 14, color: t.textMuted, lineHeight: 1.6, marginBottom: 16 }} t={t} />
          <div style={S.cols2}>
            <div><div style={S.sayH(t.green)}>They Are ✓</div>{b.theyAre.map((x,i)=><div key={i} style={{ ...S.li, display: "flex", alignItems: "flex-start", gap: 6 }}><span style={S.mk(t.green)}>✓</span><EditableField editable={isManager} value={x} style={{ flex: 1, fontSize: 13, color: t.textSecondary, lineHeight: 1.7, minWidth: 0 }} t={t} /></div>)}</div>
            <div><div style={S.sayH(t.red)}>They Are Not ✗</div>{b.theyAreNot.map((x,i)=><div key={i} style={{ ...S.li, display: "flex", alignItems: "flex-start", gap: 6 }}><span style={S.mk(t.red)}>✗</span><EditableField editable={isManager} value={x} style={{ flex: 1, fontSize: 13, color: t.textSecondary, lineHeight: 1.7, minWidth: 0 }} t={t} /></div>)}</div>
          </div>
        </div>
      </div>
      <div style={S.bSec}>
        <div style={S.bSecTitle}>🎬 Story Arc — Problem · Agitate · Solution</div>
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
        <div style={S.bSecTitle}>🪝 Hook Options — First 3 Seconds</div>
        <div style={{ fontSize: 12, color: t.textFaint, fontStyle: "italic", marginBottom: 14 }}>If they don't feel it here, they scroll.</div>
        <div style={S.card}>{b.hooks.map((h,i)=>(<div key={i} style={S.hookItem}><div style={S.hookNum}>{i+1}</div><EditableField editable={isManager} value={h} style={S.hookText} t={t} /></div>))}</div>
      </div>
      <div style={S.bSec}>
        <div style={S.bSecTitle}>✅ Say This / 🚫 Not This</div>
        <div style={S.cols2}>
          <div style={S.sayCol}><div style={S.sayH(t.green)}>✅ Say This</div>{b.sayThis.map((s,i)=><div key={i} style={{ ...S.li, display: "flex", alignItems: "flex-start", gap: 6 }}><span style={S.mk(t.green)}>✓</span><EditableField editable={isManager} value={s} style={{ flex: 1, fontSize: 13, color: t.textSecondary, lineHeight: 1.7, minWidth: 0 }} t={t} /></div>)}</div>
          <div style={S.dontCol}><div style={S.sayH(t.red)}>🚫 Not This</div>{b.notThis.map((s,i)=><div key={i} style={{ ...S.li, display: "flex", alignItems: "flex-start", gap: 6 }}><span style={S.mk(t.red)}>✗</span><EditableField editable={isManager} value={s} style={{ flex: 1, fontSize: 13, color: t.textSecondary, lineHeight: 1.7, minWidth: 0 }} t={t} /></div>)}</div>
        </div>
      </div>
      <RejectionSection brief={b} formData={fd} t={t} S={S} editable={isManager} />
      <div style={S.bSec}>
        <div style={S.bSecTitle}>📊 Proof Points</div>
        <div style={S.proofGrid}>{b.proof.map((p,i)=><div key={i} style={S.proofCard}><EditableField editable={isManager} value={p} style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.5, width: "100%" }} t={t} /></div>)}</div>
      </div>
      <div style={S.bSec}>
        <div style={S.bSecTitle}>⚠️ Required Disclosure — Non-Negotiable</div>
        <div style={S.discBox}><div style={S.discLabel}>Must appear when any stat is referenced</div><EditableField editable={isManager} value={b.disclosure} style={S.discText} t={t} /></div>
      </div>
      <div style={S.bSec}>
        <div style={S.bSecTitle}>📱 Platform Notes</div>
        <div style={S.card}><EditableField editable={isManager} value={b.platNotes} style={{ fontSize: 14, color: t.textSecondary, lineHeight: 1.6, whiteSpace: "pre-wrap" }} t={t} /></div>
      </div>
      <div style={S.bSec}>
        <div style={S.bSecTitle}>📦 Deliverables</div>
        <div style={S.card}><EditableField editable={isManager} value={b.deliverables} style={{ fontSize: 14, color: t.textSecondary, lineHeight: 1.6 }} t={t} /></div>
      </div>
      <div style={S.bSec}>
        <div style={S.bSecTitle}>📤 Creator Submissions</div>
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
  return `You are an expert UGC (user-generated content) brief writer for Intake Breathing, a magnetic nasal dilator company. Write a complete creator brief. Be specific, creative, and tailored to this exact campaign — not generic.

PRODUCT: ${productResolved} by Intake Breathing
CAMPAIGN NAME: ${d.campaignName || "Untitled"}
CAMPAIGN VIBE: ${vibeResolved}
MISSION: ${d.mission || "N/A"}
SUBMITTED BY: ${mgrName}
CONTENT QUANTITY: ${qtyVideos} videos needed
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
        <div style={{ fontSize: 40, marginBottom: 16 }}>🚧</div>
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
        <div style={{ fontSize: 32, marginBottom: 12 }}>🎥</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: t.text, marginBottom: 4 }}>Video Reformatter</div>
        <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.55 }}>
          Paste a TikTok or Instagram URL — fetch the video and see reformat options for Meta, YouTube, and TikTok ads
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
  const [fetched, setFetched] = useState(null);
  const [objectUrl, setObjectUrl] = useState(null);
  const [fileDims, setFileDims] = useState(null);
  const [remoteDims, setRemoteDims] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [dragOver, setDragOver] = useState(false);
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
    setFetched(null);
    setRemoteDims(null);
    setFetchError(null);
  };

  const toggleFormat = (id) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const handleFetch = async () => {
    const key = getScrapeCreatorsKey();
    if (!key) {
      setFetchError("Add your ScrapeCreators API key in Settings");
      setFetched(null);
      return;
    }
    const url = urlInput.trim();
    if (!url) {
      setFetchError("Paste a video URL first.");
      return;
    }
    const isTikTok = /tiktok\.com/i.test(url);
    const isIg = /instagram\.com/i.test(url);
    if (!isTikTok && !isIg) {
      setFetchError("URL must be a TikTok or Instagram link.");
      return;
    }
    setFetchError(null);
    setFetched(null);
    setRemoteDims(null);
    setFetchLoading(true);
    try {
      const endpoint = isTikTok
        ? `https://api.scrapecreators.com/v2/tiktok/video?url=${encodeURIComponent(url)}`
        : `https://api.scrapecreators.com/v1/instagram/post?url=${encodeURIComponent(url)}`;
      const res = await fetch(endpoint, { headers: { "x-api-key": key } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFetchError(data?.message || data?.error || `Request failed (${res.status})`);
        return;
      }
      const parsed = isTikTok ? extractTikTokVideo(data) : extractInstagramVideo(data);
      if (!parsed || (!parsed.videoUrl && !parsed.thumbUrl)) {
        setFetchError("Could not read video from API response. The post may be private or the response format changed.");
        return;
      }
      setFetched(parsed);
      if (parsed.width && parsed.height) {
        setRemoteDims({ w: parsed.width, h: parsed.height, ar: aspectRatioLabel(parsed.width, parsed.height) });
      }
    } catch (e) {
      setFetchError(e.message || "Network error — if this persists, the API may block browser requests (CORS).");
    } finally {
      setFetchLoading(false);
    }
  };

  const renderFormatGrid = () => (
    <>
      <div style={{ fontSize: 13, fontWeight: 700, color: t.textFaint, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12, marginTop: 8 }}>
        Reformat options
      </div>
      {VIDEO_REFORMAT_GROUPS.map((group) => (
        <div key={group.title} style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.textFaint, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 10 }}>{group.title}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
            {group.items.map((item) => {
              const on = selected.has(item.id);
              return (
                <div
                  key={item.id}
                  onClick={() => toggleFormat(item.id)}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.green + "45"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = on ? t.green + "50" : t.border; }}
                  style={{
                    background: t.card,
                    border: `1px solid ${on ? t.green + "50" : t.border}`,
                    borderRadius: 12,
                    padding: 14,
                    cursor: "pointer",
                    boxShadow: t.shadow,
                    transition: "border-color 0.15s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 4,
                        border: `1px solid ${on ? t.green : t.border}`,
                        background: on ? t.green : "transparent",
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginTop: 2,
                      }}
                    >
                      {on ? <span style={{ fontSize: 11, fontWeight: 800, color: t.isLight ? "#fff" : "#000" }}>✓</span> : null}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{item.name}</div>
                      <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>
                        {item.dimensions} · {item.ratio}
                      </div>
                      <div style={{ fontSize: 11, color: t.textFaint, marginTop: 4, lineHeight: 1.4 }}>{item.placement}</div>
                      {item.recommended && (
                        <div style={{ marginTop: 8, fontSize: 10, fontWeight: 700, color: t.green }}>★ Recommended</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          alert(
            "Server-side video processing (FFmpeg) coming soon. Use the format specs above as a guide for your editor, or download the original and resize manually.",
          )
        }
        style={{ ...S.genBtn, marginTop: 8 }}
      >
        Reformat & Download
      </button>
    </>
  );

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px 80px", animation: "fadeIn 0.3s ease" }}>
      <button type="button" onClick={onBack} style={{ ...S.btnS, fontSize: 13, padding: "9px 18px", marginBottom: 20 }}>← Back to Tools</button>
      <div style={{ fontSize: 26, fontWeight: 800, color: t.text, marginBottom: 8 }}>Video Reformatter</div>
      <div style={{ fontSize: 14, color: t.textMuted, marginBottom: 24, lineHeight: 1.5 }}>
        Fetch a TikTok or Instagram video by URL, or upload a file. Pick target formats for ads and placements.
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
        <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 14 }}>Fetching video data…</div>
      )}
      {fetchError && (
        <div style={{ fontSize: 13, color: t.red, marginBottom: 14, padding: "12px 14px", background: t.red + "10", borderRadius: 8, border: `1px solid ${t.red}35` }}>
          {fetchError}
        </div>
      )}

      {fetched && (
        <div
          style={{
            background: t.card,
            border: `1px solid ${t.border}`,
            borderRadius: 16,
            padding: 20,
            marginBottom: 24,
            boxShadow: t.shadow,
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "minmax(140px, 200px) 1fr", gap: 16, alignItems: "start" }}>
            {fetched.thumbUrl ? (
              <img src={fetched.thumbUrl} alt="" style={{ width: "100%", borderRadius: 10, objectFit: "cover", aspectRatio: "9/16", background: t.cardAlt }} />
            ) : (
              <div style={{ aspectRatio: "9/16", background: t.cardAlt, borderRadius: 10 }} />
            )}
            <div>
              <div style={{ fontSize: 12, color: t.textFaint, marginBottom: 4 }}>@{fetched.author}</div>
              <div style={{ fontSize: 14, color: t.text, lineHeight: 1.5, marginBottom: 12 }}>{fetched.caption || "—"}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 12, color: t.textMuted, marginBottom: 12 }}>
                {fetched.stats?.play != null && <span>▶ {Number(fetched.stats.play).toLocaleString()} plays</span>}
                {fetched.stats?.like != null && <span>♥ {Number(fetched.stats.like).toLocaleString()}</span>}
                {fetched.stats?.share != null && <span>↗ {Number(fetched.stats.share).toLocaleString()}</span>}
                {fetched.stats?.comment != null && <span>💬 {Number(fetched.stats.comment).toLocaleString()}</span>}
              </div>
              {displayDims && (
                <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 12 }}>
                  <strong style={{ color: t.text }}>Original:</strong> {displayDims.w}×{displayDims.h}px · aspect {displayDims.ar}
                </div>
              )}
              {fetched.videoUrl && (
                <>
                  <div style={{ marginBottom: 12, borderRadius: 10, overflow: "hidden", border: `1px solid ${t.border}`, background: "#000" }}>
                    <video
                      src={fetched.videoUrl}
                      controls
                      playsInline
                      style={{ width: "100%", maxHeight: 360, display: "block" }}
                      onLoadedMetadata={(e) => {
                        const el = e.target;
                        if (el.videoWidth && el.videoHeight) {
                          setRemoteDims({ w: el.videoWidth, h: el.videoHeight, ar: aspectRatioLabel(el.videoWidth, el.videoHeight) });
                        }
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => window.open(fetched.videoUrl, "_blank", "noopener,noreferrer")}
                    style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: t.blue, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                  >
                    Download Original
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{ fontSize: 13, fontWeight: 600, color: t.textSecondary, marginBottom: 10 }}>Or upload a video file directly</div>
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

      {displayDims && renderFormatGrid()}
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
  const [view, setView] = useState("home");
  const [currentBrief, setCurrentBrief] = useState(null);
  const [currentFormData, setCurrentFormData] = useState(null);
  const [library, setLibrary] = useState([]);
  const [formKey, setFormKey] = useState(0);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [aiSteps, setAiSteps] = useState([]);
  const [storageReady, setStorageReady] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [scrapeKey, setScrapeKey] = useState("");
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

    setStorageReady(true);
  }, []);

  // ── Save library whenever it changes ──
  useEffect(() => {
    if (!storageReady) return;
    storageSet("intake-library", JSON.stringify(library));
  }, [library, storageReady]);

  // ── Save theme preference ──
  useEffect(() => {
    if (!storageReady) return;
    storageSet("intake-theme", isDark ? "dark" : "light");
  }, [isDark, storageReady]);

  const t = isDark ? THEMES.dark : THEMES.light;
  const S = getS(t);
  const ctx = { t, S };

  const saveBrief = (brief, formData) => {
    const existing = formData.shareId != null && String(formData.shareId).trim() !== "";
    const shareId = existing ? String(formData.shareId).trim() : genShareId();
    const fd = { ...formData, shareId };
    setCurrentBrief(brief);
    setCurrentFormData(fd);
    setLibrary(prev => [{ id: Date.now(), shareId, name: fd.campaignName || (fd.productName === "Other" && fd.customProductName?.trim() ? fd.customProductName.trim() : fd.productName), brief, formData: fd, date: new Date().toLocaleDateString() }, ...prev]);
    setFormKey(k => k + 1);
    setView("display");
  };

  const openLibraryItem = useCallback((item) => {
    let fd = item.formData;
    if (!fd.shareId) {
      const shareId = genShareId();
      fd = { ...fd, shareId };
      setLibrary((prev) => prev.map((x) => (x.id === item.id ? { ...x, formData: fd, shareId } : x)));
    }
    setCurrentBrief(item.brief);
    setCurrentFormData(fd);
    setView("display");
  }, []);

  const deleteBrief = useCallback((id) => {
    setLibrary(prev => prev.filter(item => item.id !== id));
  }, []);

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
      setApiMsg(`Connected in ${ms}ms — ✦ IB-Ai is ready.`);
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
        ? "Timed out after 60s. Try again or use ⚡ Instant Draft."
        : err.message);
    } finally {
      clearInterval(timerRef.current);
      if (!deferredSuccess && !cancelledRef.current) {
        stopStepAnimation();
        setAiLoading(false);
      }
    }
  }, [startStepAnimation, stopStepAnimation]);

  const handleCancel = () => {
    cancelledRef.current = true;
    clearInterval(timerRef.current);
    stopStepAnimation();
    setAiLoading(false);
    setAiError(null);
  };

  const handleRegenTemplate = useCallback(() => {
    if (currentFormData) saveBrief(generateBrief(currentFormData), { ...currentFormData, mode: "template" });
  }, [currentFormData]);

  const handleRegenAI = useCallback(() => {
    if (currentFormData) handleGenerate({ ...currentFormData, mode: "ai" });
  }, [currentFormData, handleGenerate]);

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

        {/* NAV */}
        <div className="no-print" style={S.nav}>
          <div style={S.navLogo} onClick={()=>setView("home")}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill={t.green}/><path d="M7 12h10M12 7v10" stroke="#000" strokeWidth="2.5" strokeLinecap="round"/></svg>
            <div><div style={S.navTitle}>Intake Breathing</div><div style={S.navSub}>CREATOR PARTNERSHIPS</div></div>
          </div>
          <div style={S.navLinks}>
            <button style={S.navBtn(view === "home")} onClick={() => setView("home")}>Home</button>
            <button style={S.navBtn(view === "create")} onClick={() => { setView("create"); setFormKey((k) => k + 1); }}>New Brief</button>
            <button style={S.navBtn(view === "library")} onClick={() => setView("library")}>Library{library.length > 0 && ` (${library.length})`}</button>
            <button style={S.navBtn(view === "settings")} onClick={() => setView("settings")}>Settings</button>
            <div style={{ width: 1, height: 16, background: t.border, margin: "0 4px" }} />
            <button type="button" onClick={()=>setIsDark(!isDark)} style={S.themeToggle} title={isDark ? "Switch to light" : "Switch to dark"}>
              <div style={S.themeKnob(isDark)} />
            </button>
          </div>
        </div>

        {currentRole === ROLES.CREATOR && (
          <div className="no-print" style={{ background: t.orange + (t.isLight ? "18" : "15"), borderBottom: `1px solid ${t.orange}35`, padding: "10px 24px", display: "flex", alignItems: "center", justifyContent: "center", gap: 16, flexWrap: "wrap", fontSize: 13, color: t.text }}>
            <span>👁 Viewing as Creator — read-only mode</span>
            <button type="button" onClick={() => setCurrentRole(ROLES.MANAGER)} style={{ ...S.btnS, fontSize: 12, padding: "6px 14px", borderColor: t.orange + "50", color: t.orange }}>Switch to Manager</button>
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
                      {status === "done" && <span style={{ color: "#000", fontSize: 13, fontWeight: 800 }}>✓</span>}
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
            <div style={{ fontSize: 13, color: t.red, marginBottom: 10 }}>⚠️ {aiError}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setAiError(null)} style={{ background: "none", border: `1px solid ${t.border}`, borderRadius: 8, color: t.textMuted, cursor: "pointer", fontSize: 12, padding: "8px 16px" }}>Dismiss</button>
            </div>
          </div>
        )}

        {/* HOME — dashboard */}
        {!aiLoading && view === "home" && (
          <div style={{ animation: "fadeIn 0.3s ease", maxWidth: 960, margin: "0 auto", padding: "32px 24px 60px" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.textSecondary, letterSpacing: "0.02em" }}>Intake Breathing — Creator Partnerships</div>
            <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 20 }}>Dashboard</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
              {[
                {
                  id: "ugc",
                  icon: "🎬",
                  title: "UGC Army",
                  desc: "Create and manage UGC creator briefs",
                  badge: "Active",
                  badgeColor: t.green,
                  sub: `${library.length} brief${library.length === 1 ? "" : "s"} created`,
                  onClick: () => { setView("create"); setFormKey((k) => k + 1); },
                },
                {
                  id: "pipeline",
                  icon: "📡",
                  title: "Channel Pipeline",
                  desc: "Track creator outreach and partnerships",
                  badge: "Coming Soon",
                  badgeColor: t.orange,
                  onClick: () => setView("pipeline"),
                },
                {
                  id: "influencer",
                  icon: "💰",
                  title: "Influencer Buys",
                  desc: "Manage influencer campaigns and spend",
                  badge: "Coming Soon",
                  badgeColor: t.orange,
                  onClick: () => setView("influencer"),
                },
                {
                  id: "tools",
                  icon: "🛠️",
                  title: "Tools",
                  desc: "Video reformatter, analytics, and more",
                  badge: "1 tool",
                  badgeColor: t.blue,
                  onClick: () => setView("tools"),
                },
              ].map((card) => (
                <div
                  key={card.id}
                  onClick={card.onClick}
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
                  <div style={{ fontSize: 32, marginBottom: 12 }}>{card.icon}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: t.text, marginBottom: 4 }}>{card.title}</div>
                  <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 12, lineHeight: 1.5 }}>{card.desc}</div>
                  {card.sub && <div style={{ fontSize: 12, color: t.textFaint, marginBottom: 10 }}>{card.sub}</div>}
                  <div
                    style={{
                      display: "inline-block",
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "4px 10px",
                      borderRadius: 20,
                      background: card.badgeColor + (t.isLight ? "18" : "15"),
                      color: card.badgeColor,
                      border: t.isLight ? `1px solid ${card.badgeColor}30` : "none",
                    }}
                  >
                    {card.badge}
                  </div>
                </div>
              ))}
            </div>

            {!apiKey && (
              <div style={{ marginTop: 28, fontSize: 13, color: t.textFaint }}>
                Want IB-Ai-powered briefs?{" "}
                <span onClick={() => setView("settings")} style={{ color: t.green, cursor: "pointer", fontWeight: 600 }}>Add your API key in Settings</span>
              </div>
            )}
            {apiKey && apiStatus === "ok" && (
              <div style={{ marginTop: 28, fontSize: 13, color: t.green, fontWeight: 500 }}>✓ IB-Ai connected and ready</div>
            )}

            {library.length > 0 && (
              <div style={{ marginTop: 40 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.textFaint, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 14 }}>Recent Briefs</div>
                {library.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    style={S.listItem}
                    onClick={() => openLibraryItem(item)}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.green + "50"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; }}
                  >
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{item.name}</div>
                      <div style={{ fontSize: 12, color: t.textFaint }}>
                        {managerDisplayName(item.formData)} · {item.formData.vibe === "Other" && item.formData.customVibe?.trim() ? item.formData.customVibe.trim() : item.formData.vibe} · {formatPlatformsDisplay(item.formData)} · {formatToneDisplay(item.formData)} · {item.formData.videoLength}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: t.textFaint }}>→</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!aiLoading && view === "pipeline" && (
          <ComingSoonPage
            title="Channel Pipeline"
            message="Channel Pipeline — Coming Soon. Track creator outreach, responses, and partnership status."
            onBack={() => setView("home")}
          />
        )}
        {!aiLoading && view === "influencer" && (
          <ComingSoonPage
            title="Influencer Buys"
            message="Influencer Buys — Coming Soon. Manage influencer campaigns and spend in one place."
            onBack={() => setView("home")}
          />
        )}
        {!aiLoading && view === "tools" && <ToolsPage onBack={() => setView("home")} onOpenVideo={() => setView("videotool")} />}
        {!aiLoading && view === "videotool" && <VideoReformatter onBack={() => setView("tools")} />}

        {/* SETTINGS */}
        {!aiLoading && view === "settings" && (
          <div style={{ maxWidth: 600, margin: "0 auto", padding: "40px 24px 80px", animation: "fadeIn 0.3s ease" }}>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 6, color: t.text }}>Settings</div>
            <div style={{ fontSize: 12, color: t.textFaint, fontWeight: 500, marginBottom: 8 }}>v{APP_VERSION}</div>
            <div style={{ fontSize: 14, color: t.textMuted, marginBottom: 32 }}>Configure your API key to enable ✦ IB-Ai.</div>

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
                  {apiStatus === "ok" ? "✓ " : "✗ "}{apiMsg}
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
                Used for fetching TikTok and Instagram videos in the Video Reformatter tool. Get your key from{" "}
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
                  {scrapeStatus === "ok" ? "✓ " : "✗ "}{scrapeMsg}
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
                <strong style={{ color: t.green }}>✦ IB-Ai</strong> sends your brief form data to Claude Sonnet, which writes original hooks, story beats, persona descriptions, and creative direction tailored to your specific campaign. Requires an API key.
              </div>
              <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.7, marginTop: 10 }}>
                <strong style={{ color: t.textSecondary }}>⚡ Instant Draft</strong> uses built-in templates with Intake's playbook data. No API key needed. Fast but less creative.
              </div>
              <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.7, marginTop: 10 }}>
                Each IB-Ai call uses roughly 3,000 output tokens (~$0.01-0.02 per brief on Claude Sonnet).
              </div>
            </div>

            {/* Preview Mode — developer testing */}
            <div style={{ background: t.card, borderRadius: 12, border: `1px solid ${t.border}`, padding: 24, marginTop: 20, boxShadow: t.shadow }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 6 }}>Preview Mode</div>
              <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 16, lineHeight: 1.6 }}>Switch to Creator view to see what creators will see (read-only)</div>
              <button
                type="button"
                onClick={() => setCurrentRole((r) => (r === ROLES.MANAGER ? ROLES.CREATOR : ROLES.MANAGER))}
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

        {!aiLoading && view === "create" && <div style={{ animation: "fadeIn 0.3s ease" }}><BriefForm key={`b-${formKey}`} onGenerate={handleGenerate} /></div>}
        {!aiLoading && view === "display" && currentBrief && <div style={{ animation: "fadeIn 0.3s ease" }}><BriefDisplay brief={currentBrief} formData={currentFormData} currentRole={currentRole} onBack={()=>setView("home")} onRegenerate={handleRegenTemplate} onRegenerateAI={handleRegenAI} /></div>}

        {!aiLoading && view === "library" && (
          <div style={{ maxWidth: 960, margin: "0 auto", padding: "40px 24px 60px", animation: "fadeIn 0.3s ease" }}>
            <div style={{ ...S.formTitle, marginBottom: 24 }}>Brief Library</div>
            {library.length === 0 ? (
              <div style={S.empty}><div style={{ fontSize: 32, marginBottom: 12 }}>📁</div><div style={{ fontSize: 15, marginBottom: 8 }}>No briefs yet</div><div style={{ fontSize: 13, marginBottom: 24 }}>Generated briefs will appear here.</div><button style={S.btnP} onClick={()=>setView("create")}>Create Your First Brief</button></div>
            ) : library.map(item => (
              <div key={item.id} style={S.listItem}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=t.green+"50"}} onMouseLeave={e=>{e.currentTarget.style.borderColor=t.border}}>
                <div style={{ cursor: "pointer", flex: 1 }} onClick={()=>openLibraryItem(item)}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: t.textFaint, marginTop: 2 }}>{managerDisplayName(item.formData)} · {item.formData.vibe === "Other" && item.formData.customVibe?.trim() ? item.formData.customVibe.trim() : item.formData.vibe} · {formatPlatformsDisplay(item.formData)} · {formatToneDisplay(item.formData)} · {item.formData.videoLength}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ fontSize: 12, color: t.textFaint }}>{item.date}</div>
                  <button onClick={(e)=>{e.stopPropagation();deleteBrief(item.id)}} style={{ background: "none", border: "none", color: t.red, cursor: "pointer", fontSize: 14, padding: "4px 6px", borderRadius: 4, opacity: 0.6 }} title="Delete brief">✕</button>
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
