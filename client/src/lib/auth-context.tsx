import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

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
  createdAt: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  loginAsGuest: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
  }, []);

  // Check session on mount
  useEffect(() => {
    fetchUser().finally(() => setLoading(false));
  }, [fetchUser]);

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

  const logout = useCallback(async () => {
    let serverLogoutFailed = false;
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (!res.ok) {
        serverLogoutFailed = true;
      }
    } catch {
      serverLogoutFailed = true;
    }
    // Always clear local state so user can re-login
    setUser(null);
    if (serverLogoutFailed) {
      setError("Logged out locally, but server session may still be active");
    }
  }, []);

  const refreshUser = useCallback(async () => {
    await fetchUser();
  }, [fetchUser]);

  return (
    <AuthContext.Provider value={{ user, loading, error, loginAsGuest, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
