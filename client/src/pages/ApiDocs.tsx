import { DashboardLayout } from "@/components/DashboardLayout";
import { motion } from "framer-motion";
import { Book, Key, Shield, Zap, Code, Copy } from "lucide-react";
import { useState } from "react";

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative rounded-lg bg-black/60 border border-white/[0.06] p-4 font-mono text-xs text-green-300 overflow-x-auto">
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 rounded-md bg-white/5 hover:bg-white/10 transition-colors"
      >
        <Copy className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
      <pre className="whitespace-pre-wrap">{code}</pre>
      {copied && <span className="absolute top-2 right-10 text-[10px] text-primary">Copied!</span>}
    </div>
  );
}

export default function ApiDocs() {
  return (
    <DashboardLayout title="API Documentation">
      <div className="px-6 md:px-8 pb-8 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <Book className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-display font-bold text-white">Statistics API</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Access player statistics programmatically. Requires an API key.
          </p>
        </motion.div>

        <div className="space-y-6">
          {/* Auth */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-lg bg-surface-high/30 border border-white/[0.06] p-5"
          >
            <div className="flex items-center gap-2 mb-3">
              <Key className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-primary">Authentication</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Generate an API key from your{" "}
              <a href="/security" className="text-primary hover:underline">Security Settings</a> page.
              Include it in every request:
            </p>
            <CodeBlock code={`curl -H "X-API-Key: sk_your_key_here" \\
  https://your-domain.com/api/v1/stats/USER_ID`} />
          </motion.div>

          {/* Endpoint */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-lg bg-surface-high/30 border border-white/[0.06] p-5"
          >
            <div className="flex items-center gap-2 mb-3">
              <Code className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-primary">Endpoints</h2>
            </div>

            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/15 text-green-400 border border-green-500/20">
                  GET
                </span>
                <code className="text-xs text-white font-mono">/api/v1/stats/:userId</code>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Returns comprehensive player statistics including VPIP, PFR, win rate, and more.
              </p>
            </div>

            <h3 className="text-xs font-bold text-white mb-2">Example Response</h3>
            <CodeBlock code={`{
  "userId": "abc-123",
  "handsPlayed": 1250,
  "potsWon": 312,
  "vpip": 28.5,
  "pfr": 19.2,
  "winRate": 25.0,
  "totalWinnings": 45000,
  "bestWinStreak": 8,
  "sngWins": 5,
  "headsUpWins": 12
}`} />
          </motion.div>

          {/* Rate Limits */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-lg bg-surface-high/30 border border-white/[0.06] p-5"
          >
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-primary">Rate Limits</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-black/30 p-3 border border-white/[0.04]">
                <div className="flex items-center gap-1.5 mb-1">
                  <Zap className="w-3 h-3 text-yellow-400" />
                  <span className="text-xs font-bold text-white">100 requests/min</span>
                </div>
                <p className="text-[10px] text-muted-foreground">Per API key, rolling window</p>
              </div>
              <div className="rounded-lg bg-black/30 p-3 border border-white/[0.04]">
                <div className="flex items-center gap-1.5 mb-1">
                  <Shield className="w-3 h-3 text-blue-400" />
                  <span className="text-xs font-bold text-white">SHA-256 hashed</span>
                </div>
                <p className="text-[10px] text-muted-foreground">Keys are never stored in plain text</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}
