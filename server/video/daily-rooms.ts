// Daily.co Room & Token Management
// Creates private rooms per poker table and issues per-user meeting tokens.

const DAILY_API_BASE = "https://api.daily.co/v1";

interface DailyRoom {
  name: string;
  url: string;
  id: string;
}

// In-memory cache: tableId → Daily room info
const activeRooms = new Map<string, DailyRoom>();

function getApiKey(): string {
  const key = process.env.DAILY_API_KEY;
  if (!key) throw new Error("DAILY_API_KEY not configured");
  return key;
}

async function fetchRoom(roomName: string): Promise<DailyRoom | null> {
  const res = await fetch(`${DAILY_API_BASE}/rooms/${roomName}`, {
    headers: { Authorization: `Bearer ${getApiKey()}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Daily API error: ${res.status}`);
  return res.json() as Promise<DailyRoom>;
}

async function createRoom(roomName: string): Promise<DailyRoom> {
  const res = await fetch(`${DAILY_API_BASE}/rooms`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: roomName,
      privacy: "private",
      properties: {
        exp: Math.floor(Date.now() / 1000) + 4 * 3600,
        enable_recording: "cloud",
        enable_chat: false,
        max_participants: 10,
        start_video_off: false,
        start_audio_off: false,
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Daily room creation failed: ${res.status} ${body}`);
  }
  return res.json() as Promise<DailyRoom>;
}

export async function getOrCreateRoom(tableId: string): Promise<DailyRoom> {
  const cached = activeRooms.get(tableId);
  if (cached) return cached;

  const roomName = `poker-${tableId}`;
  const existing = await fetchRoom(roomName);
  if (existing) {
    activeRooms.set(tableId, existing);
    return existing;
  }

  const room = await createRoom(roomName);
  activeRooms.set(tableId, room);
  return room;
}

export async function createMeetingToken(
  tableId: string,
  userId: string,
  displayName: string,
  isOwner: boolean,
): Promise<string> {
  const room = await getOrCreateRoom(tableId);
  const res = await fetch(`${DAILY_API_BASE}/meeting-tokens`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: {
        room_name: room.name,
        user_name: displayName,
        user_id: userId,
        is_owner: isOwner,
        exp: Math.floor(Date.now() / 1000) + 4 * 3600,
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Daily token creation failed: ${res.status} ${body}`);
  }
  const data = (await res.json()) as { token: string };
  return data.token;
}

export async function deleteRoom(tableId: string): Promise<void> {
  const roomName = `poker-${tableId}`;
  activeRooms.delete(tableId);
  try {
    await fetch(`${DAILY_API_BASE}/rooms/${roomName}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${getApiKey()}` },
    });
  } catch {
    // Room may already be deleted or expired
  }
}
