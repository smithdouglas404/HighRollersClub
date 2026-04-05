import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { signInWithPopup, signOut, onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { auth as firebaseAuth, googleProvider, firebaseConfigured } from "./firebase";

export interface AuthUser {
  id: string;
  username: string;
  displayName: string | null;
  avatarId: string | null;
  tauntVoice: string | null;
  chipBalance: number;
  role: string;
  provider: string;
  lastDailyClaim: string | null;
  email?: string | null;
  walletAddress?: string | null;
  twoFactorEnabled?: boolean;
  tier?: string;
  tierExpiresAt?: string | null;
  kycStatus?: string;
  kycVerifiedAt?: string | null;
  kycRejectionReason?: string | null;
  memberId?: string | null;
  kycBlockchainTxHash?: string | null;
  kycLevel?: string;
  firebaseUid?: string | null;
  loyaltyPoints?: number;
  loyaltyLevel?: number;
  loyaltyStreakDays?: number;
  tierPlan?: string | null;
  premiumUntil?: string | null;
  createdAt: string;
}

interface AuthContextType {
  user: AuthUser | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  error: string | null;
  firebaseEnabled: boolean;
  loginAsGuest: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, displayName?: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [firebaseSynced, setFirebaseSynced] = useState(false);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        // Submit device fingerprint for anti-fraud tracking (only with consent)
        const fpConsent = localStorage.getItem("fp_consent");
        if (fpConsent === "accepted") {
          try {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            ctx?.fillText("fp", 10, 10);
            const fp = [
              canvas.toDataURL().slice(-32),
              navigator.userAgent.slice(0, 50),
              `${screen.width}x${screen.height}`,
              Intl.DateTimeFormat().resolvedOptions().timeZone,
              navigator.language,
            ].join("|");
            const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(fp));
            const fingerprint = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
            fetch("/api/device-fingerprint", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ fingerprint, screenRes: `${screen.width}x${screen.height}`, userAgent: navigator.userAgent }),
            }).catch(() => {});
          } catch {}
        }
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
  }, []);

  // Check session on mount
  useEffect(() => {
    fetchUser().finally(() => {
      // If Firebase isn't configured, we're done loading
      if (!firebaseConfigured) {
        setLoading(false);
      }
    });
  }, [fetchUser]);

  // Listen for Firebase auth state changes
  useEffect(() => {
    if (!firebaseConfigured || !firebaseAuth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(firebaseAuth, (fbUser) => {
      setFirebaseUser(fbUser);
      if (!fbUser) {
        // Firebase signed out — only clear user if they were a Firebase user
        if (user?.firebaseUid) {
          setUser(null);
        }
        setFirebaseSynced(false);
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  // Sync Firebase user to backend when Firebase auth state changes
  useEffect(() => {
    if (!firebaseUser || firebaseSynced) return;
    if (user && !user.firebaseUid) return; // Already logged in via local auth

    const syncUser = async () => {
      try {
        const idToken = await firebaseUser.getIdToken();
        const res = await fetch("/api/auth/firebase-sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            displayName: firebaseUser.displayName || "Player",
            username: firebaseUser.email?.split("@")[0],
            avatarUrl: firebaseUser.photoURL,
            email: firebaseUser.email,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setUser(data);
          setFirebaseSynced(true);
        }
      } catch (err) {
        console.error("Failed to sync Firebase user:", err);
        // Fallback: try session-based /me
        await fetchUser();
      } finally {
        setLoading(false);
      }
    };

    syncUser();
  }, [firebaseUser, firebaseSynced, fetchUser]);

  const loginAsGuest = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/auth/guest", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to create guest account");
      }
      const data = await res.json();
      setUser(data);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Login failed");
      }
      const data = await res.json();
      setUser(data);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, []);

  const register = useCallback(async (username: string, password: string, displayName?: string) => {
    setError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, displayName }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Registration failed");
      }
      const data = await res.json();
      setUser(data);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, []);

  const loginWithGoogle = useCallback(async () => {
    if (!firebaseConfigured || !firebaseAuth) {
      setError("Google sign-in is not configured");
      return;
    }
    setError(null);
    try {
      const result = await signInWithPopup(firebaseAuth, googleProvider);
      // The onAuthStateChanged listener will handle syncing
      setFirebaseUser(result.user);
      setFirebaseSynced(false); // Trigger sync
    } catch (err: any) {
      if (err.code === "auth/popup-closed-by-user") return;
      setError(err.message || "Google sign-in failed");
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    let serverLogoutFailed = false;
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (!res.ok) serverLogoutFailed = true;
    } catch {
      serverLogoutFailed = true;
    }

    // Also sign out of Firebase
    if (firebaseConfigured && firebaseAuth) {
      try { await signOut(firebaseAuth); } catch { /* ignore */ }
    }

    setUser(null);
    setFirebaseUser(null);
    setFirebaseSynced(false);
    if (serverLogoutFailed) {
      setError("Logged out locally, but server session may still be active");
    }
  }, []);

  const refreshUser = useCallback(async () => {
    await fetchUser();
  }, [fetchUser]);

  return (
    <AuthContext.Provider value={{
      user, firebaseUser, loading, error,
      firebaseEnabled: firebaseConfigured,
      loginAsGuest, login, register, loginWithGoogle, logout, refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
