import React, { useState, useRef, useEffect, useCallback, useContext } from "react";
import { supabase } from "../supabase.js";
import { dbGetSetting } from "../supabaseDb.js";
import ThemeContext from "../ThemeContext.js";
import { Icon } from "./Icons.jsx";


const PRODUCTS = [
  "Starter Kit Black — Includes 4 sizes (S, M, L, XL) + 15 tab sets. Magnetic nasal dilator with reusable band.",
  "Starter Kit Clear — Includes 4 sizes (S, M, L, XL) + 15 tab sets. Magnetic nasal dilator with reusable band.",
  "Mouth Tape Sleep Strips — Mouth breathing prevention strips for better sleep.",
  "Sports Tabs — High-adhesion replacement tabs for intense activity.",
  "Refills — Standard replacement adhesive tab sets.",
  "Case — Protective carrying case for the Intake band.",
  "All Products",
  "Other",
];

/** Brief form / stored briefs use the short name (before " — "). */
function productOptionName(p) {
  const s = String(p ?? "").trim();
  const i = s.indexOf(" — ");
  return i === -1 ? s : s.slice(0, i).trim();
}

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

// formatCount moved to utils/helpers.js

// durationToSeconds, gcd, aspectRatioLabel moved to utils/helpers.js

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
  const raw = Array.isArray(productsOverride) && productsOverride.length ? productsOverride : PRODUCTS;
  const pList = raw.map(productOptionName);
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
    ibScoreWeights: {
      instagram: 45,
      tiktok: 30,
      crossPlatform: 10,
      contentAlignment: 15,
    },
    ibScoreLabels: {
      "80-100": "Elite",
      "65-79": "Excellent",
      "50-64": "Strong",
      "35-49": "Promising",
      "1-34": "Low Fit",
    },
    creatorAnalysisPrompt:
      "Analyze this creator for UGC partnership potential with Intake Breathing. Evaluate content quality, audience fit, engagement authenticity, and brand safety. Flag any competitor product mentions (Breathe Right, Rhinomed, Mute, AirMax). Assess if their content style matches Intake's authentic, creator-led approach.",
    outreachStyle:
      "Casual, authentic, personalized. Reference something specific about their content. Mention Intake Breathing by name. Don't mention payment in DMs — keep it about the product and partnership potential. Emails can be slightly more formal but still warm.",
    cpmTiers: [
      { maxFollowers: 5000, cpm: 5, label: "Nano (<5K)" },
      { maxFollowers: 15000, cpm: 8, label: "Micro (5-15K)" },
      { maxFollowers: 50000, cpm: 12, label: "Rising (15-50K)" },
      { maxFollowers: 150000, cpm: 16, label: "Mid (50-150K)" },
      { maxFollowers: 500000, cpm: 20, label: "Established (150-500K)" },
      { maxFollowers: 1e15, cpm: 25, label: "Major (500K+)" },
    ],
    cpmCap: 25,
    rateFloor: 50,
    rateCeiling: 500,
    alignmentKeywords: [
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
    ],
    competitorKeywords: ["breathe right", "rhinomed", "mute snoring", "airmax"],
  };
}

/** Merge Supabase-loaded slices with defaults (nested weights/labels). */
function mergeAiKnowledge(partial) {
  const d = getDefaultAiKnowledge();
  if (!partial || typeof partial !== "object") return d;
  return {
    ...d,
    ...partial,
    ibScoreWeights: { ...d.ibScoreWeights, ...(partial.ibScoreWeights && typeof partial.ibScoreWeights === "object" ? partial.ibScoreWeights : {}) },
    ibScoreLabels: { ...d.ibScoreLabels, ...(partial.ibScoreLabels && typeof partial.ibScoreLabels === "object" ? partial.ibScoreLabels : {}) },
    cpmTiers: Array.isArray(partial.cpmTiers) && partial.cpmTiers.length ? partial.cpmTiers : d.cpmTiers,
    alignmentKeywords: Array.isArray(partial.alignmentKeywords) ? partial.alignmentKeywords : d.alignmentKeywords,
    competitorKeywords: Array.isArray(partial.competitorKeywords) ? partial.competitorKeywords : d.competitorKeywords,
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
  const isMouthTape = /^Mouth Tape/i.test(productLabel);
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
  if (typeof pName === "string" && pName.trim()) {
    const trimmed = pName.trim();
    const hit = productsList.find((p) => productOptionName(p) === trimmed || p === trimmed);
    if (hit) {
      out.productName = productOptionName(hit);
      out.customProductName = out.productName === "Other" ? String(extracted.customProductName ?? "").trim() : "";
    } else {
      out.productName = "Other";
      out.customProductName = trimmed;
    }
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

function IBAiSourceOfTruth({ t, aiKnowledge, onSave, homepage, startOpen }) {
  const ak = aiKnowledge && typeof aiKnowledge === "object" ? aiKnowledge : getDefaultAiKnowledge();
  const [open, setOpen] = useState(!!startOpen);
  const [activeSection, setActiveSection] = useState("brand");
  const [editing, setEditing] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const sections = [
    { id: "brand", label: "Brand Context" },
    { id: "products", label: "Products" },
    { id: "scoring", label: "IB Score" },
    { id: "rates", label: "Rate Calculator" },
    { id: "outreach", label: "Outreach Style" },
    { id: "competitors", label: "Competitors" },
    { id: "alignment", label: "Content Alignment" },
    { id: "approved", label: "Approved Claims" },
    { id: "banned", label: "Banned Claims" },
    { id: "rejections", label: "Revision Criteria" },
    { id: "tones", label: "Tone & Hooks" },
    { id: "platforms", label: "Platform Specs" },
    { id: "lengths", label: "Video Lengths" },
  ];

  const startEdit = (field, currentValue) => {
    setEditing(field);
    if (Array.isArray(currentValue)) {
      setEditDraft(currentValue.join("\n"));
    } else if (typeof currentValue === "object" && currentValue !== null) {
      setEditDraft(JSON.stringify(currentValue, null, 2));
    } else if (typeof currentValue === "number" && Number.isFinite(currentValue)) {
      setEditDraft(String(currentValue));
    } else {
      setEditDraft(String(currentValue || ""));
    }
  };

  const saveEdit = async (field) => {
    setSaving(true);
    try {
      let value;
      if (field === "brandContext" || field === "creatorAnalysisPrompt" || field === "outreachStyle") {
        value = editDraft;
      } else if (
        field === "toneHooks" ||
        field === "platformNotes" ||
        field === "lengthGuide" ||
        field === "ibScoreWeights" ||
        field === "ibScoreLabels" ||
        field === "cpmTiers"
      ) {
        value = JSON.parse(editDraft);
      } else if (field === "cpmCap" || field === "rateFloor" || field === "rateCeiling") {
        const n = Number(editDraft);
        if (!Number.isFinite(n)) throw new Error("Enter a valid number");
        value = n;
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
          <span>IB-Ai Source of Truth</span>
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

          {activeSection === "brand" && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 8 }}>Brand Context Given to IB-Ai</div>
              {renderEditableText("brandContext", ak.brandContext || "")}
            </div>
          )}

          {activeSection === "products" && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 8 }}>Intake Breathing Products</div>
              {editing === "products" ? (
                <div>
                  <textarea
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    style={{ width: "100%", minHeight: 200, padding: 10, borderRadius: 8, border: `1px solid ${t.green}`, background: t.inputBg, color: t.inputText, fontSize: 12, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}
                    placeholder="One product per line (same text shown above; brief form uses the name before — )"
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button type="button" onClick={() => saveEdit("products")} disabled={saving} style={{ padding: "6px 16px", borderRadius: 6, border: "none", background: t.green, color: t.isLight ? "#fff" : "#000", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{saving ? "Saving..." : "Save"}</button>
                    <button type="button" onClick={() => setEditing(null)} style={{ padding: "6px 16px", borderRadius: 6, border: `1px solid ${t.border}`, background: "transparent", color: t.textMuted, fontSize: 12, cursor: "pointer" }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div>
                  {products.map((p, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "6px 0",
                        fontSize: 12,
                        color: t.text,
                        lineHeight: 1.6,
                        borderBottom: `1px solid ${t.border}10`,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {p}
                    </div>
                  ))}
                  <button type="button" onClick={() => startEdit("products", products)} style={{ marginTop: 8, padding: "4px 12px", borderRadius: 6, border: `1px dashed ${t.border}`, background: "transparent", color: t.textFaint, fontSize: 11, cursor: "pointer" }}>✎ Edit</button>
                </div>
              )}
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
              <div style={{ marginTop: 16, fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 8 }}>Personas</div>
              <div style={{ marginTop: 8 }}>{renderEditableList("personas", ak.personas, t.blue, "•")}</div>
            </div>
          )}

          {activeSection === "scoring" && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 8 }}>IB Score Calculation (1-100)</div>
              {editing === "ibScoreWeights" ? renderEditableJSON("ibScoreWeights", ak.ibScoreWeights) : (
                <div>
                  {Object.entries(ak.ibScoreWeights || {}).map(([key, val]) => (
                    <div key={key} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${t.border}10` }}>
                      <span style={{ fontSize: 12, color: t.text, textTransform: "capitalize" }}>{key.replace(/([A-Z])/g, " $1")}</span>
                      <span style={{ fontSize: 16, fontWeight: 800, color: t.green }}>{val}%</span>
                    </div>
                  ))}
                  <button type="button" onClick={() => startEdit("ibScoreWeights", ak.ibScoreWeights)} style={{ marginTop: 8, padding: "4px 12px", borderRadius: 6, border: `1px dashed ${t.border}`, background: "transparent", color: t.textFaint, fontSize: 11, cursor: "pointer" }}>✎ Edit Weights</button>
                </div>
              )}
              <div style={{ marginTop: 16, fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 6 }}>Score Labels</div>
              {editing === "ibScoreLabels" ? renderEditableJSON("ibScoreLabels", ak.ibScoreLabels) : (
                <div>
                  {Object.entries(ak.ibScoreLabels || {}).map(([range, label]) => (
                    <div key={range} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12 }}>
                      <span style={{ color: t.textMuted }}>{range}</span>
                      <span style={{ fontWeight: 700, color: t.text }}>{label}</span>
                    </div>
                  ))}
                  <button type="button" onClick={() => startEdit("ibScoreLabels", ak.ibScoreLabels)} style={{ marginTop: 8, padding: "4px 12px", borderRadius: 6, border: `1px dashed ${t.border}`, background: "transparent", color: t.textFaint, fontSize: 11, cursor: "pointer" }}>✎ Edit Labels</button>
                </div>
              )}
            </div>
          )}

          {activeSection === "rates" && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 8 }}>Rate Calculator Parameters</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
                <div style={{ background: t.cardAlt, borderRadius: 8, padding: 10, textAlign: "center" }}>
                  <div style={{ fontSize: 9, color: t.textFaint, textTransform: "uppercase" }}>CPM Cap</div>
                  {editing === "cpmCap" ? (
                    <div style={{ marginTop: 6 }}>
                      <input type="number" value={editDraft} onChange={(e) => setEditDraft(e.target.value)} style={{ width: "100%", maxWidth: 120, padding: 6, borderRadius: 6, border: `1px solid ${t.green}`, background: t.inputBg, color: t.inputText, fontSize: 14, fontWeight: 800 }} />
                      <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 6 }}>
                        <button type="button" onClick={() => saveEdit("cpmCap")} disabled={saving} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: t.green, color: t.isLight ? "#fff" : "#000", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{saving ? "…" : "Save"}</button>
                        <button type="button" onClick={() => setEditing(null)} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${t.border}`, background: "transparent", color: t.textMuted, fontSize: 11, cursor: "pointer" }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: 20, fontWeight: 800, color: t.green }}>${ak.cpmCap ?? 25}</div>
                      <button type="button" onClick={() => startEdit("cpmCap", ak.cpmCap ?? 25)} style={{ marginTop: 6, padding: "2px 8px", borderRadius: 6, border: `1px dashed ${t.border}`, background: "transparent", color: t.textFaint, fontSize: 10, cursor: "pointer" }}>✎</button>
                    </>
                  )}
                </div>
                <div style={{ background: t.cardAlt, borderRadius: 8, padding: 10, textAlign: "center" }}>
                  <div style={{ fontSize: 9, color: t.textFaint, textTransform: "uppercase" }}>Rate Floor</div>
                  {editing === "rateFloor" ? (
                    <div style={{ marginTop: 6 }}>
                      <input type="number" value={editDraft} onChange={(e) => setEditDraft(e.target.value)} style={{ width: "100%", maxWidth: 120, padding: 6, borderRadius: 6, border: `1px solid ${t.green}`, background: t.inputBg, color: t.inputText, fontSize: 14, fontWeight: 800 }} />
                      <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 6 }}>
                        <button type="button" onClick={() => saveEdit("rateFloor")} disabled={saving} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: t.green, color: t.isLight ? "#fff" : "#000", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{saving ? "…" : "Save"}</button>
                        <button type="button" onClick={() => setEditing(null)} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${t.border}`, background: "transparent", color: t.textMuted, fontSize: 11, cursor: "pointer" }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: 20, fontWeight: 800, color: t.text }}>${ak.rateFloor ?? 50}</div>
                      <button type="button" onClick={() => startEdit("rateFloor", ak.rateFloor ?? 50)} style={{ marginTop: 6, padding: "2px 8px", borderRadius: 6, border: `1px dashed ${t.border}`, background: "transparent", color: t.textFaint, fontSize: 10, cursor: "pointer" }}>✎</button>
                    </>
                  )}
                </div>
                <div style={{ background: t.cardAlt, borderRadius: 8, padding: 10, textAlign: "center" }}>
                  <div style={{ fontSize: 9, color: t.textFaint, textTransform: "uppercase" }}>Rate Ceiling</div>
                  {editing === "rateCeiling" ? (
                    <div style={{ marginTop: 6 }}>
                      <input type="number" value={editDraft} onChange={(e) => setEditDraft(e.target.value)} style={{ width: "100%", maxWidth: 120, padding: 6, borderRadius: 6, border: `1px solid ${t.green}`, background: t.inputBg, color: t.inputText, fontSize: 14, fontWeight: 800 }} />
                      <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 6 }}>
                        <button type="button" onClick={() => saveEdit("rateCeiling")} disabled={saving} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: t.green, color: t.isLight ? "#fff" : "#000", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{saving ? "…" : "Save"}</button>
                        <button type="button" onClick={() => setEditing(null)} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${t.border}`, background: "transparent", color: t.textMuted, fontSize: 11, cursor: "pointer" }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: 20, fontWeight: 800, color: t.text }}>${ak.rateCeiling ?? 500}</div>
                      <button type="button" onClick={() => startEdit("rateCeiling", ak.rateCeiling ?? 500)} style={{ marginTop: 6, padding: "2px 8px", borderRadius: 6, border: `1px dashed ${t.border}`, background: "transparent", color: t.textFaint, fontSize: 10, cursor: "pointer" }}>✎</button>
                    </>
                  )}
                </div>
              </div>

              <div style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 6 }}>CPM Tiers (by follower count)</div>
              {(ak.cpmTiers || []).map((tier, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${t.border}10`, fontSize: 12 }}>
                  <span style={{ color: t.textMuted }}>{tier.label}</span>
                  <span style={{ fontWeight: 700, color: t.green }}>${tier.cpm} CPM</span>
                </div>
              ))}
              <button type="button" onClick={() => startEdit("cpmTiers", ak.cpmTiers)} style={{ marginTop: 8, padding: "4px 12px", borderRadius: 6, border: `1px dashed ${t.border}`, background: "transparent", color: t.textFaint, fontSize: 11, cursor: "pointer" }}>✎ Edit Tiers</button>
            </div>
          )}

          {activeSection === "outreach" && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 8 }}>Outreach style</div>
              {renderEditableText("outreachStyle", ak.outreachStyle || "")}
              <div style={{ marginTop: 16, fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 8 }}>Creator analysis prompt</div>
              {renderEditableText("creatorAnalysisPrompt", ak.creatorAnalysisPrompt || "")}
            </div>
          )}

          {activeSection === "competitors" && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 8 }}>Competitor keywords</div>
              {renderEditableList("competitorKeywords", ak.competitorKeywords || [], "#ef4444", "•")}
            </div>
          )}

          {activeSection === "alignment" && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 8 }}>Content alignment keywords</div>
              {renderEditableList("alignmentKeywords", ak.alignmentKeywords || [], t.green, "•")}
            </div>
          )}

          <div style={{ marginTop: 16, fontSize: 10, color: t.textFaint, textAlign: "center" }}>
            Edits save to Supabase and apply to IB-Ai briefs, creator scoring, rate estimates, outreach, and compliance immediately.
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
              {productOpts.map((p) => {
                const name = productOptionName(p);
                return <option key={name} value={name}>{name}</option>;
              })}
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


export { PRODUCTS, productOptionName, VIBES, AGE_RANGES, GENDERS, APPROVED_CLAIMS, BANNED_CLAIMS, DEFAULT_REJECTIONS, parseCustomRejections, buildRejectionsArray, PLATFORMS, MANAGERS, LENGTHS, TONES, SUPERVISION_LEVELS, SUPERVISION_FORM_HINTS, buildBriefExtractionPrompt, splitSentences, pick, getDefaultAiKnowledge, mergeAiKnowledge, normalizePlatforms, formatPlatformsDisplay, managerDisplayName, formatToneDisplay, generateBrief, mergeExtractedBriefToPrefill, getBriefFormBaseDefaults, UploadOldBrief, IBAiSourceOfTruth, EditableField, EditableRejectionLine, RejectionAddRow, RejectionSection, BriefDisplay, buildBriefPrintHtml };
