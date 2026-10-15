import fs from "fs";
import path from "path";
import { put } from "@vercel/blob";
import { PlayerSession, ReviewData, generateDefaultPins } from "../data/pins";
import { PUZZLES } from "../data/puzzles";
import { SEED_REVIEWS } from "../data/seedReviews";
import {
  getSupabaseAdmin,
  isSupabaseConfigured,
  DbSession,
  DbReview,
} from "./supabase";
import { getPinOrder } from "../data/pinOrder";

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

// ==============================================================================
// 1. DTO Mappers: Supabase PostgreSQL <-> TypeScript Domain Models
// ==============================================================================

function dbSessionToPlayerSession(
  db: DbSession,
  review?: ReviewData
): PlayerSession {
  return {
    pin: db.pin,
    nickname: db.nickname,
    currentRoom: db.current_room,
    startedAt: db.started_at ? Number(db.started_at) : null,
    roomEnteredAt: db.room_entered_at ? Number(db.room_entered_at) : null,
    unlockedHints: Array.isArray(db.unlocked_hints) ? db.unlocked_hints : [],
    lastHintUnlockedAt: db.last_hint_unlocked_at
      ? Number(db.last_hint_unlocked_at)
      : null,
    isCleared: !!db.is_cleared,
    clearedAt: db.cleared_at ? Number(db.cleared_at) : null,
    totalTimeSeconds: db.total_time_seconds || 0,
    totalHintsUsed: db.total_hints_used || 0,
    lastActiveAt: db.last_active_at ? Number(db.last_active_at) : null,
    status: db.status || (db.is_cleared ? "cleared" : "ready"),
    hasReviewed: !!db.has_reviewed,
    review,
  };
}

function dbReviewToReviewData(db: DbReview): ReviewData & { pin: string } {
  return {
    pin: db.pin,
    name: db.author_name,
    content: db.content,
    photo: db.photo_url || null,
    createdAt: Number(db.created_at),
    hidden: !!db.is_hidden,
  };
}

// ==============================================================================
// 2. Hidden Pins Management (Fallback / In-Memory Cache)
// ==============================================================================

export async function fetchHiddenPins(): Promise<Set<string>> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("escape_reviews")
          .select("pin")
          .eq("is_hidden", true);
        if (!error && data) {
          cachedHiddenPins = new Set(
            data.map((r: { pin: string }) => r.pin.trim().toUpperCase())
          );
          return cachedHiddenPins;
        }
      } catch (e) {
        console.warn("Supabase fetch hidden reviews failed:", e);
      }
    }
  }

  const now = Date.now();
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
        cachedHiddenPins = new Set(
          data.map((p) => String(p).trim().toUpperCase())
        );
        return cachedHiddenPins;
      }
    }
  } catch (e) {
    console.warn("Failed to fetch hidden pins from Blob:", e);
  }

  try {
    if (fs.existsSync(HIDDEN_FILE)) {
      const data = JSON.parse(fs.readFileSync(HIDDEN_FILE, "utf-8"));
      if (Array.isArray(data)) {
        cachedHiddenPins = new Set(
          data.map((p) => String(p).trim().toUpperCase())
        );
      }
    }
  } catch {}

  return cachedHiddenPins;
}

export async function saveHiddenPins(pinsSet: Set<string>): Promise<void> {
  cachedHiddenPins = pinsSet;
  lastHiddenPinsFetchAt = Date.now();
  const arr = Array.from(pinsSet);

  try {
    fs.writeFileSync(HIDDEN_FILE, JSON.stringify(arr, null, 2));
  } catch {}

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

// ==============================================================================
// 3. Admin Memos & Nicknames
// ==============================================================================

const MEMOS_FILE = path.join("/tmp", "escaperoom_admin_memos.json");
let cachedAdminMemos: Record<string, string> = {};
let lastAdminMemosFetchAt = 0;

export async function fetchAdminMemos(): Promise<Record<string, string>> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("escape_sessions")
          .select("pin, nickname");
        if (!error && data) {
          const map: Record<string, string> = {};
          data.forEach((r: { pin: string; nickname: string }) => {
            map[r.pin.trim().toUpperCase()] = r.nickname;
          });
          cachedAdminMemos = map;
          return cachedAdminMemos;
        }
      } catch (e) {
        console.warn("Supabase fetch memos failed:", e);
      }
    }
  }

  const now = Date.now();
  if (
    now - lastAdminMemosFetchAt < 2000 &&
    Object.keys(cachedAdminMemos).length > 0
  ) {
    return cachedAdminMemos;
  }
  lastAdminMemosFetchAt = now;

  try {
    const res = await fetch(
      `${BLOB_BASE_URL}/admin_memos.json?_t=${now}_${Math.random().toString(36).substring(7)}`,
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
      if (data && typeof data === "object") {
        cachedAdminMemos = data;
        try {
          fs.writeFileSync(MEMOS_FILE, JSON.stringify(data, null, 2));
        } catch {}
        return cachedAdminMemos;
      }
    }
  } catch (e) {
    console.warn("Failed to fetch admin memos from Blob:", e);
  }

  try {
    if (fs.existsSync(MEMOS_FILE)) {
      const data = JSON.parse(fs.readFileSync(MEMOS_FILE, "utf-8"));
      if (data && typeof data === "object") {
        cachedAdminMemos = data;
      }
    }
  } catch {}

  return cachedAdminMemos;
}

export async function saveAdminMemos(
  memos: Record<string, string>
): Promise<void> {
  cachedAdminMemos = memos;
  lastAdminMemosFetchAt = Date.now();

  try {
    fs.writeFileSync(MEMOS_FILE, JSON.stringify(memos, null, 2));
  } catch {}

  try {
    await put("admin_memos.json", JSON.stringify(memos), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  } catch (e) {
    console.error("Failed to save admin memos to Vercel Blob:", e);
  }
}

export async function updateSessionNickname(
  pin: string,
  newNickname: string
): Promise<boolean> {
  const cleanPin = resolvePin(pin).toUpperCase();
  const trimmed = newNickname.trim() || `탐정_${cleanPin}`;

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        const { error } = await supabase
          .from("escape_sessions")
          .update({ nickname: trimmed })
          .eq("pin", cleanPin);
        if (!error) {
          cachedAdminMemos[cleanPin] = trimmed;
          return true;
        }
        console.error("Supabase update nickname failed:", error);
      } catch (e) {
        console.error("Supabase update nickname exception:", e);
      }
    }
  }

  // Fallback to local store & Blob
  const store = getStore();
  const session = store.sessions[cleanPin];
  if (!session) return false;

  session.nickname = trimmed;
  store.sessions[cleanPin] = session;
  savePersistedSessions(store.sessions);

  const memos = await fetchAdminMemos();
  memos[cleanPin] = session.nickname;
  await saveAdminMemos(memos);

  return true;
}

// ==============================================================================
// 4. Reviews Management (Supabase SSOT + Graceful Fallback)
// ==============================================================================

let lastBlobReviewsFetchAt = 0;
let cachedBlobReviews: Array<ReviewData & { pin: string }> = [];

export async function fetchReviewsFromBlob(): Promise<Array<ReviewData & { pin: string }>> {
  const now = Date.now();
  if (now - lastBlobReviewsFetchAt < 1000 && cachedBlobReviews.length > 0) {
    return cachedBlobReviews;
  }
  lastBlobReviewsFetchAt = now;

  try {
    const res = await fetch(
      `${BLOB_BASE_URL}/escaperoom_reviews.json?_t=${now}_${Math.random().toString(36).substring(7)}`,
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
      if (Array.isArray(data) && data.length > 0) {
        cachedBlobReviews = data;
        try {
          fs.writeFileSync(REVIEWS_FILE, JSON.stringify(data, null, 2));
        } catch {}
        return cachedBlobReviews;
      }
    }
  } catch (e) {
    console.warn("Failed to fetch reviews from Vercel Blob:", e);
  }

  return cachedBlobReviews;
}

export async function saveReviewToDurableStore(
  reviewWithPin: ReviewData & { pin: string }
): Promise<void> {
  const list = getAllReviews(true);
  const pinKey = reviewWithPin.pin.toUpperCase();
  const hiddenPins = await fetchHiddenPins();
  const isHidden = hiddenPins.has(pinKey) || reviewWithPin.hidden === true;

  const filtered = list.filter((r) => r.pin.toUpperCase() !== pinKey);
  filtered.unshift({ ...reviewWithPin, hidden: isHidden });
  cachedBlobReviews = filtered;

  try {
    fs.writeFileSync(REVIEWS_FILE, JSON.stringify(filtered, null, 2));
  } catch {}

  try {
    await put("escaperoom_reviews.json", JSON.stringify(filtered), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  } catch (e) {
    console.error("Failed to save review to Vercel Blob:", e);
  }
}

export async function getAllReviewsAsync(
  includeHidden = false
): Promise<Array<ReviewData & { pin: string }>> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        let query = supabase
          .from("escape_reviews")
          .select("pin, author_name, content, photo_url, is_hidden, created_at")
          .order("created_at", { ascending: false });

        if (!includeHidden) {
          query = query.eq("is_hidden", false);
        }

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          return data.map((d: DbReview) => dbReviewToReviewData(d));
        }
        if (error) {
          console.error("Supabase getAllReviewsAsync error:", error);
        }
      } catch (e) {
        console.warn("Supabase getAllReviewsAsync failed:", e);
      }
    }
  }

  // Fallback 1: Vercel Blob durable storage (cross-lambda synced)
  try {
    const blobReviews = await fetchReviewsFromBlob();
    if (blobReviews.length > 0) {
      const hiddenPins = await fetchHiddenPins();
      const list = blobReviews.map((r) => ({
        ...r,
        hidden: hiddenPins.has(r.pin.toUpperCase()),
      }));
      return includeHidden ? list : list.filter((r) => !r.hidden);
    }
  } catch {}

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

  SEED_REVIEWS.forEach((r) => {
    const pinKey = r.pin.toUpperCase();
    reviewMap.set(pinKey, {
      ...r,
      hidden: hiddenPins.has(pinKey),
    });
  });

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
const SHEET_SYNC_INTERVAL = 15 * 1000;

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
    const supabase = isSupabaseConfigured() ? getSupabaseAdmin() : null;

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
        const parsedDate = new Date(
          dateStr.replace(" ", "T") + "+09:00"
        ).getTime();
        const createdAt = !isNaN(parsedDate) ? parsedDate : Date.now();
        const isHidden = hiddenPins.has(cleanPin);

        if (supabase) {
          await supabase.from("escape_reviews").upsert(
            {
              pin: cleanPin,
              author_name: name || "익명 탐정",
              content,
              photo_url: photo,
              is_hidden: isHidden,
              created_at: createdAt,
            },
            { onConflict: "pin" }
          );
        } else {
          saveReviewToCache({
            pin: cleanPin,
            name: name || "익명 탐정",
            content,
            photo,
            createdAt,
            hidden: isHidden,
          });
        }
      }
    }
  } catch (e) {
    console.error("Failed to sync reviews from Google Sheet:", e);
  }
}

function saveReviewToCache(reviewWithPin: ReviewData & { pin: string }) {
  saveReviewToDurableStore(reviewWithPin).catch((e) => {
    console.error("Failed to save review to durable cache:", e);
  });
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

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        const { error } = await supabase
          .from("escape_reviews")
          .update({ is_hidden: newHidden })
          .or(`pin.eq.${cleanPin},pin.eq.${rawPin}`);

        if (!error) {
          if (newHidden) {
            hiddenPins.add(cleanPin);
            hiddenPins.add(rawPin);
          } else {
            hiddenPins.delete(cleanPin);
            hiddenPins.delete(rawPin);
          }
          await saveHiddenPins(hiddenPins);
          return { success: true, hidden: newHidden };
        }
      } catch (e) {
        console.error("Supabase toggleReviewVisibility error:", e);
      }
    }
  }

  // Fallback
  if (newHidden) {
    hiddenPins.add(cleanPin);
    hiddenPins.add(rawPin);
  } else {
    hiddenPins.delete(cleanPin);
    hiddenPins.delete(rawPin);
  }
  await saveHiddenPins(hiddenPins);

  try {
    const list = getAllReviews(true);
    fs.writeFileSync(REVIEWS_FILE, JSON.stringify(list, null, 2));
  } catch {}

  const store = getStore();
  const sessionKey = store.sessions[cleanPin]
    ? cleanPin
    : Object.keys(store.sessions).find((k) => k.toUpperCase() === rawPin);

  if (sessionKey && store.sessions[sessionKey]) {
    if (store.sessions[sessionKey].review) {
      store.sessions[sessionKey].review!.hidden = newHidden;
    }
    savePersistedSessions(store.sessions);
  }

  return { success: true, hidden: newHidden };
}

// ==============================================================================
// 5. Sessions Management (Supabase SSOT + Fallback)
// ==============================================================================

interface GlobalStore {
  sessions: Record<string, PlayerSession>;
}

declare global {
  // eslint-disable-next-line no-var
  var __escapeStore: GlobalStore | undefined;
}

function loadPersistedSessions(): Record<string, PlayerSession> {
  const defaultPins = generateDefaultPins();
  let sessions = defaultPins;
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, "utf-8");
      const parsed = JSON.parse(data);
      sessions = { ...defaultPins, ...parsed };
    }
  } catch (e) {
    console.error("Failed to load sessions from /tmp:", e);
  }

  try {
    if (fs.existsSync(MEMOS_FILE)) {
      const memos = JSON.parse(fs.readFileSync(MEMOS_FILE, "utf-8"));
      if (memos && typeof memos === "object") {
        Object.entries(memos).forEach(([pin, memo]) => {
          if (sessions[pin] && typeof memo === "string" && memo.trim()) {
            sessions[pin].nickname = memo.trim();
          }
        });
      }
    }
  } catch {}

  return sessions;
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
  return Object.values(store.sessions).sort(
    (a, b) => getPinOrder(a.pin) - getPinOrder(b.pin)
  );
}

export async function getAllSessionsAsync(): Promise<PlayerSession[]> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        const [sessionsRes, reviewsRes] = await Promise.all([
          supabase.from("escape_sessions").select("*"),
          supabase.from("escape_reviews").select("*"),
        ]);

        if (!sessionsRes.error && sessionsRes.data) {
          const reviewsMap = new Map<string, ReviewData>();
          if (!reviewsRes.error && reviewsRes.data) {
            reviewsRes.data.forEach((r: DbReview) => {
              reviewsMap.set(r.pin.trim().toUpperCase(), {
                name: r.author_name,
                content: r.content,
                photo: r.photo_url || null,
                createdAt: Number(r.created_at),
                hidden: !!r.is_hidden,
              });
            });
          }

          const list = sessionsRes.data.map((db: DbSession) =>
            dbSessionToPlayerSession(
              db,
              reviewsMap.get(db.pin.trim().toUpperCase())
            )
          );
          return list.sort((a, b) => getPinOrder(a.pin) - getPinOrder(b.pin));
        }
      } catch (e) {
        console.warn("Supabase getAllSessionsAsync failed:", e);
      }
    }
  }

  const memos = await fetchAdminMemos();
  const store = getStore();
  Object.entries(memos).forEach(([pin, memo]) => {
    if (store.sessions[pin] && typeof memo === "string" && memo.trim()) {
      store.sessions[pin].nickname = memo.trim();
    }
  });
  return Object.values(store.sessions).sort(
    (a, b) => getPinOrder(a.pin) - getPinOrder(b.pin)
  );
}

export function resolvePin(input: string): string {
  const clean = input.trim().toUpperCase();
  const store = getStore();
  if (store.sessions[clean]) return clean;

  if (/^[0-9]+번?$/i.test(input.trim())) {
    const num = parseInt(clean.replace(/[^0-9]/g, ""), 10);
    if (!isNaN(num) && num >= 1 && num <= 100) {
      const padded = String(num).padStart(2, "0");
      const found = Object.values(store.sessions).find(
        (s) =>
          s.nickname.endsWith(`_${num}`) || s.nickname.endsWith(`_${padded}`)
      );
      if (found) return found.pin;
    }
  }
  return clean;
}

export async function getSessionAsync(pin: string): Promise<PlayerSession | null> {
  const cleanPin = resolvePin(pin).toUpperCase();

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        const [sessionRes, reviewRes] = await Promise.all([
          supabase.from("escape_sessions").select("*").eq("pin", cleanPin).maybeSingle(),
          supabase.from("escape_reviews").select("*").eq("pin", cleanPin).maybeSingle(),
        ]);

        if (!sessionRes.error && sessionRes.data) {
          let reviewData: ReviewData | undefined = undefined;
          if (!reviewRes.error && reviewRes.data) {
            reviewData = {
              name: reviewRes.data.author_name,
              content: reviewRes.data.content,
              photo: reviewRes.data.photo_url || null,
              createdAt: Number(reviewRes.data.created_at),
              hidden: !!reviewRes.data.is_hidden,
            };
          }
          return dbSessionToPlayerSession(sessionRes.data, reviewData);
        }
      } catch (e) {
        console.warn("Supabase getSessionAsync failed:", e);
      }
    }
  }

  return getSession(cleanPin);
}

export function getSession(pin: string): PlayerSession | null {
  const store = getStore();
  const cleanPin = resolvePin(pin);

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

export async function startOrResumeSessionAsync(
  pin: string,
  customNickname?: string
): Promise<PlayerSession> {
  const cleanPin = resolvePin(pin).toUpperCase();
  const now = Date.now();

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const existing = await getSessionAsync(cleanPin);
      if (!existing) {
        throw new Error("유효하지 않은 수사 암호입니다. 암호를 다시 확인해주세요.");
      }

      const updates: Partial<DbSession> = {
        last_active_at: now,
      };

      if (!existing.startedAt) {
        updates.started_at = now;
        updates.room_entered_at = now;
        updates.status = "playing";
      } else if (!existing.roomEnteredAt) {
        updates.room_entered_at = now;
      }

      if (customNickname && customNickname.trim()) {
        updates.nickname = customNickname.trim();
      }

      const { data, error } = await supabase
        .from("escape_sessions")
        .update(updates)
        .eq("pin", cleanPin)
        .select("*")
        .single();

      if (!error && data) {
        return dbSessionToPlayerSession(data, existing.review);
      }
    }
  }

  return startOrResumeSession(cleanPin, customNickname);
}

export function startOrResumeSession(
  pin: string,
  customNickname?: string
): PlayerSession {
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

export async function syncClientSessionAsync(
  clientState: Partial<PlayerSession> & { pin: string }
): Promise<PlayerSession> {
  const cleanPin = resolvePin(clientState.pin).toUpperCase();
  const now = Date.now();

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const existing = await getSessionAsync(cleanPin);
      if (existing) {
        const updates: Partial<DbSession> = {
          last_active_at: now,
        };

        if (clientState.currentRoom && clientState.currentRoom >= existing.currentRoom) {
          updates.current_room = clientState.currentRoom;
          updates.room_entered_at = clientState.roomEnteredAt || now;
        }

        if (clientState.isCleared) {
          updates.is_cleared = true;
          updates.cleared_at = clientState.clearedAt || now;
          updates.status = "cleared";
          if (clientState.totalTimeSeconds) {
            updates.total_time_seconds = clientState.totalTimeSeconds;
          }
        }

        if (typeof clientState.totalHintsUsed === "number") {
          updates.total_hints_used = Math.max(
            existing.totalHintsUsed || 0,
            clientState.totalHintsUsed
          );
        }

        if (clientState.startedAt && !existing.startedAt) {
          updates.started_at = clientState.startedAt;
        }

        if (
          clientState.unlockedHints &&
          clientState.unlockedHints.length >= existing.unlockedHints.length
        ) {
          updates.unlocked_hints = clientState.unlockedHints;
        }

        if (clientState.hasReviewed) {
          updates.has_reviewed = true;
        }

        const { data, error } = await supabase
          .from("escape_sessions")
          .update(updates)
          .eq("pin", cleanPin)
          .select("*")
          .single();

        if (!error && data) {
          return dbSessionToPlayerSession(data, existing.review);
        }
      }
    }
  }

  return syncClientSession(clientState);
}

export function syncClientSession(
  clientState: Partial<PlayerSession> & { pin: string }
): PlayerSession {
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
    session.totalTimeSeconds =
      clientState.totalTimeSeconds || session.totalTimeSeconds;
  }
  if (typeof clientState.totalHintsUsed === "number") {
    session.totalHintsUsed = Math.max(
      session.totalHintsUsed || 0,
      clientState.totalHintsUsed
    );
  }
  if (clientState.startedAt) {
    session.startedAt = clientState.startedAt;
  }
  if (
    clientState.unlockedHints &&
    clientState.unlockedHints.length >= session.unlockedHints.length
  ) {
    session.unlockedHints = clientState.unlockedHints;
  }
  if (clientState.hasReviewed) {
    session.hasReviewed = true;
  }

  session.lastActiveAt = now;
  store.sessions[pin] = session;
  savePersistedSessions(store.sessions);
  return session;
}

export async function submitAnswerAsync(
  pin: string,
  rawAnswer: string,
  clientCurrentRoom?: number
): Promise<{
  success: boolean;
  nextRoom?: number;
  isCleared?: boolean;
  message?: string;
  totalTimeSeconds?: number;
  totalHintsUsed?: number;
  session?: PlayerSession;
}> {
  const cleanPin = resolvePin(pin).toUpperCase();
  const session = await getSessionAsync(cleanPin);
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

  const sanitizedInput = rawAnswer.replace(/\s+/g, "").toUpperCase();
  const correctAnswer = currentPuzzle.answer.replace(/\s+/g, "").toUpperCase();

  if (sanitizedInput !== correctAnswer) {
    return { success: false, message: "오답입니다! 단서를 다시 확인해보세요." };
  }

  const now = Date.now();
  const nextRoomNum = roomToValidate + 1;
  const isCleared = nextRoomNum > 10;
  const totalTime =
    isCleared && session.startedAt
      ? Math.max(1, Math.floor((now - session.startedAt) / 1000))
      : session.totalTimeSeconds;

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const updates: Partial<DbSession> = {
        last_active_at: now,
      };

      if (isCleared) {
        updates.current_room = 11;
        updates.is_cleared = true;
        updates.cleared_at = now;
        updates.status = "cleared";
        updates.total_time_seconds = totalTime;
      } else {
        updates.current_room = nextRoomNum;
        updates.room_entered_at = now;
        updates.unlocked_hints = [];
        updates.last_hint_unlocked_at = null;
        updates.status = "playing";
      }

      const { data, error } = await supabase
        .from("escape_sessions")
        .update(updates)
        .eq("pin", cleanPin)
        .select("*")
        .single();

      if (!error && data) {
        const updatedSession = dbSessionToPlayerSession(data, session.review);
        return {
          success: true,
          nextRoom: updatedSession.isCleared ? 10 : updatedSession.currentRoom,
          isCleared: updatedSession.isCleared,
          totalTimeSeconds: updatedSession.totalTimeSeconds,
          totalHintsUsed: updatedSession.totalHintsUsed,
          session: updatedSession,
          message: updatedSession.isCleared
            ? "축하합니다! 모든 방탈출을 완료했습니다!"
            : "정답입니다! 다음 방으로 이동합니다.",
        };
      }
    }
  }

  return submitAnswer(pin, rawAnswer, clientCurrentRoom);
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

  const sanitizedInput = rawAnswer.replace(/\s+/g, "").toUpperCase();
  const correctAnswer = currentPuzzle.answer.replace(/\s+/g, "").toUpperCase();

  if (sanitizedInput !== correctAnswer) {
    return { success: false, message: "오답입니다! 단서를 다시 확인해보세요." };
  }

  const now = Date.now();
  const nextRoomNum = roomToValidate + 1;

  if (nextRoomNum > 10) {
    session.currentRoom = 11;
    session.isCleared = true;
    session.clearedAt = now;
    session.status = "cleared";
    if (session.startedAt) {
      session.totalTimeSeconds = Math.max(
        1,
        Math.floor((now - session.startedAt) / 1000)
      );
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
    message: session.isCleared
      ? "축하합니다! 모든 방탈출을 완료했습니다!"
      : "정답입니다! 다음 방으로 이동합니다.",
  };
}

export async function unlockHintAsync(
  pin: string,
  clientCurrentRoom?: number
): Promise<{
  success: boolean;
  hintIndex?: number;
  hintText?: string;
  unlockedHints?: number[];
  totalHintsUsed?: number;
  message?: string;
  remainingCooldown?: number;
}> {
  const cleanPin = resolvePin(pin).toUpperCase();
  const session = await getSessionAsync(cleanPin);
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
    return {
      success: false,
      message: "이 방의 모든 힌트와 정답을 이미 열람했습니다.",
    };
  }

  const cooldownDuration = 30; // 모든 힌트 30초 쿨다운
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

  const newUnlocked = [...session.unlockedHints, nextHintIdx];
  const newTotalHints = (session.totalHintsUsed || 0) + 1;

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { error } = await supabase
        .from("escape_sessions")
        .update({
          unlocked_hints: newUnlocked,
          total_hints_used: newTotalHints,
          last_hint_unlocked_at: now,
          last_active_at: now,
        })
        .eq("pin", cleanPin);

      if (!error) {
        return {
          success: true,
          hintIndex: nextHintIdx,
          hintText: puzzle.hints[nextHintIdx],
          unlockedHints: newUnlocked,
          totalHintsUsed: newTotalHints,
        };
      }
    }
  }

  return unlockHint(pin, clientCurrentRoom);
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
    return {
      success: false,
      message: "이 방의 모든 힌트와 정답을 이미 열람했습니다.",
    };
  }

  const cooldownDuration = 30; // 모든 힌트 30초 쿨다운
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

export async function passRoomAdminAsync(
  pin: string
): Promise<{ success: boolean; nextRoom?: number; isCleared?: boolean }> {
  const cleanPin = resolvePin(pin).toUpperCase();
  const session = await getSessionAsync(cleanPin);
  if (!session) return { success: false };

  const now = Date.now();
  const isCleared = session.currentRoom >= 10;
  const nextRoom = isCleared ? 11 : session.currentRoom + 1;

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const updates: Partial<DbSession> = {
        last_active_at: now,
      };

      if (!session.startedAt) {
        updates.started_at = now;
      }

      if (isCleared) {
        updates.is_cleared = true;
        updates.cleared_at = now;
        updates.status = "cleared";
        updates.current_room = 11;
        const startTime = session.startedAt || now;
        updates.total_time_seconds = Math.max(
          1,
          Math.floor((now - startTime) / 1000)
        );
      } else {
        updates.current_room = nextRoom;
        updates.room_entered_at = now;
        updates.unlocked_hints = [];
        updates.last_hint_unlocked_at = null;
        updates.status = "playing";
      }

      const { error } = await supabase
        .from("escape_sessions")
        .update(updates)
        .eq("pin", cleanPin);

      if (!error) {
        return { success: true, nextRoom, isCleared };
      }
    }
  }

  return passRoomAdmin(pin);
}

export function passRoomAdmin(
  pin: string
): { success: boolean; nextRoom?: number; isCleared?: boolean } {
  const cleanPin = resolvePin(pin);
  const session = getSession(cleanPin);
  if (!session) return { success: false };

  const now = Date.now();
  if (!session.startedAt) {
    session.startedAt = now;
  }

  if (session.currentRoom >= 10) {
    session.isCleared = true;
    session.clearedAt = now;
    session.status = "cleared";
    session.currentRoom = 11;
    session.totalTimeSeconds = Math.max(
      1,
      Math.floor((now - session.startedAt) / 1000)
    );
  } else {
    session.currentRoom += 1;
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
    nextRoom: session.currentRoom,
    isCleared: session.isCleared,
  };
}


export async function resetSessionAsync(pin?: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      if (pin) {
        const cleanPin = resolvePin(pin).toUpperCase();
        await supabase
          .from("escape_sessions")
          .update({
            current_room: 1,
            started_at: null,
            room_entered_at: null,
            unlocked_hints: [],
            last_hint_unlocked_at: null,
            is_cleared: false,
            cleared_at: null,
            total_time_seconds: 0,
            total_hints_used: 0,
            last_active_at: null,
            status: "ready",
            has_reviewed: false,
          })
          .eq("pin", cleanPin);
        await supabase.from("escape_reviews").delete().eq("pin", cleanPin);
      } else {
        await supabase
          .from("escape_sessions")
          .update({
            current_room: 1,
            started_at: null,
            room_entered_at: null,
            unlocked_hints: [],
            last_hint_unlocked_at: null,
            is_cleared: false,
            cleared_at: null,
            total_time_seconds: 0,
            total_hints_used: 0,
            last_active_at: null,
            status: "ready",
            has_reviewed: false,
          })
          .neq("pin", "");
        await supabase.from("escape_reviews").delete().neq("id", 0);
      }
    }
  }

  resetSession(pin);
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

export async function submitReviewAsync(
  pin: string,
  reviewInput: {
    name: string;
    content: string;
    photo?: string | null;
    isCleared?: boolean;
  }
): Promise<{
  success: boolean;
  message: string;
  review?: ReviewData;
  session?: PlayerSession;
}> {
  const cleanPin = resolvePin(pin).toUpperCase();
  const session = await getSessionAsync(cleanPin);
  if (!session) {
    return { success: false, message: "세션을 찾을 수 없습니다." };
  }

  if (session.hasReviewed) {
    return {
      success: false,
      message:
        "이미 후기를 등록하셨습니다. 후기는 1회만 등록 가능하며 수정할 수 없습니다.",
      review: session.review,
      session,
    };
  }

  if (reviewInput.isCleared) {
    session.isCleared = true;
    if (session.currentRoom <= 10) {
      session.currentRoom = 11;
    }
  }

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
    return {
      success: false,
      message: "후기 내용을 최소 2자 이상 작성해주세요.",
    };
  }

  const now = Date.now();
  const review: ReviewData = {
    name,
    content,
    photo: reviewInput.photo || null,
    createdAt: now,
  };

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        const { error: reviewErr } = await supabase
          .from("escape_reviews")
          .upsert(
            {
              pin: cleanPin,
              author_name: name,
              content,
              photo_url: reviewInput.photo || null,
              is_hidden: false,
              created_at: now,
            },
            { onConflict: "pin" }
          );

        if (!reviewErr) {
          await supabase
            .from("escape_sessions")
            .update({
              has_reviewed: true,
              is_cleared: true,
              current_room: Math.max(11, session.currentRoom),
              last_active_at: now,
            })
            .eq("pin", cleanPin);

          session.hasReviewed = true;
          session.review = review;

          // Vercel Blob 및 로컬 캐시에도 백업 저장
          await saveReviewToDurableStore({ ...review, pin: cleanPin });

          return {
            success: true,
            message: "소중한 후기가 성공적으로 등록되었습니다!",
            review,
            session,
          };
        }
        console.error("Supabase review submit failed:", reviewErr);
      } catch (e) {
        console.error("Supabase review submit exception:", e);
      }
    }
  }

  // Fallback: Blob 및 로컬 캐시에 저장
  await saveReviewToDurableStore({ ...review, pin: cleanPin });
  return submitReview(pin, reviewInput);
}

export function submitReview(
  pin: string,
  reviewInput: {
    name: string;
    content: string;
    photo?: string | null;
    isCleared?: boolean;
  }
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

  if (session.hasReviewed) {
    return {
      success: false,
      message:
        "이미 후기를 등록하셨습니다. 후기는 1회만 등록 가능하며 수정할 수 없습니다.",
      review: session.review,
      session,
    };
  }

  if (reviewInput.isCleared) {
    session.isCleared = true;
    if (session.currentRoom <= 10) {
      session.currentRoom = 11;
    }
  }

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
    return {
      success: false,
      message: "후기 내용을 최소 2자 이상 작성해주세요.",
    };
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
