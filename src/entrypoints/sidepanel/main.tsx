import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Navigate, Route, Routes } from "react-router";

import { AppShell, MoreWorkspace } from "@/components/app-shell";
import { StatusBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { RootProviders } from "@/components/root-providers";
import { DraftWorkspace } from "@/features/draft/draft-workspace";
import { LeagueMockDraftWorkspace } from "@/features/draft/league-mock-draft-workspace";
import { useAdvancedResearchAccess } from "@/features/research/advanced-research-access";
import {
  AuctionWorkspace,
  ChoppedSurvivalWorkspace,
  DeadlineWorkspace,
  DynastyCenterWorkspace,
  IdpWorkspace,
  LeaguesWorkspace,
  MatchupCenterWorkspace,
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

const ManualOddsResearchWorkspace = lazy(
  () => import("@/features/research/manual-odds-workspace"),
);

function AdvancedResearchWorkspace() {
  const access = useAdvancedResearchAccess();
  if (!access.ready) {
    return <p role="status">Loading advanced research safeguards…</p>;
  }
  if (!access.enabled) {
    return (
      <section className="workspace-page labs-workspace">
        <header className="workspace-heading">
          <div>
            <h1>Advanced Research</h1>
            <p>Optional educational analysis, disabled by default.</p>
          </div>
          <StatusBadge tone="warning">Locked</StatusBadge>
        </header>
        <article className="labs-gate">
          <div>
            <h2>Explicit opt-in required</h2>
            <p>
              Acknowledgement and enablement are both required before manual
              odds research is available. This feature provides information, not
              wagering or financial advice.
            </p>
            <Button onClick={() => void chrome.runtime.openOptionsPage()}>
              Review advanced research settings
            </Button>
          </div>
        </article>
      </section>
    );
  }
  return (
    <Suspense fallback={<p>Loading advanced research…</p>}>
      <ManualOddsResearchWorkspace />
    </Suspense>
  );
}

function SidePanelApp() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/today" replace />} />
          <Route path="/today" element={<TodayWorkspace />} />
          <Route path="/leagues" element={<LeaguesWorkspace />} />
          <Route path="/draft" element={<DraftWorkspace />} />
          <Route path="/mock-draft" element={<LeagueMockDraftWorkspace />} />
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
          <Route
            path="/advanced-research"
            element={<AdvancedResearchWorkspace />}
          />
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
