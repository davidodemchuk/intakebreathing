import React, { useState, useEffect } from "react";
import { dbLoadCampaigns, dbSaveCampaign } from "../supabaseDb.js";

function CampaignsPage({ t, S, teamMembers, creators, navigate, briefs = [] }) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => { setLoading(true); setCampaigns(await dbLoadCampaigns()); setLoading(false); })(); }, []);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: t.textFaint }}>Loading campaigns...</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div><div style={{ fontSize: 24, fontWeight: 500, color: t.text }}>Campaigns</div><div style={{ fontSize: 12, color: t.textFaint, marginTop: 4 }}>{campaigns.length} campaigns · {campaigns.filter(c => c.status === "active").length} active</div></div>
        <button onClick={async () => { const result = await dbSaveCampaign({ name: "Name your campaign/brief", status: "draft" }); if (result.data?.id) navigate("campaignDetail", { campaignId: result.data.id }); }} style={{ padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500, border: "none", background: t.green, color: t.isLight ? "#fff" : "#000", cursor: "pointer" }}>+ New campaign</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {campaigns.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: t.textFaint, background: t.card, borderRadius: 12, border: "1px solid " + t.border }}>No campaigns yet. Click "+ New campaign" to get started.</div> : campaigns.map(c => {
          const sc = { draft: t.textFaint, active: t.green, paused: t.orange || "#d4890a", complete: t.blue, completed: t.blue };
          return <div key={c.id} onClick={() => navigate("campaignDetail", { campaignId: c.id })} style={{ background: t.card, border: "1px solid " + t.border, borderRadius: 10, padding: "14px 18px", cursor: "pointer", transition: "border-color 0.15s" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.green + "50"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: t.text }}>{c.name}</div>
              <span style={{ fontSize: 10, padding: "2px 10px", borderRadius: 6, background: (sc[c.status] || t.textFaint) + "15", color: sc[c.status] || t.textFaint, fontWeight: 500, textTransform: "uppercase" }}>{c.status || "draft"}</span>
            </div>
            <div style={{ fontSize: 12, color: t.textFaint, marginTop: 4 }}>{c.product || ""}{c.created_at ? " · Created " + new Date(c.created_at).toLocaleDateString() : ""}</div>
          </div>;
        })}
      </div>
    </div>
  );
}

export default CampaignsPage;
