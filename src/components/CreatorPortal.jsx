import React, { useState, useRef, useEffect } from "react";
import { supabase } from "../supabase.js";

const ROLES = { MANAGER: "manager", CREATOR: "creator" };

function ManagerCreatorChat({ creatorId, t }) {
  const [msgs, setMsgs] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!creatorId) return;
    (async () => {
      const { data } = await supabase.from("messages").select("*").eq("creator_id", creatorId).order("created_at", { ascending: true });
      setMsgs(data || []);
      await supabase.from("messages").update({ read: true }).eq("creator_id", creatorId).eq("sender", "creator").eq("read", false);
      setLoading(false);
    })();

    const ch = supabase
      .channel(`mgr-msg-${creatorId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `creator_id=eq.${creatorId}` }, (p) => {
        setMsgs((prev) => [...prev, p.new]);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [creatorId]);

  const send = async () => {
    if (!draft.trim()) return;
    const m = draft.trim();
    setDraft("");
    await supabase.from("messages").insert({ creator_id: creatorId, sender: "manager", message: m });
  };

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: t.text, marginBottom: 12 }}>Messages</div>
      <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 16, maxHeight: 300, overflowY: "auto" }}>
        {loading ? <div style={{ color: t.textFaint, fontSize: 12 }}>Loading...</div> : null}
        {!loading && msgs.length === 0 ? <div style={{ color: t.textFaint, fontSize: 12 }}>No messages yet.</div> : null}
        {msgs.map((m) => (
          <div key={m.id} style={{ display: "flex", justifyContent: m.sender === "manager" ? "flex-end" : "flex-start", marginBottom: 6 }}>
            <div style={{ maxWidth: "75%", padding: "8px 12px", borderRadius: 10, background: m.sender === "manager" ? t.blue + "15" : t.cardAlt, border: `1px solid ${m.sender === "manager" ? t.blue + "25" : t.border}` }}>
              <div style={{ fontSize: 12, color: t.text, lineHeight: 1.5 }}>{m.message}</div>
              <div style={{ fontSize: 9, color: t.textFaint, marginTop: 2 }}>{new Date(m.created_at).toLocaleString()}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Message creator..." style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 12, outline: "none" }} />
        <button type="button" onClick={send} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: t.blue, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Send</button>
      </div>
    </div>
  );
}

function CreatorLogin({ navigate, t }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState("email");
  const [error, setError] = useState(null);

  const sendCode = async () => {
    const clean = email.trim().toLowerCase();
    if (!clean || !clean.includes("@")) {
      setError("Enter a valid email.");
      return;
    }
    setStep("sending");
    setError(null);
    try {
      const { error: e } = await supabase.auth.signInWithOtp({ email: clean, options: { shouldCreateUser: true } });
      if (e) throw e;
      setStep("code");
    } catch (e) {
      setError(e.message || "Failed to send code.");
      setStep("email");
    }
  };

  const verify = async () => {
    if (code.length !== 6) {
      setError("Enter the 6-digit code.");
      return;
    }
    setStep("verifying");
    setError(null);
    try {
      const { error: e } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code, type: "email" });
      if (e) throw e;

      const { data: creator } = await supabase.from("creators").select("id, onboarded").eq("email", email.trim().toLowerCase()).maybeSingle();

      if (!creator) {
        setError("Your email isn't in our creator database. Contact your Intake manager to get invited.");
        await supabase.auth.signOut();
        setStep("email");
        return;
      }

      navigate(creator.onboarded ? "creatorDashboard" : "creatorOnboard");
    } catch (e) {
      setError(e.message || "Invalid code.");
      setStep("code");
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <img src="/favicon-32.png" alt="Intake" style={{ width: 48, height: 48, marginBottom: 12 }} onError={(e) => { e.target.style.display = "none"; }} />
          <div style={{ fontSize: 22, fontWeight: 800, color: t.text }}>Creator Portal</div>
          <div style={{ fontSize: 13, color: t.textMuted, marginTop: 4 }}>Intake Breathing</div>
        </div>

        <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 28 }}>
          {step === "email" || step === "sending" ? (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 4 }}>Sign in</div>
              <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 20 }}>We&apos;ll send a 6-digit code to your email</div>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendCode()} placeholder="your@email.com" autoFocus style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 12 }} />
              <button type="button" onClick={sendCode} disabled={step === "sending"} style={{ width: "100%", padding: 12, borderRadius: 8, border: "none", background: t.green, color: t.isLight ? "#fff" : "#000", fontSize: 14, fontWeight: 700, cursor: step === "sending" ? "wait" : "pointer", opacity: step === "sending" ? 0.6 : 1 }}>
                {step === "sending" ? "Sending..." : "Send Code"}
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 4 }}>Check your email</div>
              <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 20 }}>Code sent to <strong style={{ color: t.text }}>{email}</strong></div>
              <input type="text" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} onKeyDown={(e) => e.key === "Enter" && verify()} placeholder="000000" autoFocus style={{ width: "100%", padding: 14, borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 24, fontWeight: 800, textAlign: "center", letterSpacing: "0.3em", outline: "none", boxSizing: "border-box", marginBottom: 12 }} />
              <button type="button" onClick={verify} disabled={step === "verifying"} style={{ width: "100%", padding: 12, borderRadius: 8, border: "none", background: t.green, color: t.isLight ? "#fff" : "#000", fontSize: 14, fontWeight: 700, cursor: step === "verifying" ? "wait" : "pointer", opacity: step === "verifying" ? 0.6 : 1 }}>
                {step === "verifying" ? "Verifying..." : "Sign In"}
              </button>
              <button type="button" onClick={() => { setStep("email"); setCode(""); setError(null); }} style={{ width: "100%", marginTop: 8, padding: 10, border: "none", background: "transparent", color: t.textFaint, fontSize: 12, cursor: "pointer" }}>Different email</button>
            </>
          )}
          {error ? <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, background: t.red + "10", border: `1px solid ${t.red}25`, fontSize: 13, color: t.red }}>{error}</div> : null}
        </div>
        <div style={{ textAlign: "center", marginTop: 20, fontSize: 11, color: t.textFaint }}>Contact your Intake manager if you don&apos;t have access.</div>
      </div>
    </div>
  );
}

function CreatorOnboard({ creatorProfile: cp, navigate, t }) {
  const [form, setForm] = useState({
    name: cp?.name || "",
    instagramHandle: cp?.instagramHandle || (cp?.handle || "").replace("@", ""),
    tiktokHandle: cp?.tiktokHandle || (cp?.handle || "").replace("@", ""),
    address: cp?.address || "",
    costPerVideo: cp?.costPerVideo || "",
    niche: cp?.niche || "",
  });
  const [saving, setSaving] = useState(false);
  const upd = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) {
      alert("Enter your name.");
      return;
    }
    setSaving(true);
    const ig = form.instagramHandle.replace("@", "").trim();
    const tt = form.tiktokHandle.replace("@", "").trim();
    const { error } = await supabase
      .from("creators")
      .update({
        name: form.name.trim(),
        instagram_handle: ig,
        tiktok_handle: tt,
        instagram_url: ig ? `https://www.instagram.com/${ig}/` : "",
        tiktok_url: tt ? `https://www.tiktok.com/@${tt}` : "",
        address: form.address.trim(),
        cost_per_video: form.costPerVideo.trim(),
        niche: form.niche.trim(),
        onboarded: true,
        onboarded_at: new Date().toISOString(),
      })
      .eq("id", cp.id);
    setSaving(false);
    if (error) {
      alert("Save failed: " + error.message);
      return;
    }
    navigate("creatorDashboard");
  };

  const inp = (label, key, ph, opts) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, color: t.textFaint, marginBottom: 4 }}>{label}</div>
      {opts?.multi ? (
        <textarea value={form[key]} onChange={(e) => upd(key, e.target.value)} placeholder={ph} rows={3} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 13, resize: "vertical", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
      ) : (
        <input value={form[key]} onChange={(e) => upd(key, e.target.value)} placeholder={ph} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
      )}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: t.bg, padding: 24 }}>
      <div style={{ maxWidth: 480, margin: "0 auto", paddingTop: 40 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: t.text }}>Welcome to Intake</div>
          <div style={{ fontSize: 13, color: t.textMuted, marginTop: 4 }}>Set up your creator profile</div>
        </div>
        <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 24 }}>
          {inp("Your Name *", "name", "First and last name")}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {inp("Instagram Handle", "instagramHandle", "handle")}
            {inp("TikTok Handle", "tiktokHandle", "handle")}
          </div>
          {inp("Content Niches", "niche", "e.g. Fitness, Lifestyle, Health")}
          {inp("Rate per Video ($)", "costPerVideo", "e.g. 100")}
          {inp("Shipping Address", "address", "Street, City, State, ZIP — we'll send you product here", { multi: true })}
          <button type="button" onClick={save} disabled={saving} style={{ width: "100%", padding: 14, borderRadius: 10, border: "none", background: t.green, color: t.isLight ? "#fff" : "#000", fontSize: 14, fontWeight: 700, cursor: saving ? "wait" : "pointer", marginTop: 8, opacity: saving ? 0.6 : 1 }}>
            {saving ? "Saving..." : "Save & Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreatorDashboard({ creatorProfile: cp, navigate, t }) {
  const [assignments, setAssignments] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!cp?.id) return;
    (async () => {
      const { data: a } = await supabase.from("brief_assignments").select("*, briefs(*)").eq("creator_id", cp.id).order("assigned_at", { ascending: false });
      setAssignments(a || []);
      const { count } = await supabase.from("messages").select("id", { count: "exact", head: true }).eq("creator_id", cp.id).eq("sender", "manager").eq("read", false);
      setUnread(count || 0);
      setLoading(false);
    })();
  }, [cp?.id]);

  if (loading) return <div style={{ minHeight: "100vh", background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", color: t.textMuted }}>Loading...</div>;

  return (
    <div style={{ minHeight: "100vh", background: t.bg, padding: 24 }}>
      <div style={{ maxWidth: 660, margin: "0 auto", paddingTop: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: t.text }}>Hey, {cp?.name?.split(" ")[0] || "Creator"}</div>
            <div style={{ fontSize: 13, color: t.textMuted }}>Intake Breathing</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => navigate("creatorProfile")} style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.cardAlt, color: t.text, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Profile</button>
            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate("creatorLogin");
              }}
              style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${t.border}`, background: "transparent", color: t.textFaint, fontSize: 12, cursor: "pointer" }}
            >
              Sign Out
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 24 }}>
          {[
            { v: assignments.length, l: "Briefs", c: t.blue, click: null },
            { v: unread, l: "Messages", c: t.orange, click: () => navigate("creatorMessages") },
            { v: cp?.ibScore ?? "—", l: "IB Score", c: t.green, click: null },
          ].map((s, i) => (
            <div
              key={i}
              onClick={s.click || undefined}
              style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: 16, textAlign: "center", cursor: s.click ? "pointer" : "default", position: "relative" }}
            >
              <div style={{ fontSize: 22, fontWeight: 800, color: s.c }}>{s.v}</div>
              <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>{s.l}</div>
              {s.l === "Messages" && unread > 0 ? <div style={{ position: "absolute", top: 6, right: 6, width: 8, height: 8, borderRadius: 4, background: t.red }} /> : null}
            </div>
          ))}
        </div>

        <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 10 }}>Your Briefs</div>
        {assignments.length === 0 ? (
          <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: 24, textAlign: "center", color: t.textFaint, fontSize: 13 }}>No briefs yet. Your manager will assign them when ready.</div>
        ) : (
          assignments.map((a) => {
            const br = a.briefs;
            const sc = { assigned: t.blue, viewed: t.orange, submitted: t.purple, approved: t.green, revision: t.red }[a.status] || t.textFaint;
            return (
              <div
                key={a.id}
                onClick={() => {
                  if (a.status === "assigned") supabase.from("brief_assignments").update({ status: "viewed", viewed_at: new Date().toISOString() }).eq("id", a.id);
                  navigate("creatorBriefView", { assignmentId: a.id, briefId: br?.id });
                }}
                style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: 14, marginBottom: 8, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.green + "50"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{br?.name || "Brief"}</div>
                  <div style={{ fontSize: 11, color: t.textFaint }}>
                    {(br?.created_by ?? br?.form_data?.manager) || ""} · {a.assigned_at ? new Date(a.assigned_at).toLocaleDateString() : ""}
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 10, background: sc + "15", color: sc }}>{a.status === "assigned" ? "New" : a.status}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function CreatorBriefView({ navigate, t }) {
  const [brief, setBrief] = useState(null);
  const [formData, setFormData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const briefId = params.get("briefId") || params.get("id");
    if (!briefId) {
      setLoading(false);
      return;
    }

    (async () => {
      const { data } = await supabase.from("briefs").select("*").eq("id", briefId).maybeSingle();
      if (data) {
        setBrief(data.brief_data);
        setFormData(data.form_data);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <div style={{ minHeight: "100vh", background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", color: t.textMuted }}>Loading brief...</div>;
  if (!brief) return <div style={{ minHeight: "100vh", background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", color: t.textFaint }}>Brief not found.</div>;

  return (
    <div style={{ minHeight: "100vh", background: t.bg }}>
      <div style={{ padding: "12px 24px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 12 }}>
        <button type="button" onClick={() => navigate("creatorDashboard")} style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.cardAlt, color: t.text, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>← Back to Dashboard</button>
        <span style={{ fontSize: 13, color: t.textMuted }}>Viewing brief</span>
      </div>
      <BriefDisplay brief={brief} formData={formData || {}} currentRole={ROLES.CREATOR} creators={[]} onBack={() => navigate("creatorDashboard")} onRegenerate={() => {}} onRegenerateAI={() => {}} />
    </div>
  );
}

function CreatorMessages({ creatorProfile: cp, navigate, t }) {
  const [msgs, setMsgs] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const endRef = useRef(null);

  useEffect(() => {
    if (!cp?.id) return;
    (async () => {
      const { data } = await supabase.from("messages").select("*").eq("creator_id", cp.id).order("created_at", { ascending: true });
      setMsgs(data || []);
      await supabase.from("messages").update({ read: true }).eq("creator_id", cp.id).eq("sender", "manager").eq("read", false);
      setLoading(false);
    })();

    const ch = supabase
      .channel(`msg-${cp.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `creator_id=eq.${cp.id}` }, (p) => {
        setMsgs((prev) => [...prev, p.new]);
        if (p.new.sender === "manager") supabase.from("messages").update({ read: true }).eq("id", p.new.id);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [cp?.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  const send = async () => {
    if (!draft.trim() || !cp?.id) return;
    const m = draft.trim();
    setDraft("");
    await supabase.from("messages").insert({ creator_id: cp.id, sender: "creator", message: m });
  };

  return (
    <div style={{ minHeight: "100vh", background: t.bg, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "12px 24px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 12 }}>
        <button type="button" onClick={() => navigate("creatorDashboard")} style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.cardAlt, color: t.text, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>← Back</button>
        <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Messages</span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px", maxWidth: 600, margin: "0 auto", width: "100%" }}>
        {loading ? <div style={{ color: t.textFaint, textAlign: "center", padding: 40 }}>Loading...</div> : null}
        {!loading && msgs.length === 0 ? <div style={{ color: t.textFaint, textAlign: "center", padding: 40, fontSize: 13 }}>No messages yet. Send one below.</div> : null}
        {msgs.map((m) => (
          <div key={m.id} style={{ display: "flex", justifyContent: m.sender === "creator" ? "flex-end" : "flex-start", marginBottom: 8 }}>
            <div
              style={{
                maxWidth: "75%",
                padding: "10px 14px",
                borderRadius: 12,
                background: m.sender === "creator" ? t.green + "18" : t.cardAlt,
                border: `1px solid ${m.sender === "creator" ? t.green + "30" : t.border}`,
              }}
            >
              <div style={{ fontSize: 13, color: t.text, lineHeight: 1.5 }}>{m.message}</div>
              <div style={{ fontSize: 10, color: t.textFaint, marginTop: 4 }}>{new Date(m.created_at).toLocaleString()}</div>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div style={{ borderTop: `1px solid ${t.border}`, padding: "12px 24px" }}>
        <div style={{ display: "flex", gap: 8, maxWidth: 600, margin: "0 auto" }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Type a message..." style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 13, outline: "none" }} />
          <button type="button" onClick={send} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: t.green, color: t.isLight ? "#fff" : "#000", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Send</button>
        </div>
      </div>
    </div>
  );
}

function CreatorProfileEdit({ creatorProfile: cp, navigate, t, onProfileUpdate }) {
  const [form, setForm] = useState({
    name: cp?.name || "",
    instagramHandle: cp?.instagramHandle || "",
    tiktokHandle: cp?.tiktokHandle || "",
    address: cp?.address || "",
    costPerVideo: cp?.costPerVideo || "",
    niche: cp?.niche || "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const upd = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    setSaved(false);
    const ig = form.instagramHandle.replace("@", "").trim();
    const tt = form.tiktokHandle.replace("@", "").trim();
    const { error } = await supabase
      .from("creators")
      .update({
        name: form.name.trim(),
        instagram_handle: ig,
        tiktok_handle: tt,
        instagram_url: ig ? `https://www.instagram.com/${ig}/` : "",
        tiktok_url: tt ? `https://www.tiktok.com/@${tt}` : "",
        address: form.address.trim(),
        cost_per_video: form.costPerVideo.trim(),
        niche: form.niche.trim(),
      })
      .eq("id", cp.id);
    setSaving(false);
    if (!error) {
      setSaved(true);
      if (onProfileUpdate) onProfileUpdate();
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const inp = (label, key, ph, opts) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, color: t.textFaint, marginBottom: 4 }}>{label}</div>
      {opts?.multi ? (
        <textarea value={form[key]} onChange={(e) => upd(key, e.target.value)} placeholder={ph} rows={3} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 13, resize: "vertical", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
      ) : (
        <input value={form[key]} onChange={(e) => upd(key, e.target.value)} placeholder={ph} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
      )}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: t.bg, padding: 24 }}>
      <div style={{ maxWidth: 480, margin: "0 auto", paddingTop: 24 }}>
        <button type="button" onClick={() => navigate("creatorDashboard")} style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.cardAlt, color: t.text, fontSize: 12, fontWeight: 600, cursor: "pointer", marginBottom: 20 }}>← Back</button>
        <div style={{ fontSize: 20, fontWeight: 800, color: t.text, marginBottom: 20 }}>Your Profile</div>
        <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 24 }}>
          {inp("Name", "name", "Your name")}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {inp("Instagram", "instagramHandle", "handle")}
            {inp("TikTok", "tiktokHandle", "handle")}
          </div>
          {inp("Niches", "niche", "Fitness, Lifestyle...")}
          {inp("Rate / video ($)", "costPerVideo", "100")}
          {inp("Shipping Address", "address", "Street, City, State, ZIP", { multi: true })}
          <button type="button" onClick={save} disabled={saving} style={{ width: "100%", padding: 12, borderRadius: 8, border: "none", background: t.green, color: t.isLight ? "#fff" : "#000", fontSize: 14, fontWeight: 700, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Saving..." : saved ? "✓ Saved" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PublicBriefView({ t }) {
  const [brief, setBrief] = useState(null);
  const [formData, setFormData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const shareId = new URLSearchParams(window.location.search).get("id");
    if (!shareId?.trim()) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase.from("briefs").select("*").eq("share_id", shareId.trim()).maybeSingle();
      if (data) {
        setBrief(data.brief_data);
        setFormData(data.form_data || {});
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <div style={{ minHeight: "100vh", background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", color: t.textMuted }}>Loading brief...</div>;
  if (!brief) return <div style={{ minHeight: "100vh", background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", color: t.textFaint, padding: 24 }}>Brief not found or invalid link.</div>;

  return (
    <div style={{ minHeight: "100vh", background: t.bg, padding: "16px 24px 40px" }}>
      <BriefDisplay brief={brief} formData={formData || {}} currentRole={ROLES.CREATOR} creators={[]} onBack={() => window.history.back()} onRegenerate={() => {}} onRegenerateAI={() => {}} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// IB-Ai — prompt builder (Claude)
// ═══════════════════════════════════════════════════════════

function buildAIPrompt(d, knowledge) {
  const k = knowledge && typeof knowledge === "object" ? knowledge : null;
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
    : buildRejectionsArray(d, k?.defaultRejections).join(". ");
  const mgrName = managerDisplayName(d);
  const qtyVideos = String(d.contentQuantity ?? "1").trim() || "1";
  const rawBudgetAi = String(d.budgetPerVideo ?? "").trim().replace(/^\$/, "");
  const budgetStrAi = rawBudgetAi ? `$${rawBudgetAi}` : "TBD";
  const supValAi = d.supervisionLevel || "full";
  const supEntry = SUPERVISION_LEVELS.find((s) => s.value === supValAi) || SUPERVISION_LEVELS[0];
  const supervisionLabelAi = supEntry.label;
  const supervisionDescAi = supEntry.desc;
  const supervisionToneNote =
    supValAi === "handsoff"
      ? "Supervision is Hands Off: the brief must be extra clear and detailed — creators will not have revision rounds, so every requirement, format spec, and CTA must be self-contained and unambiguous."
      : supValAi === "full"
        ? "Supervision is Full Review: you may keep the creative direction slightly looser knowing 1-2 revision rounds will refine the work — but still be specific on compliance and deliverables."
        : "Supervision is Light Touch: balance clarity with brevity — minor feedback may occur but avoid relying on heavy revision cycles.";
  const brandBlock = k?.brandContext && String(k.brandContext).trim()
    ? `BRAND CONTEXT (internal — match tone and claims to this):\n${String(k.brandContext).trim()}\n\n`
    : "";
  return `You are an expert UGC (user-generated content) brief writer for Intake Breathing, a magnetic nasal dilator company. Write a complete creator brief. Be specific, creative, and tailored to this exact campaign — not generic.

${brandBlock}PRODUCT: ${productResolved} by Intake Breathing
CAMPAIGN NAME: ${d.campaignName || "Untitled"}
CAMPAIGN VIBE: ${vibeResolved}
MISSION: ${d.mission || "N/A"}
SUBMITTED BY: ${mgrName}
CONTENT QUANTITY: ${qtyVideos} videos needed
BUDGET: ${budgetStrAi} per video
SUPERVISION LEVEL: ${supervisionLabelAi} — ${supervisionDescAi}
${supervisionToneNote}
TARGET AUDIENCE: ${audienceCompact}
AUDIENCE (form selection, ageRange + gender): ${audienceForm}
CORE PROBLEM: ${prob}
APPROVED CLAIMS (creators CAN say): ${d._approved || ""}
BANNED CLAIMS (NEVER say): ${d._banned || ""}
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
{"mission":"one line mission statement","persona":"creative persona name for the target viewer","age":"age range","psycho":"2-3 sentences describing their mindset, fears, desires — be vivid and specific","theyAre":["4 psychographic traits that describe this viewer"],"theyAreNot":["4 things this viewer is NOT — help creators avoid wrong assumptions"],"probInst":"directive for the PROBLEM beat — tell the creator exactly what to show/say in the opening","probLines":["3 specific lines creators can say or riff on for the problem beat — conversational, not corporate"],"probOverlays":["3 specific text overlay or visual ideas for the problem beat"],"agInst":"directive for the AGITATE beat — how to twist the knife and create urgency","agLines":["3 agitate lines — make the viewer feel the cost of inaction"],"agOverlays":["3 overlay/visual ideas for the agitate beat"],"solInst":"directive for the SOLUTION beat — the payoff, the reveal, the transformation","solLines":["3 solution lines — the relief, the wow moment, the conversion push"],"solOverlays":["3 overlay/visual ideas for the solution beat"],"hooks":["4 scroll-stopping hook options for the first 2-3 seconds — these must be thumb-stoppers"],"sayThis":["5 approved phrases creators should use"],"notThis":["5 phrases creators must NEVER say"],"rejections":["array of strings — every revision-required rule listed above; include all criteria verbatim"],"platNotes":"platform-specific tips for all selected platforms (${platLine}) at ${d.videoLength}","deliverables":"what creators need to submit and format specs"}`;
}


export { ManagerCreatorChat, CreatorLogin, CreatorOnboard, CreatorDashboard, CreatorBriefView, CreatorMessages, CreatorProfileEdit, PublicBriefView };
