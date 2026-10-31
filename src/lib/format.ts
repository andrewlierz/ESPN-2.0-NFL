import type { CellValue, Fmt } from "./table";

export function fmtValue(v: CellValue | undefined, fmt: Fmt): string {
  if (v === null || v === undefined || v === "") return "–";
  if (typeof v === "string") return v;
  if (!Number.isFinite(v)) return "–";
  switch (fmt) {
    case "int":
      return Math.round(v).toLocaleString("en-US");
    case "dec1":
      return v.toFixed(1);
    case "dec2":
      return v.toFixed(2);
    case "dec3":
      return v.toFixed(3);
    case "pct":
      return `${(v * 100).toFixed(1)}%`;
    case "signed1":
      return `${v > 0 ? "+" : ""}${v.toFixed(1)}`;
    case "signed2":
      return `${v > 0 ? "+" : ""}${v.toFixed(2)}`;
    default:
      return String(v);
  }
}

export function fmtHeight(inches: number | null): string {
  if (!inches) return "–";
  return `${Math.floor(inches / 12)}' ${inches % 12}"`;
}

export function ageFrom(birthDate: string, at = new Date()): number | null {
  if (!birthDate) return null;
  const b = new Date(birthDate + "T00:00:00Z");
  if (Number.isNaN(b.getTime())) return null;
  let age = at.getUTCFullYear() - b.getUTCFullYear();
  const m = at.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && at.getUTCDate() < b.getUTCDate())) age--;
  return age;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Sun, Oct 26" from YYYY-MM-DD. */
export function fmtGameDate(gameday: string, weekday?: string): string {
  const [, m, d] = gameday.split("-").map(Number);
  if (!m || !d) return gameday;
  const wd = weekday ? weekday.slice(0, 3) + ", " : "";
  return `${wd}${MONTHS[m - 1]} ${d}`;
}

/** "1:00 PM ET" from 24h "13:00". */
export function fmtGameTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h)) return "";
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m ?? 0).padStart(2, "0")} ${ampm} ET`;
}

export function fmtSpread(spread: number | null, home: string, away: string): string {
  if (spread === null) return "";
  if (spread === 0) return "PK";
  return spread > 0 ? `${home} -${spread}` : `${away} -${Math.abs(spread)}`;
}

export function fmtMoneyline(ml: number | null): string {
  if (ml === null) return "–";
  return ml > 0 ? `+${ml}` : String(ml);
}

export function weekLabel(week: number, gameType: string): string {
  switch (gameType) {
    case "WC":
      return "Wild Card";
    case "DIV":
      return "Divisional";
    case "CON":
      return "Conference Championship";
    case "SB":
      return "Super Bowl";
    default:
      return `Week ${week}`;
  }
}
