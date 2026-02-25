import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { AmbientParticles } from "@/components/AmbientParticles";
import { Trophy, User, Lock, Zap } from "lucide-react";

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading, loginAsGuest, login, register, error } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a1022] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (user) {
    return <>{children}</>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(username, password);
      } else {
        await register(username, password, displayName || username);
      }
    } catch {
      // error is shown via context
    } finally {
      setSubmitting(false);
    }
  };

  const handleGuest = async () => {
    setSubmitting(true);
    try {
      await loginAsGuest();
    } catch {
      // error is shown via context
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a1022] text-white flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,30,40,0.5)_0%,rgba(0,0,0,0.95)_70%)]" />
        <AmbientParticles />
      </div>

      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative z-10 glass rounded-2xl p-8 w-full max-w-sm border border-white/10"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-xl gold-gradient flex items-center justify-center mx-auto mb-3 shadow-[0_0_25px_rgba(201,168,76,0.3)]">
            <Trophy className="w-7 h-7 text-black" />
          </div>
          <h1 className="font-display font-bold text-lg tracking-widest gold-text">HIGH ROLLERS</h1>
          <p className="text-[10px] text-gray-500 tracking-[0.2em] font-mono mt-1">MULTIPLAYER POKER</p>
        </div>

        {/* Quick Guest */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleGuest}
          disabled={submitting}
          className="w-full gold-gradient rounded-lg py-3 text-sm font-bold tracking-wider text-black flex items-center justify-center gap-2 mb-4 shadow-[0_0_15px_rgba(201,168,76,0.25)] disabled:opacity-50"
        >
          <Zap className="w-4 h-4" />
          PLAY AS GUEST
        </motion.button>

        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-[10px] text-gray-600 uppercase tracking-wider">or</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Login/Register form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "register" && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="NeonAce"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1 mb-1">
              <User className="w-3 h-3" /> Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
              required
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1 mb-1">
              <Lock className="w-3 h-3" /> Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
              required
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-cyan-500/20 border border-cyan-500/30 rounded-lg py-2.5 text-sm font-bold tracking-wider text-cyan-400 hover:bg-cyan-500/30 transition-colors disabled:opacity-50"
          >
            {mode === "login" ? "LOGIN" : "CREATE ACCOUNT"}
          </button>
        </form>

        <p className="text-center mt-4 text-xs text-gray-500">
          {mode === "login" ? (
            <>
              No account?{" "}
              <button onClick={() => setMode("register")} className="text-cyan-400 hover:text-cyan-300">
                Register
              </button>
            </>
          ) : (
            <>
              Have an account?{" "}
              <button onClick={() => setMode("login")} className="text-cyan-400 hover:text-cyan-300">
                Login
              </button>
            </>
          )}
        </p>
      </motion.div>
    </div>
  );
}
