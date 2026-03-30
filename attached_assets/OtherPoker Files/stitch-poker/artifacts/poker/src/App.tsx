import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { Home } from "@/pages/home";
import { Clubs } from "@/pages/clubs";
import { ClubCreate } from "@/pages/club-create";
import { ClubDetail } from "@/pages/club-detail";
import { Tournaments } from "@/pages/tournaments";
import { TournamentCreate } from "@/pages/tournament-create";
import { TableSetup } from "@/pages/table-setup";
import { PokerTable } from "@/pages/poker-table";
import { Profile } from "@/pages/profile";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/clubs" component={Clubs} />
      <Route path="/clubs/new" component={ClubCreate} />
      <Route path="/clubs/:id" component={ClubDetail} />
      <Route path="/tournaments" component={Tournaments} />
      <Route path="/tournaments/new" component={TournamentCreate} />
      <Route path="/table/new" component={TableSetup} />
      <Route path="/table/:id" component={PokerTable} />
      <Route path="/profile" component={Profile} />
      {/* 404 Route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
