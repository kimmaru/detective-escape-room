import fs from "fs";
import path from "path";
import { PlayerSession, generateDefaultPins } from "../data/pins";
import { PUZZLES } from "../data/puzzles";

const CACHE_FILE = path.join("/tmp", "escaperoom_sessions.json");

interface GlobalStore {
  sessions: Record<string, PlayerSession>;
}

declare global {
  // eslint-disable-next-line no-var
  var __escapeStore: GlobalStore | undefined;
}

function loadPersistedSessions(): Record<string, PlayerSession> {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (e) {
    console.error("Failed to load sessions from /tmp:", e);
  }
  return generateDefaultPins();
}

function savePersistedSessions(sessions: Record<string, PlayerSession>) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(sessions, null, 2));
  } catch (e) {
    console.error("Failed to save sessions to /tmp:", e);
  }
}

function getStore(): GlobalStore {
  if (!globalThis.__escapeStore) {
    globalThis.__escapeStore = {
      sessions: loadPersistedSessions(),
    };
  }
  return globalThis.__escapeStore;
}

export function getAllSessions(): PlayerSession[] {
  const store = getStore();
  return Object.values(store.sessions);
}

export function getSession(pin: string): PlayerSession | null {
  const store = getStore();
  const cleanPin = pin.trim();
  if (!store.sessions[cleanPin]) {
    // If PIN is valid format (1001~1100 or numeric 4 digits), dynamically create if not exists
    if (/^\d{4}$/.test(cleanPin)) {
      const num = parseInt(cleanPin, 10);
      const pad = String(num % 100 || 1).padStart(2, "0");
      store.sessions[cleanPin] = {
        pin: cleanPin,
        nickname: `탐정조수_${pad}`,
        currentRoom: 1,
        startedAt: null,
        roomEnteredAt: null,
        unlockedHints: [],
        lastHintUnlockedAt: null,
        isCleared: false,
        clearedAt: null,
        totalTimeSeconds: 0,
        lastActiveAt: Date.now(),
        status: "ready",
      };
      savePersistedSessions(store.sessions);
    } else {
      return null;
    }
  }
  return store.sessions[cleanPin];
}

export function startOrResumeSession(pin: string, customNickname?: string): PlayerSession {
  const session = getSession(pin);
  if (!session) {
    throw new Error("존재하지 않는 PIN 번호입니다.");
  }

  const now = Date.now();
  if (!session.startedAt) {
    session.startedAt = now;
    session.roomEnteredAt = now;
    session.status = "playing";
  }
  if (!session.roomEnteredAt) {
    session.roomEnteredAt = now;
  }
  if (customNickname && customNickname.trim()) {
    session.nickname = customNickname.trim();
  }
  session.lastActiveAt = now;

  const store = getStore();
  store.sessions[pin] = session;
  savePersistedSessions(store.sessions);
  return session;
}

export function syncClientSession(clientState: Partial<PlayerSession> & { pin: string }): PlayerSession {
  const store = getStore();
  const pin = clientState.pin;
  let session = store.sessions[pin];

  if (!session) {
    session = getSession(pin)!;
  }

  const now = Date.now();
  // Merge state carefully preferring more advanced progress
  if (clientState.currentRoom && clientState.currentRoom > session.currentRoom) {
    session.currentRoom = clientState.currentRoom;
    session.roomEnteredAt = clientState.roomEnteredAt || now;
    session.unlockedHints = clientState.unlockedHints || [];
    session.lastHintUnlockedAt = clientState.lastHintUnlockedAt || null;
  }
  if (clientState.isCleared) {
    session.isCleared = true;
    session.clearedAt = clientState.clearedAt || now;
    session.status = "cleared";
    session.totalTimeSeconds = clientState.totalTimeSeconds || session.totalTimeSeconds;
  }
  if (clientState.startedAt && !session.startedAt) {
    session.startedAt = clientState.startedAt;
  }
  if (clientState.nickname) {
    session.nickname = clientState.nickname;
  }
  if (clientState.unlockedHints && clientState.unlockedHints.length > session.unlockedHints.length) {
    session.unlockedHints = clientState.unlockedHints;
  }

  session.lastActiveAt = now;
  store.sessions[pin] = session;
  savePersistedSessions(store.sessions);
  return session;
}

export function submitAnswer(pin: string, rawAnswer: string): {
  success: boolean;
  nextRoom?: number;
  isCleared?: boolean;
  message?: string;
  totalTimeSeconds?: number;
} {
  const session = getSession(pin);
  if (!session) {
    return { success: false, message: "세션을 찾을 수 없습니다." };
  }

  if (session.isCleared) {
    return { success: true, isCleared: true, message: "이미 모든 방을 클리어했습니다!" };
  }

  const currentPuzzle = PUZZLES.find((p) => p.roomNumber === session.currentRoom);
  if (!currentPuzzle) {
    return { success: false, message: "문제를 찾을 수 없습니다." };
  }

  // Clean answer: remove spaces, convert to uppercase
  const sanitizedInput = rawAnswer.replace(/\s+/g, "").toUpperCase();
  const correctAnswer = currentPuzzle.answer.replace(/\s+/g, "").toUpperCase();

  if (sanitizedInput !== correctAnswer) {
    return { success: false, message: "오답입니다! 단서를 다시 확인해보세요." };
  }

  // Correct answer! Advance room
  const now = Date.now();
  const nextRoomNum = session.currentRoom + 1;

  if (nextRoomNum > 10) {
    // Game cleared!
    session.isCleared = true;
    session.clearedAt = now;
    session.status = "cleared";
    if (session.startedAt) {
      session.totalTimeSeconds = Math.floor((now - session.startedAt) / 1000);
    }
  } else {
    session.currentRoom = nextRoomNum;
    session.roomEnteredAt = now;
    session.unlockedHints = [];
    session.lastHintUnlockedAt = null;
    session.status = "playing";
  }

  session.lastActiveAt = now;
  const store = getStore();
  store.sessions[pin] = session;
  savePersistedSessions(store.sessions);

  return {
    success: true,
    nextRoom: session.currentRoom,
    isCleared: session.isCleared,
    totalTimeSeconds: session.totalTimeSeconds,
    message: session.isCleared ? "축하합니다! 방탈출을 완료했습니다!" : "정답입니다! 다음 방으로 이동합니다.",
  };
}

export function unlockHint(pin: string): {
  success: boolean;
  hintIndex?: number;
  hintText?: string;
  unlockedHints?: number[];
  message?: string;
  remainingCooldown?: number;
} {
  const session = getSession(pin);
  if (!session) {
    return { success: false, message: "세션을 찾을 수 없습니다." };
  }

  const puzzle = PUZZLES.find((p) => p.roomNumber === session.currentRoom);
  if (!puzzle) {
    return { success: false, message: "문제를 찾을 수 없습니다." };
  }

  const now = Date.now();
  const enteredAt = session.roomEnteredAt || session.startedAt || now;
  const lastHintAt = session.lastHintUnlockedAt || enteredAt;

  // Next hint index to unlock
  const nextHintIdx = session.unlockedHints.length;
  if (nextHintIdx >= puzzle.hints.length) {
    return { success: false, message: "이 방의 모든 힌트를 이미 열람했습니다." };
  }

  // 1 minute (60s) cooldown
  const COOLDOWN_MS = 60 * 1000;
  const timeSinceLastEvent = now - lastHintAt;

  if (timeSinceLastEvent < COOLDOWN_MS) {
    const remainingSeconds = Math.ceil((COOLDOWN_MS - timeSinceLastEvent) / 1000);
    return {
      success: false,
      message: `아직 힌트를 볼 수 없습니다. (${remainingSeconds}초 후 활성화)`,
      remainingCooldown: remainingSeconds,
    };
  }

  // Unlock hint!
  session.unlockedHints.push(nextHintIdx);
  session.lastHintUnlockedAt = now;
  session.lastActiveAt = now;

  const store = getStore();
  store.sessions[pin] = session;
  savePersistedSessions(store.sessions);

  return {
    success: true,
    hintIndex: nextHintIdx,
    hintText: puzzle.hints[nextHintIdx],
    unlockedHints: session.unlockedHints,
  };
}

export function passRoomAdmin(pin: string): { success: boolean; nextRoom?: number; isCleared?: boolean } {
  const session = getSession(pin);
  if (!session) return { success: false };

  const now = Date.now();
  if (session.currentRoom >= 10) {
    session.isCleared = true;
    session.clearedAt = now;
    session.status = "cleared";
    if (session.startedAt) {
      session.totalTimeSeconds = Math.floor((now - session.startedAt) / 1000);
    }
  } else {
    session.currentRoom += 1;
    session.roomEnteredAt = now;
    session.unlockedHints = [];
    session.lastHintUnlockedAt = null;
  }
  session.lastActiveAt = now;

  const store = getStore();
  store.sessions[pin] = session;
  savePersistedSessions(store.sessions);
  return { success: true, nextRoom: session.currentRoom, isCleared: session.isCleared };
}

export function resetSession(pin?: string) {
  const store = getStore();
  if (pin) {
    const cleanPin = pin.trim();
    if (store.sessions[cleanPin]) {
      const num = parseInt(cleanPin, 10);
      const pad = String(num % 100 || 1).padStart(2, "0");
      store.sessions[cleanPin] = {
        pin: cleanPin,
        nickname: `탐정조수_${pad}`,
        currentRoom: 1,
        startedAt: null,
        roomEnteredAt: null,
        unlockedHints: [],
        lastHintUnlockedAt: null,
        isCleared: false,
        clearedAt: null,
        totalTimeSeconds: 0,
        lastActiveAt: null,
        status: "ready",
      };
    }
  } else {
    store.sessions = generateDefaultPins();
  }
  savePersistedSessions(store.sessions);
}
