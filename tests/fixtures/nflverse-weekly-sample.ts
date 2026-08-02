export type HistoricalWeekFixture = {
  season: number;
  week: number;
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  opponent: string;
  fantasyPointsPpr: number;
};

export const NFLVERSE_FIXTURE_METADATA = {
  source: "nflverse weekly player stats",
  sourceUrl:
    "https://github.com/nflverse/nflverse-data/releases/tag/stats_player",
  license: "CC-BY-4.0; underlying data remains subject to its owners' terms",
  retrievedAt: "2026-08-02",
  seasons: [2023, 2024],
  note: "Recorded minimal fixture containing only fields required for leakage-safe tests.",
} as const;

const PLAYERS = {
  allen: ["00-0034857", "Josh Allen", "QB"],
  mahomes: ["00-0033873", "Patrick Mahomes", "QB"],
  cook: ["00-0037248", "James Cook", "RB"],
  pacheco: ["00-0037197", "Isiah Pacheco", "RB"],
  diggs: ["00-0031588", "Stefon Diggs", "WR"],
  rice: ["00-0039067", "Rashee Rice", "WR"],
} as const;

type CompactRow = [
  season: number,
  week: number,
  player: keyof typeof PLAYERS,
  team: string,
  opponent: string,
  points: number,
];

const ROWS: CompactRow[] = [
  [2023, 1, "allen", "BUF", "NYJ", 9.04],
  [2023, 1, "mahomes", "KC", "DET", 19.54],
  [2023, 1, "cook", "BUF", "NYJ", 10.3],
  [2023, 1, "pacheco", "KC", "DET", 9.4],
  [2023, 1, "diggs", "BUF", "NYJ", 26.2],
  [2023, 1, "rice", "KC", "DET", 11.6],
  [2023, 2, "allen", "BUF", "LV", 23.66],
  [2023, 2, "mahomes", "KC", "JAX", 21.2],
  [2023, 2, "cook", "BUF", "LV", 19.9],
  [2023, 2, "pacheco", "KC", "JAX", 8],
  [2023, 2, "diggs", "BUF", "LV", 13.6],
  [2023, 2, "rice", "KC", "JAX", 4],
  [2023, 3, "allen", "BUF", "WAS", 21.32],
  [2023, 3, "mahomes", "KC", "CHI", 25.68],
  [2023, 3, "cook", "BUF", "WAS", 13.2],
  [2023, 3, "pacheco", "KC", "CHI", 15.8],
  [2023, 3, "diggs", "BUF", "WAS", 19.1],
  [2023, 3, "rice", "KC", "CHI", 10.9],
  [2023, 4, "allen", "BUF", "MIA", 36.5],
  [2023, 4, "mahomes", "KC", "NYJ", 13.22],
  [2023, 4, "cook", "BUF", "MIA", 14.7],
  [2023, 4, "pacheco", "KC", "NYJ", 24.8],
  [2023, 4, "diggs", "BUF", "MIA", 36],
  [2023, 4, "rice", "KC", "NYJ", 6.2],
  [2023, 5, "allen", "BUF", "JAX", 27.76],
  [2023, 5, "mahomes", "KC", "MIN", 19.24],
  [2023, 5, "cook", "BUF", "JAX", 5.1],
  [2023, 5, "pacheco", "KC", "MIN", 13.4],
  [2023, 5, "diggs", "BUF", "JAX", 24.1],
  [2023, 5, "rice", "KC", "MIN", 13.3],
  [2023, 6, "allen", "BUF", "NYG", 13.86],
  [2023, 6, "mahomes", "KC", "DEN", 17.34],
  [2023, 6, "cook", "BUF", "NYG", 7.1],
  [2023, 6, "pacheco", "KC", "DEN", 15.8],
  [2023, 6, "diggs", "BUF", "NYG", 20],
  [2023, 6, "rice", "KC", "DEN", 11.2],
  [2024, 1, "allen", "BUF", "ARI", 31.18],
  [2024, 1, "mahomes", "KC", "BAL", 15.14],
  [2024, 1, "cook", "BUF", "ARI", 13.3],
  [2024, 1, "pacheco", "KC", "BAL", 15.8],
  [2024, 1, "diggs", "HOU", "IND", 21.9],
  [2024, 1, "rice", "KC", "BAL", 17.3],
  [2024, 2, "allen", "BUF", "MIA", 9.76],
  [2024, 2, "mahomes", "KC", "CIN", 12.94],
  [2024, 2, "cook", "BUF", "MIA", 28.5],
  [2024, 2, "pacheco", "KC", "CIN", 16.1],
  [2024, 2, "diggs", "HOU", "CHI", 7.7],
  [2024, 2, "rice", "KC", "CIN", 18.5],
  [2024, 3, "allen", "BUF", "JAX", 30.92],
  [2024, 3, "mahomes", "KC", "ATL", 16.38],
  [2024, 3, "cook", "BUF", "JAX", 18.7],
  [2024, 3, "diggs", "HOU", "MIN", 19.92],
  [2024, 3, "rice", "KC", "ATL", 29.1],
  [2024, 4, "allen", "BUF", "BAL", 7.3],
  [2024, 4, "mahomes", "KC", "LAC", 13],
  [2024, 4, "cook", "BUF", "BAL", 5.8],
  [2024, 4, "diggs", "HOU", "JAX", 18.5],
  [2024, 4, "rice", "KC", "LAC", 0],
  [2024, 5, "allen", "BUF", "HOU", 14.64],
  [2024, 5, "mahomes", "KC", "NO", 13.44],
  [2024, 5, "cook", "BUF", "HOU", 17.9],
  [2024, 5, "diggs", "HOU", "BUF", 14.2],
  [2024, 6, "allen", "BUF", "NYJ", 24.4],
  [2024, 6, "diggs", "HOU", "NE", 19.7],
];

export const NFLVERSE_WEEKLY_SAMPLE: HistoricalWeekFixture[] = ROWS.map(
  ([season, week, key, team, opponent, fantasyPointsPpr]) => {
    const [playerId, playerName, position] = PLAYERS[key];
    return {
      season,
      week,
      playerId,
      playerName,
      position,
      team,
      opponent,
      fantasyPointsPpr,
    };
  },
);
