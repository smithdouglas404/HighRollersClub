import { Switch, Route, Redirect, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ClubProvider } from "@/lib/club-context";
import { WalletProvider } from "@/lib/wallet-context";
import Game from "@/pages/Game";
import Landing from "@/pages/Landing";
import Lobby from "@/pages/Lobby";
import Members from "@/pages/Members";
import Shop from "@/pages/Shop";
import Wallet from "@/pages/Wallet";
import ClubDashboard from "@/pages/ClubDashboard";
import ClubSettings from "@/pages/ClubSettings";
import ClubInvitations from "@/pages/ClubInvitations";
import Leagues from "@/pages/Leagues";
import AllianceDetail from "@/pages/AllianceDetail";
import LeagueDetail from "@/pages/LeagueDetail";
import Analytics from "@/pages/Analytics";
import HandReplay from "@/pages/HandReplay";
import BrowseClubs from "@/pages/BrowseClubs";
import ClubRankings from "@/pages/ClubRankings";
import Leaderboard from "@/pages/Leaderboard";
import Profile from "@/pages/Profile";
import Security from "@/pages/Security";
import ApiDocs from "@/pages/ApiDocs";
import AdminDashboard from "@/pages/AdminDashboard";
import Tournaments from "@/pages/Tournaments";
import TournamentCreate from "@/pages/TournamentCreate";
import TournamentDetail from "@/pages/TournamentDetail";
import TableSetup from "@/pages/TableSetup";
import ClubCreate from "@/pages/ClubCreate";
import PremiumUpgrade from "@/pages/PremiumUpgrade";
import AnnouncementManager from "@/pages/AnnouncementManager";
import AccountRecovery from "@/pages/AccountRecovery";
import AvatarWardrobe from "@/pages/AvatarWardrobe";
import ClubWars from "@/pages/ClubWars";
import Marketplace from "@/pages/Marketplace";
import Stakes from "@/pages/Stakes";
import Tiers from "@/pages/Tiers";
import Loyalty from "@/pages/Loyalty";
import KYC from "@/pages/KYC";
import TransactionExplorer from "@/pages/TransactionExplorer";
import BlockchainDashboard from "@/pages/BlockchainDashboard";
import Terms from "@/pages/Terms";
import Privacy from "@/pages/Privacy";
import Support from "@/pages/Support";
import ResponsibleGambling from "@/pages/ResponsibleGambling";
import PremiumTable from "@/pages/PremiumTable";
import DyeShop from "@/pages/DyeShop";
import MultiTable from "@/pages/MultiTable";
import SharedReplay from "@/pages/SharedReplay";
import ClubRevenueReports from "@/pages/ClubRevenueReports";
import ClubMemberAnalytics from "@/pages/ClubMemberAnalytics";
import ClubTournamentAnalytics from "@/pages/ClubTournamentAnalytics";
import AvatarCustomizer from "@/pages/AvatarCustomizer";
import NotFound from "@/pages/not-found";
import { AuthGate } from "@/components/auth/AuthGate";
import { ErrorBoundary } from "@/components/ErrorBoundary";

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

function ProtectedWallet() {
  return <AuthGate><Wallet /></AuthGate>;
}

function ProtectedBrowseClubs() {
  return <AuthGate><BrowseClubs /></AuthGate>;
}

function ProtectedClubRankings() {
  return <AuthGate><ClubRankings /></AuthGate>;
}

function ProtectedLeaderboard() {
  return <AuthGate><Leaderboard /></AuthGate>;
}

function ProtectedProfile() {
  return <AuthGate><Profile /></AuthGate>;
}

function ProtectedSecurity() {
  return <AuthGate><Security /></AuthGate>;
}

function ProtectedAdmin() {
  return <AuthGate><AdminDashboard /></AuthGate>;
}

function ProtectedTournaments() {
  return <AuthGate><Tournaments /></AuthGate>;
}

function ProtectedTournamentCreate() {
  return <AuthGate><TournamentCreate /></AuthGate>;
}

function ProtectedTableSetup() {
  return <AuthGate><TableSetup /></AuthGate>;
}

function ProtectedClubCreate() {
  return <AuthGate><ClubCreate /></AuthGate>;
}

function ProtectedPremium() {
  return <AuthGate><PremiumUpgrade /></AuthGate>;
}

function ProtectedAnnouncementManager() {
  return <AuthGate><AnnouncementManager /></AuthGate>;
}

function ProtectedWardrobe() {
  return <AuthGate><AvatarWardrobe /></AuthGate>;
}

function ProtectedClubWars() {
  return <AuthGate><ClubWars /></AuthGate>;
}

function ProtectedMarketplace() {
  return <AuthGate><Marketplace /></AuthGate>;
}

function ProtectedStakes() {
  return <AuthGate><Stakes /></AuthGate>;
}

function ProtectedTiers() {
  return <AuthGate><Tiers /></AuthGate>;
}

function ProtectedLoyalty() {
  return <AuthGate><Loyalty /></AuthGate>;
}

function ProtectedKYC() {
  return <AuthGate><KYC /></AuthGate>;
}

function ProtectedTransactionExplorer() {
  return <AuthGate><TransactionExplorer /></AuthGate>;
}

function ProtectedBlockchainDashboard() {
  return <AuthGate><BlockchainDashboard /></AuthGate>;
}

function ProtectedPremiumTable() {
  return <AuthGate><PremiumTable /></AuthGate>;
}

function ProtectedResponsibleGambling() {
  return <AuthGate><ResponsibleGambling /></AuthGate>;
}

function ProtectedDyeShop() {
  return <AuthGate><DyeShop /></AuthGate>;
}

function ProtectedMultiTable() {
  return <AuthGate><MultiTable /></AuthGate>;
}

function ProtectedSharedReplay() {
  return <AuthGate><SharedReplay /></AuthGate>;
}

function ProtectedClubRevenueReports({ params }: { params: { id: string } }) {
  return <AuthGate><ClubRevenueReports /></AuthGate>;
}

function ProtectedClubMemberAnalytics({ params }: { params: { id: string } }) {
  return <AuthGate><ClubMemberAnalytics /></AuthGate>;
}

function ProtectedClubTournamentAnalytics({ params }: { params: { id: string } }) {
  return <AuthGate><ClubTournamentAnalytics /></AuthGate>;
}

function ProtectedAvatarCustomizer() {
  return <AuthGate><AvatarCustomizer /></AuthGate>;
}

function GameWithTable({ params }: { params: { tableId: string } }) {
  return <AuthGate><ErrorBoundary fallbackTitle="Game Error"><Game tableId={params.tableId} /></ErrorBoundary></AuthGate>;
}

function HandReplayPage({ params }: { params: { handId: string } }) {
  return <AuthGate><HandReplay handId={params.handId} /></AuthGate>;
}

function AllianceDetailPage({ params }: { params: { id: string } }) {
  return <AuthGate><AllianceDetail allianceId={params.id} /></AuthGate>;
}

function LeagueDetailPage({ params }: { params: { id: string } }) {
  return <AuthGate><LeagueDetail seasonId={params.id} /></AuthGate>;
}

function TournamentDetailPage({ params }: { params: { id: string } }) {
  return <AuthGate><TournamentDetail tournamentId={params.id} /></AuthGate>;
}

function InviteRedirect({ params }: { params: { code: string } }) {
  const [, setLocation] = useLocation();
  const [error, setError] = useState("");
  useEffect(() => {
    fetch(`/api/tables/invite/${params.code}`)
      .then(r => r.json())
      .then(data => {
        if (data.tableId) {
          setLocation(`/game/${data.tableId}?invite=${params.code}`);
        } else {
          setError(data.message || "Invalid invite link");
        }
      })
      .catch(() => setError("Failed to resolve invite link"));
  }, [params.code, setLocation]);
  if (error) return <div className="flex items-center justify-center min-h-screen text-red-400">{error}</div>;
  return <div className="flex items-center justify-center min-h-screen text-gray-400">Joining table...</div>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/game">{() => <Game />}</Route>
      <Route path="/game/:tableId">{(params) => <GameWithTable params={params} />}</Route>
      <Route path="/invite/:code">{(params) => <InviteRedirect params={params} />}</Route>
      <Route path="/hands/:handId">{(params) => <HandReplayPage params={params} />}</Route>
      <Route path="/lobby" component={ProtectedLobby} />
      <Route path="/members" component={ProtectedMembers} />
      <Route path="/shop" component={ProtectedShop} />
      <Route path="/club" component={ProtectedClub} />
      <Route path="/club/settings" component={ProtectedClubSettings} />
      <Route path="/club/invitations" component={ProtectedClubInvitations} />
      <Route path="/leagues" component={ProtectedLeagues} />
      <Route path="/alliances/:id">{(params) => <AllianceDetailPage params={params} />}</Route>
      <Route path="/leagues/:id">{(params) => <LeagueDetailPage params={params} />}</Route>
      <Route path="/analytics" component={ProtectedAnalytics} />
      <Route path="/wallet" component={ProtectedWallet} />
      <Route path="/clubs/browse" component={ProtectedBrowseClubs} />
      <Route path="/club-rankings" component={ProtectedClubRankings} />
      <Route path="/leaderboard" component={ProtectedLeaderboard} />
      <Route path="/profile" component={ProtectedProfile} />
      <Route path="/security" component={ProtectedSecurity} />
      <Route path="/tournaments" component={ProtectedTournaments} />
      <Route path="/tournaments/new" component={ProtectedTournamentCreate} />
      <Route path="/tournaments/:id">{(params) => <TournamentDetailPage params={params} />}</Route>
      <Route path="/table/new" component={ProtectedTableSetup} />
      <Route path="/clubs/create" component={ProtectedClubCreate} />
      <Route path="/premium" component={ProtectedPremium} />
      <Route path="/admin/announcements" component={ProtectedAnnouncementManager} />
      <Route path="/admin" component={ProtectedAdmin} />
      <Route path="/sponsorship">{() => <Redirect to="/admin" />}</Route>
      <Route path="/terms" component={Terms} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/support" component={Support} />
      <Route path="/responsible-gambling" component={ProtectedResponsibleGambling} />
      <Route path="/api-docs" component={ApiDocs} />
      <Route path="/recovery" component={AccountRecovery} />
      <Route path="/wardrobe" component={ProtectedWardrobe} />
      <Route path="/club-wars" component={ProtectedClubWars} />
      <Route path="/marketplace" component={ProtectedMarketplace} />
      <Route path="/stakes" component={ProtectedStakes} />
      <Route path="/tiers" component={ProtectedTiers} />
      <Route path="/loyalty" component={ProtectedLoyalty} />
      <Route path="/kyc" component={ProtectedKYC} />
      <Route path="/explorer" component={ProtectedTransactionExplorer} />
      <Route path="/blockchain" component={ProtectedBlockchainDashboard} />
      <Route path="/premium-table" component={ProtectedPremiumTable} />
      <Route path="/dye-shop" component={ProtectedDyeShop} />
      <Route path="/multi-table" component={ProtectedMultiTable} />
      <Route path="/shared-replay/:id">{(params) => <AuthGate><SharedReplay /></AuthGate>}</Route>
      <Route path="/clubs/:id/revenue">{(params) => <ProtectedClubRevenueReports params={params} />}</Route>
      <Route path="/clubs/:id/analytics">{(params) => <ProtectedClubMemberAnalytics params={params} />}</Route>
      <Route path="/clubs/:id/tournament-analytics">{(params) => <ProtectedClubTournamentAnalytics params={params} />}</Route>
      <Route path="/avatar-customizer" component={ProtectedAvatarCustomizer} />
      <Route path="/avatar-render">{() => <Redirect to="/wardrobe" />}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WalletProvider>
          <ClubProvider>
            <TooltipProvider>
              <Toaster />
              <ErrorBoundary>
                <Router />
              </ErrorBoundary>
            </TooltipProvider>
          </ClubProvider>
        </WalletProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
