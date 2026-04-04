import React, { useState, useEffect } from "react";
import { dbLoadCampaigns, dbSaveCampaign, dbLoadCampaignCreators, dbSaveCampaignCreator, dbDeleteCampaignCreator, dbGetOrCreateConversation, dbSaveMessage, dbGetSetting } from "../supabaseDb.js";
import { notifySlack, notifyOwners } from "../utils/notifications.js";

function CampaignsPage({ t, S, teamMembers, creators, navigate }) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [campaignCreators, setCampaignCreators] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState({ current: 0, total: 0 });

  useEffect(() => { (async () => { setLoading(true); setCampaigns(await dbLoadCampaigns()); setLoading(false); })(); }, []);

  const matchCreators = (criteria) => {
    const minF = criteria?.min_followers || 0; const plats = criteria?.platforms || [];
    return creators.filter(c => {
      const ttF = Number(c.tiktokData?.followers) || 0; const igF = Number(c.instagramData?.followers) || 0;
      if (Math.max(ttF, igF) < minF) return false;
      if (plats.length > 0 && !plats.some(p => p === "tiktok" ? ttF > 0 : p === "instagram" ? igF > 0 : false)) return false;
      return true;
    });
  };
  const matched = selectedCampaign ? matchCreators(selectedCampaign.criteria) : [];

  const selectCampaign = async (c) => { setSelectedCampaign(c); setCampaignCreators(await dbLoadCampaignCreators(c.id)); };

  const saveCampaign = async () => {
    const payload = { ...formData }; if (editingId) payload.id = editingId;
    const result = await dbSaveCampaign(payload);
    if (!result.error) { setCampaigns(await dbLoadCampaigns()); setShowForm(false); if (result.data) selectCampaign(result.data); } else alert("Save failed: " + (result.error?.message || "Unknown"));
  };

  const addAllMatched = async () => {
    const toAdd = matched.filter(c => !campaignCreators.find(cc => cc.creator_id === c.id));
    for (const cr of toAdd) {
      const result = await dbSaveCampaignCreator({ campaign_id: selectedCampaign.id, creator_id: cr.id, status: "invited" });
      if (!result.error && result.data) setCampaignCreators(prev => [result.data, ...prev]);
    }
  };

  const generateInvites = async () => {
    if (!selectedCampaign || campaignCreators.length === 0) return;
    setGenerating(true);
    const apiKey = await dbGetSetting("anthropic-api-key");
    if (!apiKey) { alert("No API key."); setGenerating(false); return; }
    setGenProgress({ current: 0, total: campaignCreators.length });
    for (let i = 0; i < campaignCreators.length; i++) {
      const cc = campaignCreators[i]; const cr = creators.find(c => c.id === cc.creator_id); if (!cr) continue;
      setGenProgress({ current: i + 1, total: campaignCreators.length });
      const cn = cr.tiktokData?.displayName || cr.instagramData?.fullName || cr.handle || ""; const ch = cr.tiktokHandle || cr.instagramHandle || cr.handle || "";
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" }, body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 300, messages: [{ role: "user", content: "You are a creator partnerships manager at Intake Breathing. Write a personalized campaign invite to @" + ch + ".\n\nCAMPAIGN: " + selectedCampaign.name + "\nDESCRIPTION: " + (selectedCampaign.description || "") + "\nPRODUCT: " + (selectedCampaign.product || "Intake Breathing Starter Kit") + "\n\nCREATOR: " + cn + " (@" + ch + "), " + (Number(cr.tiktokData?.followers) || Number(cr.instagramData?.followers) || 0).toLocaleString() + " followers, IB Score " + (cr.ibScore?.overall || "N/A") + "\n\nWrite a short authentic invite under 120 words. Reference their content. Sound human, not corporate. Write ONLY the message body." }] }) });
        if (res.ok) { const data = await res.json(); const body = data.content?.[0]?.text || ""; if (body) { const conv = await dbGetOrCreateConversation(cr.id); if (conv) await dbSaveMessage({ conversation_id: conv.id, creator_id: cr.id, direction: "outbound", channel: "email", subject: "You're invited: " + selectedCampaign.name, body, status: "draft", ai_generated: true, campaign_id: selectedCampaign.id }); notifyOwners(cr.id, ch, "campaign_invite", { campaignName: selectedCampaign.name }); } }
      } catch (e) { console.error("[campaigns] Generate failed for", ch, e.message); }
    }
    setGenerating(false);
    alert("Generated " + campaignCreators.length + " invite drafts! Go to each creator's Messages to review and send.");
    notifySlack("campaign_invites_generated", { count: campaignCreators.length, campaignName: selectedCampaign.name });
  };

  const updateStatus = async (c, s) => { await dbSaveCampaign({ ...c, id: c.id, status: s }); setCampaigns(await dbLoadCampaigns()); if (selectedCampaign?.id === c.id) setSelectedCampaign({ ...c, status: s }); if (s === "active") notifySlack("campaign_live", { campaignName: c.name, creatorCount: campaignCreators.length, product: c.product }); };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: t.textFaint }}>Loading campaigns...</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div><div style={{ fontSize: 24, fontWeight: 800, color: t.text }}>Campaigns</div><div style={{ fontSize: 12, color: t.textFaint, marginTop: 4 }}>{campaigns.length} campaigns · {campaigns.filter(c => c.status === "active").length} active</div></div>
        <button onClick={() => { setFormData({ name: "", description: "", product: "Intake Breathing Starter Kit", start_date: new Date().toISOString().split("T")[0], end_date: "", target_creators: 50, budget: 0, criteria: { min_followers: 1000, platforms: ["tiktok"] }, status: "draft" }); setEditingId(null); setShowForm(true); }} style={{ padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700, border: "none", background: t.green, color: t.isLight ? "#fff" : "#000", cursor: "pointer" }}>+ New campaign</button>
      </div>

      {showForm ? (
        <div style={{ background: t.card, border: "2px solid " + t.green + "40", borderRadius: 14, padding: 24, marginBottom: 20, boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}><div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>{editingId ? "Edit campaign" : "New campaign"}</div><button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", fontSize: 18, color: t.textFaint, cursor: "pointer" }}>x</button></div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div><div style={{ fontSize: 10, color: t.textFaint, marginBottom: 2 }}>Campaign name</div><input value={formData.name || ""} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Summer Fitness Push" style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid " + t.border, background: t.inputBg, color: t.inputText, fontSize: 13, boxSizing: "border-box" }} /></div>
            <div><div style={{ fontSize: 10, color: t.textFaint, marginBottom: 2 }}>Start date</div><input type="date" value={formData.start_date || ""} onChange={(e) => setFormData(p => ({ ...p, start_date: e.target.value }))} style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid " + t.border, background: t.inputBg, color: t.inputText, fontSize: 12, boxSizing: "border-box" }} /></div>
            <div><div style={{ fontSize: 10, color: t.textFaint, marginBottom: 2 }}>End date</div><input type="date" value={formData.end_date || ""} onChange={(e) => setFormData(p => ({ ...p, end_date: e.target.value }))} style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid " + t.border, background: t.inputBg, color: t.inputText, fontSize: 12, boxSizing: "border-box" }} /></div>
          </div>
          <div style={{ marginBottom: 12 }}><div style={{ fontSize: 10, color: t.textFaint, marginBottom: 2 }}>Description</div><textarea value={formData.description || ""} onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))} placeholder="What should creators do?" style={{ width: "100%", minHeight: 60, padding: "8px 12px", borderRadius: 6, border: "1px solid " + t.border, background: t.inputBg, color: t.inputText, fontSize: 12, boxSizing: "border-box", fontFamily: "inherit", resize: "vertical" }} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div><div style={{ fontSize: 10, color: t.textFaint, marginBottom: 2 }}>Product</div><input value={formData.product || ""} onChange={(e) => setFormData(p => ({ ...p, product: e.target.value }))} style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid " + t.border, background: t.inputBg, color: t.inputText, fontSize: 12, boxSizing: "border-box" }} /></div>
            <div><div style={{ fontSize: 10, color: t.textFaint, marginBottom: 2 }}>Target creators</div><input type="number" value={formData.target_creators || ""} onChange={(e) => setFormData(p => ({ ...p, target_creators: Number(e.target.value) || 0 }))} style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid " + t.border, background: t.inputBg, color: t.inputText, fontSize: 12, boxSizing: "border-box" }} /></div>
            <div><div style={{ fontSize: 10, color: t.textFaint, marginBottom: 2 }}>Budget ($)</div><input type="number" value={formData.budget || ""} onChange={(e) => setFormData(p => ({ ...p, budget: Number(e.target.value) || 0 }))} style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid " + t.border, background: t.inputBg, color: t.inputText, fontSize: 12, boxSizing: "border-box" }} /></div>
          </div>
          <div style={{ marginBottom: 12, padding: 12, background: t.cardAlt, borderRadius: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 6 }}>Creator criteria</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div><div style={{ fontSize: 10, color: t.textFaint, marginBottom: 2 }}>Min followers</div><input type="number" value={formData.criteria?.min_followers || ""} onChange={(e) => setFormData(p => ({ ...p, criteria: { ...p.criteria, min_followers: Number(e.target.value) || 0 } }))} style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid " + t.border, background: t.inputBg, color: t.inputText, fontSize: 12, boxSizing: "border-box" }} /></div>
              <div><div style={{ fontSize: 10, color: t.textFaint, marginBottom: 2 }}>Platforms</div><div style={{ display: "flex", gap: 6 }}>{["tiktok", "instagram", "youtube"].map(p => <label key={p} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: t.text, cursor: "pointer" }}><input type="checkbox" checked={(formData.criteria?.platforms || []).includes(p)} onChange={(e) => { const cur = formData.criteria?.platforms || []; setFormData(prev => ({ ...prev, criteria: { ...prev.criteria, platforms: e.target.checked ? [...cur, p] : cur.filter(x => x !== p) } })); }} />{p}</label>)}</div></div>
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: t.green, fontWeight: 600 }}>{matchCreators(formData.criteria).length} creators match</div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button onClick={() => setShowForm(false)} style={{ padding: "8px 18px", borderRadius: 8, fontSize: 12, border: "1px solid " + t.border, background: t.card, color: t.textMuted, cursor: "pointer" }}>Cancel</button>
            <button onClick={saveCampaign} style={{ padding: "8px 18px", borderRadius: 8, fontSize: 12, fontWeight: 700, border: "none", background: t.green, color: t.isLight ? "#fff" : "#000", cursor: "pointer" }}>Save campaign</button>
          </div>
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: selectedCampaign ? "1fr 2fr" : "1fr", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {campaigns.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: t.textFaint, background: t.card, borderRadius: 12, border: "1px solid " + t.border }}>No campaigns yet.</div> : campaigns.map(c => {
            const sc = { draft: t.textFaint, active: t.green, paused: t.orange || "#d4890a", completed: t.blue };
            return <div key={c.id} onClick={() => selectCampaign(c)} style={{ background: t.card, border: selectedCampaign?.id === c.id ? "2px solid " + t.green + "60" : "1px solid " + t.border, borderRadius: 10, padding: "12px 16px", cursor: "pointer", boxShadow: t.shadow }} onMouseEnter={(e) => { if (selectedCampaign?.id !== c.id) e.currentTarget.style.background = t.cardAlt; }} onMouseLeave={(e) => { if (selectedCampaign?.id !== c.id) e.currentTarget.style.background = t.card; }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{c.name}</div><span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 4, background: (sc[c.status] || t.textFaint) + "15", color: sc[c.status] || t.textFaint, fontWeight: 700, textTransform: "uppercase" }}>{c.status}</span></div>
              <div style={{ fontSize: 11, color: t.textFaint, marginTop: 4 }}>{c.product || "No product"} · Target: {c.target_creators}</div>
            </div>;
          })}
        </div>
        {selectedCampaign ? (
          <div style={{ background: t.card, border: "1px solid " + t.border, borderRadius: 12, padding: 20, boxShadow: t.shadow }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div><div style={{ fontSize: 18, fontWeight: 800, color: t.text }}>{selectedCampaign.name}</div><div style={{ fontSize: 12, color: t.textFaint, marginTop: 2 }}>{selectedCampaign.description || ""}</div></div>
              <div style={{ display: "flex", gap: 6 }}>
                {selectedCampaign.status === "draft" ? <button onClick={() => updateStatus(selectedCampaign, "active")} style={{ padding: "6px 14px", borderRadius: 6, fontSize: 11, fontWeight: 700, border: "none", background: t.green, color: "#fff", cursor: "pointer" }}>Go Live</button> : selectedCampaign.status === "active" ? <button onClick={() => updateStatus(selectedCampaign, "paused")} style={{ padding: "6px 14px", borderRadius: 6, fontSize: 11, fontWeight: 600, border: "1px solid " + t.border, background: t.card, color: t.orange, cursor: "pointer" }}>Pause</button> : selectedCampaign.status === "paused" ? <button onClick={() => updateStatus(selectedCampaign, "active")} style={{ padding: "6px 14px", borderRadius: 6, fontSize: 11, fontWeight: 700, border: "none", background: t.green, color: "#fff", cursor: "pointer" }}>Resume</button> : null}
                <button onClick={() => { setFormData(selectedCampaign); setEditingId(selectedCampaign.id); setShowForm(true); }} style={{ padding: "6px 14px", borderRadius: 6, fontSize: 11, fontWeight: 600, border: "1px solid " + t.border, background: t.card, color: t.textMuted, cursor: "pointer" }}>Edit</button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {[{ label: "Matched", value: matched.length, color: t.text }, { label: "Invited", value: campaignCreators.length, color: t.blue }, { label: "Accepted", value: campaignCreators.filter(cc => cc.status === "accepted").length, color: t.green }, { label: "Completed", value: campaignCreators.filter(cc => cc.status === "completed").length, color: t.green }].map((s, i) => <div key={i} style={{ flex: 1, padding: "8px 10px", background: t.cardAlt, borderRadius: 8 }}><div style={{ fontSize: 9, color: t.textFaint, textTransform: "uppercase" }}>{s.label}</div><div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.value}</div></div>)}
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <button onClick={addAllMatched} style={{ padding: "6px 14px", borderRadius: 6, fontSize: 11, fontWeight: 600, border: "1px solid " + t.border, background: t.card, color: t.text, cursor: "pointer" }}>Add all {matched.length} matched</button>
              <button onClick={generateInvites} disabled={generating || campaignCreators.length === 0} style={{ padding: "6px 14px", borderRadius: 6, fontSize: 11, fontWeight: 700, border: "none", background: t.purple || "#8b6cc4", color: "#fff", cursor: "pointer", opacity: generating ? 0.6 : 1 }}>{generating ? "Generating " + genProgress.current + "/" + genProgress.total + "..." : "Generate AI invites (" + campaignCreators.length + ")"}</button>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 8 }}>Creators ({campaignCreators.length})</div>
            <div style={{ maxHeight: 400, overflowY: "auto" }}>
              {campaignCreators.length === 0 ? <div style={{ padding: 20, textAlign: "center", color: t.textFaint, fontSize: 12 }}>No creators added yet.</div> : campaignCreators.map(cc => {
                const cr = creators.find(c => c.id === cc.creator_id); if (!cr) return null;
                const h = cr.tiktokHandle || cr.instagramHandle || cr.handle || ""; const n = cr.tiktokData?.displayName || cr.instagramData?.fullName || h;
                const av = cr.tiktokData?.avatarUrl || cr.instagramData?.avatarUrl || "";
                return <div key={cc.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderBottom: "1px solid " + t.border + "40" }}>
                  {av ? <img src={av} alt="" style={{ width: 28, height: 28, borderRadius: 14, objectFit: "cover" }} onError={(e) => { e.target.style.display = "none"; }} /> : <div style={{ width: 28, height: 28, borderRadius: 14, background: t.green + "15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: t.green }}>{n[0]}</div>}
                  <div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{n} <span style={{ fontSize: 10, color: t.textFaint }}>@{h}</span></div></div>
                  <select value={cc.status} onChange={async (e) => { await dbSaveCampaignCreator({ ...cc, status: e.target.value }); setCampaignCreators(prev => prev.map(x => x.id === cc.id ? { ...x, status: e.target.value } : x)); }} style={{ padding: "3px 8px", borderRadius: 4, border: "1px solid " + t.border, background: t.inputBg, color: t.text, fontSize: 10, fontWeight: 600 }}>{["invited", "accepted", "declined", "completed", "paid"].map(s => <option key={s} value={s}>{s}</option>)}</select>
                  <button onClick={async () => { await dbDeleteCampaignCreator(cc.id); setCampaignCreators(prev => prev.filter(x => x.id !== cc.id)); }} style={{ background: "none", border: "none", color: t.textFaint, cursor: "pointer", fontSize: 10 }}>x</button>
                </div>;
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}


export default CampaignsPage;
