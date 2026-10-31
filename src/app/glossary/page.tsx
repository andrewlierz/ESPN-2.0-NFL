import type { Metadata } from "next";
import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Stat Glossary" };

const SECTIONS: { title: string; source: string; terms: [string, string][] }[] = [
  {
    title: "Pass rush & pressure",
    source: "Pro Football Reference charting via nflverse",
    terms: [
      ["Pressure (PRS)", "Any play where a defender hurried, knocked down or sacked the quarterback. PFR counts pressures = hurries + QB knockdowns + sacks."],
      ["Hurry (HURR)", "The defender forced the quarterback to throw early or move off his spot."],
      ["QB knockdown / hit (HITS)", "The quarterback was hit to the ground after releasing the ball."],
      ["Blitz (BLTZ)", "For a defender: times rushing the passer from a non-traditional rush position. For a quarterback: dropbacks where the defense blitzed."],
      ["Pressures per 100 snaps (PRS/100)", "Pressures divided by all defensive snaps, times 100. An approximate pressure rate: true pass-rush snaps are not published, so this understates the rate for players who drop into coverage often."],
      ["Pressure rate (PRS%)", "For quarterbacks and teams: times pressured divided by dropbacks (pass attempts + sacks)."],
      ["Sack conversion (SK/PRS)", "Share of pressures that ended in a sack."],
    ],
  },
  {
    title: "Coverage & tackling",
    source: "Pro Football Reference charting via nflverse",
    terms: [
      ["Targets (TGT)", "Passes thrown at receivers the defender was charted as covering."],
      ["Passer rating allowed (RTG)", "NFL passer rating computed from completions, yards, touchdowns and interceptions allowed on those targets."],
      ["aDOT allowed", "Average depth of target, in air yards, on passes thrown into the defender's coverage."],
      ["Missed tackle rate (MISS%)", "Missed tackles divided by (combined tackles + missed tackles)."],
    ],
  },
  {
    title: "Efficiency (EPA & CPOE)",
    source: "nflfastR models via nflverse",
    terms: [
      ["EPA", "Expected points added: the change in expected points from before to after a play, based on down, distance, field position and time. Positive is good for the offense."],
      ["EPA / dropback, EPA / play", "Total EPA divided by dropbacks (attempts + sacks) or by all plays (dropbacks + rushes)."],
      ["CPOE", "Completion percentage over expected, using nflfastR's completion probability model (accounts for depth, location and situation)."],
      ["ANY/A", "Adjusted net yards per attempt: (pass yards + 20×TD − 45×INT − sack yards) / (attempts + sacks)."],
      ["PACR", "Passing air conversion ratio: passing yards per air yard thrown."],
      ["RACR", "Receiver air conversion ratio: receiving yards per air yard targeted."],
      ["Target share / Air yards share", "Share of the team's targets (or air yards) in games the player played."],
      ["WOPR", "Weighted opportunity rating: 1.5 × target share + 0.7 × air yards share. A receiving-opportunity measure."],
    ],
  },
  {
    title: "Next Gen Stats (player tracking)",
    source: "NFL Next Gen Stats via nflverse",
    terms: [
      ["Time to throw (TTT)", "Average seconds from snap to throw."],
      ["Aggressiveness (AGGR%)", "Share of attempts into tight windows (a defender within 1 yard at the catch point)."],
      ["Air yards to sticks (AYTS)", "Average air yards beyond (or short of) the first-down marker on attempts."],
      ["Expected completion % (xCMP%)", "NGS model probability of completion, averaged over attempts."],
      ["Separation (SEP)", "Average yards between receiver and nearest defender when the ball arrives."],
      ["Cushion (CUSH)", "Average yards between receiver and nearest defender at the snap."],
      ["YAC above expectation (YAC+)", "Yards after catch beyond what the NGS model expected, per reception."],
      ["Rush yards over expected (RYOE)", "Rushing yards beyond the NGS expected-yards model, which accounts for blockers and defenders at handoff."],
      ["8+ box %", "Share of carries against eight or more defenders in the box."],
      ["Time to LOS (TLOS)", "Average seconds a runner spends behind the line of scrimmage."],
      ["Efficiency (EFF)", "Total distance traveled divided by rushing yards gained. Lower means a more north-south runner."],
    ],
  },
  {
    title: "Rushing & receiving charting",
    source: "Pro Football Reference charting via nflverse",
    terms: [
      ["Yards before contact (YBC/A)", "Average rushing yards gained before first contact by a defender."],
      ["Yards after contact (YAC/A)", "Average rushing yards gained after first contact."],
      ["Broken tackles (BRK)", "Tackle attempts the ball carrier broke."],
      ["Drops / drop %", "Catchable passes dropped, per target (receivers) or per attempt (passers)."],
      ["Bad throws (BAD%)", "Inaccurate passes per attempt, as charted by PFR."],
    ],
  },
  {
    title: "Snap counts",
    source: "Pro Football Reference snap counts via nflverse",
    terms: [
      ["OFF / DEF / ST", "Snaps played on offense, defense and special teams."],
      ["Snap share (%)", "Player snaps divided by team snaps. Leaderboards use games the player appeared in; team snap pages use all completed games."],
    ],
  },
];

export default function GlossaryPage() {
  return (
    <div>
      <PageHeader title="Stat Glossary" subtitle="What the advanced numbers mean and where they come from." />
      <div className="grid gap-6 lg:grid-cols-2">
        {SECTIONS.map((s) => (
          <Card key={s.title} title={s.title}>
            <p className="mb-3 text-xs text-muted">Source: {s.source}</p>
            <dl className="space-y-3">
              {s.terms.map(([t, d]) => (
                <div key={t}>
                  <dt className="text-sm font-bold text-ink">{t}</dt>
                  <dd className="text-sm text-ink-2">{d}</dd>
                </div>
              ))}
            </dl>
          </Card>
        ))}
      </div>
      <p className="mt-6 text-sm text-ink-2">
        Data is published by the{" "}
        <a href="https://github.com/nflverse/nflverse-data" className="text-link underline" target="_blank" rel="noreferrer">
          nflverse
        </a>{" "}
        project and refreshed throughout the season (PFR charting usually lands a few days after each game). Explore it all on the{" "}
        <Link href="/stats?cat=pass-rush" className="text-link underline">
          stats page
        </Link>
        .
      </p>
    </div>
  );
}
