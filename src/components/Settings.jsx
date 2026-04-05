import React, { useState, useRef, useEffect, useCallback } from "react";

function SettingsPanel({
  instanceId,
  t,
  creators,
  library,
  supabase,
  dbSetSetting,
  dbGetSetting,
  apiKey,
  scrapeKey,
  setApiStatus,
  setApiMsg,
  apiStatus,
  apiMsg,
  saveApiKey,
  testApi,
  setScrapeStatus,
  setScrapeMsg,
  scrapeStatus,
  scrapeMsg,
  saveScrapeKey,
  testScrapeApi,
  currentRole,
  setCurrentRole,
  navigate,
  CHANGELOG = [],
  APP_VERSION = "",
  ROLES = {},
}) {
  const pwId = `${instanceId}-new-password-input`;
  const apiId = `${instanceId}-api-key-input`;
  const scrapeId = `${instanceId}-scrape-key-input`;
  const unlockId = `${instanceId}-api-unlock-pw`;
  const [apiKeysUnlocked, setApiKeysUnlocked] = useState(false);
  const [savedResend, setSavedResend] = useState("");
  const [savedTwilioSid, setSavedTwilioSid] = useState("");
  const [savedTwilioToken, setSavedTwilioToken] = useState("");
  const [savedTwilioPhone, setSavedTwilioPhone] = useState("");
  const [reformatTemplates, setReformatTemplates] = useState([]);
  const [newTmplName, setNewTmplName] = useState("");
  const [newTmplType, setNewTmplType] = useState("blur");
  const [newTmplColorPrimary, setNewTmplColorPrimary] = useState("#0d0d1a");
  const [newTmplColorSecondary, setNewTmplColorSecondary] = useState("#1a1a2e");
  const [tmplSaving, setTmplSaving] = useState(false);

  const loadTemplates = useCallback(() => {
    fetch("/api/reformat-templates").then(r => r.ok ? r.json() : []).then(d => setReformatTemplates(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      const [r, s, tk, p] = await Promise.all([dbGetSetting("resend-api-key"), dbGetSetting("twilio-account-sid"), dbGetSetting("twilio-auth-token"), dbGetSetting("twilio-phone-number")]);
      if (r) setSavedResend(r);
      if (s) setSavedTwilioSid(s);
      if (tk) setSavedTwilioToken(tk);
      if (p) setSavedTwilioPhone(p);
    })();
    loadTemplates();
  }, []);

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* LEFT COLUMN */}
        <div>
          {/* Services Dashboard */}
          <div style={{ background: t.card, borderRadius: 12, border: "1px solid " + t.border, padding: 20, boxShadow: t.shadow, marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: t.text, marginBottom: 4 }}>Services</div>
            <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 16 }}>External platforms that power this dashboard</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { name: "Supabase", desc: "Database, auth, storage", url: "https://supabase.com/dashboard/project/qaokxufufwbilfultgrk", status: "connected", color: t.green },
                { name: "Railway", desc: "Server hosting + deploy", url: "https://railway.app", status: "deployed", color: t.green },
                { name: "Anthropic", desc: "Claude AI for briefs + scoring", url: "https://console.anthropic.com", status: apiKey ? "key set" : "no key", color: apiKey ? t.green : t.orange },
                { name: "ScrapeCreators", desc: "Creator enrichment (11 platforms)", url: "https://app.scrapecreators.com", status: scrapeKey ? "key set" : "no key", color: scrapeKey ? t.green : t.orange },
                { name: "Resend", desc: "Email delivery for creator portal", url: "https://resend.com", status: "configured", color: t.green },
                { name: "Google Sheets", desc: "Channel Pipeline data source", url: "https://docs.google.com/spreadsheets/d/1aM51vSoGUhuhDJu8VyukeIp59XS2G_yv3alJxTJ2Aak", status: "connected", color: t.green },
                { name: "GitHub", desc: "Source code repository", url: "https://github.com/davidodemchuk/intakebreathing", status: "active", color: t.green },
                { name: "Slack", desc: "Creator notifications", url: "https://api.slack.com/apps", status: "configured", color: t.green },
              ].map((s, i) => (
                <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 8, border: "1px solid " + t.border, textDecoration: "none", transition: "border-color 0.2s" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = s.color + "60"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: t.textMuted }}>{s.desc}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: 3, background: s.color }}></div>
                    <span style={{ fontSize: 10, color: s.color, fontWeight: 600 }}>{s.status}</span>
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* Database + Preview Mode side by side */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div style={{ background: t.card, borderRadius: 12, border: "1px solid " + t.border, padding: 16, boxShadow: t.shadow }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: t.text, marginBottom: 4 }}>Database Connection</div>
              <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 10 }}>Test read/write to Supabase</div>
              <button type="button" onClick={async () => {
                try {
                  const { data: readTest, error: readErr } = await supabase.from("creators").select("id").limit(1);
                  if (readErr) throw new Error("Read failed: " + readErr.message);
                  if (readTest && readTest.length > 0) {
                    const testId = readTest[0].id;
                    const testVal = new Date().toISOString();
                    const { error: writeErr } = await supabase.from("creators").update({ last_enriched: testVal }).eq("id", testId);
                    if (writeErr) throw new Error("Write failed: " + writeErr.message);
                    const { data: verifyData, error: verifyErr } = await supabase.from("creators").select("last_enriched").eq("id", testId).single();
                    if (verifyErr) throw new Error("Verify failed: " + verifyErr.message);
                    if (!verifyData.last_enriched) throw new Error("Write verification failed — value didn't persist");
                    const wrote = new Date(testVal).getTime();
                    const read = new Date(verifyData.last_enriched).getTime();
                    if (Math.abs(wrote - read) > 2000) throw new Error("Write verification failed — timestamps don't match");
                  }
                  alert("Database connection working. Read, write, and verify all passed.");
                } catch (e) { alert("Database test FAILED: " + e.message); }
              }} style={{ padding: "9px 16px", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer", border: "none", background: t.blue, color: "#fff" }}>
                Test Connection
              </button>
              <div style={{ fontSize: 11, color: t.textFaint, marginTop: 8 }}>{creators.length} creators · {library.length} briefs</div>
            </div>
            <div style={{ background: t.card, borderRadius: 12, border: "1px solid " + t.border, padding: 16, boxShadow: t.shadow }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: t.text, marginBottom: 4 }}>Preview Mode</div>
              <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 10 }}>See what creators see — briefs only</div>
              <button type="button" onClick={() => {
                if (currentRole === ROLES.MANAGER) { setCurrentRole(ROLES.CREATOR); navigate("campaigns"); }
                else { setCurrentRole(ROLES.MANAGER); navigate("home"); }
              }} style={{ padding: "9px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid " + (currentRole === ROLES.CREATOR ? t.green + "50" : t.border), background: currentRole === ROLES.CREATOR ? t.green + "15" : t.cardAlt, color: currentRole === ROLES.CREATOR ? t.green : t.text, cursor: "pointer" }}>
                {currentRole === ROLES.CREATOR ? "Back to Manager" : "View as Creator"}
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div>
          {/* API Keys — Password Protected */}
          <div style={{ background: t.card, borderRadius: 12, border: "1px solid " + t.border, padding: 20, boxShadow: t.shadow, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: apiKeysUnlocked ? 16 : 0 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 500, color: t.text, marginBottom: 2 }}>API Keys</div>
                <div style={{ fontSize: 12, color: t.textMuted }}>Protected — changes affect the entire platform</div>
              </div>
              {!apiKeysUnlocked ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 6, background: t.orange + "15", border: "1px solid " + t.orange + "30" }}>
                  <div style={{ width: 6, height: 6, borderRadius: 3, background: t.orange }}></div>
                  <span style={{ fontSize: 10, color: t.orange, fontWeight: 600 }}>Locked</span>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 6, background: t.green + "15", border: "1px solid " + t.green + "30" }}>
                  <div style={{ width: 6, height: 6, borderRadius: 3, background: t.green }}></div>
                  <span style={{ fontSize: 10, color: t.green, fontWeight: 600 }}>Unlocked</span>
                </div>
              )}
            </div>

            {!apiKeysUnlocked ? (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, color: t.orange, marginBottom: 10, padding: "8px 12px", background: t.orange + "08", borderRadius: 8, border: "1px solid " + t.orange + "20" }}>
                  Changing API keys will affect all AI features, enrichment, and email delivery. Enter the team password to make changes.
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input id={unlockId} type="password" placeholder="Team password" onKeyDown={async (e) => {
                    if (e.key !== "Enter") return;
                    const val = e.target.value.trim();
                    if (!val) return;
                    const encoder = new TextEncoder();
                    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(val));
                    const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
                    const stored = await dbGetSetting("manager-password-hash");
                    if (hash === stored) setApiKeysUnlocked(true);
                    else alert("Incorrect password");
                  }} style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid " + t.border, background: t.inputBg, color: t.inputText, fontSize: 13 }} />
                  <button type="button" onClick={async () => {
                    const el = document.getElementById(unlockId);
                    const val = el ? el.value.trim() : "";
                    if (!val) return;
                    const encoder = new TextEncoder();
                    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(val));
                    const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
                    const stored = await dbGetSetting("manager-password-hash");
                    if (hash === stored) setApiKeysUnlocked(true);
                    else alert("Incorrect password");
                  }} style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: t.orange, color: "#fff", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>Unlock</button>
                </div>
              </div>
            ) : (
              <div>
                {/* Anthropic API Key */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: t.text, marginBottom: 2 }}>Anthropic API Key</div>
                  <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 10 }}>Powers IB-Ai briefs, IB Score, and outreach</div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <input id={apiId} type="password" defaultValue={apiKey} placeholder="sk-ant-api03-..." style={{ flex: 1, padding: "9px 12px", borderRadius: 8, border: "1px solid " + (apiKey ? t.green + "50" : t.border), background: t.inputBg, color: t.inputText, fontSize: 13, fontFamily: "monospace", outline: "none", boxSizing: "border-box" }} />
                    <button type="button" onClick={() => { const el = document.getElementById(apiId); const val = el ? el.value.trim() : ""; if (!val) { setApiStatus("fail"); setApiMsg("Paste your key first."); return; } saveApiKey(val); testApi(val); }} disabled={apiStatus === "testing"} style={{ padding: "9px 16px", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer", border: "none", background: t.green, color: t.isLight ? "#fff" : "#000", opacity: apiStatus === "testing" ? 0.6 : 1, whiteSpace: "nowrap" }}>
                      {apiStatus === "testing" ? "Testing..." : "Save & Test"}
                    </button>
                  </div>
                  {apiMsg && <div style={{ fontSize: 11, padding: "8px 10px", borderRadius: 6, background: apiStatus === "ok" ? t.green + "10" : t.red + "08", color: apiStatus === "ok" ? t.green : t.red, border: "1px solid " + (apiStatus === "ok" ? t.green + "25" : t.red + "25") }}>{apiMsg}</div>}
                  {apiKey && !apiMsg && <div style={{ fontSize: 11, color: t.green }}>Key saved (synced via Supabase)</div>}
                </div>

                <button onClick={() => setApiKeysUnlocked(false)} style={{ fontSize: 11, color: t.textFaint, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Lock API keys</button>
              </div>
            )}
          </div>

          {/* ScrapeCreators API Key — always visible */}
          <div style={{ background: t.card, borderRadius: 12, border: "1px solid " + t.border, padding: 20, boxShadow: t.shadow, marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: t.text, marginBottom: 2 }}>ScrapeCreators API Key</div>
            <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 12 }}>Used for creator enrichment (11 platforms) and video downloads. Get from <a href="https://app.scrapecreators.com" target="_blank" rel="noopener noreferrer" style={{ color: t.blue }}>app.scrapecreators.com</a></div>
            <div style={{ display: "flex", gap: 8 }}>
              <input id={scrapeId} type="password" defaultValue={scrapeKey} placeholder="Your ScrapeCreators key..." style={{ flex: 1, padding: "9px 12px", borderRadius: 8, border: "1px solid " + (scrapeKey ? t.green + "50" : t.border), background: t.inputBg, color: t.inputText, fontSize: 13, fontFamily: "monospace", outline: "none", boxSizing: "border-box" }} />
              <button type="button" onClick={() => { const el = document.getElementById(scrapeId); const val = el ? el.value.trim() : ""; if (!val) { setScrapeStatus("fail"); setScrapeMsg("Paste your key first."); return; } saveScrapeKey(val); testScrapeApi(val); }} disabled={scrapeStatus === "testing"} style={{ padding: "9px 16px", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer", border: "none", background: t.green, color: t.isLight ? "#fff" : "#000", opacity: scrapeStatus === "testing" ? 0.6 : 1, whiteSpace: "nowrap" }}>
                {scrapeStatus === "testing" ? "Testing..." : "Save & Test"}
              </button>
            </div>
            {scrapeStatus === "ok" ? <div style={{ fontSize: 12, color: t.green, marginTop: 8 }}>Key saved (synced via Supabase)</div> : scrapeStatus === "fail" ? <div style={{ fontSize: 12, color: t.red || "#ef4444", marginTop: 8 }}>{scrapeMsg || "Failed"}</div> : scrapeKey ? <div style={{ fontSize: 12, color: t.green, marginTop: 8 }}>Key saved (synced via Supabase)</div> : null}
          </div>

          {/* Slack Notifications */}
          <div style={{ background: t.card, borderRadius: 12, border: "1px solid " + t.border, padding: 20, boxShadow: t.shadow, marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: t.text, marginBottom: 4 }}>Slack notifications</div>
            <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 12 }}>Auto-post to #internal-creatorship when messages are sent or campaigns go live.</div>
            <div>
              <div style={{ fontSize: 10, color: t.textFaint, marginBottom: 2 }}>Slack webhook URL</div>
              <input type="text" id={instanceId + "-slack-webhook"} placeholder="https://hooks.slack.com/services/..." style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid " + t.border, background: t.inputBg, color: t.inputText, fontSize: 12, boxSizing: "border-box" }} />
              <div style={{ fontSize: 9, color: t.textFaint, marginTop: 4 }}>api.slack.com/apps → your app → Incoming Webhooks → Add to #internal-creatorship</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
              <button onClick={async () => { const el = document.getElementById(instanceId + "-slack-webhook"); const val = el?.value?.trim(); if (!val) { alert("Paste your webhook URL first."); return; } await dbSetSetting("slack-webhook-url", val); alert("Slack webhook saved!"); }} style={{ padding: "8px 18px", borderRadius: 8, fontSize: 12, fontWeight: 500, border: "none", background: t.green, color: t.isLight ? "#fff" : "#000", cursor: "pointer" }}>Save</button>
              <button onClick={async () => { try { const res = await fetch("/api/slack-notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "test", data: { text: ":white_check_mark: *Intake Creators Bot connected!*\nSlack notifications are working.\n<https://www.intakecreators.com|Open Intake Creators>" } }) }); const d = await res.json(); if (d.sent) alert("Test sent! Check #internal-creatorship."); else alert("Failed: " + (d.reason || "Unknown. Make sure webhook URL is saved.")); } catch (e) { alert("Failed: " + e.message); } }} style={{ padding: "8px 18px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid " + t.border, background: t.card, color: t.textMuted, cursor: "pointer" }}>Test connection</button>
            </div>
          </div>

          {/* Email + SMS Notifications */}
          <div style={{ background: t.card, borderRadius: 12, border: "1px solid " + t.border, padding: 20, boxShadow: t.shadow, marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: t.text, marginBottom: 4 }}>Email & SMS Notifications</div>
            <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 12 }}>Send email (Resend) and text (Twilio) notifications when creators are invited to campaigns.</div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: t.textFaint, marginBottom: 2 }}>Resend API Key</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input id={instanceId + "-resend-key"} type="password" defaultValue={savedResend} placeholder="re_..." style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "1px solid " + (savedResend ? t.green + "50" : t.border), background: t.inputBg, color: t.inputText, fontSize: 12, fontFamily: "monospace", boxSizing: "border-box" }} />
                <button onClick={async () => { const v = document.getElementById(instanceId + "-resend-key")?.value?.trim(); if (!v) return; await dbSetSetting("resend-api-key", v); try { const r = await fetch("/api/test-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); r.ok ? alert("Resend key saved & test email sent!") : alert("Key saved but test failed: " + (await r.json().catch(() => ({}))).error); } catch (e) { alert("Key saved. Test failed: " + e.message); } }} style={{ padding: "8px 14px", borderRadius: 6, fontSize: 12, fontWeight: 500, border: "none", background: t.green, color: t.isLight ? "#fff" : "#000", cursor: "pointer" }}>Save & Test</button>
              </div>
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: t.textFaint, marginBottom: 2 }}>Twilio Account SID</div>
              <input id={instanceId + "-twilio-sid"} type="password" defaultValue={savedTwilioSid} placeholder="AC..." style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid " + (savedTwilioSid ? t.green + "50" : t.border), background: t.inputBg, color: t.inputText, fontSize: 12, fontFamily: "monospace", boxSizing: "border-box", marginBottom: 6 }} />
              <div style={{ fontSize: 10, color: t.textFaint, marginBottom: 2 }}>Twilio Auth Token</div>
              <input id={instanceId + "-twilio-token"} type="password" defaultValue={savedTwilioToken} placeholder="Token..." style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid " + (savedTwilioToken ? t.green + "50" : t.border), background: t.inputBg, color: t.inputText, fontSize: 12, fontFamily: "monospace", boxSizing: "border-box", marginBottom: 6 }} />
              <div style={{ fontSize: 10, color: t.textFaint, marginBottom: 2 }}>Twilio Phone Number (from)</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input id={instanceId + "-twilio-from"} type="text" defaultValue={savedTwilioPhone} placeholder="+15551234567" style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "1px solid " + (savedTwilioPhone ? t.green + "50" : t.border), background: t.inputBg, color: t.inputText, fontSize: 12, boxSizing: "border-box" }} />
                <button onClick={async () => { const sid = document.getElementById(instanceId + "-twilio-sid")?.value?.trim(); const tok = document.getElementById(instanceId + "-twilio-token")?.value?.trim(); const from = document.getElementById(instanceId + "-twilio-from")?.value?.trim(); if (!sid || !tok || !from) { alert("Fill all 3 Twilio fields."); return; } await dbSetSetting("twilio-account-sid", sid); await dbSetSetting("twilio-auth-token", tok); await dbSetSetting("twilio-phone-number", from); const testPhone = prompt("Enter a phone number to test SMS:", from); if (!testPhone) return; try { const r = await fetch("/api/test-sms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: testPhone }) }); r.ok ? alert("Twilio saved & test SMS sent!") : alert("Saved but test failed: " + (await r.json().catch(() => ({}))).error); } catch (e) { alert("Saved. Test failed: " + e.message); } }} style={{ padding: "8px 14px", borderRadius: 6, fontSize: 12, fontWeight: 500, border: "none", background: t.green, color: t.isLight ? "#fff" : "#000", cursor: "pointer" }}>Save & Test</button>
              </div>
            </div>
          </div>

          {/* Video Reformat Templates */}
          <div style={{ background: t.card, borderRadius: 12, border: "1px solid " + t.border, padding: 20, boxShadow: t.shadow, marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: t.text, marginBottom: 4 }}>Video Reformat Templates</div>
            <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 12 }}>Custom backgrounds for the Video Reformatter. Upload a PNG for image templates.</div>

            {/* Existing templates */}
            {reformatTemplates.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                {reformatTemplates.map(tmpl => {
                  const previewBg = tmpl.type === "image" && tmpl.image_url
                    ? `url(${tmpl.image_url}) center/cover`
                    : tmpl.type === "gradient" && tmpl.color_primary && tmpl.color_secondary
                      ? `linear-gradient(to bottom, ${tmpl.color_primary}, ${tmpl.color_secondary})`
                      : tmpl.color_primary || t.cardAlt;
                  return (
                    <div key={tmpl.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, border: "1px solid " + t.border, background: t.cardAlt }}>
                      <div style={{ width: 32, height: 32, borderRadius: 6, background: previewBg, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tmpl.name}</div>
                        <div style={{ fontSize: 11, color: t.textFaint }}>{tmpl.type}</div>
                      </div>
                      {tmpl.type !== "blur" && (
                        <label style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid " + t.border, cursor: "pointer", color: t.textMuted, whiteSpace: "nowrap" }}>
                          Upload PNG
                          <input type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }} onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const fd = new FormData();
                            fd.append("image", file);
                            try {
                              const res = await fetch(`/api/reformat-templates/${tmpl.id}/upload`, { method: "POST", body: fd });
                              if (res.ok) { loadTemplates(); }
                              else { const d = await res.json().catch(() => ({})); alert("Upload failed: " + (d.error || "unknown")); }
                            } catch (err) { alert("Upload failed: " + err.message); }
                          }} />
                        </label>
                      )}
                      <button onClick={async () => {
                        if (!confirm(`Delete template "${tmpl.name}"?`)) return;
                        await fetch(`/api/reformat-templates/${tmpl.id}`, { method: "DELETE" });
                        loadTemplates();
                      }} style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, border: "1px solid " + t.border, background: "transparent", color: t.red || "#ef4444", cursor: "pointer" }}>Delete</button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add new template */}
            <div style={{ padding: "12px 14px", background: t.cardAlt, borderRadius: 10, border: "1px solid " + t.border }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: t.text, marginBottom: 10 }}>Add template</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input value={newTmplName} onChange={e => setNewTmplName(e.target.value)} placeholder="Template name" style={{ flex: "1 1 120px", padding: "7px 10px", borderRadius: 6, border: "1px solid " + t.border, background: t.inputBg, color: t.inputText, fontSize: 12, boxSizing: "border-box" }} />
                <select value={newTmplType} onChange={e => setNewTmplType(e.target.value)} style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid " + t.border, background: t.inputBg, color: t.inputText, fontSize: 12 }}>
                  <option value="blur">Blur</option>
                  <option value="solid">Solid</option>
                  <option value="gradient">Gradient</option>
                  <option value="image">Image</option>
                </select>
                {(newTmplType === "solid" || newTmplType === "gradient") && (
                  <input type="color" value={newTmplColorPrimary} onChange={e => setNewTmplColorPrimary(e.target.value)} title="Color 1" style={{ width: 36, height: 34, borderRadius: 6, border: "1px solid " + t.border, cursor: "pointer", padding: 2 }} />
                )}
                {newTmplType === "gradient" && (
                  <input type="color" value={newTmplColorSecondary} onChange={e => setNewTmplColorSecondary(e.target.value)} title="Color 2" style={{ width: 36, height: 34, borderRadius: 6, border: "1px solid " + t.border, cursor: "pointer", padding: 2 }} />
                )}
                <button disabled={tmplSaving || !newTmplName.trim()} onClick={async () => {
                  if (!newTmplName.trim()) return;
                  setTmplSaving(true);
                  try {
                    const res = await fetch("/api/reformat-templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newTmplName.trim(), type: newTmplType, color_primary: newTmplColorPrimary, color_secondary: newTmplColorSecondary }) });
                    if (res.ok) { setNewTmplName(""); loadTemplates(); }
                    else { const d = await res.json().catch(() => ({})); alert("Failed: " + (d.error || "unknown")); }
                  } finally { setTmplSaving(false); }
                }} style={{ padding: "7px 16px", borderRadius: 6, border: "none", background: t.green, color: t.isLight ? "#fff" : "#000", fontSize: 12, fontWeight: 500, cursor: "pointer", opacity: tmplSaving || !newTmplName.trim() ? 0.6 : 1 }}>
                  {tmplSaving ? "Saving..." : "Add"}
                </button>
              </div>
            </div>
          </div>

          {/* Team Password */}
          <div style={{ background: t.card, borderRadius: 12, border: "1px solid " + t.border, padding: 20, boxShadow: t.shadow, marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: t.text, marginBottom: 4 }}>Team Password</div>
            <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 12 }}>Change the shared password for manager access</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input id={pwId} type="password" placeholder="New team password" style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid " + t.border, background: t.inputBg, color: t.inputText, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              <button type="button" onClick={async () => {
                const el = document.getElementById(pwId);
                const val = el ? el.value.trim() : "";
                if (!val || val.length < 4) { alert("Password must be at least 4 characters."); return; }
                const encoder = new TextEncoder();
                const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(val));
                const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
                await dbSetSetting("manager-password-hash", hash);
                localStorage.setItem("intake-manager-auth", hash);
                if (el) el.value = "";
                alert("Password updated. All team members will need to re-login with the new password.");
              }} style={{ padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer", border: "none", background: t.green, color: t.isLight ? "#fff" : "#000", whiteSpace: "nowrap" }}>Update</button>
            </div>
          </div>
        </div>
      </div>

      {/* Powered by IB-Ai — full width */}
      <div style={{ background: t.card, borderRadius: 12, border: "1px solid " + t.border, padding: 24, marginBottom: 16, boxShadow: t.shadow }}>
        <div style={{ fontSize: 15, fontWeight: 500, color: t.text, marginBottom: 4 }}>Powered by IB-Ai</div>
        <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 16 }}>Built on Anthropic's Claude — here's everything it does for Intake Creators</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ padding: "12px 14px", background: t.cardAlt, borderRadius: 10, borderLeft: "3px solid " + t.green }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: t.text, marginBottom: 4 }}>Brief Generation</div>
            <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.5 }}>Writes complete UGC briefs with original hooks, story beats, persona targeting, platform-specific direction, and compliance guardrails. Every brief is unique to the campaign.</div>
          </div>
          <div style={{ padding: "12px 14px", background: t.cardAlt, borderRadius: 10, borderLeft: "3px solid " + t.green }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: t.text, marginBottom: 4 }}>IB Score (1-100)</div>
            <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.5 }}>Scores every creator across 11 platforms. Weighs Instagram (45%), TikTok (30%), cross-platform (10%), and content alignment (15%). Generates partnership notes and risk assessment.</div>
          </div>
          <div style={{ padding: "12px 14px", background: t.cardAlt, borderRadius: 10, borderLeft: "3px solid " + t.blue }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: t.text, marginBottom: 4 }}>Rate Calculator</div>
            <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.5 }}>Estimates per-video rates for TikTok, Instagram Reels, Stories, YouTube Shorts, and dedicated videos. Uses real CPM data, engagement quality, and content alignment multipliers.</div>
          </div>
          <div style={{ padding: "12px 14px", background: t.cardAlt, borderRadius: 10, borderLeft: "3px solid " + t.blue }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: t.text, marginBottom: 4 }}>Outreach Messages</div>
            <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.5 }}>Generates personalized Instagram DMs and partnership emails for each creator. References their specific content themes and explains why Intake is a fit.</div>
          </div>
          <div style={{ padding: "12px 14px", background: t.cardAlt, borderRadius: 10, borderLeft: "3px solid " + t.purple }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: t.text, marginBottom: 4 }}>Competitor Detection</div>
            <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.5 }}>Scans creator bios and content for Breathe Right, Rhinomed, and other competing nasal products. Flags risks and adjusts partnership scoring accordingly.</div>
          </div>
          <div style={{ padding: "12px 14px", background: t.cardAlt, borderRadius: 10, borderLeft: "3px solid " + t.purple }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: t.text, marginBottom: 4 }}>Brand Safety</div>
            <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.5 }}>Evaluates every creator for content risk — flags explicit material, controversial topics, or competitor partnerships. Rates each creator as Safe, Review, or Concern.</div>
          </div>
          <div style={{ padding: "12px 14px", background: t.cardAlt, borderRadius: 10, borderLeft: "3px solid " + t.orange }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: t.text, marginBottom: 4 }}>Brief Import</div>
            <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.5 }}>Upload any old brief (PDF, image, or text) and IB-Ai reads it, extracts the key information, and rewrites it into Intake's brief format automatically.</div>
          </div>
          <div style={{ padding: "12px 14px", background: t.cardAlt, borderRadius: 10, borderLeft: "3px solid " + t.orange }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: t.text, marginBottom: 4 }}>Compliance Engine</div>
            <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.5 }}>Auto-suggests approved claims and flags banned language as you build briefs. Ensures every piece of creator content stays within FDA-registered product guidelines.</div>
          </div>
        </div>

        <div style={{ marginTop: 16, padding: "10px 14px", background: t.cardAlt, borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 11, color: t.textFaint }}>Model: Claude Sonnet · ~$0.01-0.02 per brief · ~$0.005 per IB Score · Source of Truth controls all AI behavior</div>
          <div style={{ fontSize: 11, color: t.green, fontWeight: 600 }}>All knowledge editable in Source of Truth</div>
        </div>
      </div>

      <div style={{ background: t.card, borderRadius: 12, border: `1px solid ${t.border}`, padding: 24, marginTop: 20, boxShadow: t.shadow }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: t.text, marginBottom: 16 }}>Version History</div>
        {CHANGELOG.map((entry, idx) => (
          <div key={entry.version} style={{ marginBottom: idx < CHANGELOG.length - 1 ? 24 : 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 18, fontWeight: 500, color: t.green }}>{entry.version}</span>
              <span style={{ fontSize: 13, color: t.textFaint }}>{entry.date}</span>
            </div>
            {entry.changes.map((c, i) => (
              <div key={i} style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.6, paddingLeft: 12, marginBottom: i < entry.changes.length - 1 ? 4 : 0 }}>· {c}</div>
            ))}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
        <div style={{ flex: 1, background: t.cardAlt, borderRadius: 10, padding: "12px 16px" }}>
          <div style={{ fontSize: 11, color: t.textFaint }}>Version</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: t.text }}>{APP_VERSION}</div>
        </div>
        <div style={{ flex: 1, background: t.cardAlt, borderRadius: 10, padding: "12px 16px" }}>
          <div style={{ fontSize: 11, color: t.textFaint }}>Creators</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: t.text }}>{creators.length}</div>
        </div>
        <div style={{ flex: 1, background: t.cardAlt, borderRadius: 10, padding: "12px 16px" }}>
          <div style={{ fontSize: 11, color: t.textFaint }}>Briefs</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: t.text }}>{library.length}</div>
        </div>
        <div style={{ flex: 1, background: t.cardAlt, borderRadius: 10, padding: "12px 16px" }}>
          <div style={{ fontSize: 11, color: t.textFaint }}>Stack</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: t.text }}>React + Express + Supabase</div>
        </div>
      </div>
    </>
  );
}

function HomepageSettingsBlock(props) {
  const [open, setOpen] = useState(false);
  const { t, ...rest } = props;
  return (
    <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, marginBottom: 20, overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", padding: "20px 24px", border: "none",
          background: t.card, display: "flex", justifyContent: "space-between",
          alignItems: "center", cursor: "pointer", fontSize: 16, fontWeight: 500, color: t.text,
        }}
      >
        <div style={{ textAlign: "left" }}>
          <span>Settings</span>
          <div style={{ fontSize: 12, fontWeight: 400, color: t.textMuted, marginTop: 2 }}>API keys, team password, database connection</div>
        </div>
        <span style={{ fontSize: 12, color: t.textMuted }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ padding: "0 24px 20px", borderTop: `1px solid ${t.border}` }}>
          <SettingsPanel instanceId="home-settings" {...rest} t={t} />
        </div>
      )}
    </div>
  );
}

export default SettingsPanel;
export { HomepageSettingsBlock };
