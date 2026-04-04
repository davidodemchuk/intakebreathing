// Utility functions extracted from App.jsx — no React or Supabase dependencies

export function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (line[i] === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }
    current += line[i];
  }
  result.push(current.trim());
  return result;
}

export function formatMetricShort(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const x = Number(n);
  if (x < 1000) return String(Math.round(x));
  if (x < 1_000_000) return `${(x / 1000).toFixed(x >= 10_000 ? 0 : 1)}K`;
  return `${(x / 1_000_000).toFixed(x >= 10_000_000 ? 1 : 2)}M`.replace(/\.0M$/, "M");
}

export function medianOf(arr) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

export function fmtDollar(n) {
  if (n == null || !Number.isFinite(n)) return "$0";
  return "$" + Math.round(n).toLocaleString();
}

export function genShareId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `share-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function formatCount(n) {
  const x = Number(n);
  if (!x || x === 0) return "0";
  if (x >= 1000000) return (x / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (x >= 1000) return (x / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(Math.round(x));
}

export function durationToSeconds(d) {
  if (typeof d === "number") return d > 1000 ? Math.round(d / 1000) : d;
  return 0;
}

export function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}

export function aspectRatioLabel(w, h) {
  if (!w || !h) return "—";
  const g = gcd(w, h);
  return `${w / g}:${h / g}`;
}
