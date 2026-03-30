import { Link } from "wouter";
import { NeonButton } from "@/components/ui/neon";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background text-white p-6 text-center">
      <h1 className="text-8xl font-display font-bold text-primary neon-text-glow mb-4">404</h1>
      <h2 className="text-2xl font-bold mb-6">Sector Not Found</h2>
      <p className="text-muted-foreground max-w-md mb-8">
        The data node you are looking for has been purged from the Neon Vault or never existed.
      </p>
      <Link href="/">
        <NeonButton>Return to Lobby</NeonButton>
      </Link>
    </div>
  );
}
