import React, { useState, useRef, useEffect } from "react";

function TeamOwnerPicker({ owners = [], onAdd, onRemove, teamMembers = [], label = "Owners", compact = false, t }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    setTimeout(() => document.addEventListener("click", h), 0);
    return () => document.removeEventListener("click", h);
  }, [open]);

  const available = teamMembers
    .filter(m => ["owner", "manager", "team"].includes(m.role))
    .filter(m => !owners.find(o => o.id === m.id))
    .filter(m => !search.trim() || (m.name || "").toLowerCase().includes(search.toLowerCase()));

  if (compact) {
    return (
      <div ref={ref} style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          {owners.slice(0, 3).map((m, i) => (
            <div key={m.id} style={{ marginLeft: i > 0 ? -8 : 0, zIndex: 3 - i }}>
              {m.avatar_url ? (
                <img src={m.avatar_url} alt="" title={m.name} style={{ width: 24, height: 24, borderRadius: 12, objectFit: "cover", border: "2px solid " + (t?.card || "#111") }} onError={(e) => { e.target.style.display = "none"; }} />
              ) : (
                <div style={{ width: 24, height: 24, borderRadius: 12, background: (t?.green || "#00FEA9") + "15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 500, color: t?.green || "#00FEA9", border: "2px solid " + (t?.card || "#111") }} title={m.name}>{(m.name || "?")[0]}</div>
              )}
            </div>
          ))}
          {owners.length > 3 ? <span style={{ fontSize: 9, color: t?.textFaint, marginLeft: 4 }}>+{owners.length - 3}</span> : null}
        </div>
        <button onClick={(e) => { e.stopPropagation(); setOpen(!open); }} style={{ width: 24, height: 24, borderRadius: 12, border: "1px dashed " + (t?.border || "#333"), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: t?.textFaint, cursor: "pointer", background: "none", marginLeft: 4 }}>+</button>
        {open && renderDropdown()}
      </div>
    );
  }

  function renderDropdown() {
    return (
      <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, background: t?.card || "#111", border: "1px solid " + (t?.border || "#333"), borderRadius: 10, padding: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 50, maxHeight: 280, overflowY: "auto", width: 280 }}>
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search team..." autoFocus style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid " + (t?.border || "#333"), background: t?.inputBg || "#1a1a1a", color: t?.inputText || "#fff", fontSize: 12, outline: "none", boxSizing: "border-box", marginBottom: 6 }} />
        {available.length === 0 ? <div style={{ padding: 12, textAlign: "center", color: t?.textFaint, fontSize: 11 }}>No team members available</div> : available.map(m => (
          <div key={m.id} onClick={() => { onAdd(m.id); setOpen(false); setSearch(""); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", cursor: "pointer", borderRadius: 6 }} onMouseEnter={(e) => { e.currentTarget.style.background = t?.cardAlt || "#1a1a1a"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
            {m.avatar_url ? <img src={m.avatar_url} alt="" style={{ width: 24, height: 24, borderRadius: 12, objectFit: "cover", flexShrink: 0 }} onError={(e) => { e.target.style.display = "none"; }} /> : <div style={{ width: 24, height: 24, borderRadius: 12, background: (t?.green || "#00FEA9") + "15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 500, color: t?.green || "#00FEA9" }}>{(m.name || "?")[0]}</div>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: t?.text || "#fff" }}>{m.name}</div>
              {m.title ? <div style={{ fontSize: 10, color: t?.textFaint }}>{m.title}</div> : null}
            </div>
            {m.role ? <span style={{ fontSize: 9, fontWeight: 500, color: t?.textFaint, textTransform: "uppercase", letterSpacing: "0.04em" }}>{m.role}</span> : null}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div style={{ fontSize: 10, fontWeight: 500, color: t?.textFaint, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {owners.map(m => (
          <div key={m.id} style={{ height: 32, borderRadius: 16, background: t?.cardAlt || "#1a1a1a", display: "flex", alignItems: "center", gap: 8, paddingRight: 12 }}>
            {m.avatar_url ? <img src={m.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: 14, objectFit: "cover", marginLeft: 2 }} onError={(e) => { e.target.style.display = "none"; }} /> : <div style={{ width: 28, height: 28, borderRadius: 14, background: (t?.green || "#00FEA9") + "15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 500, color: t?.green || "#00FEA9", marginLeft: 2 }}>{(m.name || "?")[0]}</div>}
            <span style={{ fontSize: 13, fontWeight: 500, color: t?.text || "#fff" }}>{m.name}</span>
            <span onClick={() => onRemove(m.id)} style={{ fontSize: 11, color: t?.textFaint, cursor: "pointer", marginLeft: 2 }} title="Remove">&times;</span>
          </div>
        ))}
        {owners.length === 0 ? <span style={{ fontSize: 12, color: t?.textFaint }}>No owners assigned</span> : null}
        <button onClick={(e) => { e.stopPropagation(); setOpen(!open); }} style={{ width: 32, height: 32, borderRadius: 16, border: "1px dashed " + (t?.border || "#333"), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: t?.textFaint, cursor: "pointer", background: "none" }}>+</button>
      </div>
      {open && renderDropdown()}
    </div>
  );
}

export { TeamOwnerPicker };
export default TeamOwnerPicker;
