import { AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { GoldButton, GoldCard, VaultBackground } from "@/components/premium/PremiumComponents";

export default function NotFound() {
  return (
    <VaultBackground>
      <div className="min-h-screen w-full flex items-center justify-center px-4">
        <GoldCard className="w-full max-w-md text-center" padding="p-10" glow>
          <AlertCircle className="h-12 w-12 mx-auto mb-4" style={{ color: "#d4af37" }} />
          <h1
            className="text-3xl font-display font-black mb-2"
            style={{
              background: "linear-gradient(180deg, #f0d060 0%, #d4af37 50%, #9a7b2c 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            404
          </h1>
          <p className="text-lg font-bold text-white mb-1">Page Not Found</p>
          <p className="text-sm text-gray-400 mb-6">
            The page you're looking for doesn't exist or has been moved.
          </p>

          <Link href="/">
            <GoldButton className="mx-auto">Go Home</GoldButton>
          </Link>
        </GoldCard>
      </div>
    </VaultBackground>
  );
}
