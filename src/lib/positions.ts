export const POS_GROUPS = ["QB", "RB", "WR", "TE", "OL", "DL", "LB", "DB", "K", "P"] as const;
export type PosGroup = (typeof POS_GROUPS)[number] | "";

const MAP: Record<string, PosGroup> = {
  QB: "QB",
  RB: "RB",
  HB: "RB",
  FB: "RB",
  WR: "WR",
  TE: "TE",
  T: "OL",
  G: "OL",
  C: "OL",
  OT: "OL",
  OG: "OL",
  OL: "OL",
  DE: "DL",
  DT: "DL",
  NT: "DL",
  DL: "DL",
  EDGE: "DL",
  LB: "LB",
  OLB: "LB",
  ILB: "LB",
  MLB: "LB",
  CB: "DB",
  S: "DB",
  FS: "DB",
  SS: "DB",
  DB: "DB",
  SAF: "DB",
  K: "K",
  PK: "K",
  P: "P",
};

export function posGroup(pos: string | undefined): PosGroup {
  return MAP[(pos ?? "").toUpperCase()] ?? "";
}

export const OFFENSE_GROUPS: PosGroup[] = ["QB", "RB", "WR", "TE", "OL"];
export const DEFENSE_GROUPS: PosGroup[] = ["DL", "LB", "DB"];
