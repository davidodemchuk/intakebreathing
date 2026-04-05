import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabase.js";

function ChangeRequestsPage({ t, S, navigate, refreshOpenCount }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("open");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [expandedId, setExpandedId] = useState(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentName, setCommentName] = useState(localStorage.getItem("intake-cr-name") || "");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: localStorage.getItem("intake-cr-name") || "", title: "", description: "", priority: "normal", category: "Feature Request", page: "Homepage", customUrl: "" });
  const [submitting, setSubmitting] = useState(false);

  const pages = ["Homepage", "Creators", "Creator Detail", "New Brief", "Brief Library", "Brief Display", "Channel Pipeline", "Tools", "Video Reformatter", "Source of Truth", "Settings", "Change Requests", "Other"];
  const categories = ["Feature Request", "Bug Fix", "Content Change", "New Idea", "UI/Design", "Other"];
  const priorityColors = { urgent: "#ef4444", high: t.orange, normal: t.textMuted, low: t.textFaint };
  const categoryColors = { "Feature Request": t.blue, "Bug Fix": "#ef4444", "Content Change": t.orange, "New Idea": t.purple, "UI/Design": t.green, "Other": t.textMuted };

  const load = async () => {
    setLoading(true);
    let query = supabase.from("change_requests").select("*").order("created_at", { ascending: false });
    if (filter !== "all") query = query.eq("status", filter);
    const { data } = await query;
    setRequests(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [filter]);

  const submit = async () => {
    if (!form.name.trim() || !form.description.trim()) { alert("Enter your name and a description."); return; }
    localStorage.setItem("intake-cr-name", form.name.trim());
    setSubmitting(true);
    const { error } = await supabase.from("change_requests").insert({
      title: form.title.trim() || form.description.trim().substring(0, 60),
      description: form.description.trim(),
      page: form.page,
      custom_url: form.customUrl.trim() || null,
      category: form.category,
      priority: form.priority,
      requested_by: form.name.trim(),
    });
    if (error) alert("Failed: " + error.message);
    else { setForm(f => ({ ...f, title: "", description: "", priority: "normal", category: "Feature Request", customUrl: "" })); setShowForm(false); load(); if (refreshOpenCount) refreshOpenCount(); }
    setSubmitting(false);
  };

  const markStatus = async (id, status) => {
    const update = { status, updated_at: new Date().toISOString() };
    if (status === "completed") { update.completed_at = new Date().toISOString(); update.completed_by = localStorage.getItem("intake-cr-name") || "Manager"; }
    await supabase.from("change_requests").update(update).eq("id", id);
    load();
    if (refreshOpenCount) refreshOpenCount();
  };

  const deleteRequest = async (id) => {
    if (!window.confirm("Delete permanently?")) return;
    await supabase.from("change_requests").delete().eq("id", id);
    load();
    if (refreshOpenCount) refreshOpenCount();
  };

  const addComment = async (id) => {
    if (!commentDraft.trim() || !commentName.trim()) return;
    localStorage.setItem("intake-cr-name", commentName.trim());
    const req = requests.find(r => r.id === id);
    const existing = Array.isArray(req?.comments) ? req.comments : [];
    const updated = [...existing, { name: commentName.trim(), text: commentDraft.trim(), date: new Date().toISOString() }];
    await supabase.from("change_requests").update({ comments: updated, updated_at: new Date().toISOString() }).eq("id", id);
    setCommentDraft("");
    load();
  };

  const filtered = categoryFilter === "All" ? requests : requests.filter(r => r.category === categoryFilter);
  const pageToView = { "Homepage": "home", "Creators": "creators", "Creator Detail": "creatorDetail", "New Brief": "create", "Brief Library": "library", "Brief Display": "display", "Channel Pipeline": "pipeline", "Tools": "tools", "Video Reformatter": "videotool", "Source of Truth": "sourceOfTruth", "Settings": "settings", "Change Requests": "changeRequests" };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {["open", "in_progress", "completed", "all"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: filter === f ? "2px solid " + t.green + "60" : "1px solid " + t.border, background: filter === f ? t.green + "10" : t.card, color: filter === f ? t.green : t.textMuted, cursor: "pointer", textTransform: "capitalize" }}>{f.replace("_", " ")}</button>
          ))}
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: t.green, color: "#000", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>{showForm ? "Cancel" : "New request"}</button>
      </div>

      {showForm ? (
        <div style={{ background: t.card, border: "2px solid " + t.green + "60", borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: t.shadow }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: t.text, marginBottom: 12 }}>Submit a request</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Your name" style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid " + t.border, background: t.inputBg, color: t.inputText, fontSize: 13 }} />
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Short title (optional)" style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid " + t.border, background: t.inputBg, color: t.inputText, fontSize: 13 }} />
          </div>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Full description..." rows={4} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid " + t.border, background: t.inputBg, color: t.inputText, fontSize: 13, marginBottom: 8, boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }} />
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <select value={form.page} onChange={e => setForm(f => ({ ...f, page: e.target.value }))} style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid " + t.border, background: t.inputBg, color: t.inputText, fontSize: 12 }}>
              {pages.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid " + t.border, background: t.inputBg, color: t.inputText, fontSize: 12 }}>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid " + t.border, background: t.inputBg, color: t.inputText, fontSize: 12 }}>
              <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
            </select>
          </div>
          <input value={form.customUrl} onChange={e => setForm(f => ({ ...f, customUrl: e.target.value }))} placeholder="Link or URL (optional)" style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid " + t.border, background: t.inputBg, color: t.inputText, fontSize: 12, marginBottom: 12, boxSizing: "border-box" }} />
          <button onClick={submit} disabled={submitting} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: t.green, color: "#000", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>{submitting ? "Submitting..." : "Submit request"}</button>
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
        {["All", ...categories].map(c => (
          <button key={c} onClick={() => setCategoryFilter(c)} style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, border: categoryFilter === c ? "1px solid " + (categoryColors[c] || t.border) : "1px solid " + t.border, background: categoryFilter === c ? (categoryColors[c] || t.textMuted) + "10" : "transparent", color: categoryFilter === c ? (categoryColors[c] || t.textMuted) : t.textFaint, cursor: "pointer" }}>{c}</button>
        ))}
      </div>

      {loading ? <div style={{ color: t.textFaint, padding: 20 }}>Loading...</div> : filtered.length === 0 ? (
        <div style={{ background: t.card, border: "1px solid " + t.border, borderRadius: 12, padding: 40, textAlign: "center", color: t.textFaint, boxShadow: t.shadow }}>No requests found</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(r => {
            const isExpanded = expandedId === r.id;
            const comments = Array.isArray(r.comments) ? r.comments : [];
            const catColor = categoryColors[r.category] || t.textMuted;
            const priColor = priorityColors[r.priority] || t.textMuted;
            const viewName = pageToView[r.page];

            return (
              <div key={r.id} style={{ background: t.card, border: "1px solid " + t.border, borderRadius: 12, boxShadow: t.shadow, borderLeft: "4px solid " + (r.status === "completed" ? t.green : r.status === "in_progress" ? t.blue : priColor), overflow: "hidden" }}>
                <div onClick={() => setExpandedId(isExpanded ? null : r.id)} style={{ padding: "16px 20px", cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: t.text, marginBottom: 4 }}>{r.title || r.description?.substring(0, 60)}</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", fontSize: 11 }}>
                        <span style={{ padding: "2px 8px", borderRadius: 5, background: catColor + "12", color: catColor, fontWeight: 600 }}>{r.category || "Other"}</span>
                        {r.priority && r.priority !== "normal" ? <span style={{ padding: "2px 8px", borderRadius: 5, background: priColor + "12", color: priColor, fontWeight: 600, textTransform: "capitalize" }}>{r.priority}</span> : null}
                        <span style={{ color: t.textFaint }}>{r.requested_by}</span>
                        <span style={{ color: t.textFaint }}>·</span>
                        {viewName ? <span onClick={e => { e.stopPropagation(); navigate(viewName); }} style={{ color: t.blue, cursor: "pointer" }}>{r.page}</span> : <span style={{ color: t.textFaint }}>{r.page}</span>}
                        <span style={{ color: t.textFaint }}>·</span>
                        <span style={{ color: t.textFaint }}>{new Date(r.created_at).toLocaleDateString()}</span>
                        {comments.length > 0 ? <span style={{ color: t.textFaint }}>· {comments.length} comment{comments.length !== 1 ? "s" : ""}</span> : null}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      {r.status === "open" ? <button onClick={e => { e.stopPropagation(); markStatus(r.id, "in_progress"); }} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid " + t.blue + "60", background: t.blue + "10", color: t.blue, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>In progress</button> : null}
                      {r.status !== "completed" ? <button onClick={e => { e.stopPropagation(); markStatus(r.id, "completed"); }} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid " + t.green + "60", background: t.green + "10", color: t.green, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Done</button> : null}
                    </div>
                  </div>
                </div>

                {isExpanded ? (
                  <div style={{ padding: "0 20px 16px", borderTop: "1px solid " + t.border }}>
                    <div style={{ fontSize: 13, color: t.text, lineHeight: 1.7, padding: "12px 0", whiteSpace: "pre-wrap" }}>{r.description}</div>
                    {r.custom_url ? <a href={r.custom_url.startsWith("http") ? r.custom_url : "https://" + r.custom_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: t.blue, display: "block", marginBottom: 12 }}>{r.custom_url}</a> : null}
                    {r.status === "completed" ? <div style={{ fontSize: 11, color: t.green, marginBottom: 8 }}>Completed {r.completed_at ? new Date(r.completed_at).toLocaleDateString() : ""} {r.completed_by ? "by " + r.completed_by : ""}</div> : null}

                    {comments.length > 0 ? (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 500, color: t.textFaint, marginBottom: 6 }}>Comments</div>
                        {comments.map((c, i) => (
                          <div key={i} style={{ padding: "8px 12px", background: t.cardAlt, borderRadius: 8, marginBottom: 4, fontSize: 12 }}>
                            <span style={{ fontWeight: 600, color: t.text }}>{c.name}</span>
                            <span style={{ color: t.textFaint, marginLeft: 6 }}>{new Date(c.date).toLocaleDateString()}</span>
                            <div style={{ color: t.textSecondary, marginTop: 2 }}>{c.text}</div>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <div style={{ display: "flex", gap: 8 }}>
                      <input value={commentName} onChange={e => setCommentName(e.target.value)} placeholder="Name" style={{ width: 100, padding: "7px 10px", borderRadius: 6, border: "1px solid " + t.border, background: t.inputBg, color: t.inputText, fontSize: 12 }} />
                      <input value={commentDraft} onChange={e => setCommentDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addComment(r.id); }} placeholder="Add a comment..." style={{ flex: 1, padding: "7px 10px", borderRadius: 6, border: "1px solid " + t.border, background: t.inputBg, color: t.inputText, fontSize: 12 }} />
                      <button onClick={() => addComment(r.id)} style={{ padding: "7px 14px", borderRadius: 6, border: "none", background: t.green, color: "#000", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Reply</button>
                    </div>

                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button onClick={() => deleteRequest(r.id)} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid " + t.border, background: "transparent", color: t.textFaint, fontSize: 11, cursor: "pointer" }}>Delete</button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChangeRequestWidget({ currentPage, t, navigate, refreshOpenCount }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: localStorage.getItem("intake-cr-name") || "", title: "", description: "", priority: "normal", category: "Feature Request", customUrl: "" });
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [pageOpenBadge, setPageOpenBadge] = useState(0);

  const categories = ["Feature Request", "Bug Fix", "Content Change", "New Idea", "UI/Design", "Other"];

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("change_requests").select("id").eq("status", "open");
      setPageOpenBadge((data || []).length);
    })();
  }, []);

  const submit = async () => {
    if (!form.name.trim() || !form.description.trim()) { alert("Enter your name and a description."); return; }
    localStorage.setItem("intake-cr-name", form.name.trim());
    setSubmitting(true);
    const { error } = await supabase.from("change_requests").insert({
      title: form.title.trim() || form.description.trim().substring(0, 60),
      description: form.description.trim(),
      page: currentPage || "Homepage",
      custom_url: form.customUrl.trim() || null,
      category: form.category,
      priority: form.priority,
      requested_by: form.name.trim(),
    });
    if (error) { alert("Failed: " + error.message); }
    else {
      setForm(f => ({ ...f, title: "", description: "", priority: "normal", category: "Feature Request", customUrl: "" }));
      setToast("Request submitted!");
      setTimeout(() => setToast(null), 3000);
      const { data } = await supabase.from("change_requests").select("id").eq("status", "open");
      setPageOpenBadge((data || []).length);
      if (refreshOpenCount) refreshOpenCount();
    }
    setSubmitting(false);
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(!open)} style={{ position: "fixed", bottom: 24, right: 24, padding: open ? "10px 16px" : "10px 18px", borderRadius: 10, background: open ? t.text : t.green, color: open ? t.bg : "#000", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 500, display: "flex", alignItems: "center", gap: 6, boxShadow: "0 4px 20px rgba(0,0,0,0.2)", zIndex: 1000 }}>
        {open ? "Close" : "Request Changes"}
        {!open && pageOpenBadge > 0 ? <span style={{ width: 18, height: 18, borderRadius: 9, background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center" }}>{pageOpenBadge}</span> : null}
      </button>

      {open ? (
        <div style={{ position: "fixed", bottom: 80, right: 24, width: 380, maxHeight: "70vh", overflowY: "auto", background: t.card, border: "1px solid " + t.border, borderRadius: 14, boxShadow: "0 8px 40px rgba(0,0,0,0.15)", zIndex: 999, padding: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 500, color: t.text, marginBottom: 4 }}>Submit a request</div>
          <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 16 }}>Bug, feature idea, content change — anything goes.</div>

          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Your name" style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid " + t.border, background: t.inputBg, color: t.inputText, fontSize: 13, marginBottom: 8, boxSizing: "border-box" }} />

          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Short title (optional)" style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid " + t.border, background: t.inputBg, color: t.inputText, fontSize: 13, marginBottom: 8, boxSizing: "border-box" }} />

          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe what you need..." rows={4} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid " + t.border, background: t.inputBg, color: t.inputText, fontSize: 13, marginBottom: 8, boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }} />

          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid " + t.border, background: t.inputBg, color: t.inputText, fontSize: 12 }}>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid " + t.border, background: t.inputBg, color: t.inputText, fontSize: 12 }}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <input value={form.customUrl} onChange={e => setForm(f => ({ ...f, customUrl: e.target.value }))} placeholder="Link to page or screenshot (optional)" style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid " + t.border, background: t.inputBg, color: t.inputText, fontSize: 12, marginBottom: 12, boxSizing: "border-box" }} />

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={submit} disabled={submitting} style={{ flex: 1, padding: "10px 16px", borderRadius: 8, border: "none", background: t.green, color: "#000", fontSize: 13, fontWeight: 500, cursor: "pointer", opacity: submitting ? 0.6 : 1 }}>{submitting ? "Submitting..." : "Submit"}</button>
            <button onClick={() => navigate("changeRequests")} style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid " + t.border, background: "transparent", color: t.textMuted, fontSize: 12, cursor: "pointer" }}>View all</button>
          </div>

          {toast ? <div style={{ marginTop: 10, fontSize: 12, color: t.green, fontWeight: 600 }}>{toast}</div> : null}
        </div>
      ) : null}
    </>
  );
}



export { ChangeRequestsPage, ChangeRequestWidget };
export default ChangeRequestsPage;
