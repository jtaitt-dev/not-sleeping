import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";

import { AppShell, MoreWorkspace } from "@/components/app-shell";
import { RootProviders } from "@/components/root-providers";
import { DraftWorkspace } from "@/features/draft/draft-workspace";
import {
  AboutWorkspace,
  CompareWorkspace,
  DataCenterWorkspace,
  DiagnosticsWorkspace,
  DynastyWorkspace,
  PlayersWorkspace,
  RankingsWorkspace,
  SettingsWorkspace,
  TeamWorkspace,
  TradeWorkspace,
  UsageWorkspace,
  WatchlistWorkspace,
} from "@/features/workspaces/all-workspaces";
import "@/styles/globals.css";

function SidePanelApp() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/draft" replace />} />
          <Route path="/draft" element={<DraftWorkspace />} />
          <Route path="/players" element={<PlayersWorkspace />} />
          <Route path="/team" element={<TeamWorkspace />} />
          <Route path="/dynasty" element={<DynastyWorkspace />} />
          <Route path="/trade" element={<TradeWorkspace />} />
          <Route path="/watchlist" element={<WatchlistWorkspace />} />
          <Route path="/more" element={<MoreWorkspace />} />
          <Route path="/compare" element={<CompareWorkspace />} />
          <Route path="/rankings" element={<RankingsWorkspace />} />
          <Route path="/data-center" element={<DataCenterWorkspace />} />
          <Route path="/usage" element={<UsageWorkspace />} />
          <Route path="/settings" element={<SettingsWorkspace />} />
          <Route path="/diagnostics" element={<DiagnosticsWorkspace />} />
          <Route path="/about" element={<AboutWorkspace />} />
          <Route path="*" element={<Navigate to="/draft" replace />} />
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
