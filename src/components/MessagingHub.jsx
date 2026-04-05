import React, { useState, useEffect } from "react";
import { supabase } from "../supabase.js";

function MessagingHub({ t, S, teamMembers, creators, navigate }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.from("creator_conversations").select("*, creator_messages(id, body, direction, status, channel, created_at, sent_at)").order("last_message_at", { ascending: false, nullsFirst: false });
      if (!error && data) setConversations(data);
      setLoading(false);
    })();
  }, []);

  const getCreator = (cid) => creators.find(cr => cr.id === cid);
  const getLastMsg = (conv) => { const msgs = conv.creator_messages || []; return msgs.length ? msgs.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))[0] : null; };
  const getMsgCount = (conv) => (conv.creator_messages || []).length;
  const getDraftCount = (conv) => (conv.creator_messages || []).filter(m => m.status === "draft").length;

  const filtered = conversations.filter(conv => {
    const cr = getCreator(conv.creator_id);
    if (filter === "drafts" && getDraftCount(conv) === 0) return false;
    if (filter === "sent" && !(conv.creator_messages || []).some(m => m.status === "sent")) return false;
    if (search) {
      const q = search.toLowerCase();
      const h = (cr?.tiktokHandle || cr?.instagramHandle || cr?.handle || "").toLowerCase();
      const n = (cr?.tiktokData?.displayName || cr?.instagramData?.fullName || "").toLowerCase();
      if (!h.includes(q) && !n.includes(q) && !(conv.creator_messages || []).some(m => m.body?.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  const totalMsgs = conversations.reduce((s, c) => s + getMsgCount(c), 0);
  const totalDrafts = conversations.reduce((s, c) => s + getDraftCount(c), 0);
  const sentThisWeek = conversations.reduce((s, c) => s + (c.creator_messages || []).filter(m => { const d = new Date(m.created_at); const w = new Date(); w.setDate(w.getDate() - 7); return d >= w && m.status === "sent"; }).length, 0);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: t.textFaint }}>Loading conversations...</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div><div style={{ fontSize: 24, fontWeight: 500, color: t.text }}>Messaging</div><div style={{ fontSize: 12, color: t.textFaint, marginTop: 4 }}>{conversations.length} conversations · {totalMsgs} messages · {totalDrafts} drafts</div></div>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        {[{ label: "Conversations", value: conversations.length, color: t.text }, { label: "Sent", value: conversations.reduce((s, c) => s + (c.creator_messages || []).filter(m => m.status === "sent" && m.direction === "outbound").length, 0), color: t.green }, { label: "Drafts", value: totalDrafts, color: t.orange || "#d4890a" }, { label: "This week", value: sentThisWeek, color: t.blue }].map((stat, i) => (
          <div key={i} style={{ flex: 1, background: t.card, border: "1px solid " + t.border, borderRadius: 10, padding: "10px 14px", boxShadow: t.shadow }}>
            <div style={{ fontSize: 9, color: t.textFaint, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{stat.label}</div>
            <div style={{ fontSize: 20, fontWeight: 500, color: stat.color, marginTop: 2 }}>{stat.value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {["all", "sent", "drafts"].map(f => <button key={f} onClick={() => setFilter(f)} style={{ padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: filter === f ? "2px solid " + t.green + "60" : "1px solid " + t.border, background: filter === f ? t.green + "10" : t.card, color: filter === f ? t.green : t.textMuted, textTransform: "capitalize" }}>{f}</button>)}
        </div>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search conversations..." style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid " + t.border, background: t.inputBg, color: t.inputText, fontSize: 12, width: 220 }} />
      </div>
      <div style={{ background: t.card, border: "1px solid " + t.border, borderRadius: 12, overflow: "hidden", boxShadow: t.shadow }}>
        {filtered.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: t.textFaint }}>{search ? "No matches" : "No conversations yet."}</div> : filtered.map((conv, ci) => {
          const cr = getCreator(conv.creator_id); const lastMsg = getLastMsg(conv); const drafts = getDraftCount(conv);
          const handle = cr?.tiktokHandle || cr?.instagramHandle || cr?.handle || "Unknown";
          const name = cr?.tiktokData?.displayName || cr?.instagramData?.fullName || handle;
          const avatar = cr?.tiktokData?.avatarUrl || cr?.instagramData?.avatarUrl || "";
          return (
            <div key={conv.id} onClick={() => navigate("creatorDetail", cr?.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: "pointer", borderBottom: ci < filtered.length - 1 ? "1px solid " + t.border + "60" : "none" }} onMouseEnter={(e) => { e.currentTarget.style.background = t.cardAlt; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
              {avatar ? <img src={avatar} alt="" style={{ width: 40, height: 40, borderRadius: 20, objectFit: "cover", flexShrink: 0 }} onError={(e) => { e.target.style.display = "none"; }} /> : <div style={{ width: 40, height: 40, borderRadius: 20, background: t.green + "15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 500, color: t.green, flexShrink: 0 }}>{name[0]}</div>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: t.text }}>{name} <span style={{ fontSize: 11, fontWeight: 400, color: t.textFaint }}>@{handle}</span></div>
                  <span style={{ fontSize: 10, color: t.textFaint }}>{lastMsg?.sent_at ? new Date(lastMsg.sent_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}</span>
                </div>
                <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lastMsg ? (lastMsg.direction === "outbound" ? "You: " : "") + lastMsg.body.substring(0, 100) : "No messages yet"}</div>
                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 9, color: t.textFaint }}>{getMsgCount(conv)} messages</span>
                  {drafts > 0 ? <span style={{ fontSize: 9, padding: "0 5px", borderRadius: 3, background: t.orange + "15", color: t.orange, fontWeight: 600 }}>{drafts} draft{drafts > 1 ? "s" : ""}</span> : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


export default MessagingHub;
