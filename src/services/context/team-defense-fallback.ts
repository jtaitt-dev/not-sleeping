import { normalizePlayerName } from "@/services/ranking/identity";
import type { Player } from "@/types/domain";

const NFL_TEAM_DEFENSES: ReadonlyArray<readonly [string, string]> = [
  ["ARI", "Arizona Cardinals"],
  ["ATL", "Atlanta Falcons"],
  ["BAL", "Baltimore Ravens"],
  ["BUF", "Buffalo Bills"],
  ["CAR", "Carolina Panthers"],
  ["CHI", "Chicago Bears"],
  ["CIN", "Cincinnati Bengals"],
  ["CLE", "Cleveland Browns"],
  ["DAL", "Dallas Cowboys"],
  ["DEN", "Denver Broncos"],
  ["DET", "Detroit Lions"],
  ["GB", "Green Bay Packers"],
  ["HOU", "Houston Texans"],
  ["IND", "Indianapolis Colts"],
  ["JAX", "Jacksonville Jaguars"],
  ["KC", "Kansas City Chiefs"],
  ["LAC", "Los Angeles Chargers"],
  ["LAR", "Los Angeles Rams"],
  ["LV", "Las Vegas Raiders"],
  ["MIA", "Miami Dolphins"],
  ["MIN", "Minnesota Vikings"],
  ["NE", "New England Patriots"],
  ["NO", "New Orleans Saints"],
  ["NYG", "New York Giants"],
  ["NYJ", "New York Jets"],
  ["PHI", "Philadelphia Eagles"],
  ["PIT", "Pittsburgh Steelers"],
  ["SEA", "Seattle Seahawks"],
  ["SF", "San Francisco 49ers"],
  ["TB", "Tampa Bay Buccaneers"],
  ["TEN", "Tennessee Titans"],
  ["WAS", "Washington Commanders"],
];

export function mergeTeamDefenseFallback(players: Player[]): Player[] {
  const defenses = NFL_TEAM_DEFENSES.map(([id, fullName]): Player => ({
    id,
    sleeperId: id,
    firstName: fullName.split(" ")[0] ?? "",
    lastName: fullName.split(" ").slice(1).join(" "),
    fullName,
    normalizedName: normalizePlayerName(fullName),
    position: "DEF",
    team: id,
    status: "active",
    fantasyPositions: ["DEF"],
  }));

  return [
    ...new Map(
      [...defenses, ...players].map((player) => [player.id, player]),
    ).values(),
  ];
}
