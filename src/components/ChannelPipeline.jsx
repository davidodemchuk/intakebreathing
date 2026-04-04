import React, { useState, useRef, useEffect, useCallback } from "react";
import TtsNativeTab, { PIPELINE_TAB_MAP, PIPELINE_SOP_TABS, pipelineColIndexToA1 } from "./TtsNative.jsx";

function ChannelPipeline({ navigate, creators: _creators, t, S: _S }) {
  const getTabFromUrl = () => {
    const p = window.location.pathname;
    const m = p.match(/\/channel-pipeline\/([^/]+)/);
    if (m) { const u = m[1].replace(/-/g, "_"); const valid = ["overview","spend","tts","tts_native","instagram","ugc","youtube","sops"]; if (valid.includes(u)) return u; }
    return "overview";
  };
  const [tab, setTab] = useState(getTabFromUrl);
  const setTabWithUrl = (newTab) => { setTab(newTab); window.history.pushState(null, "", "/channel-pipeline/" + newTab.replace(/_/g, "-")); };

  useEffect(() => { if (window.location.pathname === "/channel-pipeline") window.history.replaceState(null, "", "/channel-pipeline/overview"); }, []);
  useEffect(() => { const h = () => setTab(getTabFromUrl()); window.addEventListener("popstate", h); return () => window.removeEventListener("popstate", h); }, []);
  const [sheetData, setSheetData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [editCellVal, setEditCellVal] = useState("");
  const [saving, setSaving] = useState(false);
  const skipBlurSaveRef = useRef(false);

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "spend", label: "Spend" },
    { id: "tts", label: "TTS" },
    { id: "tts_native", label: "TTS Native" },
    { id: "instagram", label: "Instagram" },
    { id: "ugc", label: "UGC" },
    { id: "youtube", label: "YouTube" },
    { id: "sops", label: "SOPs" },
  ];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        if (tab === "sops") {
          const results = {};
          for (const sopTab of PIPELINE_SOP_TABS) {
            try {
              const res = await fetch(`/api/sheets-formatted/${encodeURIComponent(sopTab)}`);
              if (res.ok) results[sopTab] = await res.json();
            } catch {
              /* skip failed SOP tab */
            }
          }
          if (!cancelled) setSheetData((prev) => ({ ...prev, ...results }));
          return;
        }
        const sheetTab = PIPELINE_TAB_MAP[tab];
        if (!sheetTab) {
          return;
        }
        const res = await fetch(`/api/sheets-formatted/${encodeURIComponent(sheetTab)}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        if (!cancelled) setSheetData((prev) => ({ ...prev, [sheetTab]: data }));
      } catch (e) {
        if (!cancelled) setError(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab]);

  const refresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      await fetch("/api/sheets-refresh", { method: "POST" });
      setSheetData({});
      if (tab === "sops") {
        const results = {};
        for (const sopTab of PIPELINE_SOP_TABS) {
          const res = await fetch(`/api/sheets-formatted/${encodeURIComponent(sopTab)}`);
          if (res.ok) results[sopTab] = await res.json();
        }
        setSheetData(results);
      } else {
        const sheetTab = PIPELINE_TAB_MAP[tab];
        if (sheetTab) {
          const res = await fetch(`/api/sheets-formatted/${encodeURIComponent(sheetTab)}`);
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `HTTP ${res.status}`);
          }
          const data = await res.json();
          setSheetData((prev) => ({ ...prev, [sheetTab]: data }));
        }
      }
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setRefreshing(false);
    }
  };

  const saveCell = async (tabName, rowIdxInRows, colIndex, value) => {
    const colLetter = pipelineColIndexToA1(colIndex);
    const sheetRow = rowIdxInRows + 1;
    const cell = `${colLetter}${sheetRow}`;
    setSaving(true);
    try {
      const res = await fetch("/api/sheets/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tab: tabName, cell, value }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        window.alert("Save failed: " + (err.error || `HTTP ${res.status}`));
      } else {
        setSheetData((prev) => {
          const updated = { ...prev };
          if (updated[tabName]?.rows) {
            const newRows = updated[tabName].rows.map((r) => [...(r || [])]);
            if (newRows[rowIdxInRows]) {
              newRows[rowIdxInRows] = [...newRows[rowIdxInRows]];
              newRows[rowIdxInRows][colIndex] = value;
            }
            updated[tabName] = { ...updated[tabName], rows: newRows, fetchedAt: new Date().toISOString() };
          }
          return updated;
        });
      }
    } catch (e) {
      window.alert("Save failed: " + (e.message || String(e)));
    } finally {
      setSaving(false);
      setEditingCell(null);
    }
  };

  const renderSheetTable = (tabName, opts = {}) => {
    const data = sheetData[tabName];
    if (!data?.rows?.length) {
      return <div style={{ padding: 40, textAlign: "center", color: t.textFaint }}>No data loaded</div>;
    }

    const rows = data.rows;
    const formats = data.formats || [];
    const headerIdx = opts.headerRowIndex || 0;
    const headerRow = rows[headerIdx] || [];
    const headerFmt = formats[headerIdx] || [];
    const dataRows = rows.slice(headerIdx + 1);
    const dataFormats = formats.slice(headerIdx + 1);
    const maxCols = Math.max(1, ...rows.map((r) => (Array.isArray(r) ? r.length : 0)), headerRow.length);

    return (
      <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "75vh", borderRadius: 10, border: `1px solid ${t.border}` }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, minWidth: Math.min(maxCols * 85, 3000) }}>
          <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
            <tr>
              {Array.from({ length: maxCols }, (_, i) => {
                const cell = headerRow[i];
                const fmt = headerFmt[i] || {};
                return (
                  <th
                    key={i}
                    style={{
                      padding: "7px 8px",
                      textAlign: fmt.align || (i === 0 ? "left" : "center"),
                      fontSize: 10,
                      fontWeight: fmt.bold ? 800 : 700,
                      color: fmt.fg || t.text,
                      whiteSpace: "nowrap",
                      position: i === 0 ? "sticky" : "static",
                      left: i === 0 ? 0 : "auto",
                      background: fmt.bg || t.cardAlt,
                      zIndex: i === 0 ? 12 : 10,
                      minWidth: i === 0 ? 130 : 65,
                      borderBottom: `2px solid ${t.border}`,
                      borderRight: `1px solid ${t.border}25`,
                    }}
                  >
                    {String(cell ?? "").replace(/\n/g, " ")}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {dataRows.map((row, ri) => {
              const rowFmt = dataFormats[ri] || [];
              const firstCell = String(row?.[0] ?? "").trim();
              const isEmpty = !row || row.every((c) => !c || String(c).trim() === "");
              if (isEmpty) return null;

              const isTotal = /total/i.test(firstCell) || /^Q\d/i.test(firstCell);
              const isMilestone =
                /join/i.test(firstCell) ||
                /takes over/i.test(firstCell) ||
                /goals/i.test(firstCell) ||
                /video/i.test(firstCell);
              const isMonthHeader =
                /^\d{4}-\d{2}/.test(firstCell) ||
                /^(January|February|March|April|May|June|July|August|September|October|November|December)/i.test(firstCell);
              const isSectionHeader = (row || []).filter((c) => c && String(c).trim()).length <= 2 && firstCell.length > 2;

              const rowBg = rowFmt[0]?.bg || rowFmt[1]?.bg || null;
              const hasSheetBg = rowBg && rowBg !== "#ffffff";

              return (
                <tr key={ri} style={{ background: hasSheetBg ? rowBg : isTotal || isMonthHeader ? t.cardAlt : "transparent" }}>
                  {Array.from({ length: maxCols }, (_, ci) => {
                    const val = row?.[ci] ?? "";
                    const fmt = rowFmt[ci] || {};
                    const isFirst = ci === 0;
                    const s = String(val).trim();

                    let cellColor = fmt.fg || t.text;
                    let cellBg = fmt.bg || null;
                    let cellBold = fmt.bold || false;

                    if (!fmt.fg) {
                      if (s === "—" || s === "" || s === "#REF!" || s === "#DIV/0!" || s === "0" || s === "$0" || s === "$0.00") {
                        cellColor = t.textFaint;
                      } else if (s.startsWith("-$") || (s.startsWith("-") && /\d/.test(s) && !s.includes("%"))) {
                        cellColor = "#ef4444";
                      } else if (s.endsWith("%")) {
                        const pctVal = parseFloat(s.replace(/%/g, ""));
                        cellColor = Number.isFinite(pctVal) && pctVal < 0 ? "#ef4444" : t.textMuted;
                      }
                    }

                    if (!fmt.fg && isFirst && /^(Active|Pause|Under Review|Complete)$/i.test(s)) {
                      const sc = { active: t.green, pause: t.orange, "under review": t.blue, complete: t.green };
                      cellColor = sc[s.toLowerCase()] || t.textFaint;
                    }

                    if (isTotal) cellBold = true;
                    if (isFirst) cellBold = true;

                    const display = s === "#REF!" || s === "#DIV/0!" ? "—" : val;
                    const rowIdxInRows = headerIdx + 1 + ri;
                    const isEditing = editingCell?.tabName === tabName && editingCell?.rowIdxInRows === rowIdxInRows && editingCell?.col === ci;
                    const canEdit = ci > 0 && !isTotal && !isMonthHeader && !isMilestone && !isSectionHeader;

                    return (
                      <td
                        key={ci}
                        onClick={() => {
                          if (canEdit) {
                            setEditingCell({ tabName, rowIdxInRows, col: ci });
                            setEditCellVal(val === null || val === undefined ? "" : String(val));
                          }
                        }}
                        style={{
                          padding: "5px 8px",
                          textAlign: fmt.align || (isFirst ? "left" : "right"),
                          color: cellColor,
                          fontWeight: cellBold ? 700 : 400,
                          fontSize: isMilestone ? 10 : 11,
                          whiteSpace: "nowrap",
                          maxWidth: ci > 0 ? 120 : 200,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          position: isFirst ? "sticky" : "static",
                          left: isFirst ? 0 : "auto",
                          background: isFirst
                            ? cellBg || (isTotal || isMonthHeader ? t.cardAlt : t.card)
                            : cellBg || (isTotal || isMonthHeader || hasSheetBg ? (hasSheetBg ? rowBg : t.cardAlt) : "transparent"),
                          zIndex: isFirst ? 1 : 0,
                          fontVariantNumeric: "tabular-nums",
                          cursor: canEdit ? "pointer" : "default",
                          outline: isEditing ? `2px solid ${t.green}` : "none",
                          borderBottom: `1px solid ${t.border}20`,
                          borderRight: `1px solid ${t.border}15`,
                          borderTop: isTotal || isMonthHeader ? `2px solid ${t.border}` : "none",
                        }}
                      >
                        {isEditing ? (
                          <input
                            type="text"
                            autoFocus
                            value={editCellVal}
                            onChange={(e) => setEditCellVal(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                skipBlurSaveRef.current = true;
                                void saveCell(tabName, rowIdxInRows, ci, editCellVal);
                              }
                              if (e.key === "Escape") {
                                e.preventDefault();
                                skipBlurSaveRef.current = true;
                                setEditingCell(null);
                              }
                            }}
                            onBlur={() => {
                              if (skipBlurSaveRef.current) {
                                skipBlurSaveRef.current = false;
                                return;
                              }
                              void saveCell(tabName, rowIdxInRows, ci, editCellVal);
                            }}
                            style={{
                              width: "100%",
                              padding: "2px 4px",
                              border: `1px solid ${t.green}`,
                              borderRadius: 4,
                              fontSize: 11,
                              background: t.inputBg,
                              color: t.inputText,
                              outline: "none",
                              boxSizing: "border-box",
                            }}
                          />
                        ) : (
                          display
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const activeSheetName = PIPELINE_TAB_MAP[tab];
  const lastFetchedRaw =
    tab === "sops"
      ? Object.values(sheetData)
          .map((d) => d?.fetchedAt)
          .filter(Boolean)
          .sort()
          .pop()
      : activeSheetName
        ? sheetData[activeSheetName]?.fetchedAt
        : null;

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "32px 24px 60px", animation: "fadeIn 0.3s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, color: t.text, letterSpacing: "-0.02em", marginBottom: 4 }}>Channel Pipeline</div>
          <div style={{ fontSize: 13, color: t.textMuted }}>Live from Google Sheets — click a cell to edit (saves on Enter); cache ~2 min</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {saving ? (
            <span style={{ fontSize: 12, color: t.orange, fontWeight: 600 }}>Saving...</span>
          ) : null}
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: `1px solid ${t.border}`,
              background: t.cardAlt,
              color: t.text,
              fontSize: 12,
              fontWeight: 600,
              cursor: refreshing ? "not-allowed" : "pointer",
              opacity: refreshing ? 0.5 : 1,
            }}
          >
            {refreshing ? "Refreshing..." : "↻ Refresh"}
          </button>
          <a
            href="https://docs.google.com/spreadsheets/d/1aM51vSoGUhuhDJu8VyukeIp59XS2G_yv3alJxTJ2Aak/edit"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: `1px solid ${t.border}`,
              background: "transparent",
              color: t.textMuted,
              fontSize: 12,
              fontWeight: 600,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            Open in Sheets ↗
          </a>
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 24, overflowX: "auto", borderBottom: `1px solid ${t.border}` }}>
        {tabs.map((tb) => (
          <button
            key={tb.id}
            type="button"
            onClick={() => setTabWithUrl(tb.id)}
            style={{
              padding: "10px 16px",
              fontSize: 13,
              fontWeight: tab === tb.id ? 700 : 500,
              color: tab === tb.id ? t.green : t.textMuted,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              borderBottom: tab === tb.id ? `2px solid ${t.green}` : "2px solid transparent",
              whiteSpace: "nowrap",
            }}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {error ? (
        <div style={{ padding: "12px 16px", background: t.red + "10", border: `1px solid ${t.red}25`, borderRadius: 8, marginBottom: 16, color: t.red, fontSize: 13 }}>{error}</div>
      ) : null}

      {loading ? <div style={{ padding: 40, textAlign: "center", color: t.textMuted }}>Loading sheet data...</div> : null}

      {!loading && tab !== "sops" && tab !== "tts_native" && activeSheetName ? (
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 12 }}>{activeSheetName}</div>
          {renderSheetTable(activeSheetName, tab === "instagram" ? { headerRowIndex: 1 } : {})}
        </div>
      ) : null}

      {tab === "tts_native" ? <TtsNativeTab t={t} S={_S} teamMembers={[]} creators={_creators} /> : null}

      {!loading && tab === "sops" ? (
        <div>
          {PIPELINE_SOP_TABS.map((sopTab) => {
            const data = sheetData[sopTab];
            if (!data?.rows?.length) {
              return (
                <div key={sopTab} style={{ marginBottom: 24, color: t.textFaint, fontSize: 13 }}>
                  {sopTab}: no data
                </div>
              );
            }
            return (
              <div key={sopTab} style={{ marginBottom: 32 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 12 }}>{sopTab}</div>
                {renderSheetTable(sopTab)}
              </div>
            );
          })}
        </div>
      ) : null}

      <div style={{ marginTop: 16, fontSize: 11, color: t.textFaint, opacity: 0.85 }}>
        Data from Google Sheets · Last fetched: {lastFetchedRaw ? new Date(lastFetchedRaw).toLocaleString() : "—"}
      </div>
    </div>
  );
}



export default ChannelPipeline;
