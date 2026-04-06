import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { GhostInput, NeonButton } from "@/components/ui/neon";
import { useCreateClub } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Upload,
  Users,
  Shield,
  Globe,
  Lock,
  Check,
  Crown,
  Zap,
  Image,
} from "lucide-react";

const STEPS = [
  { id: "identity", label: "Club Identity" },
  { id: "config", label: "Configuration" },
  { id: "privacy", label: "Privacy & Access" },
  { id: "review", label: "Review" },
];

export function ClubCreate() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createClub = useCreateClub();

  const [step, setStep] = useState(0);
  interface ClubConfig {
    name: string;
    description: string;
    maxMembers: number;
    chipBuyIn: number;
    isPrivate: boolean;
    inviteCode: string;
    approvalRequired: boolean;
  }

  const [config, setConfig] = useState<ClubConfig>({
    name: "",
    description: "",
    maxMembers: 50,
    chipBuyIn: 1000,
    isPrivate: false,
    inviteCode: "",
    approvalRequired: false,
  });

  const update = <K extends keyof ClubConfig>(field: K, value: ClubConfig[K]) =>
    setConfig((prev) => ({ ...prev, [field]: value }));

  const nextStep = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const prevStep = () => setStep((s) => Math.max(s - 1, 0));

  const handleCreate = async () => {
    try {
      const newClub = await createClub.mutateAsync({
        data: {
          name: config.name,
          description: config.description || undefined,
          maxMembers: config.maxMembers,
          isPrivate: config.isPrivate,
          chipBuyIn: config.chipBuyIn,
        },
      });
      toast({ title: "Club Created", description: "Your syndicate is ready." });
      setLocation(`/clubs/${newClub.id}`);
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create club",
        variant: "destructive",
      });
    }
  };

  const renderStep = () => {
    switch (STEPS[step].id) {
      case "identity":
        return (
          <div>
            <h2 className="text-2xl font-display font-bold text-white mb-2">
              Club Identity
            </h2>
            <p className="text-muted-foreground text-sm mb-8">
              Give your syndicate a name, description, and cover image.
            </p>

            <div className="mb-6">
              <div className="w-full h-44 rounded-md overflow-hidden relative group cursor-pointer bg-surface-low/50 border border-white/[0.06] hover:border-primary/30 transition-all">
                <img
                  src={`${import.meta.env.BASE_URL}images/club-cover.png`}
                  alt="Club cover"
                  className="w-full h-full object-cover opacity-30 group-hover:opacity-50 transition-opacity"
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="w-12 h-12 rounded-md bg-surface-high/80 backdrop-blur-md flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                    <Image className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <span className="text-sm text-muted-foreground group-hover:text-white transition-colors font-medium">
                    Upload Cover Image
                  </span>
                  <span className="text-[10px] text-muted-foreground mt-1">
                    Recommended: 1920×480px
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <GhostInput
                label="Club Name"
                placeholder="e.g., The Neon Syndicate"
                value={config.name}
                onChange={(e) => update("name", e.target.value)}
              />

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-muted-foreground">
                  Description
                </label>
                <textarea
                  className="w-full bg-surface-highest/50 border-b-2 border-white/10 rounded-t-md px-4 py-3 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-all duration-300 resize-none h-28"
                  placeholder="Describe your club's vibe, rules, and what players can expect..."
                  value={config.description}
                  onChange={(e) => update("description", e.target.value)}
                />
                <span className="text-[10px] text-muted-foreground text-right">
                  {config.description.length}/200
                </span>
              </div>
            </div>
          </div>
        );

      case "config":
        return (
          <div>
            <h2 className="text-2xl font-display font-bold text-white mb-2">
              Configuration
            </h2>
            <p className="text-muted-foreground text-sm mb-8">
              Set capacity and default buy-in for club tables.
            </p>

            <div className="space-y-6">
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-3">
                  Max Members
                </label>
                <div className="flex gap-2">
                  {[10, 25, 50, 100, 200, 500].map((n) => (
                    <button
                      key={n}
                      onClick={() => update("maxMembers", n)}
                      className={cn(
                        "flex-1 py-3 rounded-md font-display font-bold transition-all",
                        config.maxMembers === n
                          ? "bg-primary/15 text-primary border border-primary/30"
                          : "bg-surface-high/50 text-muted-foreground border border-white/[0.06] hover:text-foreground"
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <GhostInput
                type="number"
                label="Standard Buy-in ($)"
                value={config.chipBuyIn}
                onChange={(e) => update("chipBuyIn", Number(e.target.value))}
              />

              <div className="bg-surface-low/50 rounded-md p-5 border border-white/[0.04] flex items-center gap-4">
                <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-white text-sm">
                    {config.maxMembers} member slots
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Default buy-in: ${config.chipBuyIn.toLocaleString()} per
                    player
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case "privacy":
        return (
          <div>
            <h2 className="text-2xl font-display font-bold text-white mb-2">
              Privacy & Access
            </h2>
            <p className="text-muted-foreground text-sm mb-8">
              Control who can discover and join your club.
            </p>

            <div className="space-y-4 mb-6">
              {[
                {
                  value: false,
                  icon: Globe,
                  label: "Public Club",
                  desc: "Anyone can find and request to join your club from the directory.",
                },
                {
                  value: true,
                  icon: Lock,
                  label: "Private Club",
                  desc: "Hidden from the directory. Players need an invite link or code to join.",
                },
              ].map((opt) => (
                <div
                  key={String(opt.value)}
                  onClick={() => update("isPrivate", opt.value)}
                  className={cn(
                    "flex items-center gap-4 p-5 rounded-md cursor-pointer transition-all",
                    config.isPrivate === opt.value
                      ? "bg-primary/10 border border-primary/20 shadow-[0_0_15px_rgba(129,236,255,0.1)]"
                      : "bg-surface-high/50 border border-white/[0.06] hover:border-white/10"
                  )}
                >
                  <div
                    className={cn(
                      "w-10 h-10 rounded-md flex items-center justify-center",
                      config.isPrivate === opt.value
                        ? "bg-primary/20 text-primary"
                        : "bg-surface-lowest text-muted-foreground"
                    )}
                  >
                    <opt.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-white">{opt.label}</p>
                    <p className="text-xs text-muted-foreground">{opt.desc}</p>
                  </div>
                  <div
                    className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                      config.isPrivate === opt.value
                        ? "border-primary bg-primary"
                        : "border-white/20"
                    )}
                  >
                    {config.isPrivate === opt.value && (
                      <Check className="w-3 h-3 text-background" />
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div
              onClick={() =>
                update("approvalRequired", !config.approvalRequired)
              }
              className={cn(
                "flex items-center gap-4 p-4 rounded-md cursor-pointer transition-all",
                config.approvalRequired
                  ? "bg-secondary/10 border border-secondary/20"
                  : "bg-surface-high/50 border border-white/[0.06] hover:border-white/10"
              )}
            >
              <div
                className={cn(
                  "w-5 h-5 rounded-sm border-2 flex items-center justify-center transition-all",
                  config.approvalRequired
                    ? "bg-secondary border-secondary"
                    : "border-white/20"
                )}
              >
                {config.approvalRequired && (
                  <Check className="w-3 h-3 text-background" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-bold text-white text-sm">
                  Require Admin Approval
                </p>
                <p className="text-xs text-muted-foreground">
                  New members must be approved by an admin before joining.
                </p>
              </div>
            </div>
          </div>
        );

      case "review":
        return (
          <div>
            <h2 className="text-2xl font-display font-bold text-white mb-2">
              Review & Create
            </h2>
            <p className="text-muted-foreground text-sm mb-8">
              Confirm your club settings before launching.
            </p>

            <div className="mb-6 bg-surface-low/50 rounded-md overflow-hidden border border-white/[0.04]">
              <div className="h-28 relative">
                <img
                  src={`${import.meta.env.BASE_URL}images/club-cover.png`}
                  alt="Cover"
                  className="w-full h-full object-cover opacity-40"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface-low to-transparent" />
              </div>
              <div className="p-5 -mt-8 relative">
                <div className="w-14 h-14 rounded-md bg-surface-high border border-primary/20 flex items-center justify-center mb-3">
                  <Crown className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-2xl font-display font-bold text-white">
                  {config.name || "Unnamed Club"}
                </h3>
                {config.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {config.description}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {[
                { label: "Max Members", value: config.maxMembers },
                {
                  label: "Standard Buy-in",
                  value: `$${config.chipBuyIn.toLocaleString()}`,
                },
                {
                  label: "Privacy",
                  value: config.isPrivate ? "Private" : "Public",
                },
                {
                  label: "Approval Required",
                  value: config.approvalRequired ? "Yes" : "No",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0"
                >
                  <span className="text-sm text-muted-foreground">
                    {item.label}
                  </span>
                  <span className="text-sm font-bold text-white">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-6 py-8">
        <Link
          href="/clubs"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-white transition-colors mb-6 text-sm"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Clubs
        </Link>

        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4 backdrop-blur-md border border-primary/20">
            <Crown className="w-3.5 h-3.5" />
            <span>New Syndicate</span>
          </div>
          <h1 className="text-4xl font-display font-bold text-white mb-2">
            Establish Your Club
          </h1>
          <p className="text-muted-foreground">
            Build a home for your poker crew.
          </p>
        </div>

        <div className="flex items-center gap-1.5 mb-8 justify-center">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setStep(i)}
              className="flex items-center gap-1.5"
            >
              <div
                className={cn(
                  "w-7 h-7 rounded-full text-[10px] font-bold flex items-center justify-center transition-all",
                  i === step
                    ? "bg-primary text-background"
                    : i < step
                    ? "bg-secondary/20 text-secondary border border-secondary/30"
                    : "bg-surface-high/50 text-muted-foreground border border-white/[0.06]"
                )}
              >
                {i < step ? <Check className="w-3 h-3" /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-xs font-bold uppercase tracking-wider hidden sm:block",
                  i === step
                    ? "text-primary"
                    : i < step
                    ? "text-secondary"
                    : "text-muted-foreground"
                )}
              >
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    "w-8 h-px mx-1",
                    i < step ? "bg-secondary/30" : "bg-white/[0.06]"
                  )}
                />
              )}
            </button>
          ))}
        </div>

        <div className="bg-surface-high/50 backdrop-blur-2xl rounded-md border border-white/[0.06] p-6 md:p-8 min-h-[360px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between mt-6">
          <NeonButton
            variant="ghost"
            onClick={prevStep}
            disabled={step === 0}
            className="gap-1"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </NeonButton>

          {step < STEPS.length - 1 ? (
            <NeonButton
              onClick={nextStep}
              disabled={step === 0 && !config.name.trim()}
              className="gap-1"
            >
              Next <ChevronRight className="w-4 h-4" />
            </NeonButton>
          ) : (
            <NeonButton
              onClick={handleCreate}
              disabled={createClub.isPending || !config.name.trim()}
              className="gap-1.5"
            >
              <Zap className="w-4 h-4" />
              {createClub.isPending ? "Creating..." : "Launch Club"}
            </NeonButton>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
