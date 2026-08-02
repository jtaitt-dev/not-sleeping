import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Navigate, Route, Routes } from "react-router";

import { AppShell, MoreWorkspace } from "@/components/app-shell";
import { RootProviders } from "@/components/root-providers";
import { DraftWorkspace } from "@/features/draft/draft-workspace";
import {
  AuctionWorkspace,
  ChoppedSurvivalWorkspace,
  DeadlineWorkspace,
  DynastyCenterWorkspace,
  IdpWorkspace,
  LeaguesWorkspace,
  MatchupCenterWorkspace,
  MockDraftLabWorkspace,
  ResearchWorkspace,
  RookieCenterWorkspace,
  StartSitWorkspace,
  TaxiSquadWorkspace,
  TodayWorkspace,
  TradeCenterWorkspace,
  WaiverWireWorkspace,
} from "@/features/season/full-season-workspaces";
import {
  AboutWorkspace,
  CompareWorkspace,
  DataCenterWorkspace,
  DiagnosticsWorkspace,
  PlayersWorkspace,
  RankingsWorkspace,
  SettingsWorkspace,
  TeamWorkspace,
  UsageWorkspace,
  WatchlistWorkspace,
} from "@/features/workspaces/all-workspaces";
import "@/styles/globals.css";

function SidePanelApp() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/today" replace />} />
          <Route path="/today" element={<TodayWorkspace />} />
          <Route path="/leagues" element={<LeaguesWorkspace />} />
          <Route path="/draft" element={<DraftWorkspace />} />
          <Route path="/mock-draft" element={<MockDraftLabWorkspace />} />
          <Route path="/start-sit" element={<StartSitWorkspace />} />
          <Route path="/matchup" element={<MatchupCenterWorkspace />} />
          <Route path="/chopped" element={<ChoppedSurvivalWorkspace />} />
          <Route path="/waivers" element={<WaiverWireWorkspace />} />
          <Route path="/players" element={<PlayersWorkspace />} />
          <Route path="/team" element={<TeamWorkspace />} />
          <Route path="/dynasty" element={<DynastyCenterWorkspace />} />
          <Route path="/trade" element={<TradeCenterWorkspace />} />
          <Route path="/rookie" element={<RookieCenterWorkspace />} />
          <Route path="/taxi" element={<TaxiSquadWorkspace />} />
          <Route path="/idp" element={<IdpWorkspace />} />
          <Route path="/auction" element={<AuctionWorkspace />} />
          <Route path="/research" element={<ResearchWorkspace />} />
          <Route path="/calendar" element={<DeadlineWorkspace />} />
          <Route path="/watchlist" element={<WatchlistWorkspace />} />
          <Route path="/more" element={<MoreWorkspace />} />
          <Route path="/compare" element={<CompareWorkspace />} />
          <Route path="/rankings" element={<RankingsWorkspace />} />
          <Route path="/data-center" element={<DataCenterWorkspace />} />
          <Route path="/usage" element={<UsageWorkspace />} />
          <Route path="/settings" element={<SettingsWorkspace />} />
          <Route path="/diagnostics" element={<DiagnosticsWorkspace />} />
          <Route path="/about" element={<AboutWorkspace />} />
          <Route path="*" element={<Navigate to="/today" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

const root = document.querySelector<HTMLDivElement>("#root");
if (!root) throw new Error("Side panel root element was not found.");

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <RootProviders>
      <SidePanelApp />
    </RootProviders>
  </React.StrictMode>,
);
