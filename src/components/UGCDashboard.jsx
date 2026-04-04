import React, { useState, useMemo } from "react";

function UGCDashboard({ navigate, library, creators, t, S, onOpenBrief, onNewBrief, CardIcon }) {
  const active = creators.filter((c) => c.status === "Active").length;
  const scored = creators.filter((c) => c.ibScore != null).length;
  const vids = creators.reduce((s, c) => s + Math.max((c.videoLog || []).length, c.totalVideos || 0), 0);

  const cardStyle = (accent) => ({
    background: t.card, border: `2px solid ${accent}60`, borderRadius: 14, padding: 22,
    cursor: "pointer", boxShadow: `0 2px 8px ${accent}08`,
    transition: "border-color 0.2s, box-shadow 0.2s",
  });
  const hoverIn = (e, accent) => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.boxShadow = `0 4px 16px ${accent}15`; };
  const hoverOut = (e, accent) => { e.currentTarget.style.borderColor = accent + "60"; e.currentTarget.style.boxShadow = `0 2px 8px ${accent}08`; };

  const goNewBrief = () => (onNewBrief ? onNewBrief() : navigate("create"));

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px 60px", animation: "fadeIn 0.3s ease" }}>
      <div style={{ fontSize: 28, fontWeight: 800, color: t.text, letterSpacing: "-0.02em", marginBottom: 4 }}>Creator Hub</div>
      <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 28 }}>Manage creators across all programs — UGC, TTS, A-Listers, Celebrities, and more</div>

      <div style={{ display: "flex", gap: 16, marginBottom: 32, flexWrap: "wrap" }}>
        {[
          { v: active, l: "Active Creators", c: t.green },
          { v: library.length, l: "Briefs Created", c: t.blue },
          { v: vids, l: "Videos Tracked", c: t.orange },
          { v: scored, l: "Creators Scored", c: t.purple },
          { v: [...new Set(creators.flatMap(c => c.programs || []))].length, l: "Programs Active", c: t.purple || "#8b5cf6" },
        ].map((s, i) => (
          <div key={i} style={{ flex: "1 1 120px", minWidth: 120 }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.c }}>{s.v}</div>
            <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>{s.l}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 32 }}>
        <div style={cardStyle(t.green)} onClick={() => navigate("creators")}
          onMouseEnter={(e) => hoverIn(e, t.green)} onMouseLeave={(e) => hoverOut(e, t.green)}>
          <div style={{ marginBottom: 14 }}><CardIcon type="creator" color={t.green} /></div>
          <div style={{ fontSize: 18, fontWeight: 700, color: t.text, marginBottom: 4 }}>Creators</div>
          <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.5, marginBottom: 14 }}>View, search, and manage your creator roster. Enrich profiles with live data.</div>
          <div style={{ fontSize: 12, color: t.green, fontWeight: 600 }}>{active} active · {scored} scored</div>
        </div>

        <div style={cardStyle(t.blue)} onClick={goNewBrief}
          onMouseEnter={(e) => hoverIn(e, t.blue)} onMouseLeave={(e) => hoverOut(e, t.blue)}>
          <div style={{ marginBottom: 14 }}><CardIcon type="brief" color={t.blue} /></div>
          <div style={{ fontSize: 18, fontWeight: 700, color: t.text, marginBottom: 4 }}>New Brief</div>
          <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.5, marginBottom: 14 }}>Create a new UGC creator brief with IB-Ai or Instant Draft templates.</div>
          <div style={{ fontSize: 12, color: t.blue, fontWeight: 600 }}>IB-Ai powered</div>
        </div>

        <div style={cardStyle(t.orange)} onClick={() => navigate("library")}
          onMouseEnter={(e) => hoverIn(e, t.orange)} onMouseLeave={(e) => hoverOut(e, t.orange)}>
          <div style={{ marginBottom: 14 }}><CardIcon type="brief" color={t.orange} /></div>
          <div style={{ fontSize: 18, fontWeight: 700, color: t.text, marginBottom: 4 }}>Brief Library</div>
          <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.5, marginBottom: 14 }}>Browse, edit, and regenerate your saved briefs.</div>
          <div style={{ fontSize: 12, color: t.orange, fontWeight: 600 }}>{library.length} brief{library.length !== 1 ? "s" : ""}</div>
        </div>

        <div style={cardStyle(t.purple || "#8b6cc4")} onClick={() => navigate("campaigns")}
          onMouseEnter={(e) => hoverIn(e, t.purple || "#8b6cc4")} onMouseLeave={(e) => hoverOut(e, t.purple || "#8b6cc4")}>
          <div style={{ marginBottom: 14 }}><CardIcon type="influencer" color={t.purple || "#8b6cc4"} /></div>
          <div style={{ fontSize: 18, fontWeight: 700, color: t.text, marginBottom: 4 }}>Campaigns</div>
          <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.5, marginBottom: 14 }}>Create campaigns, invite creators, track results.</div>
          <div style={{ fontSize: 12, color: t.purple || "#8b6cc4", fontWeight: 600 }}>Live</div>
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


export { UGCDashboard, ManagerLogin };
export default UGCDashboard;
