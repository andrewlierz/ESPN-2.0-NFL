export type Conference = "AFC" | "NFC";

export interface Team {
  abbr: string;
  name: string;
  location: string;
  nick: string;
  conf: string;
  division: string;
  color: string;
  color2: string;
  logo: string;
}

export type SeasonType = "REG" | "POST";
export type TypeFilter = SeasonType | "ALL";

export interface Game {
  id: string;
  season: number;
  gameType: string; // REG, WC, DIV, CON, SB
  seasonType: SeasonType;
  week: number;
  gameday: string; // YYYY-MM-DD
  weekday: string;
  gametime: string; // HH:MM ET
  away: string;
  home: string;
  awayScore: number | null;
  homeScore: number | null;
  overtime: boolean;
  neutral: boolean;
  roof: string;
  surface: string;
  temp: number | null;
  wind: number | null;
  stadium: string;
  spread: number | null; // positive => home favored
  total: number | null;
  awayMoneyline: number | null;
  homeMoneyline: number | null;
  awayQb: string;
  homeQb: string;
  awayCoach: string;
  homeCoach: string;
  referee: string;
  divGame: boolean;
  awayRest: number | null;
  homeRest: number | null;
  espnId: string;
}

/** A numeric stat bag keyed by the source column name. */
export type Stats = Record<string, number>;

export interface PlayerWeek {
  id: string; // gsis id
  name: string;
  pos: string;
  posGroup: string;
  headshot: string;
  team: string;
  opp: string;
  week: number;
  seasonType: SeasonType;
  gameId: string;
  s: Stats;
}

export interface TeamWeek {
  team: string;
  opp: string;
  week: number;
  seasonType: SeasonType;
  gameId: string;
  s: Stats;
}

export interface SnapRow {
  pfrId: string;
  name: string;
  pos: string;
  team: string;
  opp: string;
  week: number;
  seasonType: SeasonType;
  gameId: string;
  off: number;
  offPct: number;
  def: number;
  defPct: number;
  st: number;
  stPct: number;
}

export interface PfrRow {
  pfrId: string;
  name: string;
  team: string;
  opp: string;
  week: number;
  seasonType: SeasonType;
  gameId: string;
  s: Stats;
}

export interface NgsRow {
  id: string;
  name: string;
  pos: string;
  team: string;
  week: number;
  seasonType: SeasonType;
  s: Stats;
}

export interface RosterPlayer {
  id: string;
  pfrId: string;
  espnId: string;
  name: string;
  team: string;
  pos: string;
  depthPos: string;
  jersey: string;
  status: string;
  birthDate: string;
  height: number | null;
  weight: number | null;
  college: string;
  yearsExp: number | null;
  headshot: string;
  draftClub: string;
  draftNumber: number | null;
  rookieYear: number | null;
}

export interface PlayerInfo {
  id: string;
  pfrId: string;
  espnId: string;
  name: string;
  pos: string;
  posGroup: string;
  height: number | null;
  weight: number | null;
  birthDate: string;
  college: string;
  headshot: string;
  rookieSeason: number | null;
  lastSeason: number | null;
  latestTeam: string;
  status: string;
  jersey: string;
  yearsExp: number | null;
  draftYear: number | null;
  draftRound: number | null;
  draftPick: number | null;
  draftTeam: string;
}

export interface InjuryRow {
  team: string;
  week: number;
  seasonType: string;
  id: string;
  name: string;
  pos: string;
  injury: string;
  status: string;
  practiceStatus: string;
}
