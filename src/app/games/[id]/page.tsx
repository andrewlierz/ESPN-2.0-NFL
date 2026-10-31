import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AutoRefresh } from "@/components/AutoRefresh";
import { gameStatus, scores } from "@/components/GameCard";
import { Badge, Card, Empty, SimpleTable, TeamLogo } from "@/components/ui";
import { getLiveScores, liveFor } from "@/lib/data/espn";
import { getGame, getSeasonGames } from "@/lib/data/sources";
import { fmtMoneyline, fmtSpread, fmtValue, weekLabel } from "@/lib/format";
import { getGameData, type GameTeamData } from "@/lib/stats/game";
import { passerRating, sackYards } from "@/lib/stats/math";
import { computeRecords, fmtSplit, getTeamSeasonStats, type TeamSeason } from "@/lib/stats/teams";
import { getTeam } from "@/lib/teams";
import type { Game, PlayerWeek } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const g = await getGame(id);
  return { title: g ? `${g.away} @ ${g.home} · ${weekLabel(g.week, g.gameType)} ${g.season}` : "Game" };
}

const pLink = (p: { id?: string; gsis?: string; name: string }, season: number) => {
  const id = p.id ?? p.gsis;
  return id ? (
    <Link href={`/players/${id}?season=${season}`} className="font-medium text-ink hover:underline">
      {p.name}
    </Link>
  ) : (
    <span className="font-medium">{p.name}</span>
  );
};

export default async function GamePage({ params }: { params: Params }) {
  const { id } = await params;
  const game = await getGame(id);
  if (!game) notFound();

  const [seasonGames, data] = await Promise.all([getSeasonGames(game.season), getGameData(game)]);
  const weekGames = seasonGames.filter((g) => g.week === game.week);
  const live = liveFor(await getLiveScores(game.season, weekGames), game);
  const recs = computeRecords(seasonGames, "REG");
  const status = gameStatus({ game, live });
  const [as, hs] = scores({ game, live });
  const final = status.state === "post";
  const hasBox = data.away.players.length > 0 || data.home.players.length > 0;

  return (
    <div className="space-y-6">
      <ScoreHeader game={game} status={status} as={as} hs={hs} live={live} recs={recs} />

      {live?.state === "in" && (live.lastPlay || live.downDistance) && (
        <Card title="Live">
          {live.downDistance && <div className="font-semibold">{live.downDistance}{live.isRedZone && <span className="ml-2"><Badge tone="live">Red zone</Badge></span>}</div>}
          {live.lastPlay && <p className="mt-1 text-sm text-ink-2">Last play: {live.lastPlay}</p>}
        </Card>
      )}

      {live && live.awayLines.length > 0 && <Linescore game={game} away={live.awayLines} home={live.homeLines} />}

      {hasBox ? (
        <>
          <TeamComparison game={game} away={data.away} home={data.home} />
          <div className="grid gap-6 xl:grid-cols-2">
            <BoxScore game={game} d={data.away} />
            <BoxScore game={game} d={data.home} />
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <Advanced game={game} d={data.away} />
            <Advanced game={game} d={data.home} />
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <Snaps game={game} d={data.away} />
            <Snaps game={game} d={data.home} />
          </div>
        </>
      ) : (
        <Preview game={game} away={data.away} home={data.home} final={final} />
      )}
      <AutoRefresh active={status.state === "in"} />
    </div>
  );
}

function ScoreHeader({
  game,
  status,
  as,
  hs,
  live,
  recs,
}: {
  game: Game;
  status: ReturnType<typeof gameStatus>;
  as: number | null;
  hs: number | null;
  live: ReturnType<typeof liveFor>;
  recs: ReturnType<typeof computeRecords>;
}) {
  const side = (team: string, score: number | null, win: boolean, align: "l" | "r") => {
    const t = getTeam(team);
    const rec = recs.get(team);
    return (
      <div className={`flex flex-1 items-center gap-3 ${align === "r" ? "flex-row-reverse text-right" : ""}`}>
        <TeamLogo team={team} size={64} />
        <div className="min-w-0">
          <Link href={`/teams/${team}?season=${game.season}`} className="block text-lg font-bold leading-tight hover:underline sm:text-2xl">
            <span className="hidden sm:inline">{t?.location} </span>
            {t?.nick ?? team}
          </Link>
          {rec && <div className="text-xs text-muted">{fmtSplit(rec)} · {fmtSplit(align === "l" ? rec.away : rec.home)} {align === "l" ? "Away" : "Home"}</div>}
        </div>
        <div className={`tabular ml-auto text-4xl font-black sm:text-5xl ${align === "r" ? "ml-0 mr-auto" : ""} ${status.state === "post" && !win ? "text-muted" : "text-ink"}`}>
          {score ?? ""}
        </div>
      </div>
    );
  };
  const done = status.state === "post" && as !== null && hs !== null;
  return (
    <section className="rounded-lg border border-line bg-card p-4 shadow-sm sm:p-6">
      <div className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-muted">
        {weekLabel(game.week, game.gameType)} · {game.season}
        {game.divGame && " · Division game"}
        {game.neutral && " · Neutral site"}
      </div>
      <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center">
        {side(game.away, as, done && as! > hs!, "l")}
        <div className="shrink-0 text-center">
          <div className={`text-sm font-bold uppercase ${status.state === "in" ? "text-live" : "text-ink"}`}>{status.label}</div>
          {live?.broadcast && <div className="text-xs text-muted">{live.broadcast}</div>}
        </div>
        {side(game.home, hs, done && hs! > as!, "r")}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 border-t border-line pt-3 text-xs sm:grid-cols-4">
        <Info k="Stadium" v={game.stadium} />
        <Info k="Surface" v={[game.roof, game.surface].filter(Boolean).join(" · ")} />
        <Info k="Weather" v={game.temp !== null ? `${game.temp}°F${game.wind !== null ? `, wind ${game.wind} mph` : ""}` : game.roof === "dome" || game.roof === "closed" ? "Indoors" : "–"} />
        <Info k="Referee" v={game.referee || "–"} />
        <Info k="Line" v={game.spread !== null ? `${fmtSpread(game.spread, game.home, game.away)} · O/U ${game.total ?? "–"}` : "–"} />
        <Info k="Moneyline" v={game.awayMoneyline !== null ? `${game.away} ${fmtMoneyline(game.awayMoneyline)} / ${game.home} ${fmtMoneyline(game.homeMoneyline)}` : "–"} />
        <Info k="Coaches" v={`${game.awayCoach || "–"} / ${game.homeCoach || "–"}`} />
        <Info k="QBs" v={game.awayQb || game.homeQb ? `${game.awayQb || "–"} / ${game.homeQb || "–"}` : "–"} />
      </dl>
    </section>
  );
}

function Info({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-20 shrink-0 text-muted">{k}</dt>
      <dd className="truncate font-medium text-ink-2">{v || "–"}</dd>
    </div>
  );
}

function Linescore({ game, away, home }: { game: Game; away: number[]; home: number[] }) {
  const n = Math.max(away.length, home.length);
  const head = ["", ...Array.from({ length: n }, (_, i) => (i < 4 ? `Q${i + 1}` : "OT")), "T"];
  const row = (team: string, l: number[]) => [
    <span key="t" className="flex items-center gap-2 font-semibold">
      <TeamLogo team={team} size={18} />
      {team}
    </span>,
    ...Array.from({ length: n }, (_, i) => l[i] ?? "–"),
    <b key="tot">{l.reduce((a, b) => a + b, 0)}</b>,
  ];
  return (
    <Card title="Scoring by quarter">
      <SimpleTable head={head} rows={[row(game.away, away), row(game.home, home)]} />
    </Card>
  );
}

// ---------------------------------------------------------------- team comparison

function TeamComparison({ game, away, home }: { game: Game; away: GameTeamData; home: GameTeamData }) {
  const prs = (d: GameTeamData) => d.qbPressure.reduce((a, r) => a + (r.s.times_pressured ?? 0), 0);
  const blitzed = (d: GameTeamData) => d.qbPressure.reduce((a, r) => a + (r.s.times_blitzed ?? 0), 0);
  const v = (d: GameTeamData) => {
    const s = d.stats ?? {};
    const passNet = (s.passing_yards ?? 0) - sackYards(s);
    const rush = s.rushing_yards ?? 0;
    const db = (s.attempts ?? 0) + (s.sacks_suffered ?? 0);
    const plays = db + (s.carries ?? 0);
    const to = (s.passing_interceptions ?? 0) + (s.sack_fumbles_lost ?? 0) + (s.rushing_fumbles_lost ?? 0) + (s.receiving_fumbles_lost ?? 0);
    return {
      "Total yards": fmtValue(passNet + rush, "int"),
      "Net passing yards": fmtValue(passNet, "int"),
      "Comp / Att": `${s.completions ?? 0}/${s.attempts ?? 0}`,
      "Rushing yards": fmtValue(rush, "int"),
      "Rushes": fmtValue(s.carries ?? 0, "int"),
      "Total plays": fmtValue(plays, "int"),
      "Yards per play": fmtValue(plays ? (passNet + rush) / plays : null, "dec1"),
      "First downs": fmtValue((s.passing_first_downs ?? 0) + (s.rushing_first_downs ?? 0), "int"),
      "EPA per play": fmtValue(plays ? ((s.passing_epa ?? 0) + (s.rushing_epa ?? 0)) / plays : null, "signed2"),
      "EPA per dropback": fmtValue(db ? (s.passing_epa ?? 0) / db : null, "signed2"),
      "EPA per rush": fmtValue(s.carries ? (s.rushing_epa ?? 0) / s.carries : null, "signed2"),
      "Sacks allowed": `${s.sacks_suffered ?? 0}-${sackYards(s)}`,
      "QB pressured (PFR)": d.qbPressure.length ? `${prs(d)} (${fmtValue(db ? prs(d) / db : null, "pct")})` : "–",
      "QB blitzed (PFR)": d.qbPressure.length ? String(blitzed(d)) : "–",
      Turnovers: String(to),
      Penalties: `${s.penalties ?? 0}-${s.penalty_yards ?? 0}`,
    } as Record<string, string>;
  };
  const a = v(away);
  const h = v(home);
  return (
    <Card title="Team stats">
      <SimpleTable
        head={[
          "",
          <span key="a" className="inline-flex items-center gap-1.5"><TeamLogo team={game.away} size={16} />{game.away}</span>,
          <span key="h" className="inline-flex items-center gap-1.5"><TeamLogo team={game.home} size={16} />{game.home}</span>,
        ]}
        rows={Object.keys(a).map((k) => [<span key={k} className="text-ink-2">{k}</span>, a[k], h[k]])}
      />
    </Card>
  );
}

// ---------------------------------------------------------------- box score

function BoxScore({ game, d }: { game: Game; d: GameTeamData }) {
  const s = game.season;
  const passers = d.players.filter((p) => p.s.attempts).sort((a, b) => b.s.attempts - a.s.attempts);
  const rushers = d.players.filter((p) => p.s.carries).sort((a, b) => b.s.rushing_yards - a.s.rushing_yards);
  const receivers = d.players.filter((p) => p.s.targets).sort((a, b) => b.s.receiving_yards - a.s.receiving_yards);
  const tk = (p: PlayerWeek) => (p.s.def_tackles_solo ?? 0) + (p.s.def_tackle_assists ?? 0);
  const defenders = d.players
    .filter((p) => tk(p) || p.s.def_sacks || p.s.def_interceptions || p.s.def_pass_defended)
    .sort((a, b) => tk(b) - tk(a));
  const kickers = d.players.filter((p) => p.s.fg_att || p.s.pat_att);

  return (
    <Card title={<span className="inline-flex items-center gap-2"><TeamLogo team={d.team} size={20} />{getTeam(d.team)?.name} box score</span>}>
      <div className="space-y-5">
        <Section title="Passing">
          <SimpleTable
            head={["Player", "C/ATT", "YDS", "AVG", "TD", "INT", "SACKS", "RTG", "EPA"]}
            rows={passers.map((p) => [
              pLink(p, s),
              `${p.s.completions}/${p.s.attempts}`,
              p.s.passing_yards,
              fmtValue(p.s.passing_yards / p.s.attempts, "dec1"),
              p.s.passing_tds,
              p.s.passing_interceptions,
              `${p.s.sacks_suffered ?? 0}-${sackYards(p.s)}`,
              fmtValue(passerRating(p.s.completions, p.s.attempts, p.s.passing_yards, p.s.passing_tds, p.s.passing_interceptions), "dec1"),
              fmtValue(p.s.passing_epa ?? null, "signed1"),
            ])}
          />
        </Section>
        <Section title="Rushing">
          <SimpleTable
            head={["Player", "CAR", "YDS", "AVG", "TD", "1D", "EPA"]}
            rows={rushers.map((p) => [
              pLink(p, s),
              p.s.carries,
              p.s.rushing_yards,
              fmtValue(p.s.rushing_yards / p.s.carries, "dec1"),
              p.s.rushing_tds,
              p.s.rushing_first_downs ?? 0,
              fmtValue(p.s.rushing_epa ?? null, "signed1"),
            ])}
          />
        </Section>
        <Section title="Receiving">
          <SimpleTable
            head={["Player", "TGT", "REC", "YDS", "AVG", "TD", "YAC", "AIR", "EPA"]}
            rows={receivers.map((p) => [
              pLink(p, s),
              p.s.targets,
              p.s.receptions,
              p.s.receiving_yards,
              fmtValue(p.s.receptions ? p.s.receiving_yards / p.s.receptions : null, "dec1"),
              p.s.receiving_tds,
              p.s.receiving_yards_after_catch ?? 0,
              p.s.receiving_air_yards ?? 0,
              fmtValue(p.s.receiving_epa ?? null, "signed1"),
            ])}
          />
        </Section>
        <Section title="Defense">
          <SimpleTable
            head={["Player", "TOT", "SOLO", "TFL", "SACK", "QBH", "PD", "INT", "FF"]}
            rows={defenders.map((p) => [
              pLink(p, s),
              tk(p),
              p.s.def_tackles_solo ?? 0,
              p.s.def_tackles_for_loss ?? 0,
              p.s.def_sacks ?? 0,
              p.s.def_qb_hits ?? 0,
              p.s.def_pass_defended ?? 0,
              p.s.def_interceptions ?? 0,
              p.s.def_fumbles_forced ?? 0,
            ])}
          />
        </Section>
        {kickers.length > 0 && (
          <Section title="Kicking">
            <SimpleTable
              head={["Player", "FG", "LNG", "XP", "PTS"]}
              rows={kickers.map((p) => [
                pLink(p, s),
                `${p.s.fg_made ?? 0}/${p.s.fg_att ?? 0}`,
                p.s.fg_long || "–",
                `${p.s.pat_made ?? 0}/${p.s.pat_att ?? 0}`,
                (p.s.fg_made ?? 0) * 3 + (p.s.pat_made ?? 0),
              ])}
            />
          </Section>
        )}
      </div>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">{title}</h3>
      {children}
    </div>
  );
}

function Advanced({ game, d }: { game: Game; d: GameTeamData }) {
  const s = game.season;
  const rushers = d.passRush
    .filter((r) => r.s.def_pressures || r.s.def_times_blitzed || r.s.def_sacks || r.s.def_missed_tackles)
    .sort((a, b) => (b.s.def_pressures ?? 0) - (a.s.def_pressures ?? 0));
  const cover = d.passRush.filter((r) => r.s.def_targets).sort((a, b) => (b.s.def_targets ?? 0) - (a.s.def_targets ?? 0));
  return (
    <Card title={<span className="inline-flex items-center gap-2"><TeamLogo team={d.team} size={20} />{d.team} advanced (PFR charting)</span>}>
      {!d.passRush.length && !d.qbPressure.length ? (
        <Empty>Charting data is typically published a few days after the game.</Empty>
      ) : (
        <div className="space-y-5">
          {d.qbPressure.length > 0 && (
            <Section title="Quarterback under pressure">
              <SimpleTable
                head={["Player", "PRS", "PRS%", "BLTZ", "HURR", "HIT", "SACK", "BAD", "DROPS"]}
                rows={d.qbPressure.map((r) => [
                  pLink({ name: r.name, gsis: r.gsis }, s),
                  r.s.times_pressured ?? 0,
                  fmtValue(r.s.times_pressured_pct ?? null, "pct"),
                  r.s.times_blitzed ?? 0,
                  r.s.times_hurried ?? 0,
                  r.s.times_hit ?? 0,
                  r.s.times_sacked ?? 0,
                  r.s.passing_bad_throws ?? 0,
                  r.s.passing_drops ?? 0,
                ])}
              />
            </Section>
          )}
          <Section title="Pass rush & tackling">
            <SimpleTable
              head={["Player", "PRS", "HURR", "HITS", "SACK", "BLTZ", "COMB", "MISS"]}
              rows={rushers.map((r) => [
                pLink({ name: r.name, gsis: r.gsis }, s),
                <b key="p">{r.s.def_pressures ?? 0}</b>,
                r.s.def_times_hurried ?? 0,
                r.s.def_times_hitqb ?? 0,
                r.s.def_sacks ?? 0,
                r.s.def_times_blitzed ?? 0,
                r.s.def_tackles_combined ?? 0,
                r.s.def_missed_tackles ?? 0,
              ])}
            />
          </Section>
          {cover.length > 0 && (
            <Section title="Coverage">
              <SimpleTable
                head={["Player", "TGT", "CMP", "YDS", "TD", "INT", "RTG"]}
                rows={cover.map((r) => [
                  pLink({ name: r.name, gsis: r.gsis }, s),
                  r.s.def_targets ?? 0,
                  r.s.def_completions_allowed ?? 0,
                  r.s.def_yards_allowed ?? 0,
                  r.s.def_receiving_td_allowed ?? 0,
                  r.s.def_ints ?? 0,
                  fmtValue(r.s.def_passer_rating_allowed ?? null, "dec1"),
                ])}
              />
            </Section>
          )}
        </div>
      )}
    </Card>
  );
}

function Snaps({ game, d }: { game: Game; d: GameTeamData }) {
  const s = game.season;
  const off = d.snaps.filter((r) => r.off > 0).sort((a, b) => b.off - a.off);
  const def = d.snaps.filter((r) => r.def > 0).sort((a, b) => b.def - a.def);
  const pct = (v: number) => (
    <span className="inline-flex items-center justify-end gap-2">
      <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-card-2 sm:inline-block">
        <span className="block h-full rounded-full" style={{ width: `${Math.min(100, v * 100)}%`, background: "var(--series-1)" }} />
      </span>
      {fmtValue(v, "pct")}
    </span>
  );
  return (
    <Card title={<span className="inline-flex items-center gap-2"><TeamLogo team={d.team} size={20} />{d.team} snap counts</span>}>
      {!d.snaps.length ? (
        <Empty>Snap counts are not available for this game yet.</Empty>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <Section title={`Offense${d.teamSnaps?.off ? ` · ${d.teamSnaps.off} snaps` : ""}`}>
            <SimpleTable head={["Player", "POS", "SNAPS", "%"]} rows={off.map((r) => [pLink({ name: r.name, gsis: r.gsis }, s), r.pos, r.off, pct(r.offPct)])} />
          </Section>
          <Section title={`Defense${d.teamSnaps?.def ? ` · ${d.teamSnaps.def} snaps` : ""}`}>
            <SimpleTable head={["Player", "POS", "SNAPS", "%"]} rows={def.map((r) => [pLink({ name: r.name, gsis: r.gsis }, s), r.pos, r.def, pct(r.defPct)])} />
          </Section>
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- preview (game not yet played)

async function Preview({ game, away, home, final }: { game: Game; away: GameTeamData; home: GameTeamData; final: boolean }) {
  const stats = await getTeamSeasonStats({ season: game.season, type: "REG", weekFrom: null, weekTo: game.week - 1 || null, team: null });
  const a = stats.get(game.away);
  const h = stats.get(game.home);
  const rows: [string, keyof TeamSeason, Parameters<typeof fmtValue>[1]][] = [
    ["Points per game", "ppg", "dec1"],
    ["Points allowed per game", "papg", "dec1"],
    ["Yards per game", "ypg", "dec1"],
    ["Yards allowed per game", "yapg", "dec1"],
    ["Offensive EPA / play", "offEpa", "signed2"],
    ["Defensive EPA / play", "defEpa", "signed2"],
    ["Pass EPA / dropback", "passEpa", "signed2"],
    ["Rush EPA / carry", "rushEpa", "signed2"],
    ["Pressure rate (defense)", "prsPct", "pct"],
    ["Pressure rate allowed", "prsAllowedPct", "pct"],
    ["Blitz rate", "blitzPct", "pct"],
    ["Sacks", "sacks", "int"],
    ["Turnover differential", "toDiff", "int"],
  ];
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title={final ? "Season comparison" : "Matchup preview (season to date)"}>
        <SimpleTable
          head={["", game.away, game.home]}
          rows={rows.map(([label, key, fmt]) => [
            <span key={label} className="text-ink-2">{label}</span>,
            fmtValue((a?.[key] as number) ?? null, fmt),
            fmtValue((h?.[key] as number) ?? null, fmt),
          ])}
        />
      </Card>
      <Card title="Injury report">
        {[away, home].map((d) => (
          <div key={d.team} className="mb-4 last:mb-0">
            <h3 className="mb-1 flex items-center gap-2 text-sm font-bold"><TeamLogo team={d.team} size={18} />{d.team}</h3>
            {d.injuries.length ? (
              <SimpleTable
                head={["Player", "POS", "Injury", "Status"]}
                align={["l", "l", "l", "r"]}
                rows={d.injuries.map((i) => [
                  pLink({ name: i.name, id: i.id }, game.season),
                  i.pos,
                  i.injury || "–",
                  <Badge key="s" tone={i.status === "Out" ? "bad" : "neutral"}>{i.status}</Badge>,
                ])}
              />
            ) : (
              <p className="text-sm text-muted">No players listed.</p>
            )}
          </div>
        ))}
      </Card>
    </div>
  );
}
