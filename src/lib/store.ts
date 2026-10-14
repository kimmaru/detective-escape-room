import fs from "fs";
import path from "path";
import { PlayerSession, ReviewData, generateDefaultPins } from "../data/pins";
import { PUZZLES } from "../data/puzzles";

const CACHE_FILE = path.join("/tmp", "escaperoom_sessions.json");
const REVIEWS_FILE = path.join("/tmp", "escaperoom_reviews.json");

export function getAllReviews(): Array<ReviewData & { pin: string }> {
  const reviewMap = new Map<string, ReviewData & { pin: string }>();

  // 1. Read from persistent file cache
  try {
    if (fs.existsSync(REVIEWS_FILE)) {
      const data = fs.readFileSync(REVIEWS_FILE, "utf-8");
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        parsed.forEach((r) => {
          if (r && r.pin) {
            reviewMap.set(r.pin, r);
          }
        });
      }
    }
  } catch (e) {
    console.error("Failed to load reviews from /tmp:", e);
  }

  // 2. Merge reviews from active sessions
  if (globalThis.__escapeStore?.sessions) {
    Object.values(globalThis.__escapeStore.sessions).forEach((s) => {
      if (s.hasReviewed && s.review && !reviewMap.has(s.pin)) {
        reviewMap.set(s.pin, { ...s.review, pin: s.pin });
      }
    });
  }

  // Sort by newest first
  return Array.from(reviewMap.values()).sort(
    (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
  );
}

function saveReviewToCache(reviewWithPin: ReviewData & { pin: string }) {
  try {
    const list = getAllReviews();
    const filtered = list.filter((r) => r.pin !== reviewWithPin.pin);
    filtered.unshift(reviewWithPin);
    fs.writeFileSync(REVIEWS_FILE, JSON.stringify(filtered, null, 2));
  } catch (e) {
    console.error("Failed to save review to /tmp:", e);
  }
}


interface GlobalStore {
  sessions: Record<string, PlayerSession>;
}

declare global {
  // eslint-disable-next-line no-var
  var __escapeStore: GlobalStore | undefined;
}

function loadPersistedSessions(): Record<string, PlayerSession> {
  const defaultPins = generateDefaultPins();
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, "utf-8");
      const parsed = JSON.parse(data);
      // Merge with default pins to ensure all 100 exist
      return { ...defaultPins, ...parsed };
    }
  } catch (e) {
    console.error("Failed to load sessions from /tmp:", e);
  }
  return defaultPins;
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

export function resolvePin(input: string): string {
  const clean = input.trim().toUpperCase();
  const store = getStore();
  if (store.sessions[clean]) return clean;

  // 숫자 또는 번호 입력 지원 (예: "100", "100번", "1")
  const num = parseInt(clean.replace(/[^0-9]/g, ""), 10);
  if (!isNaN(num) && num >= 1 && num <= 100) {
    const padded = String(num).padStart(2, "0");
    const found = Object.values(store.sessions).find(
      (s) => s.nickname.endsWith(`_${num}`) || s.nickname.endsWith(`_${padded}`)
    );
    if (found) return found.pin;
  }
  return clean;
}

export function getSession(pin: string): PlayerSession | null {
  const store = getStore();
  const cleanPin = resolvePin(pin);

  // If session doesn't exist, check defaultPins reload
  if (!store.sessions[cleanPin]) {
    const defaults = generateDefaultPins();
    if (defaults[cleanPin]) {
      store.sessions[cleanPin] = defaults[cleanPin];
      savePersistedSessions(store.sessions);
    } else {
      return null;
    }
  }

  return store.sessions[cleanPin] || null;
}

export function startOrResumeSession(pin: string, customNickname?: string): PlayerSession {
  const cleanPin = resolvePin(pin);
  const session = getSession(cleanPin);
  if (!session) {
    throw new Error("유효하지 않은 수사 암호입니다. 암호를 다시 확인해주세요.");
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
  store.sessions[cleanPin] = session;
  savePersistedSessions(store.sessions);
  return session;
}

export function syncClientSession(clientState: Partial<PlayerSession> & { pin: string }): PlayerSession {
  const store = getStore();
  const pin = resolvePin(clientState.pin);
  let session = store.sessions[pin];

  if (!session) {
    session = getSession(pin)!;
    if (!session) {
      throw new Error("Session not found");
    }
  }

  const now = Date.now();
  if (clientState.currentRoom && clientState.currentRoom >= session.currentRoom) {
    session.currentRoom = clientState.currentRoom;
    session.roomEnteredAt = clientState.roomEnteredAt || now;
  }
  if (clientState.isCleared) {
    session.isCleared = true;
    session.clearedAt = clientState.clearedAt || now;
    session.status = "cleared";
    session.totalTimeSeconds = clientState.totalTimeSeconds || session.totalTimeSeconds;
  }
  if (typeof clientState.totalHintsUsed === "number") {
    session.totalHintsUsed = Math.max(session.totalHintsUsed || 0, clientState.totalHintsUsed);
  }
  if (clientState.startedAt) {
    session.startedAt = clientState.startedAt;
  }
  if (clientState.nickname) {
    session.nickname = clientState.nickname;
  }
  if (clientState.unlockedHints && clientState.unlockedHints.length >= session.unlockedHints.length) {
    session.unlockedHints = clientState.unlockedHints;
  }
  if (clientState.hasReviewed) {
    session.hasReviewed = true;
    if (clientState.review && !session.review) {
      session.review = clientState.review;
    }
  }

  session.lastActiveAt = now;
  store.sessions[pin] = session;
  savePersistedSessions(store.sessions);
  return session;
}

export function submitAnswer(
  pin: string,
  rawAnswer: string,
  clientCurrentRoom?: number
): {
  success: boolean;
  nextRoom?: number;
  isCleared?: boolean;
  message?: string;
  totalTimeSeconds?: number;
  totalHintsUsed?: number;
  session?: PlayerSession;
} {
  const cleanPin = resolvePin(pin);
  const session = getSession(cleanPin);
  if (!session) {
    return { success: false, message: "세션을 찾을 수 없습니다." };
  }

  const roomToValidate = clientCurrentRoom || session.currentRoom;

  if (session.isCleared || roomToValidate > 10) {
    return {
      success: true,
      isCleared: true,
      message: "이미 모든 방을 클리어했습니다!",
      totalTimeSeconds: session.totalTimeSeconds,
      totalHintsUsed: session.totalHintsUsed || 0,
      session,
    };
  }

  const currentPuzzle = PUZZLES.find((p) => p.roomNumber === roomToValidate);
  if (!currentPuzzle) {
    return { success: false, message: "문제를 찾을 수 없습니다." };
  }

  // Sanitize: strip spaces, uppercase
  const sanitizedInput = rawAnswer.replace(/\s+/g, "").toUpperCase();
  const correctAnswer = currentPuzzle.answer.replace(/\s+/g, "").toUpperCase();

  if (sanitizedInput !== correctAnswer) {
    return { success: false, message: "오답입니다! 단서를 다시 확인해보세요." };
  }

  // Correct answer! Advance room
  const now = Date.now();
  const nextRoomNum = roomToValidate + 1;

  if (nextRoomNum > 10) {
    session.currentRoom = 11;
    session.isCleared = true;
    session.clearedAt = now;
    session.status = "cleared";
    if (session.startedAt) {
      session.totalTimeSeconds = Math.max(1, Math.floor((now - session.startedAt) / 1000));
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
  store.sessions[cleanPin] = session;
  savePersistedSessions(store.sessions);

  return {
    success: true,
    nextRoom: session.isCleared ? 10 : session.currentRoom,
    isCleared: session.isCleared,
    totalTimeSeconds: session.totalTimeSeconds,
    totalHintsUsed: session.totalHintsUsed || 0,
    session,
    message: session.isCleared ? "축하합니다! 모든 방탈출을 완료했습니다!" : "정답입니다! 다음 방으로 이동합니다.",
  };
}

export function unlockHint(
  pin: string,
  clientCurrentRoom?: number
): {
  success: boolean;
  hintIndex?: number;
  hintText?: string;
  unlockedHints?: number[];
  totalHintsUsed?: number;
  message?: string;
  remainingCooldown?: number;
} {
  const cleanPin = resolvePin(pin);
  const session = getSession(cleanPin);
  if (!session) {
    return { success: false, message: "세션을 찾을 수 없습니다." };
  }

  const roomNumber = clientCurrentRoom || session.currentRoom;
  const puzzle = PUZZLES.find((p) => p.roomNumber === roomNumber);
  if (!puzzle) {
    return { success: false, message: "문제를 찾을 수 없습니다." };
  }

  const now = Date.now();
  const enteredAt = session.roomEnteredAt || session.startedAt || now;
  const lastHintAt = session.lastHintUnlockedAt || enteredAt;

  const nextHintIdx = session.unlockedHints.length;
  if (nextHintIdx >= puzzle.hints.length) {
    return { success: false, message: "이 방의 모든 힌트와 정답을 이미 열람했습니다." };
  }

  // First hint: 2-minute (120s) cooldown, subsequent hints: 1-minute (60s) cooldown
  const cooldownDuration = nextHintIdx === 0 ? 120 : 60;
  const COOLDOWN_MS = cooldownDuration * 1000;
  const timeSinceLastEvent = now - lastHintAt;

  if (timeSinceLastEvent < COOLDOWN_MS) {
    const remainingSeconds = Math.ceil((COOLDOWN_MS - timeSinceLastEvent) / 1000);
    return {
      success: false,
      message: `아직 다음 단서를 볼 수 없습니다. (${remainingSeconds}초 후 활성화)`,
      remainingCooldown: remainingSeconds,
    };
  }

  session.unlockedHints.push(nextHintIdx);
  session.totalHintsUsed = (session.totalHintsUsed || 0) + 1;
  session.lastHintUnlockedAt = now;
  session.lastActiveAt = now;

  const store = getStore();
  store.sessions[cleanPin] = session;
  savePersistedSessions(store.sessions);

  return {
    success: true,
    hintIndex: nextHintIdx,
    hintText: puzzle.hints[nextHintIdx],
    unlockedHints: session.unlockedHints,
    totalHintsUsed: session.totalHintsUsed,
  };
}

export function passRoomAdmin(pin: string): { success: boolean; nextRoom?: number; isCleared?: boolean } {
  const cleanPin = resolvePin(pin);
  const session = getSession(cleanPin);
  if (!session) return { success: false };

  const now = Date.now();
  if (session.currentRoom >= 10) {
    session.isCleared = true;
    session.clearedAt = now;
    session.status = "cleared";
    if (session.startedAt) {
      session.totalTimeSeconds = Math.max(1, Math.floor((now - session.startedAt) / 1000));
    }
  } else {
    session.currentRoom += 1;
    session.roomEnteredAt = now;
    session.unlockedHints = [];
    session.lastHintUnlockedAt = null;
  }
  session.lastActiveAt = now;

  const store = getStore();
  store.sessions[cleanPin] = session;
  savePersistedSessions(store.sessions);
  return { success: true, nextRoom: session.currentRoom, isCleared: session.isCleared };
}

export function resetSession(pin?: string) {
  const store = getStore();
  if (pin) {
    const cleanPin = resolvePin(pin);
    if (store.sessions[cleanPin]) {
      store.sessions[cleanPin] = {
        pin: cleanPin,
        nickname: store.sessions[cleanPin].nickname,
        currentRoom: 1,
        startedAt: null,
        roomEnteredAt: null,
        unlockedHints: [],
        lastHintUnlockedAt: null,
        isCleared: false,
        clearedAt: null,
        totalTimeSeconds: 0,
        totalHintsUsed: 0,
        lastActiveAt: null,
        status: "ready",
      };
    }
  } else {
    store.sessions = generateDefaultPins();
  }
  savePersistedSessions(store.sessions);
}

export function submitReview(
  pin: string,
  reviewInput: { name: string; content: string; photo?: string | null }
): {
  success: boolean;
  message: string;
  review?: ReviewData;
  session?: PlayerSession;
} {
  const cleanPin = resolvePin(pin);
  const session = getSession(cleanPin);
  if (!session) {
    return { success: false, message: "세션을 찾을 수 없습니다." };
  }

  // 중복 작성/수정 방지: 이미 작성한 경우 수정 불가
  if (session.hasReviewed) {
    return {
      success: false,
      message: "이미 후기를 등록하셨습니다. 후기는 1회만 등록 가능하며 수정할 수 없습니다.",
      review: session.review,
      session,
    };
  }

  // 클리어 여부 확인: 사건 해결자만 후기 등록 가능
  if (!session.isCleared && session.currentRoom <= 10) {
    return {
      success: false,
      message: "사건을 모두 해결(클리어)한 탐정만 후기를 남길 수 있습니다.",
    };
  }

  const name = reviewInput.name?.trim();
  const content = reviewInput.content?.trim();

  if (!name) {
    return { success: false, message: "작성자 이름을 입력해주세요." };
  }
  if (!content || content.length < 2) {
    return { success: false, message: "후기 내용을 최소 2자 이상 작성해주세요." };
  }

  const now = Date.now();
  const review: ReviewData = {
    name,
    content,
    photo: reviewInput.photo || null,
    createdAt: now,
  };

  session.hasReviewed = true;
  session.review = review;
  session.lastActiveAt = now;

  const store = getStore();
  store.sessions[cleanPin] = session;
  savePersistedSessions(store.sessions);
  saveReviewToCache({ ...review, pin: cleanPin });

  return {
    success: true,
    message: "소중한 후기가 성공적으로 등록되었습니다!",
    review,
    session,
  };
}
