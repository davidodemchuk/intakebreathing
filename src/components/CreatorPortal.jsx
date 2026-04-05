import React, { useState, useRef, useEffect } from "react";
import { supabase } from "../supabase.js";

const ROLES = { MANAGER: "manager", CREATOR: "creator" };

function ProfilePreview({ profile, platform, t }) {
  if (!profile) return null;
  const fmtNum = (n) => { if (n == null) return "—"; if (n >= 1e6) return (n / 1e6).toFixed(1) + "M"; if (n >= 1e3) return (n / 1e3).toFixed(1) + "K"; return String(n); };
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 12px", borderRadius: 10, background: t.green + "08", border: "1px solid " + t.green + "25", marginTop: 8 }}>
      {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" style={{ width: 40, height: 40, borderRadius: 20, objectFit: "cover", border: "2px solid " + t.green + "40" }} onError={(e) => { e.target.style.display = "none"; }} /> : null}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: t.text }}>{platform}</span>
          <span style={{ fontSize: 10, fontWeight: 500, color: t.green, background: t.green + "15", padding: "2px 7px", borderRadius: 6 }}>Verified</span>
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

      const igData = igProfile?.followers ? {
        followers: igProfile.followers, bio: igProfile.bio || "", avatarUrl: igProfile.avatarUrl || "",
        lastEnriched: new Date().toISOString(),
      } : null;
      const ttData = ttProfile?.followers ? {
        followers: ttProfile.followers, bio: ttProfile.bio || "", avatarUrl: ttProfile.avatarUrl || "",
        lastEnriched: new Date().toISOString(),
      } : null;

      let { data: creator } = await supabase.from("creators").select("id, onboarded").eq("email", userEmail).maybeSingle();
      if (creator) {
        await supabase.from("creators").update({
          name: name.trim(),
          handle,
          instagram_handle: igClean,
          tiktok_handle: ttClean || null,
          youtube_handle: ytClean || null,
          instagram_url: igClean ? "https://www.instagram.com/" + igClean + "/" : "",
          tiktok_url: ttClean ? "https://www.tiktok.com/@" + ttClean : "",
          ...(igData ? { instagram_data: igData } : {}),
          ...(ttData ? { tiktok_data: ttData } : {}),
        }).eq("id", creator.id);
      } else {
        const { data: nc, error: ie } = await supabase.from("creators").insert({
          handle,
          email: userEmail,
          name: name.trim(),
          instagram_handle: igClean,
          tiktok_handle: ttClean || null,
          youtube_handle: ytClean || null,
          instagram_url: igClean ? "https://www.instagram.com/" + igClean + "/" : "",
          tiktok_url: ttClean ? "https://www.tiktok.com/@" + ttClean : "",
          instagram_data: igData,
          tiktok_data: ttData,
          status: "Active",
          onboarded: false,
          programs: ["ugc"],
          creator_tier: "rising",
          niche: "",
        }).select().single();
        if (ie) { setError("Account created but profile setup failed. Try logging in."); setLoading(false); return; }
        creator = nc;

        // Notify team via Slack
        try {
          const igStats = igProfile?.followers ? " (" + Number(igProfile.followers).toLocaleString() + " followers)" : "";
          const ttStats = ttProfile?.followers ? " (" + Number(ttProfile.followers).toLocaleString() + " followers)" : "";
          await fetch("/api/slack-notify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "new_creator_signup",
              data: {
                text: ":tada: *New creator signed up!*\n"
                  + "Name: " + name.trim() + "\n"
                  + "Instagram: @" + igClean + igStats + "\n"
                  + (ttClean ? "TikTok: @" + ttClean + ttStats + "\n" : "")
                  + "<https://www.intakecreators.com/creator-hub/creator?id=" + creator.id + "|View in Creator Hub>",
              },
            }),
          });
        } catch (e) { console.log("[signup] Slack notify failed:", e.message); }
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

  const inp = { width: "100%", padding: "12px 14px", borderRadius: 8, border: "1px solid #333333", background: "#1a1a1a", color: "#FFFFFF", fontSize: 15, outline: "none", boxSizing: "border-box" };
  const btn = { width: "100%", height: 50, borderRadius: 25, border: "none", background: "#00FEA9", color: "#000000", fontSize: 15, fontWeight: 400, cursor: loading ? "wait" : "pointer", opacity: loading ? 0.6 : 1, padding: "0 28px" };
  const verifyBtn = (verifying) => ({ padding: "10px 18px", borderRadius: 8, border: "1px solid #333333", background: "transparent", color: "#FFFFFF", fontSize: 13, fontWeight: 400, cursor: verifying ? "wait" : "pointer", opacity: verifying ? 0.6 : 1, whiteSpace: "nowrap" });

  return (
    <div style={{ minHeight: "100vh", background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 460 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ color: "#00FEA9", fontSize: 22, fontWeight: 500, letterSpacing: "0.05em", marginBottom: 8 }}>{"\u2B21"} intake creators</div>
          <div style={{ fontSize: 24, fontWeight: 500, color: "#FFFFFF", letterSpacing: "-0.02em" }}>Creator Portal</div>
          <div style={{ fontSize: 14, color: "#737373", marginTop: 6 }}>Intake Breathing Technology</div>
        </div>
        <div style={{ background: "#111111", border: "1px solid #222222", borderRadius: 16, padding: 40 }}>
          <div style={{ display: "flex", marginBottom: 24, borderRadius: 10, overflow: "hidden", border: "1px solid " + t.border }}>
            <button onClick={() => { setMode("login"); setStep(1); setError(null); }} style={{ flex: 1, padding: "10px 0", fontSize: 13, fontWeight: 500, cursor: "pointer", border: "none", background: mode === "login" ? t.green : "transparent", color: mode === "login" ? (t.isLight ? "#fff" : "#000") : t.textMuted }}>Log in</button>
            <button onClick={() => { setMode("signup"); setError(null); }} style={{ flex: 1, padding: "10px 0", fontSize: 13, fontWeight: 500, cursor: "pointer", border: "none", background: mode === "signup" ? t.green : "transparent", color: mode === "signup" ? (t.isLight ? "#fff" : "#000") : t.textMuted }}>Sign up</button>
          </div>

          {mode === "signup" ? (
            <>
              {/* Step indicator */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
                <div style={{ width: 24, height: 24, borderRadius: 12, background: t.green, color: t.isLight ? "#fff" : "#000", fontSize: 12, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center" }}>1</div>
                <div style={{ flex: 1, height: 2, background: step >= 2 ? t.green : t.border, borderRadius: 1, transition: "background 0.3s" }} />
                <div style={{ width: 24, height: 24, borderRadius: 12, background: step >= 2 ? t.green : t.border, color: step >= 2 ? (t.isLight ? "#fff" : "#000") : t.textFaint, fontSize: 12, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.3s, color 0.3s" }}>2</div>
              </div>

              {step === 1 ? (
                <>
                  <div style={{ fontSize: 15, fontWeight: 500, color: t.text, marginBottom: 16 }}>Account details</div>
                  <div style={{ marginBottom: 14 }}><div style={{ fontSize: 11, color: "#737373", marginBottom: 6, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase" }}>Full name</div><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoFocus style={inp} /></div>
                  <div style={{ marginBottom: 14 }}><div style={{ fontSize: 11, color: "#737373", marginBottom: 6, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase" }}>Email</div><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" style={inp} /></div>
                  <div style={{ marginBottom: 14 }}><div style={{ fontSize: 11, color: "#737373", marginBottom: 6, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase" }}>Password</div><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" style={inp} /></div>
                  <div style={{ marginBottom: 20 }}><div style={{ fontSize: 11, color: "#737373", marginBottom: 6, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase" }}>Confirm password</div><input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter password" onKeyDown={(e) => e.key === "Enter" && handleStep1Next()} style={inp} /></div>
                  <button onClick={handleStep1Next} style={{ ...btn, cursor: "pointer", opacity: 1 }}>Continue</button>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 15, fontWeight: 500, color: t.text, marginBottom: 4 }}>Connect your socials</div>
                  <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 18 }}>We verify your profiles so brands can discover you.</div>

                  {/* Instagram — required */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, color: "#737373", marginBottom: 6, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase" }}>Instagram handle <span style={{ color: t.red || "#ef4444" }}>*</span></div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input type="text" value={igHandle} onChange={(e) => { setIgHandle(e.target.value); setIgProfile(null); setIgError(null); }} placeholder="@yourhandle" style={{ ...inp, flex: 1 }} onKeyDown={(e) => e.key === "Enter" && verifySocial("instagram", igHandle, setIgProfile, setVerifyingIg, setIgError)} />
                      <button onClick={() => verifySocial("instagram", igHandle, setIgProfile, setVerifyingIg, setIgError)} disabled={verifyingIg} style={verifyBtn(verifyingIg)}>{verifyingIg ? "..." : igProfile ? "Re-verify" : "Verify"}</button>
                    </div>
                    {igError ? <div style={{ fontSize: 12, color: t.orange, marginTop: 4 }}>{igError}</div> : null}
                    <ProfilePreview profile={igProfile} platform="Instagram" t={t} />
                  </div>

                  {/* TikTok — optional */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, color: "#737373", marginBottom: 6, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase" }}>TikTok handle <span style={{ fontSize: 10, color: t.textFaint, fontWeight: 400 }}>(optional)</span></div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input type="text" value={ttHandle} onChange={(e) => { setTtHandle(e.target.value); setTtProfile(null); setTtError(null); }} placeholder="@yourhandle" style={{ ...inp, flex: 1 }} onKeyDown={(e) => e.key === "Enter" && ttHandle.trim() && verifySocial("tiktok", ttHandle, setTtProfile, setVerifyingTt, setTtError)} />
                      {ttHandle.trim() ? <button onClick={() => verifySocial("tiktok", ttHandle, setTtProfile, setVerifyingTt, setTtError)} disabled={verifyingTt} style={verifyBtn(verifyingTt)}>{verifyingTt ? "..." : ttProfile ? "Re-verify" : "Verify"}</button> : null}
                    </div>
                    {ttError ? <div style={{ fontSize: 12, color: t.orange, marginTop: 4 }}>{ttError}</div> : null}
                    <ProfilePreview profile={ttProfile} platform="TikTok" t={t} />
                  </div>

                  {/* YouTube — optional, no verify */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, color: "#737373", marginBottom: 6, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase" }}>YouTube channel <span style={{ fontSize: 10, color: t.textFaint, fontWeight: 400 }}>(optional)</span></div>
                    <input type="text" value={ytHandle} onChange={(e) => setYtHandle(e.target.value)} placeholder="@channel or URL" style={inp} />
                  </div>

                  {/* Other platforms */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, color: "#737373", marginBottom: 6, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase" }}>Other platforms <span style={{ fontSize: 10, color: t.textFaint, fontWeight: 400 }}>(optional)</span></div>
                    <input type="text" value={otherPlatforms} onChange={(e) => setOtherPlatforms(e.target.value)} placeholder="Snapchat, Twitter, etc." style={inp} />
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => { setStep(1); setError(null); }} style={{ flex: "0 0 auto", padding: "14px 20px", borderRadius: 10, border: "1px solid " + t.border, background: "transparent", color: t.textMuted, fontSize: 14, fontWeight: 500, cursor: "pointer" }}>Back</button>
                    <button onClick={handleSignUpStep2} disabled={loading} style={{ ...btn, flex: 1 }}>{loading ? "Creating account..." : "Create account"}</button>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <div style={{ marginBottom: 14 }}><div style={{ fontSize: 11, color: "#737373", marginBottom: 6, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase" }}>Email</div><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" autoFocus style={inp} /></div>
              <div style={{ marginBottom: 20 }}><div style={{ fontSize: 11, color: "#737373", marginBottom: 6, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase" }}>Password</div><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" onKeyDown={(e) => e.key === "Enter" && handleLogin()} style={inp} /></div>
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
    niche: cp?.niche || "",
    costPerVideo: cp?.costPerVideo || cp?.cost_per_video || "",
    address: cp?.address || "",
    intakeSize: cp?.intake_size || "",
  });
  const [saving, setSaving] = useState(false);
  const upd = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const igHandle = cp?.instagramHandle || cp?.instagram_handle || "";
  const ttHandle = cp?.tiktokHandle || cp?.tiktok_handle || "";
  const igData = cp?.instagramData || cp?.instagram_data || {};
  const ttData = cp?.tiktokData || cp?.tiktok_data || {};
  const creatorName = cp?.name || "";

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("creators").update({
      niche: form.niche.trim(),
      cost_per_video: form.costPerVideo.trim(),
      address: form.address.trim(),
      intake_size: form.intakeSize,
      onboarded: true,
      onboarded_at: new Date().toISOString(),
    }).eq("id", cp.id);
    setSaving(false);
    if (error) { alert("Save failed: " + error.message); return; }
    try {
      await fetch("/api/slack-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "creator_onboarded",
          data: {
            text: ":white_check_mark: *Creator onboarding complete!*\n"
              + "Name: " + (cp?.name || "Unknown") + "\n"
              + "Instagram: @" + igHandle + "\n"
              + (ttHandle ? "TikTok: @" + ttHandle + "\n" : "")
              + "Size: " + (form.intakeSize || "Not selected") + "\n"
              + "Niche: " + (form.niche || "Not set") + "\n"
              + "Rate: $" + (form.costPerVideo || "Not set") + "/video\n"
              + "Address: " + (form.address ? "Provided" : "Not provided") + "\n"
              + "<https://www.intakecreators.com/creator-hub/creator?id=" + cp.id + "|Review in Creator Hub>",
          },
        }),
      });
    } catch (e) { console.log("[onboard] Slack notify failed:", e.message); }
    navigate("creatorDashboard");
  };

  const inpStyle = { width: "100%", padding: "12px 14px", borderRadius: 8, border: "1px solid #333333", background: "#1a1a1a", color: "#FFFFFF", fontSize: 15, outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ minHeight: "100vh", background: t.bg, padding: 24 }}>
      <div style={{ maxWidth: 500, margin: "0 auto", paddingTop: 32 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <img src="/favicon-32.png" alt="Intake" style={{ width: 48, height: 48, marginBottom: 12 }} onError={(e) => { e.target.style.display = "none"; }} />
          <div style={{ fontSize: 24, fontWeight: 500, color: t.text }}>Welcome, {creatorName.split(" ")[0] || "Creator"}!</div>
          <div style={{ fontSize: 13, color: t.textMuted, marginTop: 4 }}>Just a few more details to get you set up</div>
        </div>

        {(igHandle || ttHandle) ? (
          <div style={{ background: t.green + "08", border: "1px solid " + t.green + "25", borderRadius: 12, padding: "14px 18px", marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: t.green, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>Verified accounts</div>
            {igHandle ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: ttHandle ? 8 : 0 }}>
                {igData.avatarUrl ? <img src={igData.avatarUrl} alt="" style={{ width: 32, height: 32, borderRadius: 16, objectFit: "cover" }} onError={(e) => { e.target.style.display = "none"; }} /> : null}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: t.text }}>@{igHandle}</div>
                  <div style={{ fontSize: 11, color: t.textFaint }}>Instagram{igData.followers ? " \u00b7 " + Number(igData.followers).toLocaleString() + " followers" : ""}</div>
                </div>
              </div>
            ) : null}
            {ttHandle ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {ttData.avatarUrl ? <img src={ttData.avatarUrl} alt="" style={{ width: 32, height: 32, borderRadius: 16, objectFit: "cover" }} onError={(e) => { e.target.style.display = "none"; }} /> : null}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: t.text }}>@{ttHandle}</div>
                  <div style={{ fontSize: 11, color: t.textFaint }}>TikTok{ttData.followers ? " \u00b7 " + Number(ttData.followers).toLocaleString() + " followers" : ""}</div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div style={{ background: "#111111", border: "1px solid #222222", borderRadius: 12, padding: 24 }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: "#737373", marginBottom: 6, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase" }}>Content niches</div>
            <input value={form.niche} onChange={(e) => upd("niche", e.target.value)} placeholder="e.g. Fitness, Lifestyle, Health, Sports" style={inpStyle} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: "#737373", marginBottom: 6, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase" }}>What size Intake do you wear?</div>
            <div style={{ fontSize: 10, color: t.textFaint, marginBottom: 8 }}>Select yours or "Not sure yet" — we'll send the right fit.</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 6 }}>
              {["Small", "Medium", "Large", "XL", "Not sure"].map(sz => (
                <button key={sz} onClick={() => upd("intakeSize", sz)} style={{
                  padding: "10px 6px", borderRadius: 8, fontSize: 12, fontWeight: 400, cursor: "pointer",
                  border: form.intakeSize === sz ? "2px solid #00FEA9" : "1px solid #333333",
                  background: form.intakeSize === sz ? "rgba(0,254,169,0.1)" : "#1a1a1a",
                  color: form.intakeSize === sz ? "#00FEA9" : "#737373",
                }}>{sz}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: "#737373", marginBottom: 6, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase" }}>Rate per video ($)</div>
            <input value={form.costPerVideo} onChange={(e) => upd("costPerVideo", e.target.value)} placeholder="e.g. 100" style={inpStyle} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: "#737373", marginBottom: 6, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase" }}>Shipping address</div>
            <div style={{ fontSize: 10, color: t.textFaint, marginBottom: 4 }}>We'll send you Intake product to create content with</div>
            <textarea value={form.address} onChange={(e) => upd("address", e.target.value)} placeholder="Street, City, State, ZIP" rows={3} style={{ ...inpStyle, fontFamily: "inherit", resize: "vertical" }} />
          </div>
          <button onClick={save} disabled={saving} style={{ width: "100%", height: 50, borderRadius: 25, border: "none", background: "#00FEA9", color: "#000000", fontSize: 15, fontWeight: 400, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.6 : 1, padding: "0 28px" }}>
            {saving ? "Saving..." : "Complete setup"}
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
      <div style={{ background: "#0a0a0a", borderBottom: "1px solid #222222", padding: "0 24px", display: "flex", justifyContent: "space-between", alignItems: "center", height: 56 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: "#00FEA9", letterSpacing: "0.05em" }}>{"\u2B21"} intake</span>
          <div style={{ display: "flex", gap: 2 }}>
            {[{ id: "home", label: "Home" }, { id: "briefs", label: "Briefs", count: newBriefs.length }, { id: "campaigns", label: "Campaigns", count: pendingCampaigns.length }].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ padding: "14px 16px", fontSize: 12, fontWeight: 500, cursor: "pointer", border: "none", background: "transparent", color: activeTab === tab.id ? t.green : t.textMuted, borderBottom: activeTab === tab.id ? "2px solid " + t.green : "2px solid transparent" }}>
                {tab.label}{tab.count > 0 ? <span style={{ marginLeft: 4, fontSize: 9, padding: "1px 5px", borderRadius: 8, background: t.green, color: "#fff", fontWeight: 500 }}>{tab.count}</span> : null}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => navigate("creatorProfile")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: "1px solid " + t.border, background: "transparent", color: t.text, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
            <div style={{ width: 22, height: 22, borderRadius: 11, background: t.green + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 500, color: t.green }}>{(cp?.name || "C")[0]}</div>
            {cp?.name?.split(" ")[0] || "Profile"}
          </button>
          <button onClick={async () => { await supabase.auth.signOut(); navigate("creatorLogin"); }} style={{ padding: "0 16px", height: 32, borderRadius: 8, border: "1px solid #333333", background: "transparent", color: "#FFFFFF", fontSize: 12, fontWeight: 400, cursor: "pointer" }}>Sign Out</button>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px" }}>
        {activeTab === "home" ? (
          <>
            <div style={{ background: "linear-gradient(135deg, " + t.green + "15, " + t.blue + "10)", border: "1px solid " + t.green + "25", borderRadius: 14, padding: "20px 24px", marginBottom: 20 }}>
              <div style={{ fontSize: 20, fontWeight: 500, color: t.text }}>Hey, {cp?.name?.split(" ")[0] || "Creator"}</div>
              <div style={{ fontSize: 13, color: t.textMuted, marginTop: 4 }}>Welcome to your Intake Breathing dashboard</div>
              {pendingCampaigns.length > 0 ? <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: t.orange + "15", border: "1px solid " + t.orange + "30", fontSize: 12, color: t.orange, fontWeight: 500, cursor: "pointer" }} onClick={() => setActiveTab("campaigns")}>{pendingCampaigns.length} campaign invite{pendingCampaigns.length > 1 ? "s" : ""} waiting</div> : null}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
              {[{ v: assignments.length, l: "Briefs", c: t.blue }, { v: activeCampaigns.length, l: "Active campaigns", c: t.green }, { v: pendingCampaigns.length, l: "Pending invites", c: t.orange }].map((s, i) => (
                <div key={i} style={{ background: t.card, border: "1px solid " + t.border, borderRadius: 10, padding: "14px 16px", textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: 500, color: s.c }}>{s.v}</div>
                  <div style={{ fontSize: 10, color: t.textFaint, marginTop: 2, textTransform: "uppercase", letterSpacing: "0.04em" }}>{s.l}</div>
                </div>
              ))}
            </div>
            {assignments.length > 0 ? <div style={{ marginBottom: 20 }}><div style={{ fontSize: 14, fontWeight: 500, color: t.text, marginBottom: 8 }}>Recent briefs</div>{assignments.slice(0, 3).map(a => { const br = a.briefs; const sc = { assigned: t.blue, viewed: t.orange, submitted: t.purple || "#8b6cc4", approved: t.green }[a.status] || t.textFaint; return <div key={a.id} onClick={() => navigate("creatorBriefView", { assignmentId: a.id, briefId: br?.id })} style={{ background: t.card, border: "1px solid " + t.border, borderRadius: 10, padding: "12px 16px", marginBottom: 6, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.green + "50"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; }}><div><div style={{ fontSize: 13, fontWeight: 500, color: t.text }}>{br?.name || "Brief"}</div><div style={{ fontSize: 11, color: t.textFaint }}>{a.assigned_at ? new Date(a.assigned_at).toLocaleDateString() : ""}</div></div><span style={{ fontSize: 10, fontWeight: 500, padding: "3px 10px", borderRadius: 8, background: sc + "15", color: sc, textTransform: "uppercase" }}>{a.status === "assigned" ? "New" : a.status}</span></div>; })}</div> : null}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div onClick={() => navigate("creatorMessages")} style={{ background: t.card, border: "1px solid " + t.border, borderRadius: 10, padding: "16px 20px", cursor: "pointer" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.green + "50"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; }}><div style={{ fontSize: 13, fontWeight: 500, color: t.text }}>Messages</div><div style={{ fontSize: 11, color: t.textFaint, marginTop: 2 }}>Chat with your manager</div></div>
              <div onClick={() => navigate("creatorProfile")} style={{ background: t.card, border: "1px solid " + t.border, borderRadius: 10, padding: "16px 20px", cursor: "pointer" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.green + "50"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; }}><div style={{ fontSize: 13, fontWeight: 500, color: t.text }}>Edit profile</div><div style={{ fontSize: 11, color: t.textFaint, marginTop: 2 }}>Update your info</div></div>
            </div>
          </>
        ) : null}
        {activeTab === "briefs" ? (
          <>{assignments.length === 0 ? <div style={{ background: t.card, border: "1px solid " + t.border, borderRadius: 12, padding: 32, textAlign: "center", color: t.textFaint }}><div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>No briefs yet</div><div style={{ fontSize: 12 }}>Your manager will assign briefs when campaigns are ready.</div></div> : assignments.map(a => { const br = a.briefs; const sc = { assigned: t.blue, viewed: t.orange, submitted: t.purple || "#8b6cc4", approved: t.green }[a.status] || t.textFaint; return <div key={a.id} onClick={() => navigate("creatorBriefView", { assignmentId: a.id, briefId: br?.id })} style={{ background: t.card, border: "1px solid " + t.border, borderRadius: 10, padding: "14px 16px", marginBottom: 8, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><div style={{ fontSize: 14, fontWeight: 500, color: t.text }}>{br?.name || "Brief"}</div><div style={{ fontSize: 11, color: t.textFaint }}>{a.assigned_at ? new Date(a.assigned_at).toLocaleDateString() : ""}</div></div><span style={{ fontSize: 10, fontWeight: 500, padding: "3px 10px", borderRadius: 8, background: sc + "15", color: sc, textTransform: "uppercase" }}>{a.status === "assigned" ? "New" : a.status}</span></div>; })}</>
        ) : null}
        {activeTab === "campaigns" ? (
          <>{campaigns.length === 0 ? <div style={{ background: t.card, border: "1px solid " + t.border, borderRadius: 12, padding: 32, textAlign: "center", color: t.textFaint }}>No campaigns yet.</div> : <>{pendingCampaigns.length > 0 ? <div style={{ marginBottom: 16 }}><div style={{ fontSize: 12, fontWeight: 500, color: t.orange, textTransform: "uppercase", marginBottom: 8 }}>Waiting for response</div>{pendingCampaigns.map(cc => { const camp = cc.campaigns; return <div key={cc.id} style={{ background: t.card, border: "2px solid " + t.orange + "30", borderRadius: 10, padding: "14px 16px", marginBottom: 6 }}><div style={{ fontSize: 14, fontWeight: 500, color: t.text }}>{camp?.name || "Campaign"}</div><div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>{camp?.description?.substring(0, 150) || ""}</div>{camp?.brief_id ? <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 6, background: t.blue + "08", border: "1px solid " + t.blue + "20" }}><div style={{ fontSize: 10, fontWeight: 500, color: t.blue, textTransform: "uppercase" }}>Brief included</div><div style={{ fontSize: 12, color: t.text, marginTop: 2 }}>Accept to view the full brief and content requirements</div></div> : null}<div style={{ display: "flex", gap: 8, marginTop: 10 }}><button onClick={async () => { await supabase.from("campaign_creators").update({ status: "accepted", responded_at: new Date().toISOString() }).eq("id", cc.id); setCampaigns(prev => prev.map(c => c.id === cc.id ? { ...c, status: "accepted" } : c)); if (camp?.brief_id) { await supabase.from("brief_assignments").insert({ creator_id: cp.id, brief_id: camp.brief_id, campaign_id: camp.id, status: "assigned", assigned_at: new Date().toISOString() }); const { data: ra } = await supabase.from("brief_assignments").select("*, briefs(*)").eq("creator_id", cp.id).order("assigned_at", { ascending: false }); if (ra) setAssignments(ra); } }} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: t.green, color: "#fff", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>Accept</button><button onClick={async () => { await supabase.from("campaign_creators").update({ status: "declined", responded_at: new Date().toISOString() }).eq("id", cc.id); setCampaigns(prev => prev.map(c => c.id === cc.id ? { ...c, status: "declined" } : c)); }} style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid " + t.border, background: "transparent", color: t.textMuted, fontSize: 12, cursor: "pointer" }}>Decline</button></div></div>; })}</div> : null}{activeCampaigns.length > 0 ? <div><div style={{ fontSize: 12, fontWeight: 500, color: t.green, textTransform: "uppercase", marginBottom: 8 }}>Active</div>{activeCampaigns.map(cc => { const camp = cc.campaigns; return <div key={cc.id} style={{ background: t.card, border: "1px solid " + t.green + "30", borderRadius: 10, padding: "14px 16px", marginBottom: 6 }}><div style={{ fontSize: 14, fontWeight: 500, color: t.text }}>{camp?.name || "Campaign"}</div><div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>{camp?.product || "Intake"}</div></div>; })}</div> : null}</>}</>
        ) : null}
      </div>
    </div>
  );
}

function CreatorBriefView({ navigate, t, BriefDisplay }) {
  const [brief, setBrief] = useState(null);
  const [formData, setFormData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const briefId = params.get("briefId") || params.get("id");
    if (!briefId) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase.from("briefs").select("*").eq("id", briefId).maybeSingle();
      if (data) { setBrief(data.brief_data); setFormData(data.form_data); }
      setLoading(false);
    })();
  }, []);

  if (loading) return <div style={{ minHeight: "100vh", background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", color: t.textMuted }}>Loading brief...</div>;
  if (!brief) return <div style={{ minHeight: "100vh", background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", color: t.textFaint }}>Brief not found.</div>;
  if (!BriefDisplay) return <div style={{ minHeight: "100vh", background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", color: t.textFaint }}>Brief viewer unavailable.</div>;

  return (
    <div style={{ minHeight: "100vh", background: t.bg }}>
      <div style={{ padding: "12px 24px", borderBottom: "1px solid " + t.border, display: "flex", alignItems: "center", gap: 12 }}>
        <button type="button" onClick={() => navigate("creatorDashboard")} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid " + t.border, background: t.cardAlt, color: t.text, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>&larr; Back to Dashboard</button>
        <span style={{ fontSize: 13, color: t.textMuted }}>Viewing brief</span>
        <div className="ibai-glow-label" style={{ marginLeft: "auto" }}>Generated by IB-Ai</div>
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
      const { data } = await supabase.from("creator_messages").select("*").eq("creator_id", cp.id).order("created_at", { ascending: true });
      setMsgs(data || []);
      setLoading(false);
    })();

    const ch = supabase
      .channel(`cmsg-${cp.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "creator_messages", filter: `creator_id=eq.${cp.id}` }, (p) => {
        setMsgs((prev) => [...prev, p.new]);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [cp?.id]);

  useEffect(() => {
    const container = endRef.current?.parentElement;
    if (container) container.scrollTop = container.scrollHeight;
  }, [msgs.length]);

  const send = async () => {
    if (!draft.trim() || !cp?.id) return;
    const m = draft.trim();
    setDraft("");
    await supabase.from("creator_messages").insert({ creator_id: cp.id, direction: "inbound", body: m, channel: "portal" });
  };

  const isInbound = (m) => m.direction === "inbound" || m.sender === "creator";

  return (
    <div style={{ minHeight: "100vh", background: t.bg, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "12px 24px", borderBottom: "1px solid " + t.border, display: "flex", alignItems: "center", gap: 12 }}>
        <button type="button" onClick={() => navigate("creatorDashboard")} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid " + t.border, background: t.cardAlt, color: t.text, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>&larr; Back</button>
        <span style={{ fontSize: 14, fontWeight: 500, color: t.text }}>Messages</span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px", maxWidth: 600, margin: "0 auto", width: "100%" }}>
        {loading ? <div style={{ color: t.textFaint, textAlign: "center", padding: 40 }}>Loading...</div> : null}
        {!loading && msgs.length === 0 ? <div style={{ color: t.textFaint, textAlign: "center", padding: 40, fontSize: 13 }}>No messages yet. Send one below.</div> : null}
        {msgs.map((m) => (
          <div key={m.id} style={{ display: "flex", justifyContent: isInbound(m) ? "flex-end" : "flex-start", marginBottom: 8 }}>
            <div style={{
              maxWidth: "75%", padding: "10px 14px", borderRadius: 12,
              background: isInbound(m) ? t.green + "18" : t.cardAlt,
              border: "1px solid " + (isInbound(m) ? t.green + "30" : t.border),
            }}>
              <div style={{ fontSize: 13, color: t.text, lineHeight: 1.5 }}>{m.body || m.message || ""}</div>
              <div style={{ fontSize: 10, color: t.textFaint, marginTop: 4 }}>{new Date(m.created_at).toLocaleString()}</div>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div style={{ borderTop: "1px solid " + t.border, padding: "12px 24px" }}>
        <div style={{ display: "flex", gap: 8, maxWidth: 600, margin: "0 auto" }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Type a message..." style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid " + t.border, background: t.inputBg, color: t.inputText, fontSize: 13, outline: "none" }} />
          <button type="button" onClick={send} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: t.green, color: t.isLight ? "#fff" : "#000", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>Send</button>
        </div>
      </div>
    </div>
  );
}

function CreatorProfileEdit({ creatorProfile: cp, navigate, t, onProfileUpdate }) {
  const [form, setForm] = useState({
    name: cp?.name || "",
    instagramHandle: cp?.instagramHandle || cp?.instagram_handle || "",
    tiktokHandle: cp?.tiktokHandle || cp?.tiktok_handle || "",
    youtubeHandle: cp?.youtubeHandle || cp?.youtube_handle || "",
    otherSocial: cp?.otherSocial || cp?.other_social || "",
    address: cp?.address || "",
    costPerVideo: cp?.costPerVideo || cp?.cost_per_video || "",
    niche: cp?.niche || "",
    intakeSize: cp?.intakeSize || cp?.intake_size || "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const upd = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    setSaved(false);
    const ig = form.instagramHandle.replace("@", "").trim();
    const tt = form.tiktokHandle.replace("@", "").trim();
    const { error } = await supabase.from("creators").update({
      name: form.name.trim(),
      instagram_handle: ig,
      tiktok_handle: tt,
      youtube_handle: form.youtubeHandle?.replace("@", "").trim() || null,
      other_social: form.otherSocial?.trim() || null,
      instagram_url: ig ? "https://www.instagram.com/" + ig + "/" : "",
      tiktok_url: tt ? "https://www.tiktok.com/@" + tt : "",
      address: form.address.trim(),
      cost_per_video: form.costPerVideo.trim(),
      niche: form.niche.trim(),
      intake_size: form.intakeSize || null,
    }).eq("id", cp.id);
    setSaving(false);
    if (!error) {
      setSaved(true);
      if (onProfileUpdate) onProfileUpdate();
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const inp = (label, key, ph, opts) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, color: "#737373", marginBottom: 6, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</div>
      {opts?.multi ? (
        <textarea value={form[key]} onChange={(e) => upd(key, e.target.value)} placeholder={ph} rows={3} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid " + t.border, background: t.inputBg, color: t.inputText, fontSize: 13, resize: "vertical", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
      ) : (
        <input value={form[key]} onChange={(e) => upd(key, e.target.value)} placeholder={ph} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid " + t.border, background: t.inputBg, color: t.inputText, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
      )}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: t.bg, padding: 24 }}>
      <div style={{ maxWidth: 480, margin: "0 auto", paddingTop: 24 }}>
        <button type="button" onClick={() => navigate("creatorDashboard")} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid " + t.border, background: t.cardAlt, color: t.text, fontSize: 12, fontWeight: 500, cursor: "pointer", marginBottom: 20 }}>&larr; Back</button>
        <div style={{ fontSize: 20, fontWeight: 500, color: t.text, marginBottom: 20 }}>Your Profile</div>
        <div style={{ background: t.card, border: "1px solid " + t.border, borderRadius: 14, padding: 24 }}>
          {inp("Name", "name", "Your name")}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {inp("Instagram", "instagramHandle", "handle")}
            {inp("TikTok", "tiktokHandle", "handle")}
          </div>
          {inp("YouTube", "youtubeHandle", "channel name or handle")}
          {inp("Other Platforms", "otherSocial", "Twitter, Snapchat, etc.")}
          {inp("Niches", "niche", "Fitness, Lifestyle...")}
          {inp("Rate / video ($)", "costPerVideo", "100")}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: "#737373", marginBottom: 6, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase" }}>Intake Size</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 6 }}>
              {["Small", "Medium", "Large", "XL", "Not sure"].map(sz => (
                <button key={sz} type="button" onClick={() => upd("intakeSize", sz)} style={{
                  padding: "8px 4px", borderRadius: 8, fontSize: 11, fontWeight: 500, cursor: "pointer",
                  border: form.intakeSize === sz ? "2px solid " + t.green : "1px solid " + t.border,
                  background: form.intakeSize === sz ? t.green + "10" : "transparent",
                  color: form.intakeSize === sz ? t.green : t.textMuted,
                }}>{sz}</button>
              ))}
            </div>
          </div>
          {inp("Shipping Address", "address", "Street, City, State, ZIP", { multi: true })}
          <button type="button" onClick={save} disabled={saving} style={{ width: "100%", padding: 12, borderRadius: 8, border: "none", background: t.green, color: t.isLight ? "#fff" : "#000", fontSize: 14, fontWeight: 500, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Saving..." : saved ? "\u2713 Saved" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PublicBriefView({ t, BriefDisplay }) {
  const [brief, setBrief] = useState(null);
  const [formData, setFormData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const shareId = new URLSearchParams(window.location.search).get("id");
    if (!shareId?.trim()) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase.from("briefs").select("*").eq("share_id", shareId.trim()).maybeSingle();
      if (data) { setBrief(data.brief_data); setFormData(data.form_data || {}); }
      setLoading(false);
    })();
  }, []);

  if (loading) return <div style={{ minHeight: "100vh", background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", color: t.textMuted }}>Loading brief...</div>;
  if (!brief) return <div style={{ minHeight: "100vh", background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", color: t.textFaint, padding: 24 }}>Brief not found or invalid link.</div>;
  if (!BriefDisplay) return <div style={{ minHeight: "100vh", background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", color: t.textFaint }}>Brief viewer unavailable.</div>;

  return (
    <div style={{ minHeight: "100vh", background: t.bg, padding: "16px 24px 40px" }}>
      <BriefDisplay brief={brief} formData={formData || {}} currentRole={ROLES.CREATOR} creators={[]} onBack={() => window.history.back()} onRegenerate={() => {}} onRegenerateAI={() => {}} />
    </div>
  );
}

export { CreatorLogin, CreatorOnboard, CreatorDashboard, CreatorBriefView, CreatorMessages, CreatorProfileEdit, PublicBriefView };
