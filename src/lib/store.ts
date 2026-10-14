import fs from "fs";
import path from "path";
import { put } from "@vercel/blob";
import { PlayerSession, ReviewData, generateDefaultPins } from "../data/pins";
import { PUZZLES } from "../data/puzzles";
import { SEED_REVIEWS } from "../data/seedReviews";

const CACHE_FILE = path.join("/tmp", "escaperoom_sessions.json");
const REVIEWS_FILE = path.join("/tmp", "escaperoom_reviews.json");
const HIDDEN_FILE = path.join("/tmp", "escaperoom_hidden_pins.json");

const BLOB_BASE_URL =
  process.env.BLOB_STORE_BASE_URL ||
  "https://mak5nkc0fp7zkw4z.public.blob.vercel-storage.com";

// Default hidden pins (the test reviews admin configured as hidden)
const DEFAULT_HIDDEN_PINS = [
  "TEST_PIN",
  "TEST12",
  "IMG_TEST",
  "BIG_IMG",
  "FAST_TEST",
];

let cachedHiddenPins: Set<string> = new Set(DEFAULT_HIDDEN_PINS);
let lastHiddenPinsFetchAt = 0;

export async function fetchHiddenPins(): Promise<Set<string>> {
  const now = Date.now();
  // Fetch from Blob at most every 1000ms for snappy updates across all lambdas
  if (now - lastHiddenPinsFetchAt < 1000 && cachedHiddenPins.size > 0) {
    return cachedHiddenPins;
  }
  lastHiddenPinsFetchAt = now;

  try {
    const res = await fetch(
      `${BLOB_BASE_URL}/hidden_reviews.json?_t=${now}_${Math.random().toString(36).substring(7)}`,
      {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      }
    );
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        cachedHiddenPins = new Set(data.map((p) => String(p).trim().toUpperCase()));
        return cachedHiddenPins;
      }
    }
  } catch (e) {
    console.warn("Failed to fetch hidden pins from Blob:", e);
  }

  // Fallback: local /tmp file
  try {
    if (fs.existsSync(HIDDEN_FILE)) {
      const data = JSON.parse(fs.readFileSync(HIDDEN_FILE, "utf-8"));
      if (Array.isArray(data)) {
        cachedHiddenPins = new Set(data.map((p) => String(p).trim().toUpperCase()));
      }
    }
  } catch {}

  return cachedHiddenPins;
}

export async function saveHiddenPins(pinsSet: Set<string>): Promise<void> {
  cachedHiddenPins = pinsSet;
  lastHiddenPinsFetchAt = Date.now();
  const arr = Array.from(pinsSet);

  // 1. Write to local /tmp
  try {
    fs.writeFileSync(HIDDEN_FILE, JSON.stringify(arr, null, 2));
  } catch {}

  // 2. Write to Vercel Blob (durable across all lambdas!)
  try {
    await put("hidden_reviews.json", JSON.stringify(arr), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  } catch (e) {
    console.error("Failed to save hidden pins to Vercel Blob:", e);
  }
}

export async function getAllReviewsAsync(
  includeHidden = false
): Promise<Array<ReviewData & { pin: string }>> {
  const hiddenPins = await fetchHiddenPins();
  return getMergedReviews(includeHidden, hiddenPins);
}

export function getAllReviews(
  includeHidden = false
): Array<ReviewData & { pin: string }> {
  return getMergedReviews(includeHidden, cachedHiddenPins);
}

function getMergedReviews(
  includeHidden: boolean,
  hiddenPins: Set<string>
): Array<ReviewData & { pin: string }> {
  const reviewMap = new Map<string, ReviewData & { pin: string }>();

  // 1. Pre-seed default reviews from spreadsheet
  SEED_REVIEWS.forEach((r) => {
    const pinKey = r.pin.toUpperCase();
    reviewMap.set(pinKey, {
      ...r,
      hidden: hiddenPins.has(pinKey),
    });
  });

  // 2. Read from persistent file cache (overrides seeds with user's modifications & hidden flags)
  try {
    if (fs.existsSync(REVIEWS_FILE)) {
      const data = fs.readFileSync(REVIEWS_FILE, "utf-8");
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        parsed.forEach((r) => {
          if (r && r.pin) {
            const pinKey = r.pin.toUpperCase();
            reviewMap.set(pinKey, {
              ...r,
              hidden: hiddenPins.has(pinKey),
            });
          }
        });
      }
    }
  } catch (e) {
    console.error("Failed to load reviews from /tmp:", e);
  }

  // 3. Merge reviews from active sessions
  if (globalThis.__escapeStore?.sessions) {
    Object.values(globalThis.__escapeStore.sessions).forEach((s) => {
      const pinKey = s.pin.toUpperCase();
      if (s.hasReviewed && s.review) {
        reviewMap.set(pinKey, {
          ...s.review,
          pin: s.pin,
          hidden: hiddenPins.has(pinKey),
        });
      }
    });
  }

  // Sort by newest first
  const list = Array.from(reviewMap.values())
    .map((r) => ({
      ...r,
      hidden: hiddenPins.has(r.pin.toUpperCase()),
    }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  return includeHidden ? list : list.filter((r) => !r.hidden);
}

const GOOGLE_SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1hxHY2paDQP1E3iWw1ZPhusdFvKLAk86mxvk0l4aVQgA/export?format=csv";

let lastSheetSyncAt = 0;
const SHEET_SYNC_INTERVAL = 15 * 1000; // 15초 쿨다운

export async function syncReviewsFromGoogleSheet(): Promise<void> {
  const now = Date.now();
  if (now - lastSheetSyncAt < SHEET_SYNC_INTERVAL) return;
  lastSheetSyncAt = now;

  try {
    const res = await fetch(GOOGLE_SHEET_CSV_URL, { cache: "no-store" });
    if (!res.ok) return;
    const text = await res.text();
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length <= 1) return;

    const hiddenPins = await fetchHiddenPins();
    const list = getAllReviews(true);
    const map = new Map<string, ReviewData & { pin: string }>();
    list.forEach((r) => map.set(r.pin.toUpperCase(), r));

    let hasUpdates = false;

    for (let i = 1; i < lines.length; i++) {
      const row: string[] = [];
      let cur = "";
      let inQuote = false;
      const line = lines[i];

      for (let j = 0; j < line.length; j++) {
        const c = line[j];
        if (c === '"') {
          inQuote = !inQuote;
        } else if (c === "," && !inQuote) {
          row.push(cur.trim());
          cur = "";
        } else {
          cur += c;
        }
      }
      row.push(cur.trim());

      if (row.length >= 6) {
        const dateStr = row[0];
        const pin = row[1];
        const name = row[2];
        const driveUrl = row[4];
        const content = row[5];
        if (!pin || !content) continue;

        let photo: string | null = null;
        if (driveUrl && driveUrl.includes("drive.google.com")) {
          const m = driveUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
          if (m) photo = `https://lh3.googleusercontent.com/d/${m[1]}`;
        }

        const cleanPin = pin.trim().toUpperCase();
        const existing = map.get(cleanPin);

        if (!existing) {
          const parsedDate = new Date(dateStr.replace(" ", "T") + "+09:00").getTime();
          map.set(cleanPin, {
            pin,
            name: name || "익명 탐정",
            content,
            photo,
            createdAt: !isNaN(parsedDate) ? parsedDate : Date.now(),
            hidden: hiddenPins.has(cleanPin),
          });
          hasUpdates = true;
        } else {
          existing.hidden = hiddenPins.has(cleanPin);
        }
      }
    }

    if (hasUpdates) {
      const mergedList = Array.from(map.values()).sort(
        (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
      );
      fs.writeFileSync(REVIEWS_FILE, JSON.stringify(mergedList, null, 2));
    }
  } catch (e) {
    console.error("Failed to sync reviews from Google Sheet:", e);
  }
}

function saveReviewToCache(reviewWithPin: ReviewData & { pin: string }) {
  try {
    const list = getAllReviews(true);
    const pinKey = reviewWithPin.pin.toUpperCase();
    const isHidden = cachedHiddenPins.has(pinKey) || reviewWithPin.hidden === true;

    const filtered = list.filter(
      (r) => r.pin.toUpperCase() !== pinKey
    );
    filtered.unshift({ ...reviewWithPin, hidden: isHidden });
    fs.writeFileSync(REVIEWS_FILE, JSON.stringify(filtered, null, 2));
  } catch (e) {
    console.error("Failed to save review to /tmp:", e);
  }
}

export async function toggleReviewVisibility(
  pin: string,
  hide?: boolean
): Promise<{ success: boolean; hidden?: boolean }> {
  const cleanPin = resolvePin(pin).toUpperCase();
  const rawPin = pin.trim().toUpperCase();

  const hiddenPins = await fetchHiddenPins();
  const isCurrentlyHidden = hiddenPins.has(cleanPin) || hiddenPins.has(rawPin);
  const newHidden = hide !== undefined ? hide : !isCurrentlyHidden;

  if (newHidden) {
    hiddenPins.add(cleanPin);
    hiddenPins.add(rawPin);
  } else {
    hiddenPins.delete(cleanPin);
    hiddenPins.delete(rawPin);
  }

  await saveHiddenPins(hiddenPins);

  // Sync /tmp cache
  try {
    const list = getAllReviews(true);
    fs.writeFileSync(REVIEWS_FILE, JSON.stringify(list, null, 2));
  } catch {}

  const store = getStore();
  const sessionKey =
    store.sessions[cleanPin]
      ? cleanPin
      : Object.keys(store.sessions).find(
          (k) => k.toUpperCase() === rawPin
        );

  if (sessionKey && store.sessions[sessionKey]) {
    if (store.sessions[sessionKey].review) {
      store.sessions[sessionKey].review!.hidden = newHidden;
    } else {
      const reviews = getAllReviews(true);
      const target = reviews.find(
        (r) => r.pin.toUpperCase() === cleanPin || r.pin.toUpperCase() === rawPin
      );
      if (target) {
        store.sessions[sessionKey].review = {
          name: target.name,
          content: target.content,
          photo: target.photo,
          createdAt: target.createdAt,
          hidden: newHidden,
        };
      }
    }
    savePersistedSessions(store.sessions);
  }

  return { success: true, hidden: newHidden };
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

  // 숫자 또는 번호 입력 지원 (오직 숫자만 있거나 "10번"과 같은 형태일 때만 번호로 매핑)
  if (/^[0-9]+번?$/i.test(input.trim())) {
    const num = parseInt(clean.replace(/[^0-9]/g, ""), 10);
    if (!isNaN(num) && num >= 1 && num <= 100) {
      const padded = String(num).padStart(2, "0");
      const found = Object.values(store.sessions).find(
        (s) => s.nickname.endsWith(`_${num}`) || s.nickname.endsWith(`_${padded}`)
      );
      if (found) return found.pin;
    }
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
  if (clientState.hasReviewed || clientState.review) {
    session.hasReviewed = true;
    if (clientState.review) {
      // Preserve existing hidden state if set by admin or present in cachedHiddenPins
      const isHidden = cachedHiddenPins.has(pin.toUpperCase()) || session.review?.hidden === true;
      session.review = {
        ...session.review,
        ...clientState.review,
        hidden: isHidden,
      };
      saveReviewToCache({
        name: session.review.name || session.nickname || "명탐정",
        content: session.review.content || "",
        photo: session.review.photo || null,
        createdAt: session.review.createdAt || Date.now(),
        hidden: isHidden,
        pin,
      });
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
  reviewInput: { name: string; content: string; photo?: string | null; isCleared?: boolean }
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

  // 클라이언트 클리어 플래그 동기화
  if (reviewInput.isCleared) {
    session.isCleared = true;
    if (session.currentRoom <= 10) {
      session.currentRoom = 11;
    }
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
