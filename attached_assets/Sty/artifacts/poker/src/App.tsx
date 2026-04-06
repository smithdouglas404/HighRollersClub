import { useState } from "react";
import { Switch, Route, Redirect, useLocation, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, updateProfile } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { motion } from "framer-motion";

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

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0a0c" }}>
      <div className="text-center">
        <div
          className="w-8 h-8 border-2 rounded-full animate-spin mx-auto mb-3"
          style={{ borderColor: "rgba(0,243,255,0.2)", borderTopColor: "#00f3ff" }}
        />
        <p className="text-gray-400 text-sm">Loading...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType<any> }) {
  const { user, firebaseUser, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!firebaseUser) return <Redirect to="/login" />;
  if (!user) return <LoadingScreen />;

  return <Component />;
}

function HomeRedirect() {
  const { user, firebaseUser, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!firebaseUser) return <LandingPage />;
  if (!user) return <LoadingScreen />;

  return <Home />;
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function LandingPage() {
  const [, navigate] = useLocation();
  const BASE = import.meta.env.BASE_URL;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden" style={{ background: "#0a0a0c" }}>
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-30%] left-[-10%] w-[700px] h-[700px] bg-[#00f3ff]/[0.04] rounded-full blur-[180px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-purple-600/[0.03] rounded-full blur-[150px]" />
        <div className="absolute top-[20%] right-[20%] w-[300px] h-[300px] bg-[#d4af37]/[0.02] rounded-full blur-[100px]" />
      </div>

      <div className="absolute top-6 left-6 z-10 flex items-center gap-3 opacity-20">
        <img src={`${BASE}images/avatar-shadow-king.jpg`} alt="" className="w-10 h-10 rounded-full object-cover border border-white/10" />
        <img src={`${BASE}images/avatar-neon-fox.jpg`} alt="" className="w-8 h-8 rounded-full object-cover border border-white/10" />
      </div>
      <div className="absolute bottom-6 right-6 z-10 flex items-center gap-3 opacity-20">
        <img src={`${BASE}images/avatar-oracle-seer.jpg`} alt="" className="w-8 h-8 rounded-full object-cover border border-white/10" />
        <img src={`${BASE}images/avatar-void-witch.jpg`} alt="" className="w-10 h-10 rounded-full object-cover border border-white/10" />
      </div>

      <div className="w-full max-w-[420px] relative z-10 text-center">
        <div className="inline-flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #00f3ff, #00b4cc)", boxShadow: "0 0 20px rgba(0,243,255,0.3)" }}>
            <span className="text-[#0a0a0c] font-black text-lg">S</span>
          </div>
          <h1 className="text-3xl font-display font-black tracking-tight uppercase" style={{ color: "#00f3ff", textShadow: "0 0 30px rgba(0,243,255,0.3)" }}>
            Stitch Poker
          </h1>
        </div>
        <p className="text-white/40 text-sm mb-8">Premium online poker. High stakes. Zero limits.</p>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => navigate("/login")}
            className="w-full rounded-xl py-3.5 font-display font-black text-sm uppercase tracking-[0.15em] text-[#0a0a0c] transition-all hover:brightness-110"
            style={{
              background: "linear-gradient(135deg, #00f3ff, #00b4cc)",
              boxShadow: "0 0 25px rgba(0,243,255,0.25)",
            }}
          >
            Sign In
          </button>
          <button
            onClick={() => navigate("/register")}
            className="w-full rounded-xl py-3.5 font-display font-black text-sm uppercase tracking-[0.15em] transition-all hover:brightness-110"
            style={{
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "white",
            }}
          >
            Create Account
          </button>
        </div>

        <div className="mt-8">
          <p className="text-white/10 text-[10px] uppercase tracking-[0.2em]">Premium Online Poker</p>
        </div>
      </div>
    </div>
  );
}

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [, navigate] = useLocation();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/");
    } catch (err: any) {
      if (err.code === "auth/invalid-credential" || err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
        setError("Invalid email or password");
      } else if (err.code === "auth/invalid-email") {
        setError("Invalid email address");
      } else {
        setError(err.message || "Login failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
      navigate("/");
    } catch (err: any) {
      if (err.code !== "auth/popup-closed-by-user") {
        setError(err.message || "Google login failed");
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden" style={{ background: "#0a0a0c" }}>
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-30%] left-[-10%] w-[700px] h-[700px] bg-[#00f3ff]/[0.04] rounded-full blur-[180px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-purple-600/[0.03] rounded-full blur-[150px]" />
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-[420px] relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #00f3ff, #00b4cc)", boxShadow: "0 0 20px rgba(0,243,255,0.3)" }}>
              <span className="text-[#0a0a0c] font-black text-lg">S</span>
            </div>
            <h1 className="text-3xl font-display font-black tracking-tight uppercase" style={{ color: "#00f3ff", textShadow: "0 0 30px rgba(0,243,255,0.3)" }}>
              Stitch Poker
            </h1>
          </div>
          <p className="text-white/40 text-sm">Sign in to hit the tables</p>
        </div>

        <div className="flex flex-col gap-3 mb-6">
          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all hover:brightness-110"
            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}
          >
            <GoogleIcon />
            Continue with Google
          </button>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-white/30 text-xs uppercase tracking-widest font-medium">or</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        <form onSubmit={handleEmailLogin}>
          <div
            className="rounded-2xl p-6 space-y-4"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(20px)" }}
          >
            {error && (
              <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-lg px-4 py-3 text-sm"
                style={{ background: "rgba(255,0,60,0.1)", color: "#ff003c", border: "1px solid rgba(255,0,60,0.2)" }}
              >{error}</motion.div>
            )}

            <div>
              <label className="block text-xs font-bold text-white/50 mb-1.5 uppercase tracking-wider">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-white placeholder-white/20 outline-none transition-all focus:ring-1 focus:ring-[#00f3ff]/50"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                placeholder="you@example.com" required autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-white/50 mb-1.5 uppercase tracking-wider">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-white placeholder-white/20 outline-none transition-all focus:ring-1 focus:ring-[#00f3ff]/50"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                placeholder="Enter password" required autoComplete="current-password"
              />
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full rounded-xl py-3.5 font-display font-black text-sm uppercase tracking-[0.15em] text-[#0a0a0c] transition-all hover:brightness-110 disabled:opacity-50 mt-5"
            style={{ background: "linear-gradient(135deg, #00f3ff, #00b4cc)", boxShadow: "0 0 25px rgba(0,243,255,0.25)" }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="text-center text-white/30 mt-6 text-sm">
          New player?{" "}
          <a href="#" onClick={(e) => { e.preventDefault(); navigate("/register"); }} className="font-bold hover:underline" style={{ color: "#00f3ff" }}>
            Create an account
          </a>
        </p>

        <div className="text-center mt-8">
          <p className="text-white/10 text-[10px] uppercase tracking-[0.2em]">Premium Online Poker</p>
        </div>
      </motion.div>
    </div>
  );
}

function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [, navigate] = useLocation();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName) {
        await updateProfile(cred.user, { displayName });
      }
      navigate("/");
    } catch (err: any) {
      if (err.code === "auth/email-already-in-use") {
        setError("Email already in use");
      } else if (err.code === "auth/weak-password") {
        setError("Password must be at least 6 characters");
      } else if (err.code === "auth/invalid-email") {
        setError("Invalid email address");
      } else {
        setError(err.message || "Registration failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
      navigate("/");
    } catch (err: any) {
      if (err.code !== "auth/popup-closed-by-user") {
        setError(err.message || "Google sign up failed");
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden" style={{ background: "#0a0a0c" }}>
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-30%] left-[-10%] w-[700px] h-[700px] bg-[#00f3ff]/[0.04] rounded-full blur-[180px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-purple-600/[0.03] rounded-full blur-[150px]" />
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-[420px] relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #00f3ff, #00b4cc)", boxShadow: "0 0 20px rgba(0,243,255,0.3)" }}>
              <span className="text-[#0a0a0c] font-black text-lg">S</span>
            </div>
            <h1 className="text-3xl font-display font-black tracking-tight uppercase" style={{ color: "#00f3ff", textShadow: "0 0 30px rgba(0,243,255,0.3)" }}>
              Stitch Poker
            </h1>
          </div>
          <p className="text-white/40 text-sm">Create your account</p>
        </div>

        <div className="flex flex-col gap-3 mb-6">
          <button
            onClick={handleGoogleSignUp}
            className="w-full flex items-center justify-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all hover:brightness-110"
            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}
          >
            <GoogleIcon />
            Continue with Google
          </button>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-white/30 text-xs uppercase tracking-widest font-medium">or</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        <form onSubmit={handleRegister}>
          <div
            className="rounded-2xl p-6 space-y-4"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(20px)" }}
          >
            {error && (
              <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-lg px-4 py-3 text-sm"
                style={{ background: "rgba(255,0,60,0.1)", color: "#ff003c", border: "1px solid rgba(255,0,60,0.2)" }}
              >{error}</motion.div>
            )}

            <div>
              <label className="block text-xs font-bold text-white/50 mb-1.5 uppercase tracking-wider">Display Name</label>
              <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-white placeholder-white/20 outline-none transition-all focus:ring-1 focus:ring-[#00f3ff]/50"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                placeholder="Your display name" autoComplete="name"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-white/50 mb-1.5 uppercase tracking-wider">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-white placeholder-white/20 outline-none transition-all focus:ring-1 focus:ring-[#00f3ff]/50"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                placeholder="you@example.com" required autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-white/50 mb-1.5 uppercase tracking-wider">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-white placeholder-white/20 outline-none transition-all focus:ring-1 focus:ring-[#00f3ff]/50"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                placeholder="Min 6 characters" required autoComplete="new-password"
              />
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full rounded-xl py-3.5 font-display font-black text-sm uppercase tracking-[0.15em] text-[#0a0a0c] transition-all hover:brightness-110 disabled:opacity-50 mt-5"
            style={{ background: "linear-gradient(135deg, #00f3ff, #00b4cc)", boxShadow: "0 0 25px rgba(0,243,255,0.25)" }}
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="text-center text-white/30 mt-6 text-sm">
          Already have an account?{" "}
          <a href="#" onClick={(e) => { e.preventDefault(); navigate("/login"); }} className="font-bold hover:underline" style={{ color: "#00f3ff" }}>
            Sign in
          </a>
        </p>

        <div className="text-center mt-8">
          <p className="text-white/10 text-[10px] uppercase tracking-[0.2em]">Premium Online Poker</p>
        </div>
      </motion.div>
    </div>
  );
}

function AppRoutes() {
  return (
    <AuthProvider>
      <Switch>
        <Route path="/" component={HomeRedirect} />
        <Route path="/login" component={LoginPage} />
        <Route path="/register" component={RegisterPage} />
        <Route path="/clubs">{() => <ProtectedRoute component={Clubs} />}</Route>
        <Route path="/clubs/new">{() => <ProtectedRoute component={ClubCreate} />}</Route>
        <Route path="/clubs/:id">{() => <ProtectedRoute component={ClubDetail} />}</Route>
        <Route path="/tournaments">{() => <ProtectedRoute component={Tournaments} />}</Route>
        <Route path="/tournaments/new">{() => <ProtectedRoute component={TournamentCreate} />}</Route>
        <Route path="/table/new">{() => <ProtectedRoute component={TableSetup} />}</Route>
        <Route path="/table/:id">{() => <ProtectedRoute component={PokerTable} />}</Route>
        <Route path="/profile">{() => <ProtectedRoute component={Profile} />}</Route>
        <Route component={NotFound} />
      </Switch>
      <Toaster />
    </AuthProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={basePath}>
          <AppRoutes />
        </WouterRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
