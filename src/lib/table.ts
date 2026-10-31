/** Serializable table model shared by server builders and the client DataTable. */
export type Fmt = "int" | "dec1" | "dec2" | "dec3" | "pct" | "signed1" | "signed2" | "text";

export interface Column {
  key: string;
  label: string;
  fmt: Fmt;
  /** Tooltip / definition. */
  title?: string;
  /** Lower is better (sort ascending first). */
  asc?: boolean;
}

export type Entity =
  | { kind: "player"; id?: string; name: string; team: string; pos?: string; headshot?: string }
  | { kind: "team"; team: string };

export type CellValue = number | string | null;

export interface TableRow {
  entity: Entity;
  v: Record<string, CellValue>;
}

export interface TableData {
  columns: Column[];
  rows: TableRow[];
  defaultSort: string;
  defaultAsc?: boolean;
}
