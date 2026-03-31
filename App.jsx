import { useState, useRef, useCallback, useEffect, memo, createContext, useContext } from "react";

// ═══════════════════════════════════════════════════════════
// THEME SYSTEM
// ═══════════════════════════════════════════════════════════

const THEMES = {
  dark: {
    bg: "#060606", card: "#111", cardAlt: "#0d0d0d",
    border: "#222", borderLight: "#333",
    navBg: "rgba(6,6,6,0.92)",
    text: "#ffffff", textSecondary: "#cccccc", textMuted: "#999999", textFaint: "#666666",
    inputBg: "#0d0d0d", inputText: "#ffffff",
    green: "#00FEA9", blue: "#63B7BA", red: "#ff6b6b", orange: "#ffaa3b", purple: "#c084fc",
    heroGradient: "linear-gradient(135deg,#ffffff,#666666)",
    discBg: "rgba(0,0,0,0.3)",
    scrollThumb: "#222",
    isLight: false,
    shadow: "none",
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

const PRODUCTS = ["Starter Kit Black", "Starter Kit Clear", "Mouth Tape", "Case", "Other"];

const VIBES = ["Fun & Entertaining", "Educational / How-To", "Trend / Challenge", "Unboxing / First Impressions", "Lifestyle / Routine", "Before & After", "Storytelling / Testimonial", "ASMR / Satisfying"];

const AUDIENCES = [
  { label: "Young Adults (18–25) — TikTok native", value: "Men & women 18-25 on TikTok. Trend-driven, skeptical of ads, loves challenges and authentic reactions. They scroll fast and need a reason to stop." },
  { label: "Adults (25–40) — Sleep & wellness", value: "Men & women 25-40 interested in sleep quality and wellness. They've tried nasal strips, mouth tape, or nothing. Open to new solutions but need proof it works." },
  { label: "Athletes & Fitness", value: "Active men & women 18-40 who train regularly. They care about airflow, recovery, and performance. They've seen nose strips on athletes and are curious about something better." },
  { label: "Snorers & Partners of Snorers", value: "Adults 30-50 who snore or share a bed with someone who does. They're frustrated, have tried everything, and are skeptical but desperate for something that actually works." },
  { label: "Allergy Sufferers", value: "Adults 20-45 dealing with seasonal allergies and nasal congestion. They rely on meds but want a drug-free option that helps them breathe easier, especially at night." },
  { label: "Mouth Breathers / Mouth Tape Curious", value: "Health-conscious adults 20-40 who've heard about the benefits of nasal breathing and mouth taping. They want to stop mouth breathing at night but need something that actually opens the nose." },
  { label: "Custom", value: "" },
];

const PROBLEMS = [
  { label: "Think it's one-size-fits-all / won't fit", value: "People assume Intake is one-size-fits-all and write it off thinking it won't fit their nose. They don't realize the Starter Kit comes with 4 different sizes — so there's a level for every nose." },
  { label: "Think it's just a nasal strip", value: "People lump Intake in with flimsy nasal strips. They don't understand it uses magnets to physically hold the nose open from the outside — it's a completely different category." },
  { label: "Skeptical it actually works", value: "They've seen it in their feed but think it's gimmicky. They need real reactions and real proof to believe a little magnetic band can actually change how they breathe." },
  { label: "Don't know it's reusable", value: "People assume it's disposable like strips — use once, throw away. They don't realize the band is reusable and you only replace the cheap adhesive tabs." },
  { label: "Embarrassed by how it looks", value: "They think it looks weird on their face. They need to see real people wearing it confidently — and the Clear option exists for people who want something invisible." },
  { label: "Snoring — tried everything, nothing works", value: "They've tried strips, sprays, pillows, even mouth guards. Nothing sticks (literally). They're frustrated and skeptical that anything new will be different." },
  { label: "Mouth breathing but don't know how to fix it", value: "They know mouth breathing is bad but can't seem to stop, especially at night. They need something that makes nasal breathing easy and automatic." },
  { label: "Custom", value: "" },
];

const STAT_OPTIONS = [
  { id: "snoring", label: "88% reduced snoring", full: "88% of users reported reduced snoring (SleepScore Labs, 840+ nights, Dec 2024)" },
  { id: "sleep", label: "87% deeper sleep", full: "87% of users reported deeper, more restful sleep (SleepScore Labs, 840+ nights, Dec 2024)" },
  { id: "sinus", label: "92% sinus pressure relief", full: "92% of users reported sinus pressure relief (SleepScore Labs, 840+ nights, Dec 2024)" },
  { id: "breathe", label: "96% easier breathing night one", full: "96% of users reported easier breathing from night one (SleepScore Labs, 840+ nights, Dec 2024)" },
  { id: "congestion", label: "41% less nasal congestion", full: "41% reduction in perceived nasal congestion (SleepScore Labs, 840+ nights, Dec 2024)" },
  { id: "expansion", label: "88%+ nasal passageway expansion", full: "Expands nasal passageway by over 88%" },
  { id: "sizes", label: "4 sizes fit 90% of noses", full: "Fits 90% of noses with 4 included sizes" },
  { id: "customers", label: "1,000,000+ customers", full: "Trusted by over 1,000,000 customers" },
  { id: "fda", label: "FDA registered / Made in USA", full: "FDA registered, medical grade, hypoallergenic, latex-free, made in USA" },
  { id: "athletes", label: "Built for motocross athletes", full: "Originally designed for professional motocross athletes" },
];

const APPROVED_CLAIMS = ["Keeps my nose open all night", "Drug-free, nothing wears off", "Easier to breathe through my nose", "Helps me sleep through allergy season", "Physically opens your nasal passages", "Comes with 4 sizes to fit your nose", "Magnetic — stays on all night", "Sweat-proof, won't fall off", "Built for athletes, loved by everyone", "Reusable band, just replace the tabs", "90-day risk-free trial"];
const BANNED_CLAIMS = ['"Treats allergies" or "allergy cure"', '"Clears congestion" or "decongestant"', '"Replaces your allergy medication"', '"Clinically proven" (without SleepScore citation)', '"Medical device" (it\'s FDA registered, not cleared/approved)', '"Guarantees fit" — say "fits 90% of noses" instead', 'Any medical diagnosis language', '"Cures" anything'];
const DISCLOSURE = "Source: SleepScore Labs Independent Study, 840+ nights analyzed, Dec 2024. Must appear as text overlay or in caption any time a stat is referenced.";

const PLATFORMS = ["TikTok", "Instagram Reels", "YouTube Shorts", "Facebook", "Multi-platform"];
const LENGTHS = ["15-30s", "30-60s", "60-90s", "90s+"];
const TONES = ["Real & relatable", "Funny & casual", "Aspirational", "Educational", "Dramatic/storytelling", "ASMR/satisfying"];

const PREFILL = {
  productName: "Starter Kit Black", campaignName: "The Level Up", vibe: "Fun & Entertaining",
  mission: "Four sizes. One that's perfect for you. How far can you level up?",
  audienceKey: 0, problemKey: 0, customAudience: "", customProblem: "",
  selectedStats: ["snoring", "sleep", "expansion", "sizes", "customers", "fda", "athletes"],
  platform: "TikTok", videoLength: "15-30s", tone: "Funny & casual",
  notes: "Creator tries each level 1→4 on camera. Quick cuts. Reaction-driven. Each level opens the nose wider. Payoff is Level 4 where their nose opens WIDE and the genuine reaction IS the content.\n\nHook ideas: 'I don't even know if I can make it to Level 4' / 'This comes with FOUR sizes??' / 'Level 1 was easy... Level 4 broke me.'\n\nThe Level Up isn't about needing Level 4 — it's about finding YOUR level. But the entertainment value is the journey to 4. Keep it fun, not medical. Show the magnetic snap-on moment — it's satisfying and shareable.",
};

const DEFAULTS = {
  productName: "Starter Kit Black", campaignName: "", vibe: "Fun & Entertaining", mission: "",
  audienceKey: 0, problemKey: 0, customAudience: "", customProblem: "",
  selectedStats: ["snoring", "sleep", "sizes", "customers", "fda"],
  platform: "TikTok", videoLength: "15-30s", tone: "Real & relatable", notes: "",
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
  "Multi-platform": "Shoot 9:16 at max resolution. TikTok = fast; Facebook = more context. Separate files per platform.",
};
const LENGTH_GUIDE = {
  "15-30s": "Hook by second 2, problem by 5, solution by 15, CTA in last 3.",
  "30-60s": "Hook in 3s, 15s problem/agitate, 20s solution/demo, CTA at end.",
  "60-90s": "Fuller story arc. Build tension. Still front-load the hook.",
  "90s+": "Break into chapters. Keep energy high. Don't let the middle drag.",
};
const PERSONAS = ["The Curious Scroller", "The Skeptical Shopper", "The Scroll-Past Skeptic", "The Late-Night Browser", "The Try-Anything Explorer", "The Sleep Seeker", "The Mouth-Breather in Denial"];

function generateBrief(d) {
  const fullProduct = d.productName === "Other" ? "Intake Breathing" : `Intake Breathing — ${d.productName}`;
  const mission = d.mission || `Discover what ${fullProduct} can do for you.`;
  const audObj = AUDIENCES[d.audienceKey];
  const audienceText = audObj.label === "Custom" ? d.customAudience : audObj.value;
  const ageMatch = audienceText.match(/(\d{1,2}\s*[-–]\s*\d{1,2})/);
  const age = ageMatch ? ageMatch[1].replace(/\s/g, "") : "18-44";
  const probObj = PROBLEMS[d.problemKey];
  const problemText = probObj.label === "Custom" ? d.customProblem : probObj.value;
  const problemSentences = splitSentences(problemText);
  const persona = PERSONAS[Math.floor(Math.random() * PERSONAS.length)];
  const psycho = audienceText.length > 20 ? audienceText : "They've seen the product in their feed but haven't pulled the trigger. Open-minded but need proof. They trust real people over polished ads.";
  const isStarterKit = d.productName.startsWith("Starter Kit");
  const isMouthTape = d.productName === "Mouth Tape";
  const solBase = isStarterKit ? "The Starter Kit includes 4 sizes that fit 90% of noses. Each level opens your nose wider. It's magnetic, reusable, and stays on all night." : isMouthTape ? "Intake Mouth Tape keeps your mouth closed so you breathe through your nose all night. Pair with the nasal dilator for max airflow." : `${fullProduct} is part of the Intake Breathing system for better nasal breathing.`;
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
  const hooks = TONE_HOOKS[d.tone] || TONE_HOOKS["Real & relatable"];
  const proof = d.selectedStats.map(id => { const s = STAT_OPTIONS.find(o => o.id === id); return s ? s.full : ""; }).filter(Boolean);
  const platNotes = (PLATFORM_NOTES[d.platform] || "") + "\n\n" + (LENGTH_GUIDE[d.videoLength] || "");
  const deliverables = `Submit: (1) Final video — vertical 9:16, 1080×1920 min, ${d.videoLength}. (2) Raw footage. (3) One thumbnail still. Upload via creator portal.`;
  return { mission, persona, age, psycho, theyAre, theyAreNot, probInst, probLines, probOverlays, agInst, agLines, agOverlays, solInst, solLines, solOverlays, hooks, sayThis: pick(APPROVED_CLAIMS, 5), notThis: BANNED_CLAIMS.slice(0, 5), disclosure: DISCLOSURE, proof: proof.length > 0 ? proof.slice(0, 4) : ["1,000,000+ customers", "FDA registered", "Made in USA", "90-day risk-free trial"], platNotes, deliverables };
}

// ═══════════════════════════════════════════════════════════
// FORM
// ═══════════════════════════════════════════════════════════

const BriefForm = memo(function BriefForm({ prefill, onGenerate }) {
  const { t, S } = useContext(ThemeContext);
  const [audienceKey, setAudienceKey] = useState(prefill ? prefill.audienceKey : 0);
  const [problemKey, setProblemKey] = useState(prefill ? prefill.problemKey : 0);
  const [selectedStats, setSelectedStats] = useState(prefill ? [...prefill.selectedStats] : [...DEFAULTS.selectedStats]);
  const vals = useRef({
    productName: prefill?.productName || DEFAULTS.productName,
    campaignName: prefill?.campaignName || DEFAULTS.campaignName,
    vibe: prefill?.vibe || DEFAULTS.vibe,
    mission: prefill?.mission || "",
    customAudience: prefill?.customAudience || "",
    customProblem: prefill?.customProblem || "",
    platform: prefill?.platform || DEFAULTS.platform,
    videoLength: prefill?.videoLength || DEFAULTS.videoLength,
    tone: prefill?.tone || DEFAULTS.tone,
    notes: prefill?.notes || "",
  });
  const toggleStat = (id) => setSelectedStats(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  const go = useCallback((mode) => {
    const v = vals.current;
    if (AUDIENCES[audienceKey].label === "Custom" && !v.customAudience.trim()) { alert("Please describe your target audience."); return; }
    if (PROBLEMS[problemKey].label === "Custom" && !v.customProblem.trim()) { alert("Please describe the core problem."); return; }
    onGenerate({
      mode,
      productName: v.productName, campaignName: v.campaignName, vibe: v.vibe, mission: v.mission,
      audienceKey, problemKey, customAudience: v.customAudience, customProblem: v.customProblem,
      selectedStats, platform: v.platform, videoLength: v.videoLength, tone: v.tone, notes: v.notes,
      // Resolved text for AI prompt
      _audience: AUDIENCES[audienceKey].label === "Custom" ? v.customAudience : AUDIENCES[audienceKey].value,
      _problem: PROBLEMS[problemKey].label === "Custom" ? v.customProblem : PROBLEMS[problemKey].value,
      _stats: selectedStats.map(id => { const s = STAT_OPTIONS.find(o => o.id === id); return s ? s.full : ""; }).filter(Boolean).join(". "),
      _approved: APPROVED_CLAIMS.join(". "),
      _banned: BANNED_CLAIMS.join(". "),
      _disclosure: DISCLOSURE,
    });
  }, [onGenerate, audienceKey, problemKey, selectedStats]);
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
        <div style={S.r2}>{mkSel("productName", "Product *", PRODUCTS)}{mkSel("vibe", "Campaign Vibe", VIBES)}</div>
        <div style={S.r2}>
          <div style={S.fg}><label style={S.label}>Campaign Name</label>
            <input style={S.input} defaultValue={vals.current.campaignName} onChange={e=>{vals.current.campaignName=e.target.value}} onFocus={e=>{e.target.style.borderColor=t.green}} onBlur={e=>{e.target.style.borderColor=t.border}} placeholder='e.g. "The Level Up"' /></div>
          <div style={S.fg}><label style={S.label}>One-Line Mission</label>
            <input style={S.input} defaultValue={vals.current.mission} onChange={e=>{vals.current.mission=e.target.value}} onFocus={e=>{e.target.style.borderColor=t.green}} onBlur={e=>{e.target.style.borderColor=t.border}} placeholder="The soul of this campaign" /></div>
        </div>
      </div>
      <div style={S.section}>
        <div style={S.secLabel}>👤 Audience & Problem</div>
        <div style={S.fg}><label style={S.label}>Target Audience</label>
          <select style={S.select} value={audienceKey} onChange={e=>setAudienceKey(Number(e.target.value))}>
            {AUDIENCES.map((a,i)=><option key={i} value={i}>{a.label}</option>)}
          </select>
          {AUDIENCES[audienceKey].label !== "Custom" && <div style={S.hint}>{AUDIENCES[audienceKey].value}</div>}
        </div>
        {AUDIENCES[audienceKey].label === "Custom" && <div style={S.fg}><textarea style={S.textarea} defaultValue={vals.current.customAudience} onChange={e=>{vals.current.customAudience=e.target.value}} onFocus={e=>{e.target.style.borderColor=t.green}} onBlur={e=>{e.target.style.borderColor=t.border}} placeholder="Describe your target audience" rows={3} /></div>}
        <div style={S.fg}><label style={S.label}>Core Problem</label>
          <select style={S.select} value={problemKey} onChange={e=>setProblemKey(Number(e.target.value))}>
            {PROBLEMS.map((p,i)=><option key={i} value={i}>{p.label}</option>)}
          </select>
          {PROBLEMS[problemKey].label !== "Custom" && <div style={S.hint}>{PROBLEMS[problemKey].value}</div>}
        </div>
        {PROBLEMS[problemKey].label === "Custom" && <div style={S.fg}><textarea style={S.textarea} defaultValue={vals.current.customProblem} onChange={e=>{vals.current.customProblem=e.target.value}} onFocus={e=>{e.target.style.borderColor=t.green}} onBlur={e=>{e.target.style.borderColor=t.border}} placeholder="The misconception or emotional block" rows={3} /></div>}
      </div>
      <div style={S.section}>
        <div style={S.secLabel}>📊 Proof Points — tap to include</div>
        <div style={S.chipGrid}>
          {STAT_OPTIONS.map(st => <div key={st.id} style={S.chip(selectedStats.includes(st.id))} onClick={()=>toggleStat(st.id)}>{selectedStats.includes(st.id) ? "✓ " : ""}{st.label}</div>)}
        </div>
        <div style={{ ...S.hint, marginTop: 10 }}>Selected stats become proof point cards. SleepScore citation auto-included.</div>
      </div>
      <div style={S.section}>
        <div style={S.secLabel}>⚖️ Compliance — auto-included</div>
        <div style={S.cols2}>
          <div><div style={{ fontSize: 12, fontWeight: 700, color: t.green, marginBottom: 8 }}>✅ Approved</div>
            <div style={S.roBox}>{APPROVED_CLAIMS.map((c,i)=><div key={i} style={S.roItem()}><span style={S.roMarker(t.green)}>✓</span>{c}</div>)}</div></div>
          <div><div style={{ fontSize: 12, fontWeight: 700, color: t.red, marginBottom: 8 }}>❌ Banned</div>
            <div style={S.roBox}>{BANNED_CLAIMS.map((c,i)=><div key={i} style={S.roItem()}><span style={S.roMarker(t.red)}>✗</span>{c}</div>)}</div></div>
        </div>
        <div style={{ ...S.roBox, marginTop: 12, borderColor: t.red+"40", color: t.red, fontSize: 12 }}>⚠️ {DISCLOSURE}</div>
      </div>
      <div style={S.section}>
        <div style={S.secLabel}>🎬 Format & Tone</div>
        <div style={S.r3}>{mkSel("platform", "Platform", PLATFORMS)}{mkSel("videoLength", "Video Length", LENGTHS)}{mkSel("tone", "Tone", TONES)}</div>
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
        <div style={S.bCampaign}>{fd.campaignName || fd.productName}</div>
        <div style={S.bMission}>"{b.mission}"</div>
        <div style={S.badges}>
          <span style={S.badge(t.text)}>{fd.productName}</span>
          <span style={S.badge(t.purple)}>{fd.vibe}</span>
          <span style={S.badge(t.blue)}>{fd.platform}</span>
          <span style={S.badge(t.orange)}>{fd.videoLength}</span>
          <span style={S.badge(t.green)}>{fd.tone}</span>
        </div>
      </div>
      <div style={S.bSec}>
        <div style={S.bSecTitle}>👤 Who You're Talking To</div>
        <div style={S.card}>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, color: t.text }}>{b.persona}</div>
          <div style={{ fontSize: 13, color: t.blue, fontWeight: 600, marginBottom: 10 }}>{b.age}</div>
          <div style={{ fontSize: 14, color: t.textMuted, lineHeight: 1.6, marginBottom: 16 }}>{b.psycho}</div>
          <div style={S.cols2}>
            <div><div style={S.sayH(t.green)}>They Are ✓</div>{b.theyAre.map((x,i)=><div key={i} style={S.li}><span style={S.mk(t.green)}>✓</span>{x}</div>)}</div>
            <div><div style={S.sayH(t.red)}>They Are Not ✗</div>{b.theyAreNot.map((x,i)=><div key={i} style={S.li}><span style={S.mk(t.red)}>✗</span>{x}</div>)}</div>
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
            <div style={S.beatInst}>{bt.inst}</div>
            <div style={S.beatSub}>Lines to riff on</div>
            {bt.lines.map((l,i)=><div key={i} style={S.beatLine}>"{l}"</div>)}
            <div style={{ ...S.beatSub, marginTop: 12 }}>Overlay ideas</div>
            {bt.overlays.map((o,i)=><div key={i} style={{ ...S.beatLine, borderLeftColor: bt.color+"40" }}>{o}</div>)}
          </div>
        ))}
      </div>
      <div style={S.bSec}>
        <div style={S.bSecTitle}>🪝 Hook Options — First 3 Seconds</div>
        <div style={{ fontSize: 12, color: t.textFaint, fontStyle: "italic", marginBottom: 14 }}>If they don't feel it here, they scroll.</div>
        <div style={S.card}>{b.hooks.map((h,i)=>(<div key={i} style={S.hookItem}><div style={S.hookNum}>{i+1}</div><div style={S.hookText}>{h}</div></div>))}</div>
      </div>
      <div style={S.bSec}>
        <div style={S.bSecTitle}>✅ Say This / 🚫 Not This</div>
        <div style={S.cols2}>
          <div style={S.sayCol}><div style={S.sayH(t.green)}>✅ Say This</div>{b.sayThis.map((s,i)=><div key={i} style={S.li}><span style={S.mk(t.green)}>✓</span>{s}</div>)}</div>
          <div style={S.dontCol}><div style={S.sayH(t.red)}>🚫 Not This</div>{b.notThis.map((s,i)=><div key={i} style={S.li}><span style={S.mk(t.red)}>✗</span>{s}</div>)}</div>
        </div>
      </div>
      <div style={S.bSec}>
        <div style={S.bSecTitle}>📊 Proof Points</div>
        <div style={S.proofGrid}>{b.proof.map((p,i)=><div key={i} style={S.proofCard}>{p}</div>)}</div>
      </div>
      <div style={S.bSec}>
        <div style={S.bSecTitle}>⚠️ Required Disclosure — Non-Negotiable</div>
        <div style={S.discBox}><div style={S.discLabel}>Must appear when any stat is referenced</div><div style={S.discText}>{b.disclosure}</div></div>
      </div>
      <div style={S.bSec}>
        <div style={S.bSecTitle}>📱 Platform Notes</div>
        <div style={S.card}><div style={{ fontSize: 14, color: t.textSecondary, lineHeight: 1.6, whiteSpace: "pre-line" }}>{b.platNotes}</div></div>
      </div>
      <div style={S.bSec}>
        <div style={S.bSecTitle}>📦 Deliverables</div>
        <div style={S.card}><div style={{ fontSize: 14, color: t.textSecondary, lineHeight: 1.6 }}>{b.deliverables}</div></div>
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
  return `You are an expert UGC (user-generated content) brief writer for Intake Breathing, a magnetic nasal dilator company. Write a complete creator brief. Be specific, creative, and tailored to this exact campaign — not generic.

PRODUCT: ${d.productName} by Intake Breathing
CAMPAIGN NAME: ${d.campaignName || "Untitled"}
CAMPAIGN VIBE: ${d.vibe}
MISSION: ${d.mission || "N/A"}
TARGET AUDIENCE: ${d._audience}
CORE PROBLEM TO SOLVE: ${d._problem}
PROOF POINTS / STATS: ${d._stats}
PLATFORM: ${d.platform} | LENGTH: ${d.videoLength} | TONE: ${d.tone}
APPROVED CLAIMS (creators CAN say): ${d._approved}
BANNED CLAIMS (NEVER say): ${d._banned}
REQUIRED DISCLOSURE: ${d._disclosure}
CREATIVE DIRECTION / NOTES: ${d.notes || "None"}

Write the brief as JSON. Be CREATIVE and SPECIFIC to this campaign — don't be generic. Write hooks that would actually stop someone mid-scroll. Write riff lines that sound like a real person talking, not marketing copy. Overlay ideas should be specific visual directions.

Return ONLY this JSON (no other text):
{"mission":"one line mission statement","persona":"creative persona name for the target viewer","age":"age range","psycho":"2-3 sentences describing their mindset, fears, desires — be vivid and specific","theyAre":["4 psychographic traits that describe this viewer"],"theyAreNot":["4 things this viewer is NOT — help creators avoid wrong assumptions"],"probInst":"directive for the PROBLEM beat — tell the creator exactly what to show/say in the opening","probLines":["3 specific lines creators can say or riff on for the problem beat — conversational, not corporate"],"probOverlays":["3 specific text overlay or visual ideas for the problem beat"],"agInst":"directive for the AGITATE beat — how to twist the knife and create urgency","agLines":["3 agitate lines — make the viewer feel the cost of inaction"],"agOverlays":["3 overlay/visual ideas for the agitate beat"],"solInst":"directive for the SOLUTION beat — the payoff, the reveal, the transformation","solLines":["3 solution lines — the relief, the wow moment, the conversion push"],"solOverlays":["3 overlay/visual ideas for the solution beat"],"hooks":["4 scroll-stopping hook options for the first 2-3 seconds — these must be thumb-stoppers"],"sayThis":["5 approved phrases creators should use"],"notThis":["5 phrases creators must NEVER say"],"disclosure":"exact required citation text","proof":["4 formatted stat cards"],"platNotes":"platform-specific tips for ${d.platform} at ${d.videoLength}","deliverables":"what creators need to submit and format specs"}`;
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
  const apiKeyRef = useRef("");
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
    if (keyVal) { setApiKey(keyVal); apiKeyRef.current = keyVal; }

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
    setLibrary(prev => [{ id: Date.now(), name: formData.campaignName || formData.productName, brief, formData, date: new Date().toLocaleDateString() }, ...prev]);
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
    apiKeyRef.current = key;
    setApiStatus(null);
    setApiMsg("");
    storageSet("intake-apikey", key);
    return key;
  };

  const getApiHeaders = (keyOverride) => {
    const key = keyOverride || apiKeyRef.current || apiKey;
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
    if (!apiKeyRef.current) {
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
          headers: {
            "Content-Type": "application/json",
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
            "x-api-key": apiKeyRef.current,
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
            <div><div style={S.navTitle}>INTAKE</div><div style={S.navSub}>Brief Command Center</div></div>
          </div>
          <div style={S.navLinks}>
            <button style={S.navBtn(view==="home")} onClick={()=>setView("home")}>Home</button>
            <button style={S.navBtn(view==="create")} onClick={()=>{setView("create");setFormKey(k=>k+1)}}>New Brief</button>
            <button style={S.navBtn(view==="library")} onClick={()=>setView("library")}>Library{library.length>0&&` (${library.length})`}</button>
            <button style={S.navBtn(view==="settings")} onClick={()=>setView("settings")}>⚙</button>
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
              <div style={S.heroTag}>Intake Breathing — Internal Tool</div>
              <div style={S.heroTitle}>UGC Brief<br/>Command Center</div>
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
                    <div><div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{item.name}</div><div style={{ fontSize: 12, color: t.textFaint }}>{item.formData.vibe} · {item.formData.platform} · {item.formData.videoLength}</div></div>
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
                  <div style={{ fontSize: 12, color: t.textFaint, marginTop: 2 }}>{item.formData.vibe} · {item.formData.platform} · {item.formData.videoLength}</div>
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
