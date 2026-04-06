import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";

const BASE = import.meta.env.BASE_URL;

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

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#5865F2">
      <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.11 13.11 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
    </svg>
  );
}

export function Register() {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const [, navigate] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }

    setLoading(true);
    try {
      await register(username, password, displayName || undefined);
      navigate("/");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = (provider: string) => {
    setError(`${provider} signup coming soon — create an account below to get started`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden" style={{ background: "#0a0a0c" }}>
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-30%] right-[-10%] w-[700px] h-[700px] bg-[#00f3ff]/[0.04] rounded-full blur-[180px]" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-[#d4af37]/[0.03] rounded-full blur-[150px]" />
      </div>

      <div className="absolute top-6 right-6 z-10 flex items-center gap-3 opacity-20">
        <img src={`${BASE}images/avatar-red-wolf.jpg`} alt="" className="w-10 h-10 rounded-full object-cover border border-white/10" />
        <img src={`${BASE}images/avatar-punk-duchess.jpg`} alt="" className="w-8 h-8 rounded-full object-cover border border-white/10" />
      </div>
      <div className="absolute bottom-6 left-6 z-10 flex items-center gap-3 opacity-20">
        <img src={`${BASE}images/avatar-tech-monk.jpg`} alt="" className="w-8 h-8 rounded-full object-cover border border-white/10" />
        <img src={`${BASE}images/avatar-steel-ghost.jpg`} alt="" className="w-10 h-10 rounded-full object-cover border border-white/10" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-[420px] relative z-10"
      >
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #00f3ff, #00b4cc)", boxShadow: "0 0 20px rgba(0,243,255,0.3)" }}>
              <span className="text-[#0a0a0c] font-black text-lg">S</span>
            </div>
            <h1 className="text-3xl font-display font-black tracking-tight uppercase" style={{ color: "#00f3ff", textShadow: "0 0 30px rgba(0,243,255,0.3)" }}>
              Stitch Poker
            </h1>
          </div>
          <p className="text-white/40 text-sm">Create your player account</p>
        </div>

        <div className="flex flex-col gap-3 mb-5">
          <button
            onClick={() => handleSocialLogin("Google")}
            className="w-full flex items-center justify-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all hover:brightness-110"
            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}
          >
            <GoogleIcon />
            Sign up with Google
          </button>

          <div className="flex gap-3">
            <button
              onClick={() => handleSocialLogin("Apple")}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all hover:brightness-110"
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}
            >
              <AppleIcon />
              Apple
            </button>
            <button
              onClick={() => handleSocialLogin("Discord")}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all hover:brightness-110"
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}
            >
              <DiscordIcon />
              Discord
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-white/30 text-xs uppercase tracking-widest font-medium">or</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        <form onSubmit={handleSubmit}>
          <div
            className="rounded-2xl p-6 space-y-4"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              backdropFilter: "blur(20px)",
            }}
          >
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg px-4 py-3 text-sm"
                style={{ background: "rgba(255,0,60,0.1)", color: "#ff003c", border: "1px solid rgba(255,0,60,0.2)" }}
              >
                {error}
              </motion.div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-white/50 mb-1.5 uppercase tracking-wider">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-white placeholder-white/20 outline-none transition-all text-sm focus:ring-1 focus:ring-[#00f3ff]/50"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                  placeholder="your_name"
                  required
                  autoComplete="username"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-white/50 mb-1.5 uppercase tracking-wider">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-white placeholder-white/20 outline-none transition-all text-sm focus:ring-1 focus:ring-[#00f3ff]/50"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                  placeholder="Table name"
                  autoComplete="name"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-white/50 mb-1.5 uppercase tracking-wider">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-white placeholder-white/20 outline-none transition-all text-sm focus:ring-1 focus:ring-[#00f3ff]/50"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
                placeholder="Min 6 characters"
                required
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-white/50 mb-1.5 uppercase tracking-wider">Confirm Password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-white placeholder-white/20 outline-none transition-all text-sm focus:ring-1 focus:ring-[#00f3ff]/50"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
                placeholder="Repeat password"
                required
                autoComplete="new-password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl py-3.5 font-display font-black text-sm uppercase tracking-[0.15em] text-[#0a0a0c] transition-all hover:brightness-110 disabled:opacity-50 mt-5"
            style={{
              background: "linear-gradient(135deg, #00f3ff, #00b4cc)",
              boxShadow: "0 0 25px rgba(0,243,255,0.25)",
            }}
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="text-center text-white/30 mt-6 text-sm">
          Already a player?{" "}
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); navigate("/login"); }}
            className="font-bold hover:underline"
            style={{ color: "#00f3ff" }}
          >
            Sign in
          </a>
        </p>

        <div className="text-center mt-6">
          <div className="inline-flex items-center gap-4 text-white/15 text-[10px] uppercase tracking-[0.15em]">
            <span>10,000 free chips</span>
            <span className="w-1 h-1 rounded-full bg-white/15" />
            <span>Instant play</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
