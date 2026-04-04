import React, { useState, useMemo } from "react";
import { dbGetSetting, dbSetSetting } from "../supabaseDb.js";

function CreatorHubLanding({ navigate, creators, t, S, library, CardIcon, setProgramFilter }) {
  const programCounts = {
    ugc: creators.filter(c => (c.programs || []).includes("ugc")).length,
    tts: creators.filter(c => (c.programs || []).includes("tts")).length,
    alist: creators.filter(c => (c.programs || []).includes("alist")).length,
    celebrity: creators.filter(c => (c.programs || []).includes("celebrity")).length,
    rising: creators.filter(c => (c.programs || []).includes("rising")).length,
    superfiliate: creators.filter(c => (c.programs || []).includes("superfiliate")).length,
  };
  const total = creators.length;

  const programs = [
    { id: "ugc", name: "UGC Army", desc: "Branded content creators making videos for campaign briefs", count: programCounts.ugc, color: "#00FEA9", icon: "creator",
      stats: [{ label: "Briefs", value: library.length }, { label: "Scored", value: creators.filter(c => c.ibScore != null).length }] },
    { id: "tts", name: "TTS Creators", desc: "TikTok Shop affiliates driving product sales and GMV", count: programCounts.tts, color: "#63B7BA", icon: "pipeline", stats: [] },
    { id: "alist", name: "A-Listers", desc: "Proven high-tier influencers with major reach and engagement", count: programCounts.alist, color: "#F59E0B", icon: "creator", stats: [] },
    { id: "celebrity", name: "Celebrities", desc: "Athletes, public figures, and famous personalities", count: programCounts.celebrity, color: "#8B5CF6", icon: "creator", stats: [] },
    { id: "rising", name: "Rising Stars", desc: "Regular creators proving themselves and growing fast", count: programCounts.rising, color: "#3B82F6", icon: "creator", stats: [] },
    { id: "superfiliate", name: "Superfiliate", desc: "Affiliate program members with referral links and commissions", count: programCounts.superfiliate, color: "#EC4899", icon: "creator", stats: [] },
  ];

  const goToProgram = (progId) => {
    localStorage.setItem("creator_program_filter", progId);
    if (setProgramFilter) setProgramFilter(progId);
    navigate("creators");
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px 60px", animation: "fadeIn 0.3s ease" }}>
      {/* Hero header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 32, fontWeight: 800, color: t.text, letterSpacing: "-0.03em" }}>Creator Hub</div>
        <div style={{ fontSize: 14, color: t.textMuted, marginTop: 6 }}>{total} creators across {programs.filter(p => p.count > 0).length} active programs</div>
      </div>

      {/* Quick stats */}
      <div style={{ display: "flex", gap: 12, marginBottom: 32 }}>
        {[
          { label: "Total Creators", value: total, color: t.green },
          { label: "Briefs Created", value: library.length, color: t.blue },
          { label: "Videos Tracked", value: creators.reduce((s, c) => s + Math.max((c.videoLog || []).length, c.totalVideos || 0), 0), color: t.orange },
          { label: "Creators Scored", value: creators.filter(c => c.ibScore != null).length, color: t.purple || "#8b6cc4" },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, background: t.card, border: "1px solid " + t.border, borderRadius: 12, padding: "16px 20px" }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: t.textFaint, marginTop: 2, textTransform: "uppercase", letterSpacing: "0.04em" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* View all button */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: t.text }}>Programs</div>
        <button onClick={() => goToProgram("all")} style={{ padding: "8px 18px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid " + t.border, background: t.card, color: t.text, cursor: "pointer" }}>View all {total} creators &rarr;</button>
      </div>

      {/* Program cards — 2 column grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 32 }}>
        {programs.map(prog => (
          <div key={prog.id}
            onClick={() => goToProgram(prog.id)}
            style={{
              background: t.card, border: "2px solid " + prog.color + "40", borderRadius: 16,
              padding: "24px 28px", cursor: "pointer", position: "relative", overflow: "hidden",
              transition: "border-color 0.2s, box-shadow 0.2s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = prog.color; e.currentTarget.style.boxShadow = "0 4px 20px " + prog.color + "15"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = prog.color + "40"; e.currentTarget.style.boxShadow = "none"; }}
          >
            {/* Color accent bar */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: prog.color }} />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: t.text, marginBottom: 6 }}>{prog.name}</div>
                <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.5, marginBottom: 16, maxWidth: 320 }}>{prog.desc}</div>
              </div>
              <div style={{ fontSize: 36, fontWeight: 800, color: prog.color, opacity: 0.8 }}>{prog.count}</div>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ fontSize: 11, color: prog.color, fontWeight: 700 }}>
                {prog.count} creator{prog.count !== 1 ? "s" : ""}
              </div>
              {prog.stats.map((s, i) => (
                <div key={i} style={{ fontSize: 11, color: t.textFaint }}>{s.value} {s.label.toLowerCase()}</div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => navigate("create")} style={{ padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 700, border: "none", background: t.green, color: t.isLight ? "#fff" : "#000", cursor: "pointer" }}>+ New Brief</button>
        <button onClick={() => navigate("campaigns")} style={{ padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600, border: "1px solid " + t.border, background: t.card, color: t.text, cursor: "pointer" }}>Campaigns</button>
        <button onClick={() => navigate("library")} style={{ padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600, border: "1px solid " + t.border, background: t.card, color: t.text, cursor: "pointer" }}>Brief Library ({library.length})</button>
      </div>
    </div>
  );
}

function UGCDashboard({ navigate, library, creators, t, S, onOpenBrief, onNewBrief, CardIcon, teamMembers = [] }) {
  const [activeTab, setActiveTab] = useState("overview");
  const active = creators.filter((c) => c.status === "Active").length;
  const scored = creators.filter((c) => c.ibScore != null).length;
  const vids = creators.reduce((s, c) => s + Math.max((c.videoLog || []).length, c.totalVideos || 0), 0);
  const programs = [...new Set(creators.flatMap(c => c.programs || []))];

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "creators", label: "Creators", count: active },
    { id: "campaigns", label: "Campaigns" },
    { id: "briefs", label: "Briefs", count: library.length },
  ];

  const goNewBrief = () => (onNewBrief ? onNewBrief() : navigate("create"));

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 24px 60px", animation: "fadeIn 0.3s ease" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, color: t.text, letterSpacing: "-0.02em" }}>Creator Hub</div>
          <div style={{ fontSize: 13, color: t.textMuted, marginTop: 4 }}>{active} creators · {programs.length} programs · {library.length} briefs</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={goNewBrief} style={{ padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700, border: "none", background: t.green, color: t.isLight ? "#fff" : "#000", cursor: "pointer" }}>+ New Brief</button>
          <button onClick={() => navigate("creators")} style={{ padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid " + t.border, background: t.card, color: t.text, cursor: "pointer" }}>View All Creators</button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 2, marginBottom: 20, borderBottom: "1px solid " + t.border }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer",
            border: "none", background: "transparent",
            color: activeTab === tab.id ? t.green : t.textMuted,
            borderBottom: activeTab === tab.id ? "2px solid " + t.green : "2px solid transparent",
            marginBottom: -1,
          }}>
            {tab.label}
            {tab.count != null ? <span style={{ marginLeft: 6, fontSize: 10, padding: "1px 6px", borderRadius: 8, background: activeTab === tab.id ? t.green + "15" : t.border, color: activeTab === tab.id ? t.green : t.textFaint, fontWeight: 700 }}>{tab.count}</span> : null}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === "overview" ? (
        <>
          {/* Stats */}
          <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
            {[
              { v: active, l: "Active Creators", c: t.green },
              { v: library.length, l: "Briefs Created", c: t.blue },
              { v: vids, l: "Videos Tracked", c: t.orange },
              { v: scored, l: "Creators Scored", c: t.purple || "#8b6cc4" },
              { v: programs.length, l: "Programs Active", c: t.blue },
            ].map((s, i) => (
              <div key={i} style={{ flex: "1 1 120px", minWidth: 120 }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: s.c }}>{s.v}</div>
                <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>

          {/* Quick action cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
            <div onClick={() => navigate("creators")} style={{ background: t.card, border: "2px solid " + t.green + "60", borderRadius: 14, padding: 20, cursor: "pointer" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.green; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.green + "60"; }}>
              <div style={{ marginBottom: 10 }}><CardIcon type="creator" color={t.green} /></div>
              <div style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 4 }}>Creators</div>
              <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.5 }}>View, search, and manage your creator roster</div>
              <div style={{ fontSize: 11, color: t.green, fontWeight: 600, marginTop: 8 }}>{active} active · {scored} scored</div>
            </div>

            <div onClick={() => setActiveTab("campaigns")} style={{ background: t.card, border: "2px solid " + (t.purple || "#8b6cc4") + "60", borderRadius: 14, padding: 20, cursor: "pointer" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.purple || "#8b6cc4"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = (t.purple || "#8b6cc4") + "60"; }}>
              <div style={{ marginBottom: 10 }}><CardIcon type="influencer" color={t.purple || "#8b6cc4"} /></div>
              <div style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 4 }}>Campaigns</div>
              <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.5 }}>Create campaigns, invite creators, track results</div>
              <div style={{ fontSize: 11, color: t.purple || "#8b6cc4", fontWeight: 600, marginTop: 8 }}>Manage campaigns</div>
            </div>

            <div onClick={goNewBrief} style={{ background: t.card, border: "2px solid " + t.blue + "60", borderRadius: 14, padding: 20, cursor: "pointer" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.blue; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.blue + "60"; }}>
              <div style={{ marginBottom: 10 }}><CardIcon type="brief" color={t.blue} /></div>
              <div style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 4 }}>New Brief</div>
              <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.5 }}>Create a UGC brief with IB-Ai</div>
              <div style={{ fontSize: 11, color: t.blue, fontWeight: 600, marginTop: 8 }}>IB-Ai powered</div>
            </div>
          </div>

          {/* Recent briefs */}
          {library.length > 0 ? (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.textFaint, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Recent briefs</div>
              {library.slice(0, 5).map((item) => (
                <div key={item.id} onClick={() => onOpenBrief?.(item)}
                  style={{ background: t.card, border: "1px solid " + t.border, borderRadius: 10, padding: "12px 16px", marginBottom: 6, cursor: onOpenBrief ? "pointer" : "default", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.green + "50"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{item.name}</div>
                    <div style={{ fontSize: 11, color: t.textFaint, marginTop: 2 }}>{item.formData?.manager || ""} · {item.date}</div>
                  </div>
                  <span style={{ fontSize: 11, color: t.textFaint }}>&rarr;</span>
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : null}

      {/* CREATORS TAB */}
      {activeTab === "creators" ? (
        <div>
          <div style={{ textAlign: "center", padding: 40 }}>
            <button onClick={() => navigate("creators")} style={{ padding: "12px 24px", borderRadius: 10, fontSize: 14, fontWeight: 700, border: "none", background: t.green, color: t.isLight ? "#fff" : "#000", cursor: "pointer" }}>Open full creator roster</button>
            <div style={{ fontSize: 12, color: t.textFaint, marginTop: 8 }}>{active} active creators · {scored} scored</div>
          </div>
        </div>
      ) : null}

      {/* CAMPAIGNS TAB */}
      {activeTab === "campaigns" ? (
        <div>
          <div style={{ fontSize: 12, color: t.textFaint, marginBottom: 12 }}>Create and manage campaigns directly from the Creator Hub.</div>
          <button onClick={() => navigate("campaigns")} style={{ padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700, border: "none", background: t.green, color: t.isLight ? "#fff" : "#000", cursor: "pointer" }}>Open Campaigns Manager</button>
        </div>
      ) : null}

      {/* BRIEFS TAB */}
      {activeTab === "briefs" ? (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: t.textFaint }}>{library.length} briefs in library</div>
            <button onClick={goNewBrief} style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, border: "none", background: t.green, color: t.isLight ? "#fff" : "#000", cursor: "pointer" }}>+ New Brief</button>
          </div>
          {library.length === 0 ? (
            <div style={{ background: t.card, border: "1px solid " + t.border, borderRadius: 12, padding: 32, textAlign: "center", color: t.textFaint }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No briefs yet</div>
              <div style={{ fontSize: 12 }}>Create your first UGC brief with IB-Ai.</div>
            </div>
          ) : library.map((item) => (
            <div key={item.id} onClick={() => onOpenBrief?.(item)}
              style={{ background: t.card, border: "1px solid " + t.border, borderRadius: 10, padding: "12px 16px", marginBottom: 6, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.green + "50"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{item.name}</div>
                <div style={{ fontSize: 11, color: t.textFaint, marginTop: 2 }}>{item.formData?.manager || ""} · {item.date}</div>
              </div>
              <span style={{ fontSize: 11, color: t.textFaint }}>&rarr;</span>
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
            Creator? Sign in here &rarr;
          </a>
        </div>
      </div>
    </div>
  );
}


export { UGCDashboard, ManagerLogin, CreatorHubLanding };
export default UGCDashboard;
