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

function ProfilePreview({ profile, platform, t }) {
  if (!profile) return null;
  const fmtNum = (n) => { if (n == null) return "—"; if (n >= 1e6) return (n / 1e6).toFixed(1) + "M"; if (n >= 1e3) return (n / 1e3).toFixed(1) + "K"; return String(n); };
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 12px", borderRadius: 10, background: t.green + "08", border: "1px solid " + t.green + "25", marginTop: 8 }}>
      {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" style={{ width: 40, height: 40, borderRadius: 20, objectFit: "cover", border: "2px solid " + t.green + "40" }} onError={(e) => { e.target.style.display = "none"; }} /> : null}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{platform}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: t.green, background: t.green + "15", padding: "2px 7px", borderRadius: 6 }}>Verified</span>
        </div>
        <div style={{ fontSize: 12, color: t.textMuted }}>{fmtNum(profile.followers)} followers{profile.bio ? " · " + profile.bio.slice(0, 60) + (profile.bio.length > 60 ? "..." : "") : ""}</div>
      </div>
    </div>
  );
}

function CreatorLogin({ navigate, t }) {
  const [mode, setMode] = useState("login");
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [igHandle, setIgHandle] = useState("");
  const [ttHandle, setTtHandle] = useState("");
  const [ytHandle, setYtHandle] = useState("");
  const [otherPlatforms, setOtherPlatforms] = useState("");
  const [igProfile, setIgProfile] = useState(null);
  const [ttProfile, setTtProfile] = useState(null);
  const [verifyingIg, setVerifyingIg] = useState(false);
  const [verifyingTt, setVerifyingTt] = useState(false);
  const [igError, setIgError] = useState(null);
  const [ttError, setTtError] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        const { data: creator } = await supabase.from("creators").select("id, onboarded").eq("email", session.user.email.toLowerCase()).maybeSingle();
        if (creator) { navigate(creator.onboarded ? "creatorDashboard" : "creatorOnboard"); return; }
      }
      setCheckingSession(false);
    })();
  }, []);

  const getScrapeKey = async () => {
    const { data } = await supabase.from("app_settings").select("value").eq("key", "scrapecreators-api-key").maybeSingle();
    return data?.value || "";
  };

  const verifySocial = async (platform, handle, setProfile, setVerifying, setVerifyError) => {
    const clean = String(handle || "").replace(/^@/, "").trim();
    if (!clean) { setVerifyError("Enter a handle first."); return; }
    setVerifying(true); setVerifyError(null); setProfile(null);
    try {
      const key = await getScrapeKey();
      if (!key) { setVerifyError("Verification unavailable. Continue anyway."); setVerifying(false); return; }
      const endpoint = platform === "tiktok"
        ? `https://api.scrapecreators.com/v1/tiktok/profile?handle=${encodeURIComponent(clean)}`
        : `https://api.scrapecreators.com/v1/instagram/profile?handle=${encodeURIComponent(clean)}`;
      const res = await Promise.race([
        fetch(endpoint, { headers: { "x-api-key": key } }),
        new Promise((_, rej) => setTimeout(() => rej(new Error("TIMEOUT")), 15000)),
      ]);
      if (!res.ok) { setVerifyError("Profile not found. Check the handle and try again."); setVerifying(false); return; }
      const raw = await res.json();
      const data = raw?.data ?? raw;
      if (platform === "tiktok") {
        const user = data?.user ?? data;
        const stats = data?.stats ?? data;
        setProfile({ followers: stats?.followerCount ?? stats?.follower_count ?? null, bio: user?.signature ?? user?.bio ?? "", avatarUrl: user?.avatarMedium ?? user?.avatarLarger ?? user?.avatarThumb ?? "" });
      } else {
        setProfile({ followers: data?.follower_count ?? data?.edge_followed_by?.count ?? null, bio: data?.biography ?? "", avatarUrl: data?.profile_pic_url_hd ?? data?.profile_pic_url ?? "" });
      }
    } catch (e) { setVerifyError(e.message === "TIMEOUT" ? "Verification timed out. Try again." : "Verification failed."); }
    setVerifying(false);
  };

  const handleStep1Next = () => {
    setError(null);
    if (!name.trim()) { setError("Enter your name."); return; }
    if (!email.trim() || !email.includes("@")) { setError("Enter a valid email."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirmPassword) { setError("Passwords don't match."); return; }
    setStep(2);
  };

  const handleSignUpStep2 = async () => {
    setError(null);
    const igClean = igHandle.replace(/^@/, "").trim();
    if (!igClean) { setError("Instagram handle is required."); return; }
    setLoading(true);
    try {
      const { error: authErr } = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password, options: { data: { full_name: name.trim() } } });
      if (authErr) throw authErr;
      const userEmail = email.trim().toLowerCase();
      const ttClean = ttHandle.replace(/^@/, "").trim();
      const ytClean = ytHandle.replace(/^@/, "").trim();
      const handle = igClean;
      const socialData = {
        instagramHandle: igClean,
        tiktokHandle: ttClean || null,
        youtubeHandle: ytClean || null,
        otherPlatforms: otherPlatforms.trim() || null,
      };
      if (igProfile) { socialData.igFollowers = igProfile.followers; socialData.igBio = igProfile.bio; socialData.igAvatarUrl = igProfile.avatarUrl; }
      if (ttProfile) { socialData.ttFollowers = ttProfile.followers; socialData.ttBio = ttProfile.bio; socialData.ttAvatarUrl = ttProfile.avatarUrl; }

      let { data: creator } = await supabase.from("creators").select("id, onboarded").eq("email", userEmail).maybeSingle();
      if (creator) {
        await supabase.from("creators").update({ name: name.trim(), handle, ...socialData }).eq("id", creator.id);
      } else {
        const { data: nc, error: ie } = await supabase.from("creators").insert({ handle, email: userEmail, name: name.trim(), status: "Active", onboarded: false, ...socialData }).select().single();
        if (ie) { setError("Account created but profile setup failed. Try logging in."); setLoading(false); return; }
        creator = nc;
      }
      navigate(creator.onboarded ? "creatorDashboard" : "creatorOnboard");
    } catch (e) { setError(e.message?.includes("already registered") ? "This email is already registered. Try logging in." : (e.message || "Sign up failed.")); }
    setLoading(false);
  };

  const handleLogin = async () => {
    setError(null);
    if (!email.trim() || !email.includes("@")) { setError("Enter a valid email."); return; }
    if (!password) { setError("Enter your password."); return; }
    setLoading(true);
    try {
      const { error: authErr } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (authErr) throw authErr;
      const { data: creator } = await supabase.from("creators").select("id, onboarded").eq("email", email.trim().toLowerCase()).maybeSingle();
      if (!creator) { setError("No creator profile found. Sign up first."); await supabase.auth.signOut(); setLoading(false); return; }
      navigate(creator.onboarded ? "creatorDashboard" : "creatorOnboard");
    } catch (e) { setError(e.message?.includes("Invalid login") ? "Wrong email or password." : (e.message || "Login failed.")); }
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email.trim() || !email.includes("@")) { setError("Enter your email first."); return; }
    setLoading(true); setError(null);
    try { const { error: re } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: window.location.origin + "/creator" }); if (re) throw re; alert("Password reset link sent to " + email.trim()); } catch (e) { setError(e.message || "Failed to send reset link."); }
    setLoading(false);
  };

  if (checkingSession) return <div style={{ minHeight: "100vh", background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", color: t.textMuted }}>Loading...</div>;

  const inp = { width: "100%", padding: "14px 16px", borderRadius: 10, border: "1px solid " + t.border, background: t.inputBg, color: t.inputText, fontSize: 15, outline: "none", boxSizing: "border-box" };
  const btn = { width: "100%", padding: 14, borderRadius: 10, border: "none", background: t.green, color: t.isLight ? "#fff" : "#000", fontSize: 15, fontWeight: 700, cursor: loading ? "wait" : "pointer", opacity: loading ? 0.6 : 1 };
  const verifyBtn = (verifying) => ({ padding: "10px 18px", borderRadius: 10, border: "none", background: t.blue, color: "#fff", fontSize: 13, fontWeight: 700, cursor: verifying ? "wait" : "pointer", opacity: verifying ? 0.6 : 1, whiteSpace: "nowrap" });

  return (
    <div style={{ minHeight: "100vh", background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 460 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: t.text, letterSpacing: "-0.02em" }}>Creator Portal</div>
          <div style={{ fontSize: 14, color: t.textMuted, marginTop: 6 }}>Intake Breathing Technology</div>
        </div>
        <div style={{ background: t.card, border: "1px solid " + t.border, borderRadius: 16, padding: 32, boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", marginBottom: 24, borderRadius: 10, overflow: "hidden", border: "1px solid " + t.border }}>
            <button onClick={() => { setMode("login"); setStep(1); setError(null); }} style={{ flex: 1, padding: "10px 0", fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none", background: mode === "login" ? t.green : "transparent", color: mode === "login" ? (t.isLight ? "#fff" : "#000") : t.textMuted }}>Log in</button>
            <button onClick={() => { setMode("signup"); setError(null); }} style={{ flex: 1, padding: "10px 0", fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none", background: mode === "signup" ? t.green : "transparent", color: mode === "signup" ? (t.isLight ? "#fff" : "#000") : t.textMuted }}>Sign up</button>
          </div>

          {mode === "signup" ? (
            <>
              {/* Step indicator */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
                <div style={{ width: 24, height: 24, borderRadius: 12, background: t.green, color: t.isLight ? "#fff" : "#000", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>1</div>
                <div style={{ flex: 1, height: 2, background: step >= 2 ? t.green : t.border, borderRadius: 1, transition: "background 0.3s" }} />
                <div style={{ width: 24, height: 24, borderRadius: 12, background: step >= 2 ? t.green : t.border, color: step >= 2 ? (t.isLight ? "#fff" : "#000") : t.textFaint, fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.3s, color 0.3s" }}>2</div>
              </div>

              {step === 1 ? (
                <>
                  <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 16 }}>Account details</div>
                  <div style={{ marginBottom: 14 }}><div style={{ fontSize: 11, color: t.textFaint, marginBottom: 4, fontWeight: 600 }}>Full name</div><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoFocus style={inp} /></div>
                  <div style={{ marginBottom: 14 }}><div style={{ fontSize: 11, color: t.textFaint, marginBottom: 4, fontWeight: 600 }}>Email</div><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" style={inp} /></div>
                  <div style={{ marginBottom: 14 }}><div style={{ fontSize: 11, color: t.textFaint, marginBottom: 4, fontWeight: 600 }}>Password</div><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" style={inp} /></div>
                  <div style={{ marginBottom: 20 }}><div style={{ fontSize: 11, color: t.textFaint, marginBottom: 4, fontWeight: 600 }}>Confirm password</div><input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter password" onKeyDown={(e) => e.key === "Enter" && handleStep1Next()} style={inp} /></div>
                  <button onClick={handleStep1Next} style={{ ...btn, cursor: "pointer", opacity: 1 }}>Continue</button>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 4 }}>Connect your socials</div>
                  <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 18 }}>We verify your profiles so brands can discover you.</div>

                  {/* Instagram — required */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, color: t.textFaint, marginBottom: 4, fontWeight: 600 }}>Instagram handle <span style={{ color: t.red || "#ef4444" }}>*</span></div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input type="text" value={igHandle} onChange={(e) => { setIgHandle(e.target.value); setIgProfile(null); setIgError(null); }} placeholder="@yourhandle" style={{ ...inp, flex: 1 }} onKeyDown={(e) => e.key === "Enter" && verifySocial("instagram", igHandle, setIgProfile, setVerifyingIg, setIgError)} />
                      <button onClick={() => verifySocial("instagram", igHandle, setIgProfile, setVerifyingIg, setIgError)} disabled={verifyingIg} style={verifyBtn(verifyingIg)}>{verifyingIg ? "..." : igProfile ? "Re-verify" : "Verify"}</button>
                    </div>
                    {igError ? <div style={{ fontSize: 12, color: t.orange, marginTop: 4 }}>{igError}</div> : null}
                    <ProfilePreview profile={igProfile} platform="Instagram" t={t} />
                  </div>

                  {/* TikTok — optional */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, color: t.textFaint, marginBottom: 4, fontWeight: 600 }}>TikTok handle <span style={{ fontSize: 10, color: t.textFaint, fontWeight: 400 }}>(optional)</span></div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input type="text" value={ttHandle} onChange={(e) => { setTtHandle(e.target.value); setTtProfile(null); setTtError(null); }} placeholder="@yourhandle" style={{ ...inp, flex: 1 }} onKeyDown={(e) => e.key === "Enter" && ttHandle.trim() && verifySocial("tiktok", ttHandle, setTtProfile, setVerifyingTt, setTtError)} />
                      {ttHandle.trim() ? <button onClick={() => verifySocial("tiktok", ttHandle, setTtProfile, setVerifyingTt, setTtError)} disabled={verifyingTt} style={verifyBtn(verifyingTt)}>{verifyingTt ? "..." : ttProfile ? "Re-verify" : "Verify"}</button> : null}
                    </div>
                    {ttError ? <div style={{ fontSize: 12, color: t.orange, marginTop: 4 }}>{ttError}</div> : null}
                    <ProfilePreview profile={ttProfile} platform="TikTok" t={t} />
                  </div>

                  {/* YouTube — optional, no verify */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, color: t.textFaint, marginBottom: 4, fontWeight: 600 }}>YouTube channel <span style={{ fontSize: 10, color: t.textFaint, fontWeight: 400 }}>(optional)</span></div>
                    <input type="text" value={ytHandle} onChange={(e) => setYtHandle(e.target.value)} placeholder="@channel or URL" style={inp} />
                  </div>

                  {/* Other platforms */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, color: t.textFaint, marginBottom: 4, fontWeight: 600 }}>Other platforms <span style={{ fontSize: 10, color: t.textFaint, fontWeight: 400 }}>(optional)</span></div>
                    <input type="text" value={otherPlatforms} onChange={(e) => setOtherPlatforms(e.target.value)} placeholder="Snapchat, Twitter, etc." style={inp} />
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => { setStep(1); setError(null); }} style={{ flex: "0 0 auto", padding: "14px 20px", borderRadius: 10, border: "1px solid " + t.border, background: "transparent", color: t.textMuted, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Back</button>
                    <button onClick={handleSignUpStep2} disabled={loading} style={{ ...btn, flex: 1 }}>{loading ? "Creating account..." : "Create account"}</button>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <div style={{ marginBottom: 14 }}><div style={{ fontSize: 11, color: t.textFaint, marginBottom: 4, fontWeight: 600 }}>Email</div><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" autoFocus style={inp} /></div>
              <div style={{ marginBottom: 20 }}><div style={{ fontSize: 11, color: t.textFaint, marginBottom: 4, fontWeight: 600 }}>Password</div><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" onKeyDown={(e) => e.key === "Enter" && handleLogin()} style={inp} /></div>
              <button onClick={handleLogin} disabled={loading} style={btn}>{loading ? "Signing in..." : "Sign in"}</button>
              <button onClick={handleForgotPassword} style={{ width: "100%", marginTop: 10, padding: 10, border: "none", background: "transparent", color: t.textFaint, fontSize: 12, cursor: "pointer" }}>Forgot password?</button>
            </>
          )}
          {error ? <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 10, background: (t.red || "#ef4444") + "10", border: "1px solid " + (t.red || "#ef4444") + "25", fontSize: 13, color: t.red || "#ef4444" }}>{error}</div> : null}
        </div>
        <div style={{ textAlign: "center", marginTop: 24 }}><a href="/" style={{ fontSize: 12, color: t.textFaint, textDecoration: "none" }}>Back to Intake Creators</a></div>
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
  const [campaigns, setCampaigns] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("home");

  useEffect(() => {
    if (!cp?.id) return;
    (async () => {
      try {
        const { data: a } = await supabase.from("brief_assignments").select("*, briefs(*)").eq("creator_id", cp.id).order("assigned_at", { ascending: false });
        setAssignments(a || []);
        const { data: cc } = await supabase.from("campaign_creators").select("*, campaigns(*)").eq("creator_id", cp.id).order("invited_at", { ascending: false });
        setCampaigns(cc || []);
      } catch {}
      setLoading(false);
    })();
  }, [cp?.id]);

  const pendingCampaigns = campaigns.filter(c => c.status === "invited");
  const activeCampaigns = campaigns.filter(c => c.status === "accepted");
  const newBriefs = assignments.filter(a => a.status === "assigned");

  if (loading) return <div style={{ minHeight: "100vh", background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", color: t.textMuted }}>Loading...</div>;

  return (
    <div style={{ minHeight: "100vh", background: t.bg }}>
      <div style={{ background: t.card, borderBottom: "1px solid " + t.border, padding: "0 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: t.text, padding: "14px 0" }}>Intake</span>
          <div style={{ display: "flex", gap: 2 }}>
            {[{ id: "home", label: "Home" }, { id: "briefs", label: "Briefs", count: newBriefs.length }, { id: "campaigns", label: "Campaigns", count: pendingCampaigns.length }].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ padding: "14px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none", background: "transparent", color: activeTab === tab.id ? t.green : t.textMuted, borderBottom: activeTab === tab.id ? "2px solid " + t.green : "2px solid transparent" }}>
                {tab.label}{tab.count > 0 ? <span style={{ marginLeft: 4, fontSize: 9, padding: "1px 5px", borderRadius: 8, background: t.green, color: "#fff", fontWeight: 700 }}>{tab.count}</span> : null}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => navigate("creatorProfile")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: "1px solid " + t.border, background: "transparent", color: t.text, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            <div style={{ width: 22, height: 22, borderRadius: 11, background: t.green + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: t.green }}>{(cp?.name || "C")[0]}</div>
            {cp?.name?.split(" ")[0] || "Profile"}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px" }}>
        {activeTab === "home" ? (
          <>
            <div style={{ background: "linear-gradient(135deg, " + t.green + "15, " + t.blue + "10)", border: "1px solid " + t.green + "25", borderRadius: 14, padding: "20px 24px", marginBottom: 20 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: t.text }}>Hey, {cp?.name?.split(" ")[0] || "Creator"}</div>
              <div style={{ fontSize: 13, color: t.textMuted, marginTop: 4 }}>Welcome to your Intake Breathing dashboard</div>
              {pendingCampaigns.length > 0 ? <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: t.orange + "15", border: "1px solid " + t.orange + "30", fontSize: 12, color: t.orange, fontWeight: 600, cursor: "pointer" }} onClick={() => setActiveTab("campaigns")}>{pendingCampaigns.length} campaign invite{pendingCampaigns.length > 1 ? "s" : ""} waiting</div> : null}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
              {[{ v: assignments.length, l: "Briefs", c: t.blue }, { v: activeCampaigns.length, l: "Active campaigns", c: t.green }, { v: pendingCampaigns.length, l: "Pending invites", c: t.orange }].map((s, i) => (
                <div key={i} style={{ background: t.card, border: "1px solid " + t.border, borderRadius: 10, padding: "14px 16px", textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: s.c }}>{s.v}</div>
                  <div style={{ fontSize: 10, color: t.textFaint, marginTop: 2, textTransform: "uppercase", letterSpacing: "0.04em" }}>{s.l}</div>
                </div>
              ))}
            </div>
            {assignments.length > 0 ? <div style={{ marginBottom: 20 }}><div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 8 }}>Recent briefs</div>{assignments.slice(0, 3).map(a => { const br = a.briefs; const sc = { assigned: t.blue, viewed: t.orange, submitted: t.purple || "#8b6cc4", approved: t.green }[a.status] || t.textFaint; return <div key={a.id} onClick={() => navigate("creatorBriefView")} style={{ background: t.card, border: "1px solid " + t.border, borderRadius: 10, padding: "12px 16px", marginBottom: 6, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.green + "50"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; }}><div><div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{br?.name || "Brief"}</div><div style={{ fontSize: 11, color: t.textFaint }}>{a.assigned_at ? new Date(a.assigned_at).toLocaleDateString() : ""}</div></div><span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 8, background: sc + "15", color: sc, textTransform: "uppercase" }}>{a.status === "assigned" ? "New" : a.status}</span></div>; })}</div> : null}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div onClick={() => navigate("creatorMessages")} style={{ background: t.card, border: "1px solid " + t.border, borderRadius: 10, padding: "16px 20px", cursor: "pointer" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.green + "50"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; }}><div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Messages</div><div style={{ fontSize: 11, color: t.textFaint, marginTop: 2 }}>Chat with your manager</div></div>
              <div onClick={() => navigate("creatorProfile")} style={{ background: t.card, border: "1px solid " + t.border, borderRadius: 10, padding: "16px 20px", cursor: "pointer" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.green + "50"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; }}><div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Edit profile</div><div style={{ fontSize: 11, color: t.textFaint, marginTop: 2 }}>Update your info</div></div>
            </div>
          </>
        ) : null}
        {activeTab === "briefs" ? (
          <>{assignments.length === 0 ? <div style={{ background: t.card, border: "1px solid " + t.border, borderRadius: 12, padding: 32, textAlign: "center", color: t.textFaint }}><div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No briefs yet</div><div style={{ fontSize: 12 }}>Your manager will assign briefs when campaigns are ready.</div></div> : assignments.map(a => { const br = a.briefs; const sc = { assigned: t.blue, viewed: t.orange, submitted: t.purple || "#8b6cc4", approved: t.green }[a.status] || t.textFaint; return <div key={a.id} onClick={() => navigate("creatorBriefView")} style={{ background: t.card, border: "1px solid " + t.border, borderRadius: 10, padding: "14px 16px", marginBottom: 8, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{br?.name || "Brief"}</div><div style={{ fontSize: 11, color: t.textFaint }}>{a.assigned_at ? new Date(a.assigned_at).toLocaleDateString() : ""}</div></div><span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 8, background: sc + "15", color: sc, textTransform: "uppercase" }}>{a.status === "assigned" ? "New" : a.status}</span></div>; })}</>
        ) : null}
        {activeTab === "campaigns" ? (
          <>{campaigns.length === 0 ? <div style={{ background: t.card, border: "1px solid " + t.border, borderRadius: 12, padding: 32, textAlign: "center", color: t.textFaint }}>No campaigns yet.</div> : <>{pendingCampaigns.length > 0 ? <div style={{ marginBottom: 16 }}><div style={{ fontSize: 12, fontWeight: 700, color: t.orange, textTransform: "uppercase", marginBottom: 8 }}>Waiting for response</div>{pendingCampaigns.map(cc => { const camp = cc.campaigns; return <div key={cc.id} style={{ background: t.card, border: "2px solid " + t.orange + "30", borderRadius: 10, padding: "14px 16px", marginBottom: 6 }}><div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{camp?.name || "Campaign"}</div><div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>{camp?.description?.substring(0, 150) || ""}</div><div style={{ display: "flex", gap: 8, marginTop: 10 }}><button onClick={async () => { await supabase.from("campaign_creators").update({ status: "accepted", responded_at: new Date().toISOString() }).eq("id", cc.id); setCampaigns(prev => prev.map(c => c.id === cc.id ? { ...c, status: "accepted" } : c)); }} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: t.green, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Accept</button><button onClick={async () => { await supabase.from("campaign_creators").update({ status: "declined", responded_at: new Date().toISOString() }).eq("id", cc.id); setCampaigns(prev => prev.map(c => c.id === cc.id ? { ...c, status: "declined" } : c)); }} style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid " + t.border, background: "transparent", color: t.textMuted, fontSize: 12, cursor: "pointer" }}>Decline</button></div></div>; })}</div> : null}{activeCampaigns.length > 0 ? <div><div style={{ fontSize: 12, fontWeight: 700, color: t.green, textTransform: "uppercase", marginBottom: 8 }}>Active</div>{activeCampaigns.map(cc => { const camp = cc.campaigns; return <div key={cc.id} style={{ background: t.card, border: "1px solid " + t.green + "30", borderRadius: 10, padding: "14px 16px", marginBottom: 6 }}><div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{camp?.name || "Campaign"}</div><div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>{camp?.product || "Intake"}</div></div>; })}</div> : null}</>}</>
        ) : null}
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
