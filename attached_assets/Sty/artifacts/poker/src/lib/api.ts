import { auth } from "./firebase";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function getFirebaseToken(): Promise<string | null> {
  try {
    const user = auth.currentUser;
    if (!user) return null;
    return await user.getIdToken();
  } catch {
    return null;
  }
}

async function request(path: string, options: RequestInit = {}) {
  const token = await getFirebaseToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}api${path}`, {
    ...options,
    credentials: "include",
    headers,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export const api = {
  register: (username: string, password: string, displayName?: string) =>
    request("/auth/register", { method: "POST", body: JSON.stringify({ username, password, displayName }) }),

  login: (username: string, password: string) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),

  logout: () =>
    request("/auth/logout", { method: "POST" }),

  firebaseSync: (data: { displayName?: string; username?: string; avatarUrl?: string; email?: string }) =>
    request("/auth/firebase-sync", { method: "POST", body: JSON.stringify(data) }),

  getMe: () =>
    request("/auth/me"),

  getUserProfile: () =>
    request("/users/me"),

  getBalance: () =>
    request("/wallet/balance"),

  getTransactions: (limit = 50) =>
    request(`/wallet/transactions?limit=${limit}`),

  getGameState: (tableId: number) =>
    request(`/tables/${tableId}/game`),

  joinTable: (tableId: number, seatIndex: number, buyIn: number) =>
    request(`/tables/${tableId}/join`, { method: "POST", body: JSON.stringify({ seatIndex, buyIn }) }),

  leaveTable: (tableId: number) =>
    request(`/tables/${tableId}/leave`, { method: "POST" }),

  startHand: (tableId: number) =>
    request(`/tables/${tableId}/start`, { method: "POST" }),

  performAction: (tableId: number, action: string, amount?: number) =>
    request(`/tables/${tableId}/action`, { method: "POST", body: JSON.stringify({ action, amount }) }),

  getTables: () =>
    request("/tables"),

  createTable: (body: any) =>
    request("/tables", { method: "POST", body: JSON.stringify(body) }),
};
