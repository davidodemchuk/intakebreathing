import { useState, useRef, useCallback, useEffect, memo, createContext, useContext } from "react";

// ═══ UPDATE THIS WITH EVERY PUSH ═══
// Add new version at the TOP of this array
// Bump APP_VERSION to match
// Format: { version: "X.Y.Z", date: "YYYY-MM-DD", changes: ["what changed"] }
const APP_VERSION = "1.2.2";
const CHANGELOG = [
  { version: "1.2.2", date: "2025-03-31", changes: [
    "Tone dropdown now includes Other option with custom text input",
    "AI prompt updated to use custom tone when Other is selected",
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
    "AI proof point suggestions now use verified data only",
  ]},
  { version: "1.1.0", date: "2025-03-31", changes: [
    "AI-powered proof point auto-selection — stats update based on product, audience, problem, mission, and campaign fields",
    "Debounced 2-second delay to avoid excessive API calls",
    "Visual loading indicator on proof points section during AI suggestion",
  ]},
  { version: "1.0.0", date: "2025-03-31", changes: [
    "Initial release — UGC Brief Command Center",
    "AI Generate with Claude Sonnet API",
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
    heroGradient: "linear-gradient(135deg,#ffffff,#666666)",
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
    heroGradient: "linear-gradient(135deg,#0a0a0a,#555555)",
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
    hero: { textAlign: "center", padding: "72px 24px 48px" },
    heroTag: { display: "inline-block", padding: "5px 14px", borderRadius: 20, background: t.green + (t.isLight ? "18" : "15"), color: t.green, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 20, border: t.isLight ? `1px solid ${t.green}30` : "none" },
    heroTitle: { fontSize: 40, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: 14, background: t.heroGradient, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
    heroDesc: { fontSize: 16, color: t.textMuted, lineHeight: 1.6, maxWidth: 520, margin: "0 auto 36px" },
    heroActions: { display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" },
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

const PLATFORMS = ["TikTok", "Instagram Reels", "YouTube Shorts", "Facebook", "Other"];
const LENGTHS = ["15-30s", "30-60s", "60-90s", "90s+"];
const TONES = ["Real & relatable", "Funny & casual", "Aspirational", "Educational", "Dramatic/storytelling", "ASMR/satisfying", "Other"];

const PREFILL = {
  productName: "Starter Kit Black", customProductName: "", campaignName: "The Level Up", vibe: "Fun & Entertaining", customVibe: "",
  mission: "Four sizes. One that's perfect for you. How far can you level up?",
  ageRange: "25-34", gender: "Men & Women",
  problem: "People assume Intake is one-size-fits-all and write it off thinking it won't fit their nose. They don't realize the Starter Kit comes with 4 different sizes — so there's a level for every nose.",
  selectedStats: ["snoring", "sleep", "sinus", "starterkit", "customers", "fda"],
  platforms: ["TikTok"], customPlatform: "", videoLength: "15-30s", tone: "Funny & casual", customTone: "",
  notes: "Creator tries each level 1→4 on camera. Quick cuts. Reaction-driven. Each level opens the nose wider. Payoff is Level 4 where their nose opens WIDE and the genuine reaction IS the content.\n\nHook ideas: 'I don't even know if I can make it to Level 4' / 'This comes with FOUR sizes??' / 'Level 1 was easy... Level 4 broke me.'\n\nThe Level Up isn't about needing Level 4 — it's about finding YOUR level. But the entertainment value is the journey to 4. Keep it fun, not medical. Show the magnetic snap-on moment — it's satisfying and shareable.",
};

const DEFAULTS = {
  productName: "Starter Kit Black", customProductName: "", campaignName: "", vibe: "Fun & Entertaining", customVibe: "", mission: "",
  ageRange: "25-34", gender: "Men & Women", problem: "",
  selectedStats: ["snoring", "sleep", "sinus", "customers", "fda"],
  platforms: ["TikTok"], customPlatform: "", videoLength: "15-30s", tone: "Real & relatable", customTone: "", notes: "",
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
  return plats.map(p => p === "Other" && fd.customPlatform?.trim() ? fd.customPlatform.trim() : p).join(", ");
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
  const noteBlocks = platformsArr.map(p => {
    const base = (PLATFORM_NOTES[p] || "").trim();
    if (p === "Other" && (d.customPlatform || "").trim()) {
      const o = (d.customPlatform || "").trim();
      return base ? `${base}\nNamed platform: ${o}` : `Platform: ${o}`;
    }
    return base;
  }).filter(Boolean);
  const lg = LENGTH_GUIDE[d.videoLength] || "";
  const platNotes = vibePrefix + tonePrefix + noteBlocks.join("\n\n—\n\n") + (noteBlocks.length && lg ? "\n\n" : "") + lg;
  const platLabel = (p) => p === "Other" && (d.customPlatform || "").trim() ? (d.customPlatform || "").trim() : p;
  const deliverables = `Submit for: ${platformsArr.map(platLabel).join(", ")}. (1) Final video — vertical 9:16, 1080×1920 min, ${d.videoLength}. (2) Raw footage. (3) One thumbnail still. Upload via creator portal.`;
  return { mission, persona, age, psycho, theyAre, theyAreNot, probInst, probLines, probOverlays, agInst, agLines, agOverlays, solInst, solLines, solOverlays, hooks, sayThis: pick(APPROVED_CLAIMS, 5), notThis: BANNED_CLAIMS.slice(0, 5), disclosure: DISCLOSURE, proof: proof.length > 0 ? proof.slice(0, 4) : ["88% of users reported a reduction in snoring (SleepScore Labs independent study, 840+ nights analyzed)", "Over 1,000,000 customers · 4.5 star rating", "FDA registered, medical grade, hypoallergenic, latex-free, made in USA", "90-day risk-free trial included"], platNotes, deliverables };
}

// ═══════════════════════════════════════════════════════════
// FORM
// ═══════════════════════════════════════════════════════════

const BriefForm = memo(function BriefForm({ prefill, onGenerate }) {
  const { t, S } = useContext(ThemeContext);
  const [ageRange, setAgeRange] = useState(prefill?.ageRange ?? DEFAULTS.ageRange);
  const [gender, setGender] = useState(prefill?.gender ?? DEFAULTS.gender);
  const [selectedStats, setSelectedStats] = useState(prefill ? [...prefill.selectedStats] : [...DEFAULTS.selectedStats]);
  const [showCustomProduct, setShowCustomProduct] = useState((prefill?.productName || DEFAULTS.productName) === "Other");
  const [showCustomVibe, setShowCustomVibe] = useState((prefill?.vibe || DEFAULTS.vibe) === "Other");
  const [showCustomTone, setShowCustomTone] = useState((prefill?.tone || DEFAULTS.tone) === "Other");
  const [selectedPlatforms, setSelectedPlatforms] = useState(() => {
    const p = prefill?.platforms ?? DEFAULTS.platforms;
    if (Array.isArray(p) && p.length) return [...p];
    if (prefill?.platform) return [prefill.platform];
    return ["TikTok"];
  });
  const [statsLoading, setStatsLoading] = useState(false);
  const debounceTimer = useRef(null);
  const vals = useRef({
    productName: prefill?.productName || DEFAULTS.productName,
    customProductName: prefill?.customProductName ?? DEFAULTS.customProductName,
    campaignName: prefill?.campaignName || DEFAULTS.campaignName,
    vibe: prefill?.vibe || DEFAULTS.vibe,
    customVibe: prefill?.customVibe ?? DEFAULTS.customVibe,
    mission: prefill?.mission || "",
    problem: prefill?.problem ?? DEFAULTS.problem,
    ageRange: prefill?.ageRange ?? DEFAULTS.ageRange,
    gender: prefill?.gender ?? DEFAULTS.gender,
    customPlatform: prefill?.customPlatform ?? DEFAULTS.customPlatform,
    videoLength: prefill?.videoLength || DEFAULTS.videoLength,
    tone: prefill?.tone || DEFAULTS.tone,
    customTone: prefill?.customTone ?? DEFAULTS.customTone,
    notes: prefill?.notes || "",
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

  const triggerStatsSuggest = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => suggestStats(), 2000);
  }, [suggestStats]);

  useEffect(() => {
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, []);

  const togglePlatform = (name) => {
    setSelectedPlatforms(prev => prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]);
  };

  const go = useCallback((mode) => {
    const v = vals.current;
    if (!v.problem.trim()) { alert("Please describe the core problem."); return; }
    if (v.productName === "Other" && !v.customProductName.trim()) { alert("Please enter a product name."); return; }
    if (v.vibe === "Other" && !v.customVibe.trim()) { alert("Please describe your campaign vibe."); return; }
    if (v.tone === "Other" && !v.customTone.trim()) { alert("Please describe your tone."); return; }
    if (selectedPlatforms.length === 0) { alert("Please select at least one platform."); return; }
    const problemTrim = v.problem.trim();
    onGenerate({
      mode,
      productName: v.productName, customProductName: v.customProductName.trim(), campaignName: v.campaignName, vibe: v.vibe, customVibe: v.customVibe.trim(), mission: v.mission,
      ageRange, gender, problem: problemTrim,
      selectedStats, platforms: [...selectedPlatforms], customPlatform: (v.customPlatform || "").trim(), videoLength: v.videoLength, tone: v.tone, customTone: (v.customTone || "").trim(), notes: v.notes,
      _audience: `Ages ${ageRange} — ${gender}`,
      _problem: problemTrim,
      _stats: selectedStats.map(id => { const s = STAT_OPTIONS.find(o => o.id === id); return s ? s.full : ""; }).filter(Boolean).join(". "),
      _approved: APPROVED_CLAIMS.join(". "),
      _banned: BANNED_CLAIMS.join(". "),
      _disclosure: DISCLOSURE,
    });
  }, [onGenerate, ageRange, gender, selectedStats, selectedPlatforms]);
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
        <div style={S.formTitle}>{prefill ? "⚡ The Level Up — Prefilled" : "Create New Brief"}</div>
        <div style={S.formSub}>Select options below. Brief generates instantly.</div>
      </div>
      <div style={S.section}>
        <div style={S.secLabel}>🎯 Product & Campaign</div>
        <div style={S.r2}>
          <div style={S.fg}><label style={S.label}>Product *</label>
            <select style={S.select} defaultValue={vals.current.productName} onChange={e => { const v = e.target.value; vals.current.productName = v; setShowCustomProduct(v === "Other"); triggerStatsSuggest(); }}>
              {PRODUCTS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            {showCustomProduct && <div style={S.fg}><label style={S.label}>Product Name</label>
              <input style={S.input} defaultValue={vals.current.customProductName} onChange={e => { vals.current.customProductName = e.target.value; }} onFocus={e => { e.target.style.borderColor = t.green; }} onBlur={e => { e.target.style.borderColor = t.border; }} placeholder="Enter your product name" />
            </div>}
          </div>
          <div style={S.fg}><label style={S.label}>Campaign Vibe</label>
            <select style={S.select} defaultValue={vals.current.vibe} onChange={e => { const v = e.target.value; vals.current.vibe = v; setShowCustomVibe(v === "Other"); triggerStatsSuggest(); }}>
              {VIBES.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            {showCustomVibe && <div style={S.fg}><label style={S.label}>Campaign Vibe</label>
              <input style={S.input} defaultValue={vals.current.customVibe} onChange={e => { vals.current.customVibe = e.target.value; }} onFocus={e => { e.target.style.borderColor = t.green; }} onBlur={e => { e.target.style.borderColor = t.border; }} placeholder="Describe your campaign vibe" />
            </div>}
          </div>
        </div>
        <div style={S.r2}>
          <div style={S.fg}><label style={S.label}>Campaign Name</label>
            <input style={S.input} defaultValue={vals.current.campaignName} onChange={e=>{vals.current.campaignName=e.target.value; triggerStatsSuggest();}} onFocus={e=>{e.target.style.borderColor=t.green}} onBlur={e=>{e.target.style.borderColor=t.border}} placeholder='e.g. "The Level Up"' /></div>
          <div style={S.fg}><label style={S.label}>One-Line Mission</label>
            <input style={S.input} defaultValue={vals.current.mission} onChange={e=>{vals.current.mission=e.target.value; triggerStatsSuggest();}} onFocus={e=>{e.target.style.borderColor=t.green}} onBlur={e=>{e.target.style.borderColor=t.border}} placeholder="The soul of this campaign" /></div>
        </div>
      </div>
      <div style={S.section}>
        <div style={S.secLabel}>👤 Audience & Problem</div>
        <div style={S.r2}>
          <div style={S.fg}><label style={S.label}>Age Range</label>
            <select style={S.select} value={ageRange} onChange={e=>{ const v = e.target.value; vals.current.ageRange = v; setAgeRange(v); triggerStatsSuggest(); }}>
              {AGE_RANGES.map((a)=><option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div style={S.fg}><label style={S.label}>Gender</label>
            <select style={S.select} value={gender} onChange={e=>{ const v = e.target.value; vals.current.gender = v; setGender(v); triggerStatsSuggest(); }}>
              {GENDERS.map((g)=><option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </div>
        <div style={S.fg}><label style={S.label}>Core Problem *</label>
          <textarea style={S.textarea} defaultValue={vals.current.problem} onChange={e=>{vals.current.problem=e.target.value; triggerStatsSuggest();}} onFocus={e=>{e.target.style.borderColor=t.green}} onBlur={e=>{e.target.style.borderColor=t.border}} placeholder="What misconception, frustration, or emotional block are we solving? Write it like you'd explain it to a creator." rows={4} />
        </div>
      </div>
      <div style={S.section}>
        <div style={S.secLabel}>📊 Proof Points {statsLoading ? <span style={{ fontSize: 11, color: t.orange, fontWeight: 500, marginLeft: 4 }}>— AI selecting...</span> : <span style={{ fontSize: 11, color: t.textFaint, fontWeight: 500, marginLeft: 4 }}>— auto-selected by AI, tap to adjust</span>}</div>
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
        <div style={S.secLabel}>⚖️ Compliance — auto-included</div>
        <div style={S.cols2}>
          <div><div style={{ fontSize: 12, fontWeight: 700, color: t.green, marginBottom: 8 }}>✅ Approved</div>
            <div style={S.roBox}>{APPROVED_CLAIMS.map((c,i)=><div key={i} style={S.roItem()}><span style={S.roMarker(t.green)}>✓</span>{c}</div>)}</div></div>
          <div><div style={{ fontSize: 12, fontWeight: 700, color: t.red, marginBottom: 8 }}>❌ Banned</div>
            <div style={S.roBox}>{BANNED_CLAIMS.map((c,i)=><div key={i} style={S.roItem()}><span style={S.roMarker(t.red)}>✗</span>{c}</div>)}</div></div>
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
        <div style={S.secLabel}>📱 Platform</div>
        <div style={S.chipGrid}>
          {PLATFORMS.map(p => <div key={p} style={S.chip(selectedPlatforms.includes(p))} onClick={() => togglePlatform(p)}>{selectedPlatforms.includes(p) ? "✓ " : ""}{p}</div>)}
        </div>
        {selectedPlatforms.includes("Other") && <div style={S.fg}><label style={S.label}>Other platform</label>
          <input style={S.input} defaultValue={vals.current.customPlatform} onChange={e => { vals.current.customPlatform = e.target.value; }} onFocus={e => { e.target.style.borderColor = t.green; }} onBlur={e => { e.target.style.borderColor = t.border; }} placeholder="e.g. Snapchat, Twitter/X, Pinterest..." />
        </div>}
      </div>
      <div style={S.section}>
        <div style={S.secLabel}>📝 Creative Direction</div>
        <div style={S.fg}><label style={S.label}>Notes for Creators</label>
          <textarea style={{ ...S.textarea, minHeight: 120 }} defaultValue={vals.current.notes} onChange={e=>{vals.current.notes=e.target.value}} onFocus={e=>{e.target.style.borderColor=t.green}} onBlur={e=>{e.target.style.borderColor=t.border}} placeholder="Format instructions, hook ideas, visual direction…" rows={5} />
          <div style={S.hint}>Main free-text field. Everything else is from the Intake playbook.</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
        <button style={{ ...S.genBtn, flex: 1, marginTop: 0 }} onClick={() => go("ai")}>✦ AI Generate</button>
        <button style={{ ...S.genBtn, flex: 1, marginTop: 0, background: t.border, color: t.text, fontWeight: 700, fontSize: 14 }} onClick={() => go("template")}>⚡ Instant Draft</button>
      </div>
      <div style={{ ...S.hint, textAlign: "center", marginTop: 8 }}>AI Generate uses Claude to write original creative. Instant Draft uses templates — fast but generic.</div>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════
// BRIEF DISPLAY
// ═══════════════════════════════════════════════════════════

function EditableField({ value, style, t }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && ref.current.textContent !== value) ref.current.textContent = value ?? "";
  }, [value]);
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

function BriefDisplay({ brief: b, formData: fd, onBack, onRegenerate, onRegenerateAI }) {
  const { t, S } = useContext(ThemeContext);
  const wasAI = fd.mode === "ai";
  return (
    <div style={S.bWrap}>
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={onBack} style={{ ...S.btnS, fontSize: 13, padding: "9px 18px" }}>← Back</button>
        <button onClick={onRegenerateAI} style={{ ...S.btnS, fontSize: 13, padding: "9px 18px", borderColor: t.green+"50", color: t.green }}>✦ AI Regenerate</button>
        <button onClick={onRegenerate} style={{ ...S.btnS, fontSize: 13, padding: "9px 18px" }}>⚡ Quick Regen</button>
      </div>
      <div style={{ marginBottom: 24 }}>
        <span style={{ ...S.badge(wasAI ? t.green : t.textFaint), fontSize: 11 }}>{wasAI ? "✦ AI Generated" : "⚡ Template Draft"}</span>
      </div>
      <div style={S.bHeader}>
        <div style={S.bCampaign}>{fd.campaignName || (fd.productName === "Other" && fd.customProductName?.trim() ? fd.customProductName.trim() : fd.productName)}</div>
        <EditableField value={`"${b.mission}"`} style={S.bMission} t={t} />
        <div style={S.badges}>
          <span style={S.badge(t.text)}>{fd.productName === "Other" && fd.customProductName?.trim() ? fd.customProductName.trim() : fd.productName}</span>
          <span style={S.badge(t.purple)}>{fd.vibe === "Other" && fd.customVibe?.trim() ? fd.customVibe.trim() : fd.vibe}</span>
          {normalizePlatforms(fd).map((p, i) => (
            <span key={`${p}-${i}`} style={S.badge(t.blue)}>{p === "Other" && fd.customPlatform?.trim() ? fd.customPlatform.trim() : p}</span>
          ))}
          <span style={S.badge(t.orange)}>{fd.videoLength}</span>
          <span style={S.badge(t.green)}>{fd.tone === "Other" && fd.customTone?.trim() ? fd.customTone.trim() : fd.tone}</span>
        </div>
        <div style={{ fontSize: 12, color: t.textFaint, marginTop: 14, fontStyle: "italic" }}>Click any text to edit</div>
      </div>
      <div style={S.bSec}>
        <div style={S.bSecTitle}>👤 Who You're Talking To</div>
        <div style={S.card}>
          <EditableField value={b.persona} style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, color: t.text }} t={t} />
          <EditableField value={b.age} style={{ fontSize: 13, color: t.blue, fontWeight: 600, marginBottom: 10 }} t={t} />
          <EditableField value={b.psycho} style={{ fontSize: 14, color: t.textMuted, lineHeight: 1.6, marginBottom: 16 }} t={t} />
          <div style={S.cols2}>
            <div><div style={S.sayH(t.green)}>They Are ✓</div>{b.theyAre.map((x,i)=><div key={i} style={{ ...S.li, display: "flex", alignItems: "flex-start", gap: 6 }}><span style={S.mk(t.green)}>✓</span><EditableField value={x} style={{ flex: 1, fontSize: 13, color: t.textSecondary, lineHeight: 1.7, minWidth: 0 }} t={t} /></div>)}</div>
            <div><div style={S.sayH(t.red)}>They Are Not ✗</div>{b.theyAreNot.map((x,i)=><div key={i} style={{ ...S.li, display: "flex", alignItems: "flex-start", gap: 6 }}><span style={S.mk(t.red)}>✗</span><EditableField value={x} style={{ flex: 1, fontSize: 13, color: t.textSecondary, lineHeight: 1.7, minWidth: 0 }} t={t} /></div>)}</div>
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
            <EditableField value={bt.inst} style={S.beatInst} t={t} />
            <div style={S.beatSub}>Lines to riff on</div>
            {bt.lines.map((l,i)=><EditableField key={i} value={`"${l}"`} style={S.beatLine} t={t} />)}
            <div style={{ ...S.beatSub, marginTop: 12 }}>Overlay ideas</div>
            {bt.overlays.map((o,i)=><div key={i} style={{ marginBottom: 4 }}><EditableField value={o} style={{ ...S.beatLine, borderLeftColor: bt.color+"40" }} t={t} /></div>)}
          </div>
        ))}
      </div>
      <div style={S.bSec}>
        <div style={S.bSecTitle}>🪝 Hook Options — First 3 Seconds</div>
        <div style={{ fontSize: 12, color: t.textFaint, fontStyle: "italic", marginBottom: 14 }}>If they don't feel it here, they scroll.</div>
        <div style={S.card}>{b.hooks.map((h,i)=>(<div key={i} style={S.hookItem}><div style={S.hookNum}>{i+1}</div><EditableField value={h} style={S.hookText} t={t} /></div>))}</div>
      </div>
      <div style={S.bSec}>
        <div style={S.bSecTitle}>✅ Say This / 🚫 Not This</div>
        <div style={S.cols2}>
          <div style={S.sayCol}><div style={S.sayH(t.green)}>✅ Say This</div>{b.sayThis.map((s,i)=><div key={i} style={{ ...S.li, display: "flex", alignItems: "flex-start", gap: 6 }}><span style={S.mk(t.green)}>✓</span><EditableField value={s} style={{ flex: 1, fontSize: 13, color: t.textSecondary, lineHeight: 1.7, minWidth: 0 }} t={t} /></div>)}</div>
          <div style={S.dontCol}><div style={S.sayH(t.red)}>🚫 Not This</div>{b.notThis.map((s,i)=><div key={i} style={{ ...S.li, display: "flex", alignItems: "flex-start", gap: 6 }}><span style={S.mk(t.red)}>✗</span><EditableField value={s} style={{ flex: 1, fontSize: 13, color: t.textSecondary, lineHeight: 1.7, minWidth: 0 }} t={t} /></div>)}</div>
        </div>
      </div>
      <div style={S.bSec}>
        <div style={S.bSecTitle}>📊 Proof Points</div>
        <div style={S.proofGrid}>{b.proof.map((p,i)=><div key={i} style={S.proofCard}><EditableField value={p} style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.5, width: "100%" }} t={t} /></div>)}</div>
      </div>
      <div style={S.bSec}>
        <div style={S.bSecTitle}>⚠️ Required Disclosure — Non-Negotiable</div>
        <div style={S.discBox}><div style={S.discLabel}>Must appear when any stat is referenced</div><EditableField value={b.disclosure} style={S.discText} t={t} /></div>
      </div>
      <div style={S.bSec}>
        <div style={S.bSecTitle}>📱 Platform Notes</div>
        <div style={S.card}><EditableField value={b.platNotes} style={{ fontSize: 14, color: t.textSecondary, lineHeight: 1.6, whiteSpace: "pre-wrap" }} t={t} /></div>
      </div>
      <div style={S.bSec}>
        <div style={S.bSecTitle}>📦 Deliverables</div>
        <div style={S.card}><EditableField value={b.deliverables} style={{ fontSize: 14, color: t.textSecondary, lineHeight: 1.6 }} t={t} /></div>
      </div>
      <div style={S.bSec}>
        <div style={S.bSecTitle}>📤 Creator Submissions</div>
        <div style={{ border: `2px dashed ${t.border}`, borderRadius: 12, padding: "40px 20px", textAlign: "center", color: t.textFaint, fontSize: 14 }}>Upload zone coming soon.</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// AI PROMPT BUILDER
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
  const platLine = plats.map(p => p === "Other" && (d.customPlatform || "").trim() ? `Other (${(d.customPlatform || "").trim()})` : p).join(", ");
  const toneResolved = d.tone === "Other" ? (d.customTone || "").trim() : (d.tone || "");
  return `You are an expert UGC (user-generated content) brief writer for Intake Breathing, a magnetic nasal dilator company. Write a complete creator brief. Be specific, creative, and tailored to this exact campaign — not generic.

PRODUCT: ${productResolved} by Intake Breathing
CAMPAIGN NAME: ${d.campaignName || "Untitled"}
CAMPAIGN VIBE: ${vibeResolved}
MISSION: ${d.mission || "N/A"}
TARGET AUDIENCE: ${audienceCompact}
AUDIENCE (form selection, ageRange + gender): ${audienceForm}
CORE PROBLEM: ${prob}
PROOF POINTS / STATS: ${d._stats || ""}
APPROVED CLAIMS (creators CAN say): ${d._approved || ""}
BANNED CLAIMS (NEVER say): ${d._banned || ""}
REQUIRED DISCLOSURE: ${d._disclosure || ""}
PLATFORMS: ${platLine}
VIDEO LENGTH: ${d.videoLength || ""}
TONE: ${toneResolved}
CREATIVE NOTES: ${d.notes || "None"}

TONE DIRECTION: The creative tone for this brief is "${toneResolved}". Match this voice consistently in hooks, on-camera delivery, pacing, overlay text, and every line of copy — do not default to a generic influencer voice.

Write the brief as JSON. Be CREATIVE and SPECIFIC to this campaign — don't be generic. Write hooks that would actually stop someone mid-scroll. Write riff lines that sound like a real person talking, not marketing copy. Overlay ideas should be specific visual directions.

Return ONLY this JSON (no other text):
{"mission":"one line mission statement","persona":"creative persona name for the target viewer","age":"age range","psycho":"2-3 sentences describing their mindset, fears, desires — be vivid and specific","theyAre":["4 psychographic traits that describe this viewer"],"theyAreNot":["4 things this viewer is NOT — help creators avoid wrong assumptions"],"probInst":"directive for the PROBLEM beat — tell the creator exactly what to show/say in the opening","probLines":["3 specific lines creators can say or riff on for the problem beat — conversational, not corporate"],"probOverlays":["3 specific text overlay or visual ideas for the problem beat"],"agInst":"directive for the AGITATE beat — how to twist the knife and create urgency","agLines":["3 agitate lines — make the viewer feel the cost of inaction"],"agOverlays":["3 overlay/visual ideas for the agitate beat"],"solInst":"directive for the SOLUTION beat — the payoff, the reveal, the transformation","solLines":["3 solution lines — the relief, the wow moment, the conversion push"],"solOverlays":["3 overlay/visual ideas for the solution beat"],"hooks":["4 scroll-stopping hook options for the first 2-3 seconds — these must be thumb-stoppers"],"sayThis":["5 approved phrases creators should use"],"notThis":["5 phrases creators must NEVER say"],"disclosure":"exact required citation text","proof":["4 formatted stat cards"],"platNotes":"platform-specific tips for all selected platforms (${platLine}) at ${d.videoLength}","deliverables":"what creators need to submit and format specs"}`;
}

// ═══════════════════════════════════════════════════════════
// APP
// ═══════════════════════════════════════════════════════════

export default function App() {
  const [isDark, setIsDark] = useState(true);
  const [view, setView] = useState("home");
  const [currentBrief, setCurrentBrief] = useState(null);
  const [currentFormData, setCurrentFormData] = useState(null);
  const [library, setLibrary] = useState([]);
  const [formKey, setFormKey] = useState(0);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [storageReady, setStorageReady] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const timerRef = useRef(null);
  const cancelledRef = useRef(false);

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
    setCurrentBrief(brief);
    setCurrentFormData(formData);
    setLibrary(prev => [{ id: Date.now(), name: formData.campaignName || (formData.productName === "Other" && formData.customProductName?.trim() ? formData.customProductName.trim() : formData.productName), brief, formData, date: new Date().toLocaleDateString() }, ...prev]);
    setFormKey(k => k + 1);
    setView("display");
  };

  const deleteBrief = useCallback((id) => {
    setLibrary(prev => prev.filter(item => item.id !== id));
  }, []);

  // ── API Connection Test ──
  const [apiStatus, setApiStatus] = useState(null); // null | "testing" | "ok" | "fail"
  const [apiMsg, setApiMsg] = useState("");

  const saveApiKey = (key) => {
    setApiKey(key);
    setApiStatus(null);
    setApiMsg("");
    storageSet("intake-apikey", key);
    return key;
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
      setApiMsg(`Connected in ${ms}ms — ✦ AI Generate is ready.`);
    } catch (err) {
      setApiStatus("fail");
      setApiMsg(err.message === "TIMEOUT" ? "No response after 20s. Check your network or API key." : err.message);
    }
  };

  const handleGenerate = useCallback(async (formData) => {
    if (formData.mode === "template") {
      saveBrief(generateBrief(formData), formData);
      return;
    }

    // AI mode
    const liveKey = localStorage.getItem("intake-apikey") || "";
    if (!liveKey) {
      setAiError("No API key set. Go to ⚙ Settings and add your Anthropic API key.");
      return;
    }
    cancelledRef.current = false;
    setAiLoading(true);
    setAiError(null);
    setElapsed(0);
    const start = Date.now();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);

    try {
      const response = await Promise.race([
        fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: getApiHeaders(liveKey),
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
        if (response.status === 401) throw new Error("Invalid API key. Check ⚙ Settings.");
        throw new Error(msg);
      }

      const data = await response.json();
      if (cancelledRef.current) return;

      const text = data.content.map(i => i.text || "").join("");
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("AI didn't return valid JSON. Try again or use Instant Draft.");

      let brief;
      try { brief = JSON.parse(match[0]); }
      catch { throw new Error("JSON parse failed — response may have been cut off. Try again."); }

      saveBrief(brief, formData);
    } catch (err) {
      if (cancelledRef.current) return;
      setAiError(err.message === "TIMEOUT"
        ? "Timed out after 60s. Try again or use ⚡ Instant Draft."
        : err.message);
    } finally {
      clearInterval(timerRef.current);
      if (!cancelledRef.current) setAiLoading(false);
    }
  }, []);

  const handleCancel = () => { cancelledRef.current = true; clearInterval(timerRef.current); setAiLoading(false); setAiError(null); };

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
          * { box-sizing:border-box }
          input::placeholder,textarea::placeholder { color:${t.textFaint} }
          ::-webkit-scrollbar { width:6px }
          ::-webkit-scrollbar-thumb { background:${t.scrollThumb}; border-radius:3px }
          select option { background:${t.card}; color:${t.text} }
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
        <div style={S.nav}>
          <div style={S.navLogo} onClick={()=>setView("home")}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill={t.green}/><path d="M7 12h10M12 7v10" stroke="#000" strokeWidth="2.5" strokeLinecap="round"/></svg>
            <div><div style={S.navTitle}>Intake Breathing</div><div style={S.navSub}>CREATOR PARTNERSHIPS</div></div>
          </div>
          <div style={S.navLinks}>
            <button style={S.navBtn(view==="home")} onClick={()=>setView("home")}>Home</button>
            <button style={S.navBtn(view==="create")} onClick={()=>{setView("create");setFormKey(k=>k+1)}}>New Brief</button>
            <button style={S.navBtn(view==="library")} onClick={()=>setView("library")}>Library{library.length>0&&` (${library.length})`}</button>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button style={S.navBtn(view==="settings")} onClick={()=>setView("settings")}>⚙</button>
              <span style={{ fontSize: 10, color: t.textFaint, fontWeight: 500 }}>v{APP_VERSION}</span>
            </div>
            {apiKey && <div style={{ width: 7, height: 7, borderRadius: 4, background: apiStatus === "ok" ? t.green : t.orange, marginLeft: -8 }} title={apiStatus === "ok" ? "API connected" : "API key set"} />}
            <div style={{ width: 1, height: 16, background: t.border, margin: "0 4px" }} />
            <button onClick={()=>setIsDark(!isDark)} style={S.themeToggle} title={isDark ? "Switch to light" : "Switch to dark"}>
              <div style={S.themeKnob(isDark)} />
            </button>
          </div>
        </div>

        {/* AI LOADING */}
        {aiLoading && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "120px 24px", textAlign: "center", animation: "fadeIn 0.3s ease" }}>
            <div style={{ width: 40, height: 40, border: `3px solid ${t.border}`, borderTop: `3px solid ${t.green}`, borderRadius: "50%", animation: "spin 0.8s linear infinite", marginBottom: 20 }} />
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: t.text }}>AI is writing your brief…</div>
            <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 6 }}>
              {elapsed < 15 ? "Claude is crafting original hooks, story beats, and creative direction." :
               elapsed < 30 ? "Still working — writing tailored content takes 15-25 seconds." :
               "Taking longer than usual. Consider cancelling."}
            </div>
            <div style={{ fontSize: 24, color: t.green, fontWeight: 700, marginBottom: 24, fontVariantNumeric: "tabular-nums" }}>{elapsed}s</div>
            <button onClick={handleCancel} style={{ ...S.btnS, fontSize: 13, padding: "9px 20px" }}>Cancel</button>
          </div>
        )}

        {/* AI ERROR */}
        {aiError && !aiLoading && (
          <div style={{ margin: "20px auto", maxWidth: 600, padding: "16px 18px", background: t.red+"12", border: `1px solid ${t.red}35`, borderRadius: 10 }}>
            <div style={{ fontSize: 13, color: t.red, marginBottom: 10 }}>⚠️ {aiError}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setAiError(null)} style={{ background: "none", border: `1px solid ${t.border}`, borderRadius: 8, color: t.textMuted, cursor: "pointer", fontSize: 12, padding: "8px 16px" }}>Dismiss</button>
            </div>
          </div>
        )}

        {/* HOME */}
        {!aiLoading && view === "home" && (
          <div style={{ animation: "fadeIn 0.3s ease" }}>
            <div style={S.hero}>
              <div style={S.heroTag}>Intake Breathing — Creator Partnerships</div>
              <div style={S.heroTitle}>UGC<br/>Army</div>
              <div style={S.heroDesc}>Pick a product, vibe, and audience. Instant creator-ready brief — hooks, story arcs, compliance all baked in.</div>
              <div style={S.heroActions}>
                <button style={S.btnP} onClick={()=>{setView("create");setFormKey(k=>k+1)}}>+ New Brief</button>
                <button style={S.btnS} onClick={()=>{setView("prefilled");setFormKey(k=>k+1)}}>⚡ Test: Level Up</button>
              </div>

              {/* API key nudge */}
              {!apiKey && (
                <div style={{ marginTop: 24, fontSize: 13, color: t.textFaint }}>
                  Want AI-generated briefs? <span onClick={()=>setView("settings")} style={{ color: t.green, cursor: "pointer", fontWeight: 600 }}>Add your API key in ⚙ Settings</span>
                </div>
              )}
              {apiKey && apiStatus === "ok" && (
                <div style={{ marginTop: 24, fontSize: 13, color: t.green, fontWeight: 500 }}>
                  ✓ AI Generate connected and ready
                </div>
              )}
            </div>
            {library.length > 0 && (
              <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 24px 60px" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.textFaint, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 14 }}>Recent Briefs</div>
                {library.slice(0,5).map(item => (
                  <div key={item.id} style={S.listItem} onClick={()=>{setCurrentBrief(item.brief);setCurrentFormData(item.formData);setView("display")}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=t.green+"50"}} onMouseLeave={e=>{e.currentTarget.style.borderColor=t.border}}>
                    <div><div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{item.name}</div><div style={{ fontSize: 12, color: t.textFaint }}>{item.formData.vibe === "Other" && item.formData.customVibe?.trim() ? item.formData.customVibe.trim() : item.formData.vibe} · {formatPlatformsDisplay(item.formData)} · {formatToneDisplay(item.formData)} · {item.formData.videoLength}</div></div>
                    <div style={{ fontSize: 12, color: t.textFaint }}>→</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SETTINGS */}
        {!aiLoading && view === "settings" && (
          <div style={{ maxWidth: 600, margin: "0 auto", padding: "40px 24px 80px", animation: "fadeIn 0.3s ease" }}>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 6, color: t.text }}>Settings</div>
            <div style={{ fontSize: 14, color: t.textMuted, marginBottom: 32 }}>Configure your API key to enable ✦ AI Generate.</div>

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

            {/* How it works */}
            <div style={{ background: t.card, borderRadius: 12, border: `1px solid ${t.border}`, padding: 24, boxShadow: t.shadow }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 12 }}>How it works</div>
              <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.7 }}>
                <strong style={{ color: t.green }}>✦ AI Generate</strong> sends your brief form data to Claude Sonnet, which writes original hooks, story beats, persona descriptions, and creative direction tailored to your specific campaign. Requires an API key.
              </div>
              <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.7, marginTop: 10 }}>
                <strong style={{ color: t.textSecondary }}>⚡ Instant Draft</strong> uses built-in templates with Intake's playbook data. No API key needed. Fast but less creative.
              </div>
              <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.7, marginTop: 10 }}>
                Each AI call uses roughly 3,000 output tokens (~$0.01-0.02 per brief on Claude Sonnet).
              </div>
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
        {!aiLoading && view === "prefilled" && <div style={{ animation: "fadeIn 0.3s ease" }}><BriefForm key={`p-${formKey}`} prefill={PREFILL} onGenerate={handleGenerate} /></div>}
        {!aiLoading && view === "display" && currentBrief && <div style={{ animation: "fadeIn 0.3s ease" }}><BriefDisplay brief={currentBrief} formData={currentFormData} onBack={()=>setView("home")} onRegenerate={handleRegenTemplate} onRegenerateAI={handleRegenAI} /></div>}

        {!aiLoading && view === "library" && (
          <div style={{ maxWidth: 960, margin: "0 auto", padding: "40px 24px 60px", animation: "fadeIn 0.3s ease" }}>
            <div style={{ ...S.formTitle, marginBottom: 24 }}>Brief Library</div>
            {library.length === 0 ? (
              <div style={S.empty}><div style={{ fontSize: 32, marginBottom: 12 }}>📁</div><div style={{ fontSize: 15, marginBottom: 8 }}>No briefs yet</div><div style={{ fontSize: 13, marginBottom: 24 }}>Generated briefs will appear here.</div><button style={S.btnP} onClick={()=>setView("create")}>Create Your First Brief</button></div>
            ) : library.map(item => (
              <div key={item.id} style={S.listItem}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=t.green+"50"}} onMouseLeave={e=>{e.currentTarget.style.borderColor=t.border}}>
                <div style={{ cursor: "pointer", flex: 1 }} onClick={()=>{setCurrentBrief(item.brief);setCurrentFormData(item.formData);setView("display")}}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: t.textFaint, marginTop: 2 }}>{item.formData.vibe === "Other" && item.formData.customVibe?.trim() ? item.formData.customVibe.trim() : item.formData.vibe} · {formatPlatformsDisplay(item.formData)} · {formatToneDisplay(item.formData)} · {item.formData.videoLength}</div>
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
