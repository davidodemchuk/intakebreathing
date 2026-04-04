import React, { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "../supabase.js";
import { dbLoadTtsWeekly, dbSaveTtsWeek, dbDeleteTtsWeek, dbLoadTtsMonthly, dbLoadTtsTargets, dbSaveTtsTarget, dbLoadTtsMilestones, dbSaveTtsMilestone, dbDeleteTtsMilestone, dbLoadTtsCreatorWeekly, dbSaveTtsCreatorWeekly, dbDeleteTtsCreatorWeekly, dbGetSetting, dbGetOrCreateConversation, dbSaveMessage } from "../supabaseDb.js";
import { notifySlack, notifyOwners } from "../utils/notifications.js";
import { formatMetricShort } from "../utils/helpers.js";

const PIPELINE_TAB_MAP = {
  overview: "Creator Monthly",
  spend: "Partnership Spend",
  tts: "TTS Weekly",
  instagram: "Instagram Weekly",
  ugc: "UGC Weekly",
  youtube: "YT Weekly",
  sops: null,
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

function TtsNativeTab({ t, S, teamMembers, creators = [] }) {
  const [weeks, setWeeks] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRow, setEditingRow] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState("table");
  const [currentEnterer, setCurrentEnterer] = useState(() => { try { return localStorage.getItem("tts_enterer") || ""; } catch { return ""; } });
  const [targets, setTargets] = useState([]);
  const [showTargetForm, setShowTargetForm] = useState(false);
  const [targetFormData, setTargetFormData] = useState({});
  const [editingCell, setEditingCell] = useState(null);
  const [editingValue, setEditingValue] = useState("");
  const [entererDropdownOpen, setEntererDropdownOpen] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [milestoneFormData, setMilestoneFormData] = useState({});


  const [analyzingWeek, setAnalyzingWeek] = useState(null);
  const defaultColWidths = { week: 140, sf_invites: 90, requests: 85, shipped: 80, videos: 75, impressions: 110, orders: 75, gmv: 120, org_gmv: 100, paid_gmv: 100, ad_spend: 100, sv: 60, roas: 75, cpm: 70, net_video: 90, net_rev: 110, entered_by: 80, actions: 100 };
  const [colWidths, setColWidths] = useState(() => { try { const saved = localStorage.getItem("tts_col_widths"); return saved ? { ...defaultColWidths, ...JSON.parse(saved) } : { ...defaultColWidths }; } catch { return { ...defaultColWidths }; } });
  const onResizeStart = (e, colKey) => {
    e.preventDefault(); const startX = e.clientX; const startWidth = colWidths[colKey] || 100;
    const onMove = (me) => { setColWidths(prev => ({ ...prev, [colKey]: Math.max(40, startWidth + me.clientX - startX) })); };
    const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); document.body.style.cursor = ""; document.body.style.userSelect = ""; setColWidths(prev => { try { localStorage.setItem("tts_col_widths", JSON.stringify(prev)); } catch {} return prev; }); };
    document.body.style.cursor = "col-resize"; document.body.style.userSelect = "none"; document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp);
  };
  const ResizableTh = ({ colKey, children, style: thStyle }) => <th style={{ ...thStyle, width: colWidths[colKey] || 100, minWidth: 40, position: "relative", overflow: "hidden", verticalAlign: "middle" }}>{children}<div onMouseDown={(e) => onResizeStart(e, colKey)} style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 6, cursor: "col-resize", background: "transparent", zIndex: 5 }} onMouseEnter={(e) => { e.currentTarget.style.background = t.green + "40"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }} /></th>;

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [w, m, tgts, ms] = await Promise.all([dbLoadTtsWeekly(), dbLoadTtsMonthly(), dbLoadTtsTargets(), dbLoadTtsMilestones()]);
      setWeeks(w);
      setMonthly(m);
      setTargets(tgts);
      setMilestones(ms);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!entererDropdownOpen) return;
    const handler = () => setEntererDropdownOpen(false);
    setTimeout(() => document.addEventListener("click", handler), 0);
    return () => document.removeEventListener("click", handler);
  }, [entererDropdownOpen]);




  const [aiError, setAiError] = useState(null);
  const analyzeWeek = async (w) => {
    setAnalyzingWeek(w.id); setAiError(null);
    console.log("[IB-Ai] Starting analysis for week", w.week_start);
    try {
      const prevWeek = weeks.find(pw => pw.week_start < w.week_start);
      const monthWeeks = weeks.filter(mw => mw.week_start.substring(0, 7) === w.week_start.substring(0, 7));
      const creatorData = weekCreators[w.id] || [];
      const prompt = "You are IB-Ai, the analytics engine for Intake Breathing's TikTok Shop (TTS) program. Analyze this week's performance data and write a concise 3-paragraph executive summary.\n\nWEEK: " + w.week_start + " to " + w.week_end + "\n\nTHIS WEEK:\n- SF invites: " + w.superfiliate_invites + "\n- Sample requests: " + w.sample_requests + "\n- Samples shipped: " + w.samples_posted + "\n- Videos posted: " + w.videos_posted + "\n- Impressions: " + Number(w.impressions).toLocaleString() + "\n- Organic impressions: " + Number(w.organic_impressions).toLocaleString() + "\n- Orders: " + w.orders + "\n- GMV: $" + Number(w.tts_gmv).toLocaleString() + "\n- Ad spend: $" + Number(w.ad_spend).toLocaleString() + "\n- ROAS: " + (Number(w.ad_spend) > 0 ? (Number(w.tts_gmv) / Number(w.ad_spend)).toFixed(2) : "N/A") + "\n\n" + (prevWeek ? "PREVIOUS WEEK (" + prevWeek.week_start + "):\n- Videos: " + prevWeek.videos_posted + "\n- Impressions: " + Number(prevWeek.impressions).toLocaleString() + "\n- GMV: $" + Number(prevWeek.tts_gmv).toLocaleString() + "\n- Ad spend: $" + Number(prevWeek.ad_spend).toLocaleString() : "No previous week data.") + "\n\nMONTH-TO-DATE (" + monthWeeks.length + " weeks):\n- Total GMV: $" + monthWeeks.reduce((s, mw) => s + Number(mw.tts_gmv || 0), 0).toLocaleString() + "\n- Total videos: " + monthWeeks.reduce((s, mw) => s + Number(mw.videos_posted || 0), 0) + "\n\n" + (creatorData.length > 0 ? "TOP CREATORS:\n" + creatorData.map(c => "- @" + c.creator_handle + ": " + c.videos_posted + " videos, $" + Number(c.gmv).toLocaleString() + " GMV, " + c.orders + " orders").join("\n") : "No creator attribution data.") + "\n\nWrite 3 paragraphs: 1) Performance summary vs last week 2) What's working or not 3) One actionable recommendation. Be specific with numbers. Be direct.";

      const apiKey = await dbGetSetting("anthropic-api-key");
      console.log("[IB-Ai] API key:", apiKey ? "found (" + apiKey.substring(0, 8) + "...)" : "NOT FOUND");
      if (!apiKey) { alert("No Anthropic API key. Go to Settings."); setAnalyzingWeek(null); return; }
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
      });
      console.log("[IB-Ai] API response status:", res.status);
      if (!res.ok) throw new Error("API error " + res.status + ": " + (await res.text()).substring(0, 200));
      const data = await res.json();
      const summary = data.content?.[0]?.text || "Analysis failed.";
      console.log("[IB-Ai] Summary length:", summary.length);
      const updated = { ...w, ai_summary: summary, ai_analyzed_at: new Date().toISOString() };
      delete updated.created_at; delete updated.updated_at;
      await dbSaveTtsWeek(updated);
      setWeeks(prev => prev.map(wk => wk.id === w.id ? { ...wk, ai_summary: summary, ai_analyzed_at: new Date().toISOString() } : wk));
    } catch (e) { console.error("[IB-Ai] FULL ERROR:", e); setAiError({ weekId: w.id, message: e.message }); }
    setAnalyzingWeek(null);
  };

  const calc = (d) => {
    const vp = Number(d.videos_posted) || 0;
    const sf = Number(d.superfiliate_invites) || 0;
    const sr = Number(d.sample_requests) || 0;
    const sp = Number(d.samples_posted) || 0;
    const va = Number(d.videos_approved) || 0;
    const imp = Number(d.impressions) || 0;
    const orgImp = Number(d.organic_impressions) || 0;
    const orders = Number(d.orders) || 0;
    const gmv = Number(d.tts_gmv) || 0;
    const adSpend = Number(d.ad_spend) || 0;
    const sampleCost = Number(d.sample_cost) || 0;
    const creatorPay = Number(d.creator_payments) || 0;
    const commission = Number(d.tts_commission) || 0;
    const totalCost = adSpend + sampleCost + creatorPay;
    return {
      sv_ratio: vp > 0 ? (sp / vp).toFixed(2) : "\u2014",
      post_rate: sr > 0 ? ((sp / sr) * 100).toFixed(1) + "%" : "\u2014",
      approval_rate: vp > 0 ? ((va / vp) * 100).toFixed(1) + "%" : "\u2014",
      cost_per_video: vp > 0 ? "$" + Math.round(totalCost / vp).toLocaleString() : "\u2014",
      cpm: imp > 0 ? "$" + (adSpend / (imp / 1000)).toFixed(2) : "\u2014",
      roas: adSpend > 0 ? (gmv / adSpend).toFixed(2) + "x" : "\u2014",
      net_revenue: "$" + Math.round(gmv - totalCost - commission).toLocaleString(),
      net_per_video: vp > 0 ? "$" + Math.round((gmv - totalCost - commission) / vp).toLocaleString() : "\u2014",
      avg_order_value: orders > 0 ? "$" + (gmv / orders).toFixed(2) : "\u2014",
      organic_gmv_pct: gmv > 0 && Number(d.organic_gmv) > 0 ? Math.round((Number(d.organic_gmv) / gmv) * 100) + "%" : "\u2014",
      paid_gmv_pct: gmv > 0 && Number(d.paid_gmv) > 0 ? Math.round((Number(d.paid_gmv) / gmv) * 100) + "%" : "\u2014",
      cost_per_order: orders > 0 ? "$" + Math.round((adSpend + sampleCost + creatorPay) / orders).toLocaleString() : "\u2014",
    };
  };

  const wowChange = (current, previous) => {
    const c = Number(current) || 0;
    const p = Number(previous) || 0;
    if (p === 0 && c === 0) return null;
    if (p === 0) return { dir: "up", pct: 100 };
    const pct = Math.round(((c - p) / Math.abs(p)) * 100);
    if (pct === 0) return null;
    return { dir: pct > 0 ? "up" : "down", pct: Math.abs(pct) };
  };

  const WowArrow = ({ current, previous, invert }) => {
    const change = wowChange(current, previous);
    if (!change) return null;
    const isGood = invert ? change.dir === "down" : change.dir === "up";
    const color = isGood ? t.green : (t.red || "#ef4444");
    return <span style={{ fontSize: 9, fontWeight: 700, color, marginLeft: 4 }}>{change.dir === "up" ? "\u25B2" : "\u25BC"} {change.pct}%</span>;
  };

  const getMonday = (d) => { const date = new Date(d); const day = date.getDay(); const diff = date.getDate() - day + (day === 0 ? -6 : 1); return new Date(date.setDate(diff)).toISOString().split("T")[0]; };
  const getSunday = (monday) => { const d = new Date(monday); d.setDate(d.getDate() + 6); return d.toISOString().split("T")[0]; };

  const newWeekQuick = async () => {
    const monday = getMonday(new Date());
    const existing = weeks.find(w => w.week_start === monday);
    if (existing) { alert("A row for this week already exists. Click any cell to edit it."); return; }
    const row = { week_start: monday, week_end: getSunday(monday), superfiliate_invites: 0, sample_requests: 0, samples_posted: 0, videos_posted: 0, videos_approved: 0, videos_rejected: 0, impressions: 0, organic_impressions: 0, orders: 0, tts_gmv: 0, organic_gmv: 0, paid_gmv: 0, tts_commission: 0, ad_spend: 0, sample_cost: 0, creator_payments: 0, new_creators_added: 0, active_creators: 0, total_creators: 0, notes: "", entered_by: currentEnterer || null };
    const result = await dbSaveTtsWeek(row);
    if (!result.error) { const [refreshed, refreshedMonthly] = await Promise.all([dbLoadTtsWeekly(), dbLoadTtsMonthly()]); setWeeks(refreshed); setMonthly(refreshedMonthly); }
    else { alert("Failed to create week: " + (result.error?.message || "Unknown")); }
  };

  const editWeek = (row) => { setFormData({ ...row }); setEditingRow(row.id); setShowForm(true); if (row.entered_by) setCurrentEnterer(row.entered_by); };

  const copyLastWeek = () => {
    if (weeks.length > 0) {
      const last = weeks[0];
      const monday = getMonday(new Date());
      setFormData({ ...last, id: undefined, week_start: monday, week_end: getSunday(monday), notes: "", created_at: undefined, updated_at: undefined });
    }
  };

  const saveForm = async () => {
    setSaving(true);
    const payload = { ...formData };
    delete payload.created_at; delete payload.updated_at;
    if (!editingRow) delete payload.id;
    if (currentEnterer) payload.entered_by = currentEnterer;
    const result = editingRow ? await dbSaveTtsWeek({ ...payload, id: editingRow }) : await dbSaveTtsWeek(payload);
    if (!result.error) {
      const [refreshed, refreshedMonthly] = await Promise.all([dbLoadTtsWeekly(), dbLoadTtsMonthly()]);
      setWeeks(refreshed); setMonthly(refreshedMonthly); setShowForm(false); setEditingRow(null);
    } else { alert("Save failed: " + (result.error?.message || "Unknown error")); }
    setSaving(false);
  };

  const deleteWeek = async (id) => { if (!window.confirm("Delete this week's data permanently?")) return; await dbDeleteTtsWeek(id); setWeeks(prev => prev.filter(w => w.id !== id)); };

  const inputField = (label, key, type = "number") => (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, color: t.textFaint, marginBottom: 2 }}>{label}</div>
      <input type={type} value={formData[key] ?? ""} onChange={(e) => setFormData(prev => ({ ...prev, [key]: type === "number" ? (e.target.value === "" ? 0 : Number(e.target.value)) : e.target.value }))} style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid " + t.border, background: t.inputBg, color: t.inputText, fontSize: 13, boxSizing: "border-box" }} />
    </div>
  );

  const fmtNum = (n) => n != null && n !== 0 ? Number(n).toLocaleString() : "0";
  const fmtDol = (n) => n != null ? "$" + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "$0.00";

  const scrollToWeek = (weekStart) => {
    setViewMode("table");
    setTimeout(() => {
      const row = document.querySelector('[data-week="' + weekStart + '"]');
      if (row) {
        row.scrollIntoView({ behavior: "smooth", block: "center" });
        row.style.transition = "background 0.3s";
        row.style.background = t.isLight ? "#d4f5e2" : "#0a3d1f";
        setTimeout(() => { row.style.background = ""; }, 2000);
      }
    }, 100);
  };

  const editableColumns = ["superfiliate_invites", "sample_requests", "samples_posted", "videos_posted", "impressions", "orders", "tts_gmv", "organic_gmv", "paid_gmv", "ad_spend"];

  const EditableCell = ({ rowId, column, value, format, align, style: cellStyle, step, children }) => {
    const isEditing = editingCell?.rowId === rowId && editingCell?.column === column;
    const row = weeks.find(w => w.id === rowId);
    const displayVal = format ? format(value) : value;
    const srcMap = { tts_gmv: "gmv_source", organic_gmv: "gmv_source", paid_gmv: "gmv_source", impressions: "impressions_source", organic_impressions: "impressions_source", ad_spend: "ad_spend_source", orders: "gmv_source" };
    const srcKey = srcMap[column]; const source = srcKey ? (row?.[srcKey] || "manual") : "manual";
    const isApi = source !== "manual" && source !== "google_sheets_import";
    const overrides = row?.overrides || {}; const isOverridden = overrides[column] === true;

    const saveCell = async (newVal) => {
      if (!row) { setEditingCell(null); return; }
      if (Number(row[column]) === Number(newVal)) { setEditingCell(null); return; }
      const updated = { ...row, [column]: newVal };
      if (isApi) updated.overrides = { ...(row.overrides || {}), [column]: true };
      delete updated.created_at; delete updated.updated_at;
      const result = await dbSaveTtsWeek(updated);
      if (result.error) { alert("Save failed: " + (result.error.message || "Unknown")); setEditingCell(null); return; }
      const [refreshed, refreshedMonthly] = await Promise.all([dbLoadTtsWeekly(), dbLoadTtsMonthly()]);
      setWeeks(refreshed); setMonthly(refreshedMonthly); setEditingCell(null);
    };

    if (isEditing) {
      return (
        <td style={{ ...cellStyle, padding: 0 }}>
          <input autoFocus type="number" step={step || "1"} value={editingValue} onChange={(e) => setEditingValue(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === "Enter") { await saveCell(Number(editingValue) || 0); }
              else if (e.key === "Escape") { setEditingCell(null); }
              else if (e.key === "Tab") {
                e.preventDefault(); await saveCell(Number(editingValue) || 0);
                const ci = editableColumns.indexOf(column); if (ci === -1) return;
                const sw = [...weeks].sort((a, b) => b.week_start.localeCompare(a.week_start));
                const wi = sw.findIndex(w => w.id === rowId);
                if (e.shiftKey) {
                  if (ci > 0) { setEditingCell({ rowId, column: editableColumns[ci - 1] }); setEditingValue(row?.[editableColumns[ci - 1]] ?? 0); }
                  else if (wi > 0) { const pr = sw[wi - 1]; const lc = editableColumns[editableColumns.length - 1]; setEditingCell({ rowId: pr.id, column: lc }); setEditingValue(pr?.[lc] ?? 0); }
                } else {
                  if (ci < editableColumns.length - 1) { setEditingCell({ rowId, column: editableColumns[ci + 1] }); setEditingValue(row?.[editableColumns[ci + 1]] ?? 0); }
                  else if (wi < sw.length - 1) { const nr = sw[wi + 1]; const fc = editableColumns[0]; setEditingCell({ rowId: nr.id, column: fc }); setEditingValue(nr?.[fc] ?? 0); }
                }
              }
            }}
            onBlur={() => saveCell(Number(editingValue) || 0)}
            style={{ width: "100%", padding: "8px 10px", fontSize: 12, fontWeight: 700, border: "2px solid " + t.green, borderRadius: 4, background: t.inputBg, color: t.text, textAlign: align || "right", boxSizing: "border-box", outline: "none" }} />
        </td>
      );
    }

    const bgTint = isApi && !isOverridden ? (t.isLight ? "#eff6ff" : "#0c1525") : isOverridden ? (t.isLight ? "#fefce8" : "#1a1a0a") : undefined;
    return (
      <td onClick={(e) => { e.stopPropagation(); setEditingCell({ rowId, column }); setEditingValue(value ?? 0); }}
        style={{ ...cellStyle, cursor: "cell", background: bgTint || cellStyle?.background || "transparent" }}
        title={isApi ? (isOverridden ? "Manually overridden" : "Auto-filled by " + source) : "Click to edit"}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: cellStyle?.textAlign === "left" ? "flex-start" : "flex-end", gap: 4 }}>
          {isApi && !isOverridden ? <span style={{ width: 5, height: 5, borderRadius: 3, background: t.blue, flexShrink: 0, opacity: 0.7 }}></span> : isOverridden ? <svg width="10" height="10" viewBox="0 0 16 16" fill={t.orange} opacity="0.6" style={{ flexShrink: 0 }}><rect x="3" y="7" width="10" height="8" rx="1.5" /><path d="M5 7V5a3 3 0 016 0v2" fill="none" stroke={t.orange} strokeWidth="1.5" strokeLinecap="round" /></svg> : null}
          <span>{displayVal}</span>
        </div>
        {children}
      </td>
    );
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: t.textFaint }}>Loading TTS data...</div>;

  return (
    <div>
      {/* Dashboard stats — rolling 30 days */}
      {(() => {
        const today = new Date(); const thirtyAgo = new Date(today); thirtyAgo.setDate(thirtyAgo.getDate() - 30); const sixtyAgo = new Date(today); sixtyAgo.setDate(sixtyAgo.getDate() - 60);
        const todayStr = today.toISOString().split("T")[0]; const thirtyStr = thirtyAgo.toISOString().split("T")[0]; const sixtyStr = sixtyAgo.toISOString().split("T")[0];
        const last30 = weeks.filter(w => w.week_start >= thirtyStr && w.week_start <= todayStr);
        const prev30 = weeks.filter(w => w.week_start >= sixtyStr && w.week_start < thirtyStr);
        const s30 = (k) => last30.reduce((s, w) => s + (Number(w[k]) || 0), 0);
        const sP = (k) => prev30.reduce((s, w) => s + (Number(w[k]) || 0), 0);
        const gmv30 = s30("tts_gmv"); const adSpend30 = s30("ad_spend"); const videos30 = s30("videos_posted"); const orders30 = s30("orders");
        const netRev30 = gmv30 - adSpend30 - s30("sample_cost") - s30("creator_payments") - s30("tts_commission");
        const roas30 = adSpend30 > 0 ? (gmv30 / adSpend30).toFixed(2) : null;
        const gmvPrev = sP("tts_gmv"); const videosPrev = sP("videos_posted"); const adSpendPrev = sP("ad_spend");
        const netRevPrev = gmvPrev - adSpendPrev - sP("sample_cost") - sP("creator_payments") - sP("tts_commission");
        const roasPrev = adSpendPrev > 0 ? gmvPrev / adSpendPrev : null;
        const target = targets.find(tg => tg.month === today.toISOString().substring(0, 7));

        const Pct = ({ current, previous }) => { if (!previous || previous === 0) return null; const pct = Math.round(((current - previous) / Math.abs(previous)) * 100); if (pct === 0) return null; return <div style={{ fontSize: 10, marginTop: 2, color: pct > 0 ? t.green : (t.red || "#ef4444") }}>{pct > 0 ? "\u25B2" : "\u25BC"} {Math.abs(pct)}% vs prior 30d</div>; };
        const PBar = ({ actual, goal, color }) => { if (!goal || goal <= 0) return null; const pct = Math.min(100, Math.round((actual / goal) * 100)); return <div style={{ marginTop: 6 }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: t.textFaint, marginBottom: 2 }}><span>{pct}% of target</span><span>{"$" + Number(goal).toLocaleString()}</span></div><div style={{ height: 4, borderRadius: 2, background: t.border, overflow: "hidden" }}><div style={{ height: "100%", width: pct + "%", borderRadius: 2, background: pct >= 100 ? t.green : color, transition: "width 0.5s" }} /></div></div>; };

        return (
          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            <div style={{ flex: 1, background: t.card, border: "1px solid " + t.border, borderRadius: 10, padding: "12px 16px", boxShadow: t.shadow }}>
              <div style={{ fontSize: 10, color: t.textFaint, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Last 30 days GMV</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: t.green, marginTop: 2 }}>{"$" + Math.round(gmv30).toLocaleString()}</div>
              <Pct current={gmv30} previous={gmvPrev} />
              <PBar actual={gmv30} goal={target?.target_gmv} color={t.green} />
            </div>
            <div style={{ flex: 1, background: t.card, border: "1px solid " + t.border, borderRadius: 10, padding: "12px 16px", boxShadow: t.shadow }}>
              <div style={{ fontSize: 10, color: t.textFaint, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Last 30 days ROAS</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: t.blue, marginTop: 2 }}>{roas30 ? roas30 + "x" : "\u2014"}</div>
              <Pct current={Number(roas30) || 0} previous={roasPrev} />
              <PBar actual={Number(roas30) || 0} goal={target?.target_roas} color={t.blue} />
            </div>
            <div style={{ flex: 1, background: t.card, border: "1px solid " + t.border, borderRadius: 10, padding: "12px 16px", boxShadow: t.shadow }}>
              <div style={{ fontSize: 10, color: t.textFaint, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Last 30 days videos</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: t.text, marginTop: 2 }}>{videos30.toLocaleString()}</div>
              <Pct current={videos30} previous={videosPrev} />
              <PBar actual={videos30} goal={target?.target_videos} color={t.orange || "#d4890a"} />
            </div>
            <div style={{ flex: 1, background: t.card, border: "1px solid " + t.border, borderRadius: 10, padding: "12px 16px", boxShadow: t.shadow }}>
              <div style={{ fontSize: 10, color: t.textFaint, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Last 30 days net revenue</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: netRev30 >= 0 ? t.green : (t.red || "#ef4444"), marginTop: 2 }}>{"$" + Math.round(netRev30).toLocaleString()}</div>
              <Pct current={netRev30} previous={netRevPrev} />
            </div>
          </div>
        );
      })()}

      {/* Trend charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
        {[
          { label: "GMV", key: "tts_gmv", color: t.green, format: (v) => "$" + Math.round(v).toLocaleString() },
          { label: "Impressions", key: "impressions", color: t.blue, format: (v) => v >= 1000000 ? (v / 1000000).toFixed(1) + "M" : v >= 1000 ? Math.round(v / 1000).toLocaleString() + "K" : String(v) },
          { label: "Videos posted", key: "videos_posted", color: t.orange || "#d4890a", format: (v) => String(Math.round(v)) },
        ].map(chart => {
          const sorted = [...weeks].filter(w => Number(w[chart.key]) > 0).sort((a, b) => a.week_start.localeCompare(b.week_start)).slice(-35);
          if (sorted.length < 2) return <div key={chart.key} style={{ background: t.card, border: "1px solid " + t.border, borderRadius: 12, padding: "16px 18px", boxShadow: t.shadow }}><div style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 4 }}>{chart.label}</div><div style={{ fontSize: 12, color: t.textFaint, textAlign: "center", padding: 30 }}>Not enough data</div></div>;
          const values = sorted.map(w => Number(w[chart.key]) || 0);
          const max = Math.max(...values, 1); const min = Math.min(...values, 0); const range = max - min || 1;
          const cW = 300; const cH = 80; const pL = 10; const pR = 10; const uW = cW - pL - pR;
          const points = values.map((v, i) => ({ x: pL + (i / (values.length - 1)) * uW, y: cH - 8 - ((v - min) / range) * (cH - 16), val: v, date: sorted[i].week_start, month: new Date(sorted[i].week_start).toLocaleDateString("en-US", { month: "short" }), fullDate: new Date(sorted[i].week_start).toLocaleDateString("en-US", { month: "short", day: "numeric" }) }));
          const pathD = points.map((p, i) => (i === 0 ? "M" : "L") + p.x.toFixed(1) + " " + p.y.toFixed(1)).join(" ");
          const areaD = pathD + " L" + points[points.length - 1].x.toFixed(1) + " " + (cH - 4) + " L" + points[0].x.toFixed(1) + " " + (cH - 4) + " Z";
          const lastVal = values[values.length - 1]; const firstVal = values[0];
          const totalChange = firstVal > 0 ? Math.round(((lastVal - firstVal) / firstVal) * 100) : 0;
          const xLabels = []; let lastMo = ""; points.forEach(p => { if (p.month !== lastMo) { xLabels.push({ x: p.x, label: p.month }); lastMo = p.month; } });
          return (
            <div key={chart.key} style={{ background: t.card, border: "1px solid " + t.border, borderRadius: 12, padding: "16px 18px", boxShadow: t.shadow }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>{chart.label}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: chart.color }}>{chart.format(lastVal)}</div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontSize: 10, color: t.textFaint }}>{sorted.length} weeks ({Math.round(sorted.length / 4.3)} months) of data</div>
                {totalChange !== 0 ? <div style={{ fontSize: 11, fontWeight: 700, color: totalChange > 0 ? t.green : (t.red || "#ef4444") }}>{totalChange > 0 ? "+" : ""}{totalChange}% overall</div> : null}
              </div>
              <div style={{ position: "relative" }}
                onMouseMove={(e) => { const rect = e.currentTarget.getBoundingClientRect(); const mx = (e.clientX - rect.left) / (rect.width / cW); let cl = points[0]; let cd = Infinity; points.forEach(p => { const d = Math.abs(p.x - mx); if (d < cd) { cd = d; cl = p; } }); const tt = e.currentTarget.querySelector("[data-tooltip]"); const dot = e.currentTarget.querySelector("[data-hover-dot]"); const ln = e.currentTarget.querySelector("[data-hover-line]"); if (tt) { tt.style.display = "block"; tt.style.left = (cl.x / cW * 100) + "%"; tt.innerHTML = '<div style="font-weight:700;font-size:12px;color:' + chart.color + '">' + chart.format(cl.val) + '</div><div style="font-size:10px;color:' + t.textFaint + '">' + cl.fullDate + '</div><div style="font-size:9px;color:' + t.textFaint + ';margin-top:2px">Click to view week</div>'; } if (dot) { dot.setAttribute("cx", cl.x); dot.setAttribute("cy", cl.y); dot.style.display = "block"; } if (ln) { ln.setAttribute("x1", cl.x); ln.setAttribute("x2", cl.x); ln.style.display = "block"; } }}
                onMouseLeave={(e) => { const tt = e.currentTarget.querySelector("[data-tooltip]"); const dot = e.currentTarget.querySelector("[data-hover-dot]"); const ln = e.currentTarget.querySelector("[data-hover-line]"); if (tt) tt.style.display = "none"; if (dot) dot.style.display = "none"; if (ln) ln.style.display = "none"; }}>
                <div data-tooltip style={{ display: "none", position: "absolute", top: -8, transform: "translateX(-50%)", background: t.card, border: "1px solid " + t.border, borderRadius: 8, padding: "6px 10px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", pointerEvents: "none", zIndex: 10, textAlign: "center", whiteSpace: "nowrap" }}></div>
                <svg width="100%" viewBox={"0 0 " + cW + " " + (cH + 18)} preserveAspectRatio="none" style={{ display: "block", cursor: "crosshair" }}
                  onClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); const mx = (e.clientX - rect.left) / (rect.width / cW); let ci = 0; let cd = Infinity; points.forEach((p, i) => { const d = Math.abs(p.x - mx); if (d < cd) { cd = d; ci = i; } }); scrollToWeek(sorted[ci].week_start); }}>
                  <line x1={pL} y1={8} x2={cW - pR} y2={8} stroke={t.border} strokeWidth="0.5" />
                  <line x1={pL} y1={cH / 2} x2={cW - pR} y2={cH / 2} stroke={t.border} strokeWidth="0.5" strokeDasharray="4 4" />
                  <line x1={pL} y1={cH - 8} x2={cW - pR} y2={cH - 8} stroke={t.border} strokeWidth="0.5" />
                  <path d={areaD} fill={chart.color} opacity="0.06" />
                  <path d={pathD} fill="none" stroke={chart.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  {points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={i === points.length - 1 ? 5 : 3} fill={chart.color} opacity={i === points.length - 1 ? 1 : 0.5} style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); scrollToWeek(sorted[i].week_start); }} />)}
                  <circle data-hover-dot cx="0" cy="0" r="5" fill={chart.color} stroke={t.card} strokeWidth="2" style={{ display: "none" }} />
                  <line data-hover-line x1="0" y1="4" x2="0" y2={cH - 4} stroke={chart.color} strokeWidth="0.5" strokeDasharray="3 3" style={{ display: "none" }} />
                  {xLabels.map((lbl, i) => <text key={i} x={lbl.x} y={cH + 12} fill={t.textFaint} fontSize="9" textAnchor="middle" fontWeight="500">{lbl.label}</text>)}
                </svg>
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {["table", "monthly"].map(m => (
            <button key={m} onClick={() => setViewMode(m)} style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: viewMode === m ? "2px solid " + t.green + "60" : "1px solid " + t.border, background: viewMode === m ? t.green + "10" : t.card, color: viewMode === m ? t.green : t.textMuted, textTransform: "capitalize" }}>{m === "monthly" ? "Monthly rollups" : "Weekly data"}</button>
          ))}
          <button onClick={() => { const thisMonth = new Date().toISOString().substring(0, 7); const existing = targets.find(tg => tg.month === thisMonth); setTargetFormData(existing || { month: thisMonth, target_gmv: 0, target_videos: 0, target_creators: 0, target_roas: 0, target_orders: 0, notes: "" }); setShowTargetForm(true); }} style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid " + (t.purple || "#8b6cc4") + "40", background: (t.purple || "#8b6cc4") + "08", color: t.purple || "#8b6cc4", cursor: "pointer" }}>Set monthly target</button>
          <button onClick={() => { setMilestoneFormData({ week_start: getMonday(new Date()), team_member_id: "", label: "", type: "join" }); setShowMilestoneForm(true); }} style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid " + t.blue + "40", background: t.blue + "08", color: t.blue, cursor: "pointer" }}>+ Milestone</button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {weeks.length > 0 ? <button onClick={() => { copyLastWeek(); setShowForm(true); }} style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid " + t.border, background: t.card, color: t.textMuted, cursor: "pointer" }}>Copy last week</button> : null}
          {weeks.length > 0 ? <button onClick={() => { const hdrs = ["Week start","Week end","SF Invites","Sample requests","Samples shipped","Videos posted","Impressions","Organic impressions","Orders","GMV","Ad spend","Sample cost","Commission","Creator payments","S/V Ratio","ROAS","CPM","Net revenue","Net/video","Notes"]; const csvRows = [hdrs.join(",")]; [...weeks].sort((a,b) => a.week_start.localeCompare(b.week_start)).forEach(w => { const c = calc(w); csvRows.push([w.week_start,w.week_end,w.superfiliate_invites||0,w.sample_requests||0,w.samples_posted||0,w.videos_posted||0,w.impressions||0,w.organic_impressions||0,w.orders||0,w.tts_gmv||0,w.ad_spend||0,w.sample_cost||0,w.tts_commission||0,w.creator_payments||0,c.sv_ratio,c.roas,c.cpm,c.net_revenue.replace(/[$,]/g,""),c.net_per_video.replace(/[$,]/g,""),'"'+(w.notes||"").replace(/"/g,'""')+'"'].join(",")); }); const blob = new Blob([csvRows.join("\n")],{type:"text/csv"}); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "tts_weekly_"+new Date().toISOString().split("T")[0]+".csv"; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(a.href); }} style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid " + t.border, background: t.card, color: t.textMuted, cursor: "pointer" }}>Download CSV</button> : null}
          <button onClick={() => { setColWidths({ ...defaultColWidths }); try { localStorage.setItem("tts_col_widths", JSON.stringify(defaultColWidths)); } catch {} }} style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid " + t.border, background: t.card, color: t.textFaint, cursor: "pointer" }}>Reset columns</button>
          <button onClick={newWeekQuick} style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, border: "none", background: t.green, color: t.isLight ? "#fff" : "#000", cursor: "pointer" }}>+ New week</button>
        </div>
      </div>



      {showMilestoneForm ? (
        <div style={{ background: t.card, border: "2px solid " + t.blue + "40", borderRadius: 14, padding: 20, marginBottom: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>Add milestone</div>
            <button onClick={() => setShowMilestoneForm(false)} style={{ background: "none", border: "none", fontSize: 18, color: t.textFaint, cursor: "pointer" }}>x</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 10 }}>
            <div><div style={{ fontSize: 10, color: t.textFaint, marginBottom: 2 }}>Week</div><input type="date" value={milestoneFormData.week_start || ""} onChange={(e) => setMilestoneFormData(prev => ({ ...prev, week_start: e.target.value }))} style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid " + t.border, background: t.inputBg, color: t.inputText, fontSize: 12, boxSizing: "border-box" }} /></div>
            <div><div style={{ fontSize: 10, color: t.textFaint, marginBottom: 2 }}>Team member</div><select value={milestoneFormData.team_member_id || ""} onChange={(e) => setMilestoneFormData(prev => ({ ...prev, team_member_id: e.target.value }))} style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid " + t.border, background: t.inputBg, color: t.inputText, fontSize: 12, boxSizing: "border-box" }}><option value="">Select person</option>{teamMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
            <div><div style={{ fontSize: 10, color: t.textFaint, marginBottom: 2 }}>Label</div><input type="text" value={milestoneFormData.label || ""} onChange={(e) => setMilestoneFormData(prev => ({ ...prev, label: e.target.value }))} placeholder="e.g. Beau joins TTS, Ashleigh takes over UGC" style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid " + t.border, background: t.inputBg, color: t.inputText, fontSize: 12, boxSizing: "border-box" }} /></div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
            <button onClick={() => setShowMilestoneForm(false)} style={{ padding: "7px 16px", borderRadius: 8, fontSize: 12, border: "1px solid " + t.border, background: t.card, color: t.textMuted, cursor: "pointer" }}>Cancel</button>
            <button onClick={async () => { if (!milestoneFormData.label?.trim()) { alert("Enter a label"); return; } const result = await dbSaveTtsMilestone(milestoneFormData); if (!result.error) { setMilestones(prev => [...prev, result.data].sort((a, b) => b.week_start.localeCompare(a.week_start))); setShowMilestoneForm(false); } }} style={{ padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700, border: "none", background: t.blue, color: "#fff", cursor: "pointer" }}>Add milestone</button>
          </div>
        </div>
      ) : null}

      {showTargetForm ? (
        <div style={{ background: t.card, border: "2px solid " + (t.purple || "#8b6cc4") + "40", borderRadius: 14, padding: 20, marginBottom: 20, boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>Monthly target</div>
            <button onClick={() => setShowTargetForm(false)} style={{ background: "none", border: "none", fontSize: 18, color: t.textFaint, cursor: "pointer" }}>x</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 1fr", gap: 10 }}>
            <div><div style={{ fontSize: 10, color: t.textFaint, marginBottom: 2 }}>Month</div><input type="month" value={targetFormData.month || ""} onChange={(e) => setTargetFormData(prev => ({ ...prev, month: e.target.value }))} style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid " + t.border, background: t.inputBg, color: t.inputText, fontSize: 12, boxSizing: "border-box" }} /></div>
            <div><div style={{ fontSize: 10, color: t.textFaint, marginBottom: 2 }}>Target GMV ($)</div><input type="number" value={targetFormData.target_gmv || ""} onChange={(e) => setTargetFormData(prev => ({ ...prev, target_gmv: Number(e.target.value) || 0 }))} style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid " + t.border, background: t.inputBg, color: t.inputText, fontSize: 12, boxSizing: "border-box" }} /></div>
            <div><div style={{ fontSize: 10, color: t.textFaint, marginBottom: 2 }}>Target videos</div><input type="number" value={targetFormData.target_videos || ""} onChange={(e) => setTargetFormData(prev => ({ ...prev, target_videos: Number(e.target.value) || 0 }))} style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid " + t.border, background: t.inputBg, color: t.inputText, fontSize: 12, boxSizing: "border-box" }} /></div>
            <div><div style={{ fontSize: 10, color: t.textFaint, marginBottom: 2 }}>Target orders</div><input type="number" value={targetFormData.target_orders || ""} onChange={(e) => setTargetFormData(prev => ({ ...prev, target_orders: Number(e.target.value) || 0 }))} style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid " + t.border, background: t.inputBg, color: t.inputText, fontSize: 12, boxSizing: "border-box" }} /></div>
            <div><div style={{ fontSize: 10, color: t.textFaint, marginBottom: 2 }}>Target ROAS</div><input type="number" step="0.1" value={targetFormData.target_roas || ""} onChange={(e) => setTargetFormData(prev => ({ ...prev, target_roas: Number(e.target.value) || 0 }))} style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid " + t.border, background: t.inputBg, color: t.inputText, fontSize: 12, boxSizing: "border-box" }} /></div>
            <div><div style={{ fontSize: 10, color: t.textFaint, marginBottom: 2 }}>Target creators</div><input type="number" value={targetFormData.target_creators || ""} onChange={(e) => setTargetFormData(prev => ({ ...prev, target_creators: Number(e.target.value) || 0 }))} style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid " + t.border, background: t.inputBg, color: t.inputText, fontSize: 12, boxSizing: "border-box" }} /></div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
            <button onClick={() => setShowTargetForm(false)} style={{ padding: "7px 16px", borderRadius: 8, fontSize: 12, border: "1px solid " + t.border, background: t.card, color: t.textMuted, cursor: "pointer" }}>Cancel</button>
            <button onClick={async () => { const result = await dbSaveTtsTarget(targetFormData); if (!result.error) { const refreshed = await dbLoadTtsTargets(); setTargets(refreshed); setShowTargetForm(false); } else { alert("Save failed: " + (result.error?.message || "Unknown")); } }} style={{ padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700, border: "none", background: t.purple || "#8b6cc4", color: "#fff", cursor: "pointer" }}>Save target</button>
          </div>
        </div>
      ) : null}

      {/* Entry form */}
      {showForm ? (
        <div style={{ background: t.card, border: "2px solid " + t.green + "40", borderRadius: 14, padding: 24, marginBottom: 20, boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>{editingRow ? "Edit week" : "New week entry"}</div>
            <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", fontSize: 18, color: t.textFaint, cursor: "pointer" }}>x</button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, position: "relative" }} onClick={(e) => e.stopPropagation()}>
            <span style={{ fontSize: 12, color: t.textFaint }}>Entering as</span>
            <div onClick={() => setEntererDropdownOpen(prev => !prev)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 12px", borderRadius: 8, border: "1px solid " + (currentEnterer ? t.green + "50" : t.border), background: currentEnterer ? t.green + "08" : t.inputBg, cursor: "pointer", minWidth: 160 }}>
              {(() => { const member = teamMembers.find(m => m.id === currentEnterer); if (!member) return <span style={{ fontSize: 12, color: t.textFaint }}>Select your name</span>; return <>{member.avatar_url ? <img src={member.avatar_url} alt="" style={{ width: 22, height: 22, borderRadius: 11, objectFit: "cover" }} onError={(e) => { e.target.style.display = "none"; }} /> : null}<span style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{member.name}</span></>; })()}
              <span style={{ fontSize: 10, color: t.textFaint, marginLeft: "auto" }}>{"\u25BC"}</span>
            </div>
            {currentEnterer ? (() => { const member = teamMembers.find(m => m.id === currentEnterer); if (!member?.slack_id) return null; return <a href={"slack://user?team=TFC94FVGF&id=" + member.slack_id} onClick={(e) => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 6, background: t.blue + "10", border: "1px solid " + t.blue + "30", textDecoration: "none", fontSize: 10, fontWeight: 600, color: t.blue }}><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" opacity="0.8"><path d="M14.5 2C13.1 2 12 3.1 12 4.5V9h4.5C17.9 9 19 7.9 19 6.5S17.9 4 16.5 4H14.5V2zM9.5 2C8.1 2 7 3.1 7 4.5S8.1 7 9.5 7H12V4.5C12 3.1 10.9 2 9.5 2zM4.5 9C3.1 9 2 10.1 2 11.5S3.1 14 4.5 14H9v-5H4.5zM9 15H4.5C3.1 15 2 16.1 2 17.5S3.1 20 4.5 20c1.4 0 2.5-1.1 2.5-2.5V15zM15 15v2.5c0 1.4 1.1 2.5 2.5 2.5S20 18.9 20 17.5 18.9 15 17.5 15H15zM15 9v5h4.5c1.4 0 2.5-1.1 2.5-2.5S20.9 9 19.5 9H15z"/></svg>Slack</a>; })() : null}
            {entererDropdownOpen ? (
              <div style={{ position: "absolute", top: "100%", left: 70, marginTop: 4, zIndex: 50, background: t.card, border: "1px solid " + t.border, borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", minWidth: 240, overflow: "hidden", maxHeight: 300, overflowY: "auto" }}>
                {teamMembers.map(m => (
                  <div key={m.id} onClick={() => { setCurrentEnterer(m.id); try { localStorage.setItem("tts_enterer", m.id); } catch {} setEntererDropdownOpen(false); }} style={{ padding: "8px 12px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, background: currentEnterer === m.id ? t.green + "10" : "transparent" }} onMouseEnter={(e) => { e.currentTarget.style.background = currentEnterer === m.id ? t.green + "15" : t.cardAlt; }} onMouseLeave={(e) => { e.currentTarget.style.background = currentEnterer === m.id ? t.green + "10" : "transparent"; }}>
                    {m.avatar_url ? <img src={m.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: 14, objectFit: "cover", flexShrink: 0 }} onError={(e) => { e.target.style.display = "none"; }} /> : <div style={{ width: 28, height: 28, borderRadius: 14, background: t.green + "15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: t.green }}>{m.name?.[0]}</div>}
                    <div><div style={{ fontWeight: 600, color: t.text }}>{m.name}</div>{m.title ? <div style={{ fontSize: 10, color: t.textFaint }}>{m.title}</div> : null}</div>
                    {currentEnterer === m.id ? <span style={{ marginLeft: "auto", color: t.green, fontSize: 14 }}>{"\u2713"}</span> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          <div style={{ display: "flex", gap: 24 }}>
            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 4 }}>Required weekly data</div>
                <div style={{ fontSize: 11, color: t.textFaint, marginBottom: 10 }}>Fill these every week — missing data skews all calculations</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                  {inputField("Week start (Monday)", "week_start", "date")}{inputField("Week end (Sunday)", "week_end", "date")}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 8 }}>
                  {inputField("SF invites sent", "superfiliate_invites")}{inputField("Sample requests", "sample_requests")}{inputField("Samples shipped", "samples_posted")}{inputField("Videos posted", "videos_posted")}{inputField("Orders", "orders")}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginTop: 8 }}>
                  {inputField("Total impressions", "impressions")}{inputField("Organic impressions", "organic_impressions")}{inputField("Total GMV ($)", "tts_gmv")}{inputField("Ad spend ($)", "ad_spend")}
                </div>
              </div>
              <div style={{ marginBottom: 16, padding: 12, background: t.cardAlt, borderRadius: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 6 }}>GMV breakdown</div>
                <div style={{ fontSize: 10, color: t.textFaint, marginBottom: 8 }}>How much GMV came from organic vs paid? Should add up to Total GMV.</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  {inputField("Organic GMV ($)", "organic_gmv")}{inputField("Paid GMV ($)", "paid_gmv")}
                  <div style={{ padding: "20px 10px 0", fontSize: 12, color: Number(formData.organic_gmv || 0) + Number(formData.paid_gmv || 0) !== Number(formData.tts_gmv || 0) && Number(formData.tts_gmv || 0) > 0 ? (t.orange || "#d4890a") : t.green }}>{Number(formData.tts_gmv || 0) > 0 ? (Number(formData.organic_gmv || 0) + Number(formData.paid_gmv || 0) === Number(formData.tts_gmv || 0) ? "Matches total GMV" : "Gap: $" + (Number(formData.tts_gmv || 0) - Number(formData.organic_gmv || 0) - Number(formData.paid_gmv || 0)).toLocaleString()) : ""}</div>
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: t.orange || "#d4890a", marginBottom: 6 }}>Costs (affects ROAS + net revenue)</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  {inputField("Sample cost ($)", "sample_cost")}{inputField("Creator payments ($)", "creator_payments")}{inputField("Commission ($)", "tts_commission")}
                </div>
              </div>
              <div style={{ marginBottom: 16, padding: 12, background: t.cardAlt, borderRadius: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 6 }}>Weekly content notes</div>
                <div style={{ fontSize: 10, color: t.textFaint, marginBottom: 8 }}>What stood out this week? This context explains spikes and drops.</div>
                <textarea value={formData.notes || ""} onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))} placeholder={"Top performing video this week:\nContent types posted (unboxing / tutorial / review):\nNew creators who stood out:\nAnything unusual (viral video, algorithm change, etc.):"} style={{ width: "100%", minHeight: 80, padding: "8px 12px", borderRadius: 8, border: "1px solid " + t.border, background: t.inputBg, color: t.inputText, fontSize: 12, resize: "vertical", boxSizing: "border-box", outline: "none", fontFamily: "inherit", lineHeight: 1.6 }} />
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: t.textFaint, marginBottom: 6 }}>Creators (optional)</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  {inputField("New added", "new_creators_added")}{inputField("Active this week", "active_creators")}{inputField("Total in program", "total_creators")}
                </div>
              </div>
            </div>
            <div style={{ width: 220, flexShrink: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: t.green, marginBottom: 10 }}>Live calculations</div>
              <div style={{ background: t.cardAlt, borderRadius: 10, padding: 14 }}>
                {Object.entries(calc(formData)).map(([key, val]) => (
                  <div key={key} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid " + t.border + "40" }}>
                    <span style={{ fontSize: 11, color: t.textMuted }}>{key.replace(/_/g, " ")}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: String(val).includes("\u2014") ? t.textFaint : t.text }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            <button onClick={() => setShowForm(false)} style={{ padding: "8px 20px", borderRadius: 8, fontSize: 13, border: "1px solid " + t.border, background: t.card, color: t.textMuted, cursor: "pointer" }}>Cancel</button>
            <button onClick={saveForm} disabled={saving} style={{ padding: "8px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700, border: "none", background: t.green, color: t.isLight ? "#fff" : "#000", cursor: "pointer", opacity: saving ? 0.6 : 1 }}>{saving ? "Saving..." : editingRow ? "Update" : "Save week"}</button>
          </div>
        </div>
      ) : null}

      {(() => {
        const tw = weeks.length; if (tw === 0) return null;
        const wo = weeks.filter(w => Number(w.orders) > 0).length;
        const wsc = weeks.filter(w => Number(w.sample_cost) > 0).length;
        const wcp = weeks.filter(w => Number(w.creator_payments) > 0).length;
        const issues = [];
        if (wo === 0) issues.push("Orders data missing for all weeks \u2014 conversion rates unavailable");
        else if (wo < tw * 0.5) issues.push("Orders only tracked for " + wo + "/" + tw + " weeks");
        if (wsc < tw * 0.3) issues.push("Sample costs missing for " + (tw - wsc) + " weeks \u2014 net revenue may be overstated");
        if (wcp < tw * 0.1 && tw > 4) issues.push("Creator payments not tracked \u2014 ROAS may be overstated");
        if (issues.length === 0) return null;
        return <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 8, background: t.isLight ? "#fef3cd" : "#332d1a", border: "1px solid " + (t.isLight ? "#f0d9a8" : "#4d4020"), fontSize: 12, color: t.isLight ? "#856404" : "#fbbf24", lineHeight: 1.6 }}><span style={{ fontWeight: 700 }}>Data gaps:</span> {issues.join(" \u00B7 ")}</div>;
      })()}

      {/* Table view */}
      {viewMode === "table" ? (
        <div style={{ background: t.card, border: "1px solid " + t.border, borderRadius: 12, overflow: "hidden", boxShadow: t.shadow }}>
          {weeks.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: t.textFaint }}>No data yet. Click "+ New week" to start entering TTS data.</div>
          ) : (
            <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "70vh" }}>
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0", fontSize: 12, tableLayout: "fixed", minWidth: Object.values(colWidths).reduce((s, w) => s + w, 0) }}>
                <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                  <tr style={{ background: t.isLight ? "#e8e5dc" : "#222222", borderBottom: "2px solid " + t.border, height: 44 }}>
                    {(() => { const hs = { padding: "10px 12px", fontWeight: 700, color: t.text, borderBottom: "2px solid " + t.border, whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.04em", fontSize: 10 }; const ho = weeks.some(w => Number(w.orders) > 0); return <>
                      <ResizableTh colKey="week" style={{ ...hs, textAlign: "left" }}>Week</ResizableTh>
                      <ResizableTh colKey="sf_invites" style={{ ...hs, textAlign: "right" }}>SF Invites</ResizableTh>
                      <ResizableTh colKey="requests" style={{ ...hs, textAlign: "right" }}>Requests</ResizableTh>
                      <ResizableTh colKey="shipped" style={{ ...hs, textAlign: "right" }}>Shipped</ResizableTh>
                      <ResizableTh colKey="videos" style={{ ...hs, textAlign: "right" }}>Videos</ResizableTh>
                      <ResizableTh colKey="impressions" style={{ ...hs, textAlign: "right" }}>Impressions</ResizableTh>
                      <ResizableTh colKey="orders" style={{ ...hs, textAlign: "right", color: ho ? t.text : (t.orange || "#d4890a") }}>Orders{!ho ? " (!)" : ""}</ResizableTh>
                      <ResizableTh colKey="gmv" style={{ ...hs, textAlign: "right" }}>GMV</ResizableTh>
                      <ResizableTh colKey="org_gmv" style={{ ...hs, textAlign: "right" }}>Org GMV</ResizableTh>
                      <ResizableTh colKey="paid_gmv" style={{ ...hs, textAlign: "right" }}>Paid GMV</ResizableTh>
                      <ResizableTh colKey="ad_spend" style={{ ...hs, textAlign: "right" }}>Ad Spend</ResizableTh>
                      <ResizableTh colKey="sv" style={{ ...hs, textAlign: "right" }}>S/V</ResizableTh>
                      <ResizableTh colKey="roas" style={{ ...hs, textAlign: "right" }}>ROAS</ResizableTh>
                      <ResizableTh colKey="cpm" style={{ ...hs, textAlign: "right" }}>CPM</ResizableTh>
                      <ResizableTh colKey="net_video" style={{ ...hs, textAlign: "right" }}>Net/video</ResizableTh>
                      <ResizableTh colKey="net_rev" style={{ ...hs, textAlign: "right" }}>Net Rev</ResizableTh>
                      <ResizableTh colKey="entered_by" style={{ ...hs, textAlign: "left" }}>By</ResizableTh>
                      <th style={{ ...hs, width: colWidths.actions || 100 }}></th>
                    </>; })()}
                  </tr>
                </thead>
                {(() => {
                    const sumW = (ws, k) => ws.reduce((s, w) => s + (Number(w[k]) || 0), 0);
                    const grouped = [];
                    let curMonth = "", curQ = "", mWeeks = [], qWeeks = [];
                    weeks.forEach((w) => {
                      const d = new Date(w.week_start);
                      const month = d.toLocaleDateString("en-US", { month: "long" }) + " '" + String(d.getFullYear()).slice(-2);
                      const q = "Q" + (Math.floor(d.getMonth() / 3) + 1) + " '" + String(d.getFullYear()).slice(-2);
                      if (q !== curQ) {
                        if (curMonth && mWeeks.length) { grouped.push({ type: "mt", label: curMonth, ws: [...mWeeks] }); mWeeks = []; }
                        if (curQ && qWeeks.length) { grouped.push({ type: "qt", label: curQ, ws: [...qWeeks] }); qWeeks = []; }
                        curQ = q;
                        curMonth = month;
                      } else if (month !== curMonth) {
                        if (curMonth && mWeeks.length) { grouped.push({ type: "mt", label: curMonth, ws: [...mWeeks] }); mWeeks = []; }
                        curMonth = month;
                      }
                      mWeeks.push(w); qWeeks.push(w);
                      grouped.push({ type: "w", data: w, pw: null });
                      milestones.filter(ms => ms.week_start === w.week_start).forEach(ms => grouped.push({ type: "ms", data: ms }));
                    });
                    if (mWeeks.length) grouped.push({ type: "mt", label: curMonth, ws: mWeeks });
                    if (qWeeks.length) grouped.push({ type: "qt", label: curQ, ws: qWeeks });
                    const wRows = grouped.filter(r => r.type === "w");
                    for (let i = 0; i < wRows.length; i++) wRows[i].pw = wRows[i + 1]?.data || null;

                    const qColor = t.isLight ? "#c2dccb" : "#1a3322";
                    const qLabelBg = t.isLight ? "#eef7f0" : "#0d1f14";
                    const qLabelColor = t.isLight ? "#1a5c35" : "#4ade80";
                    const qGroups = []; let cqG = null; let cqRows = [];
                    grouped.forEach((row, ri) => {
                      let q = null;
                      if (row.type === "w") { const d = new Date(row.data.week_start); q = "Q" + (Math.floor(d.getMonth() / 3) + 1) + " '" + String(d.getFullYear()).slice(-2); }
                      else if ((row.type === "mt" || row.type === "qt") && row.ws?.length > 0) { const d = new Date(row.ws[0].week_start); q = "Q" + (Math.floor(d.getMonth() / 3) + 1) + " '" + String(d.getFullYear()).slice(-2); }
                      if (q && q !== cqG) { if (cqRows.length > 0) qGroups.push({ q: cqG, rows: [...cqRows] }); cqG = q; cqRows = [{ row, ri }]; }
                      else { cqRows.push({ row, ri }); }
                    });
                    if (cqRows.length > 0) qGroups.push({ q: cqG, rows: cqRows });

                    const renderRow = (row, ri) => {
                      if (row.type === "ms") { const ms = row.data; const member = teamMembers.find(m => m.id === ms.team_member_id); return <tr key={"ms-" + ms.id} style={{ background: t.isLight ? "#eff6ff" : "#0c1929" }}><td colSpan={99} style={{ padding: "8px 14px", borderBottom: "1px solid " + (t.isLight ? "#bfdbfe" : "#1e3a5f") }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 8, height: 8, borderRadius: 4, background: t.blue, flexShrink: 0 }}></div>{member?.avatar_url ? <img src={member.avatar_url} alt="" style={{ width: 24, height: 24, borderRadius: 12, objectFit: "cover" }} /> : null}<span style={{ fontSize: 12, fontWeight: 700, color: t.isLight ? "#1e40af" : "#60a5fa" }}>{ms.label}</span>{member ? <span style={{ fontSize: 10, color: t.isLight ? "#6b7280" : "#9ca3af" }}>— {member.name}</span> : null}<button onClick={(e) => { e.stopPropagation(); if (window.confirm("Delete this milestone?")) dbDeleteTtsMilestone(ms.id).then(() => setMilestones(prev => prev.filter(m => m.id !== ms.id))); }} style={{ marginLeft: "auto", background: "none", border: "none", color: t.textFaint, cursor: "pointer", fontSize: 10 }}>remove</button></div></td></tr>; }
                      if (row.type === "mt") {
                        const ws = row.ws; const tg = sumW(ws,"tts_gmv"); const ta = sumW(ws,"ad_spend"); const tv = sumW(ws,"videos_posted"); const ti = sumW(ws,"impressions"); const to = sumW(ws,"orders");
                        const nr = tg - ta - sumW(ws,"sample_cost") - sumW(ws,"creator_payments") - sumW(ws,"tts_commission");
                        const roas = ta > 0 ? (tg/ta).toFixed(2)+"x" : "\u2014";
                        const mtb = "2px solid " + (t.isLight ? "#f0d9a8" : "#3d2f0f"); const mtc = t.isLight ? "#92600a" : "#fbbf24"; const mts = { padding: "8px 12px", fontSize: 11, fontWeight: 700, textAlign: "right", color: mtc, borderBottom: mtb };
                        return <tr key={"mt"+ri} style={{ background: t.isLight ? "#fef3e2" : "#2a1f0a" }}>
                          <td style={{ ...mts, textAlign: "left" }}>{row.label} total</td>
                          <td style={mts}>{fmtNum(sumW(ws,"superfiliate_invites"))}</td><td style={mts}>{fmtNum(sumW(ws,"sample_requests"))}</td><td style={mts}>{fmtNum(sumW(ws,"samples_posted"))}</td><td style={mts}>{fmtNum(tv)}</td>
                          <td style={mts}>{fmtNum(ti)}</td><td style={mts}>{fmtNum(to)}</td>
                          <td style={{ ...mts, fontSize: 12, fontWeight: 800, color: t.green }}>{fmtDol(tg)}</td><td style={mts}>{fmtDol(sumW(ws,"organic_gmv"))}</td><td style={mts}>{fmtDol(sumW(ws,"paid_gmv"))}</td><td style={mts}>{fmtDol(ta)}</td><td style={mts}>{"\u2014"}</td>
                          <td style={{ ...mts, fontSize: 12, fontWeight: 800, color: roas !== "\u2014" && parseFloat(roas) >= 2 ? t.green : t.text }}>{roas}</td>
                          <td style={mts}>{ti > 0 ? "$"+(ta/(ti/1000)).toFixed(2) : "\u2014"}</td><td style={mts}>{tv > 0 ? "$"+Math.round(nr/tv).toLocaleString() : "\u2014"}</td>
                          <td style={{ ...mts, fontSize: 12, fontWeight: 800, color: nr >= 0 ? t.green : (t.red||"#ef4444") }}>{"$"+Math.round(nr).toLocaleString()}</td><td style={{ borderBottom: mtb }}></td><td style={{ borderBottom: mtb }}></td>
                        </tr>;
                      }
                      if (row.type === "qt") {
                        const ws = row.ws; const tg = sumW(ws,"tts_gmv"); const ta = sumW(ws,"ad_spend"); const tv = sumW(ws,"videos_posted"); const ti = sumW(ws,"impressions"); const to = sumW(ws,"orders"); const tsp = sumW(ws,"samples_posted");
                        const nr = tg - ta - sumW(ws,"sample_cost") - sumW(ws,"creator_payments") - sumW(ws,"tts_commission");
                        const roas = ta > 0 ? (tg/ta).toFixed(2)+"x" : "\u2014";
                        const sv = tsp > 0 && tv > 0 ? (tsp / tv).toFixed(2) : "\u2014";
                        const cpm = ti > 0 ? "$" + (ta / (ti / 1000)).toFixed(2) : "\u2014";
                        const npv = tv > 0 ? "$" + Math.round(nr / tv).toLocaleString() : "\u2014";
                        const qtb = "3px solid " + (t.isLight ? "#b8d4c0" : "#2a4a32"); const qtc = t.isLight ? "#145a30" : "#4ade80"; const qts = { padding: "10px 12px", fontSize: 12, fontWeight: 800, textAlign: "right", color: qtc, borderBottom: qtb };
                        return <tr key={"qt"+ri} style={{ background: t.isLight ? "#c2dccb" : "#1a3322" }}>
                          <td style={{ ...qts, textAlign: "left", padding: "10px 14px" }}>{row.label} total</td>
                          <td style={qts}>{fmtNum(sumW(ws,"superfiliate_invites"))}</td><td style={qts}>{fmtNum(sumW(ws,"sample_requests"))}</td><td style={qts}>{fmtNum(tsp)}</td><td style={qts}>{fmtNum(tv)}</td>
                          <td style={qts}>{fmtNum(ti)}</td><td style={qts}>{fmtNum(to)}</td>
                          <td style={{ ...qts, fontSize: 14, color: t.isLight ? "#0a7c3e" : "#4ade80" }}>{fmtDol(tg)}</td><td style={qts}>{fmtDol(sumW(ws,"organic_gmv"))}</td><td style={qts}>{fmtDol(sumW(ws,"paid_gmv"))}</td><td style={qts}>{fmtDol(ta)}</td>
                          <td style={qts}>{sv}</td>
                          <td style={{ ...qts, color: roas !== "\u2014" && parseFloat(roas) >= 2 ? (t.isLight ? "#0a7c3e" : "#4ade80") : qtc }}>{roas}</td>
                          <td style={qts}>{cpm}</td><td style={qts}>{npv}</td>
                          <td style={{ ...qts, fontSize: 14, color: nr >= 0 ? (t.isLight ? "#0a7c3e" : "#4ade80") : "#ef4444" }}>{"$"+Math.round(nr).toLocaleString()}</td>
                          <td style={{ borderBottom: qtb }}></td><td style={{ borderBottom: qtb }}></td>
                        </tr>;
                      }
                      if (row.type === "w") {
                        const w = row.data; const pw = row.pw; const c = calc(w);
                        const bb = "1px solid " + t.border + "40";
                        const cs = { padding: "10px 12px", borderBottom: bb, textAlign: "right", fontSize: 12 };
                        const result = [];
                        result.push(
                          <tr key={"w-"+w.id} data-week={w.week_start} style={{ background: "transparent" }} onMouseEnter={(e) => { e.currentTarget.style.background = t.isLight ? "#ece9e0" : "#1e1e1e"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                            <td style={{ ...cs, textAlign: "left", whiteSpace: "nowrap" }}>{w.week_start.substring(5)} — {w.week_end?.substring(5)}</td>
                            <EditableCell rowId={w.id} column="superfiliate_invites" value={w.superfiliate_invites} format={fmtNum} style={cs} />
                            <EditableCell rowId={w.id} column="sample_requests" value={w.sample_requests} format={fmtNum} style={cs} />
                            <EditableCell rowId={w.id} column="samples_posted" value={w.samples_posted} format={fmtNum} style={cs} />
                            <EditableCell rowId={w.id} column="videos_posted" value={w.videos_posted} format={fmtNum} style={cs} />
                            <EditableCell rowId={w.id} column="impressions" value={w.impressions} format={fmtNum} style={cs}>{pw ? <WowArrow current={w.impressions} previous={pw.impressions} /> : null}</EditableCell>
                            <EditableCell rowId={w.id} column="orders" value={w.orders} format={fmtNum} style={cs}>{pw ? <WowArrow current={w.orders} previous={pw.orders} /> : null}</EditableCell>
                            <EditableCell rowId={w.id} column="tts_gmv" value={w.tts_gmv} format={fmtDol} step="0.01" style={{ ...cs, fontWeight: 700, fontSize: 13, color: t.green }}>{pw ? <WowArrow current={w.tts_gmv} previous={pw.tts_gmv} /> : null}</EditableCell>
                            <EditableCell rowId={w.id} column="organic_gmv" value={w.organic_gmv} format={fmtDol} step="0.01" style={{ ...cs, fontSize: 11, color: t.textMuted }} />
                            <EditableCell rowId={w.id} column="paid_gmv" value={w.paid_gmv} format={fmtDol} step="0.01" style={{ ...cs, fontSize: 11, color: t.textMuted }} />
                            <EditableCell rowId={w.id} column="ad_spend" value={w.ad_spend} format={fmtDol} step="0.01" style={{ ...cs, color: Number(w.ad_spend) > 0 ? (t.red || "#ef4444") : t.textFaint }}>{pw ? <WowArrow current={w.ad_spend} previous={pw.ad_spend} invert /> : null}</EditableCell>
                            <td style={{ ...cs, color: t.textMuted }}>{c.sv_ratio}</td>
                            <td style={{ ...cs, fontWeight: 700, fontSize: 13, color: c.roas !== "\u2014" && parseFloat(c.roas) >= 2 ? t.green : t.text }}>{c.roas}{pw ? <WowArrow current={Number(w.ad_spend) > 0 ? Number(w.tts_gmv) / Number(w.ad_spend) : 0} previous={Number(pw.ad_spend) > 0 ? Number(pw.tts_gmv) / Number(pw.ad_spend) : 0} /> : null}</td>
                            <td style={{ ...cs, color: t.textMuted }}>{c.cpm}</td>
                            <td style={cs}>{c.net_per_video}</td>
                            <td style={{ ...cs, fontWeight: 700, fontSize: 13, color: c.net_revenue.includes("-") ? (t.red || "#ef4444") : t.green }}>{c.net_revenue}{pw ? (() => { const p = calc(pw); const cVal = Number(String(c.net_revenue).replace(/[$,]/g, "")) || 0; const pVal = Number(String(p.net_revenue).replace(/[$,]/g, "")) || 0; return <WowArrow current={cVal} previous={pVal} />; })() : null}</td>
                            <td style={{ ...cs, textAlign: "left" }}>
                              {(() => { const member = teamMembers.find(m => m.id === w.entered_by); if (!member) return <span style={{ fontSize: 10, color: t.textFaint }}>{"\u2014"}</span>; return <div style={{ display: "flex", alignItems: "center", gap: 4 }}>{member.avatar_url ? <img src={member.avatar_url} alt="" style={{ width: 18, height: 18, borderRadius: 9, objectFit: "cover" }} /> : null}<span style={{ fontSize: 10, color: t.textMuted }}>{member.name.split(" ")[0]}</span></div>; })()}
                            </td>
                            <td style={{ ...cs, textAlign: "center", whiteSpace: "nowrap" }}>
                              <button onClick={(e) => { e.stopPropagation(); setExpandedNotes(prev => prev === w.id ? null : w.id); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: w.notes ? t.blue : t.textFaint, marginRight: 6 }} title={w.notes || "Add note"}>{w.notes ? "Note" : "+Note"}</button>
                              <button onClick={(e) => { e.stopPropagation(); editWeek(w); }} style={{ background: "none", border: "none", color: t.textFaint, cursor: "pointer", fontSize: 11, marginRight: 6 }} title="Edit full row">Edit</button>
                              <button onClick={(e) => { e.stopPropagation(); deleteWeek(w.id); }} style={{ background: "none", border: "none", color: t.textFaint, cursor: "pointer", fontSize: 11 }} title="Delete">Del</button>
                            </td>
                          </tr>,
                          expandedNotes === w.id ? <tr key={"detail-" + w.id}><td colSpan={99} style={{ padding: "12px 16px", background: t.cardAlt, borderBottom: "2px solid " + t.border }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 6 }}>Week notes</div>
                                <textarea defaultValue={w.notes || ""} placeholder={"Top performing video:\nContent types:\nAnything unusual:"} onBlur={async (e) => { const val = e.target.value.trim(); if (val !== (w.notes || "")) { const upd = { ...w, notes: val }; delete upd.created_at; delete upd.updated_at; await dbSaveTtsWeek(upd); setWeeks(prev => prev.map(wk => wk.id === w.id ? { ...wk, notes: val } : wk)); } }} style={{ width: "100%", minHeight: 80, padding: "8px 12px", borderRadius: 8, border: "1px solid " + t.border, background: t.inputBg, color: t.inputText, fontSize: 12, resize: "vertical", boxSizing: "border-box", outline: "none", fontFamily: "inherit", lineHeight: 1.6 }} />
                              </div>
                              {w.ai_summary ? <div style={{ padding: 12, background: t.isLight ? "#f0fdf4" : "#0a1f0f", borderRadius: 8, border: "1px solid " + (t.isLight ? "#bbf7d0" : "#14532d") }}><div style={{ fontSize: 10, fontWeight: 700, color: t.green, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>IB-Ai analysis</div><div style={{ fontSize: 12, color: t.text, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{w.ai_summary}</div><div style={{ fontSize: 9, color: t.textFaint, marginTop: 4 }}>Generated {w.ai_analyzed_at ? new Date(w.ai_analyzed_at).toLocaleDateString() : ""}</div></div> : null}
                              <div>
                                <button onClick={() => analyzeWeek(w)} disabled={analyzingWeek === w.id} style={{ padding: "6px 14px", borderRadius: 6, fontSize: 11, fontWeight: 600, border: "1px solid " + t.green + "40", background: t.green + "08", color: t.green, cursor: "pointer" }}>{analyzingWeek === w.id ? "Analyzing..." : w.ai_summary ? "Re-analyze with IB-Ai" : "Analyze with IB-Ai"}</button>
                                {aiError && aiError.weekId === w.id ? <div style={{ marginTop: 6, padding: "6px 10px", borderRadius: 6, background: (t.red || "#ef4444") + "10", border: "1px solid " + (t.red || "#ef4444") + "30", fontSize: 11, color: t.red || "#ef4444" }}>Error: {aiError.message}</div> : null}
                              </div>
                            </div>
                          </td></tr> : null);
                        return result;
                      }
                      return null;
                    };

                    return qGroups.flatMap((group, gi) => {
                      const els = [];
                      if (gi > 0) els.push(<tbody key={"qsep-" + gi}><tr><td colSpan={99} style={{ height: 16, border: "none", background: "transparent", padding: 0 }}></td></tr></tbody>);
                      els.push(
                        <tbody key={"qtbody-" + gi} style={{ outline: "2px solid " + qColor, outlineOffset: "-1px" }}>
                          <tr style={{ background: qLabelBg }}><td colSpan={99} style={{ padding: "8px 14px", fontSize: 13, fontWeight: 800, color: qLabelColor, borderBottom: "1px solid " + qColor, letterSpacing: "-0.01em" }}>{group.q}</td></tr>
                          {group.rows.flatMap(({ row, ri }) => renderRow(row, ri))}
                        </tbody>
                      );
                      return els;
                    });
                  })()}
              </table>
            </div>
          )}
        </div>
      ) : null}

      {/* Monthly rollup view */}
      {viewMode === "monthly" ? (
        <div style={{ background: t.card, border: "1px solid " + t.border, borderRadius: 12, overflow: "hidden", boxShadow: t.shadow }}>
          {monthly.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: t.textFaint }}>No monthly data yet. Add weekly data first.</div>
          ) : (
            <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "70vh" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 1600 }}>
                <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                  <tr style={{ background: t.isLight ? "#e8e5dc" : "#222222", borderBottom: "2px solid " + t.border, height: 44 }}>
                    {["Month", "SF Invites", "Requests", "Shipped", "Videos", "Impressions", "Orders", "GMV", "Ad Spend", "S/V", "ROAS", "CPM", "Net/video", "Net Revenue", "Weeks"].map((h, i) => (
                      <th key={i} style={{ padding: "10px 12px", textAlign: i === 0 || i === 14 ? "left" : "right", fontWeight: 700, color: t.text, borderBottom: "2px solid " + t.border, whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.04em", fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let curQ = ""; const rows = [];
                    const mkQTotal = (qLabel) => {
                      const qMs = monthly.filter(mm => { const dd = new Date(mm.month_start || mm.month + "-01"); return ("Q" + (Math.floor(dd.getMonth() / 3) + 1) + " '" + String(dd.getFullYear()).slice(-2)) === qLabel; });
                      const qG = qMs.reduce((s, mm) => s + Number(mm.tts_gmv || 0), 0); const qA = qMs.reduce((s, mm) => s + Number(mm.ad_spend || 0), 0); const qN = qMs.reduce((s, mm) => s + Number(mm.net_revenue || 0), 0);
                      const qR = qA > 0 ? (qG / qA).toFixed(2) + "x" : "\u2014"; const qW = qMs.reduce((s, mm) => s + Number(mm.weeks_reported || 0), 0);
                      const mqtc = t.isLight ? "#145a30" : "#4ade80"; const mqtg = t.isLight ? "#0a7c3e" : "#4ade80";
                      return <tr key={"qt-" + qLabel} style={{ background: t.isLight ? "#c2dccb" : "#1a3322" }}>
                        <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 800, color: mqtc }}>{qLabel} total</td><td colSpan={4}></td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 12, fontWeight: 800, color: mqtc }}>{fmtNum(qMs.reduce((s, mm) => s + Number(mm.impressions || 0), 0))}</td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 12, fontWeight: 800, color: mqtc }}>{fmtNum(qMs.reduce((s, mm) => s + Number(mm.orders || 0), 0))}</td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 14, fontWeight: 800, color: mqtg }}>{fmtDol(qG)}</td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 12, fontWeight: 800, color: mqtc }}>{fmtDol(qA)}</td><td></td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 12, fontWeight: 800, color: mqtg }}>{qR}</td><td></td><td></td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 13, fontWeight: 800, color: qN >= 0 ? mqtg : "#ef4444" }}>${Math.round(qN).toLocaleString()}</td>
                        <td style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, color: mqtc }}>{qW}w</td>
                      </tr>;
                    };
                    monthly.forEach((m, mi) => {
                      const d = new Date(m.month_start || m.month + "-01"); const q = "Q" + (Math.floor(d.getMonth() / 3) + 1) + " '" + String(d.getFullYear()).slice(-2);
                      if (q !== curQ) {
                        if (curQ) { rows.push(mkQTotal(curQ)); rows.push(<tr key={"qsp-" + curQ} style={{ height: 12 }}><td colSpan={99} style={{ border: "none" }}></td></tr>); }
                        curQ = q;
                      }
                      const gmv = Number(m.tts_gmv) || 0; const adSpend = Number(m.ad_spend) || 0; const netRev = Number(m.net_revenue) || 0;
                      const roas = m.roas ? m.roas + "x" : (adSpend > 0 ? (gmv / adSpend).toFixed(2) + "x" : "\u2014");
                      const cpm = m.cpm ? "$" + m.cpm : (Number(m.impressions) > 0 ? "$" + (adSpend / (Number(m.impressions) / 1000)).toFixed(2) : "\u2014");
                      const npv = m.net_per_video ? "$" + Number(m.net_per_video).toLocaleString() : (Number(m.videos_posted) > 0 ? "$" + Math.round(netRev / Number(m.videos_posted)).toLocaleString() : "\u2014");
                      const sv = Number(m.videos_posted) > 0 && Number(m.samples_posted || 0) > 0 ? (Number(m.samples_posted) / Number(m.videos_posted)).toFixed(2) : "\u2014";
                      const mld = new Date(m.month_start || m.month + "-01"); const monthLabel = mld.toLocaleDateString("en-US", { month: "long" }) + " '" + String(mld.getFullYear()).slice(-2);
                      const target = targets.find(tg => tg.month === m.month); const gmvPct = target?.target_gmv > 0 ? Math.round((gmv / target.target_gmv) * 100) : null;
                      const prevMonth = monthly[mi + 1] || null; const mc = t.isLight ? "#92600a" : "#fbbf24"; const mc2 = t.isLight ? "#6b5c3a" : "#a0944a";
                      rows.push(
                        <tr key={"m-" + m.month} style={{ background: t.isLight ? "#fef3e2" : "#2a1f0a", borderBottom: "2px solid " + (t.isLight ? "#f0d9a8" : "#3d2f0f") }} onMouseEnter={(e) => { e.currentTarget.style.background = t.isLight ? "#fdecc8" : "#332808"; }} onMouseLeave={(e) => { e.currentTarget.style.background = t.isLight ? "#fef3e2" : "#2a1f0a"; }}>
                          <td style={{ padding: "10px 12px", fontWeight: 700, color: mc, whiteSpace: "nowrap" }}>
                            {monthLabel}{gmvPct != null ? <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: gmvPct >= 100 ? t.green : gmvPct >= 75 ? t.orange : (t.red || "#ef4444") }}>{gmvPct}% to target</span> : null}
                            {Number(m.superfiliate_invites) > 0 && Number(m.videos_posted) > 0 ? <div style={{ fontSize: 9, color: mc2, marginTop: 2, fontWeight: 400 }}>Funnel: {m.superfiliate_invites} invites \u2192 {m.sample_requests || 0} requests \u2192 {m.samples_posted || 0} shipped \u2192 {m.videos_posted} videos ({Math.round((Number(m.videos_posted) / Number(m.superfiliate_invites)) * 100)}% invite-to-video)</div> : null}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: mc }}>{fmtNum(m.superfiliate_invites || 0)}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: mc }}>{fmtNum(m.sample_requests || 0)}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: mc }}>{fmtNum(m.samples_posted || 0)}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: mc }}>{fmtNum(m.videos_posted)}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: mc }}>{fmtNum(m.impressions)}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: mc }}>{fmtNum(m.orders)}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 800, fontSize: 13, color: t.green }}>{fmtDol(gmv)}{prevMonth ? (() => { const pG = Number(prevMonth.tts_gmv) || 0; if (pG === 0) return null; const pct = Math.round(((gmv - pG) / pG) * 100); if (pct === 0) return null; return <span style={{ fontSize: 9, fontWeight: 700, color: pct > 0 ? t.green : (t.red || "#ef4444"), marginLeft: 4 }}>{pct > 0 ? "\u25B2" : "\u25BC"}{Math.abs(pct)}%</span>; })() : null}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: adSpend > 0 ? (t.red || "#ef4444") : t.textFaint }}>{fmtDol(adSpend)}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: mc2 }}>{sv}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: roas !== "\u2014" && parseFloat(roas) >= 2 ? t.green : t.text }}>{roas}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: mc2 }}>{cpm}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: mc2 }}>{npv}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 800, fontSize: 13, color: netRev >= 0 ? t.green : (t.red || "#ef4444") }}>${Math.round(netRev).toLocaleString()}</td>
                          <td style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, color: t.textFaint }}>{m.weeks_reported}w</td>
                        </tr>
                      );
                    });
                    if (curQ) rows.push(mkQTotal(curQ));
                    return rows;
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}


export default TtsNativeTab;
export { PIPELINE_TAB_MAP, PIPELINE_SOP_TABS, pipelineColIndexToA1 };
