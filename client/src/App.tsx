import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import Game from "@/pages/Game";
import Landing from "@/pages/Landing";
import Lobby from "@/pages/Lobby";
import Members from "@/pages/Members";
import Shop from "@/pages/Shop";
import ClubDashboard from "@/pages/ClubDashboard";
import ClubSettings from "@/pages/ClubSettings";
import ClubInvitations from "@/pages/ClubInvitations";
import Leagues from "@/pages/Leagues";
import Analytics from "@/pages/Analytics";
import HandReplay from "@/pages/HandReplay";
import NotFound from "@/pages/not-found";
import { AuthGate } from "@/components/auth/AuthGate";

function ProtectedLobby() {
  return <AuthGate><Lobby /></AuthGate>;
}

function ProtectedMembers() {
  return <AuthGate><Members /></AuthGate>;
}

function ProtectedShop() {
  return <AuthGate><Shop /></AuthGate>;
}

function ProtectedClub() {
  return <AuthGate><ClubDashboard /></AuthGate>;
}

function ProtectedClubSettings() {
  return <AuthGate><ClubSettings /></AuthGate>;
}

function ProtectedClubInvitations() {
  return <AuthGate><ClubInvitations /></AuthGate>;
}

function ProtectedLeagues() {
  return <AuthGate><Leagues /></AuthGate>;
}

function ProtectedAnalytics() {
  return <AuthGate><Analytics /></AuthGate>;
}

function GameWithTable({ params }: { params: { tableId: string } }) {
  return <AuthGate><Game tableId={params.tableId} /></AuthGate>;
}

function HandReplayPage({ params }: { params: { handId: string } }) {
  return <AuthGate><HandReplay handId={params.handId} /></AuthGate>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/game">{() => <Game />}</Route>
      <Route path="/game/:tableId">{(params) => <GameWithTable params={params} />}</Route>
      <Route path="/hands/:handId">{(params) => <HandReplayPage params={params} />}</Route>
      <Route path="/lobby" component={ProtectedLobby} />
      <Route path="/members" component={ProtectedMembers} />
      <Route path="/shop" component={ProtectedShop} />
      <Route path="/club" component={ProtectedClub} />
      <Route path="/club/settings" component={ProtectedClubSettings} />
      <Route path="/club/invitations" component={ProtectedClubInvitations} />
      <Route path="/leagues" component={ProtectedLeagues} />
      <Route path="/analytics" component={ProtectedAnalytics} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
