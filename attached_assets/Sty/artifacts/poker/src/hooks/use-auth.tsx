import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { api } from "@/lib/api";

interface AppUser {
  id: number;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  level?: number;
  gamesPlayed?: number;
  gamesWon?: number;
}

interface AuthContextType {
  user: AppUser | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  balance: number;
  refreshBalance: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [synced, setSynced] = useState(false);

  const refreshBalance = useCallback(async () => {
    try {
      const data = await api.getBalance();
      setBalance(data.balance);
    } catch {}
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const data = await api.getMe();
      setUser(data);
      const bal = await api.getBalance();
      setBalance(bal.balance);
    } catch {
      setUser(null);
      setBalance(0);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      if (!fbUser) {
        setUser(null);
        setBalance(0);
        setLoading(false);
        setSynced(false);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!firebaseUser || synced) return;

    const syncUser = async () => {
      try {
        const data = await api.firebaseSync({
          displayName: firebaseUser.displayName || "Player",
          username: firebaseUser.email?.split("@")[0] || undefined,
          avatarUrl: firebaseUser.photoURL || undefined,
          email: firebaseUser.email || undefined,
        });

        setUser({
          id: data.id,
          username: data.username,
          displayName: data.displayName,
          avatarUrl: data.avatarUrl,
          level: data.level,
          gamesPlayed: data.gamesPlayed,
          gamesWon: data.gamesWon,
        });
        setBalance(data.balance ?? 0);
        setSynced(true);
      } catch (err) {
        console.error("Failed to sync user:", err);
        try {
          const meData = await api.getMe();
          setUser(meData);
          const bal = await api.getBalance();
          setBalance(bal.balance);
          setSynced(true);
        } catch {
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    };

    syncUser();
  }, [firebaseUser, synced]);

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading, balance, refreshBalance, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
