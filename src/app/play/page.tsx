"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Lightbulb,
  Send,
  ZoomIn,
  Clock,
  User,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import TypewriterText from "@/components/TypewriterText";
import HintModal from "@/components/HintModal";
import LightboxModal from "@/components/LightboxModal";

interface PuzzleData {
  roomNumber: number;
  title: string;
  image: string;
  dialogue: string;
  question: string;
  totalHints: number;
}

interface HintItem {
  index: number;
  text: string;
}

export default function PlayPage() {
  const router = useRouter();

  // Core state
  const [pin, setPin] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string>("탐정 조수");
  const [currentRoom, setCurrentRoom] = useState<number>(1);
  const [puzzle, setPuzzle] = useState<PuzzleData | null>(null);
  const [unlockedHints, setUnlockedHints] = useState<HintItem[]>([]);
  const [totalPuzzles, setTotalPuzzles] = useState<number>(10);

  // Staging & Animations
  const [isTypingFinished, setIsTypingFinished] = useState<boolean>(false);
  const [isRoomTransitioning, setIsRoomTransitioning] = useState<boolean>(false);
  const [isShaking, setIsShaking] = useState<boolean>(false);

  // Hint cooldown
  const [hintCooldown, setHintCooldown] = useState<number>(60);
  const [canUnlockNext, setCanUnlockNext] = useState<boolean>(false);

  // Modals
  const [isHintModalOpen, setIsHintModalOpen] = useState<boolean>(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false);
  const [isHintLoading, setIsHintLoading] = useState<boolean>(false);

  // Form input & feedback
  const [answerInput, setAnswerInput] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "error" | "success"; text: string } | null>(null);

  // Timestamps
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const startedAtRef = useRef<number | null>(null);
  const roomEnteredAtRef = useRef<number>(Date.now());
  const lastHintAtRef = useRef<number | null>(null);

  // Cooldown countdown timer (strictly 60s per step)
  useEffect(() => {
    const timer = setInterval(() => {
      if (startedAtRef.current) {
        setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }

      const baseTime = lastHintAtRef.current || roomEnteredAtRef.current;
      const elapsedSinceBase = Math.floor((Date.now() - baseTime) / 1000);
      const remaining = Math.max(0, 60 - elapsedSinceBase);
      setHintCooldown(remaining);
      setCanUnlockNext(remaining === 0 && (puzzle ? unlockedHints.length < puzzle.totalHints : false));
    }, 1000);

    return () => clearInterval(timer);
  }, [puzzle, unlockedHints.length]);

  // Load session from server
  const loadGameState = useCallback(async (activePin: string) => {
    try {
      const res = await fetch(`/api/game/state?pin=${activePin}`);
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 404) {
          localStorage.removeItem("escape_session");
          router.push("/");
          return;
        }
        return;
      }

      if (data.isCleared) {
        router.push("/clear");
        return;
      }

      const s = data.session;
      setNickname(s.nickname || "탐정 조수");
      setCurrentRoom(s.currentRoom);
      setPuzzle(data.puzzle);
      setUnlockedHints(data.unlockedHints || []);
      setTotalPuzzles(data.totalPuzzles || 10);

      if (s.startedAt) startedAtRef.current = s.startedAt;
      if (s.roomEnteredAt) roomEnteredAtRef.current = s.roomEnteredAt;
      if (s.lastHintUnlockedAt) lastHintAtRef.current = s.lastHintUnlockedAt;

      // Update cooldown based on server data
      const base = s.lastHintUnlockedAt || s.roomEnteredAt || Date.now();
      const elapsed = Math.floor((Date.now() - base) / 1000);
      const rem = Math.max(0, 60 - elapsed);
      setHintCooldown(rem);
      setCanUnlockNext(rem === 0 && (data.puzzle ? (data.unlockedHints || []).length < data.puzzle.totalHints : false));

      localStorage.setItem("escape_session", JSON.stringify(s));
    } catch (e) {
      console.warn("Failed to load game state:", e);
    }
  }, [router]);

  // Initial session mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("escape_session");
      if (!saved) {
        router.push("/");
        return;
      }
      const parsed = JSON.parse(saved);
      if (!parsed.pin) {
        router.push("/");
        return;
      }

      setPin(parsed.pin);
      setNickname(parsed.nickname || `탐정_${parsed.pin}`);
      setCurrentRoom(parsed.currentRoom || 1);
      if (parsed.startedAt) startedAtRef.current = parsed.startedAt;
      if (parsed.roomEnteredAt) roomEnteredAtRef.current = parsed.roomEnteredAt;
      if (parsed.lastHintUnlockedAt) lastHintAtRef.current = parsed.lastHintUnlockedAt;

      loadGameState(parsed.pin);
    } catch {
      router.push("/");
    }
  }, [loadGameState, router]);

  // Periodic heartbeat sync
  useEffect(() => {
    if (!pin) return;
    const interval = setInterval(() => {
      fetch("/api/game/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin,
          currentRoom,
          startedAt: startedAtRef.current,
          roomEnteredAt: roomEnteredAtRef.current,
        }),
      }).catch(() => {});
    }, 15000);

    return () => clearInterval(interval);
  }, [pin, currentRoom]);

  // Stable callback for typing completion
  const handleTypingComplete = useCallback(() => {
    setIsTypingFinished(true);
  }, []);

  // Format seconds to mm:ss
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // Open Hint Modal
  const handleHintButtonClick = () => {
    // If cooldown has finished and 0 hints unlocked yet, unlock Hint 1 automatically
    if (unlockedHints.length === 0 && canUnlockNext) {
      handleUnlockNextHint();
    }
    setIsHintModalOpen(true);
  };

  // Unlock next hint in the modal
  const handleUnlockNextHint = async () => {
    if (!pin) return;
    setIsHintLoading(true);
    try {
      const res = await fetch("/api/game/hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, roomNumber: currentRoom }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setFeedbackMsg({ type: "error", text: data.message || "단서 해금 실패" });
        setIsHintLoading(false);
        return;
      }

      // Append new hint to unlocked list
      const newHintItem: HintItem = {
        index: data.hintIndex,
        text: data.hintText,
      };
      setUnlockedHints((prev) => [...prev, newHintItem]);
      lastHintAtRef.current = Date.now();
      setHintCooldown(60);
      setCanUnlockNext(false);
      setIsHintModalOpen(true);
    } catch {
      setFeedbackMsg({ type: "error", text: "단서를 불러오는 중 통신 에러가 발생했습니다." });
    } finally {
      setIsHintLoading(false);
    }
  };

  // Handle Submit Answer
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin || !answerInput.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setFeedbackMsg(null);

    try {
      const res = await fetch("/api/game/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, answer: answerInput, roomNumber: currentRoom }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 500);
        setFeedbackMsg({
          type: "error",
          text: data.message || "오답입니다! 단서를 다시 확인해보세요.",
        });
        setIsSubmitting(false);
        return;
      }

      // Correct answer!
      setFeedbackMsg({ type: "success", text: "정답입니다!" });

      if (data.isCleared) {
        router.push("/clear");
      } else {
        // Room transition motion
        setIsRoomTransitioning(true);
        setTimeout(() => {
          // Reset room entered state for the new room
          const now = Date.now();
          roomEnteredAtRef.current = now;
          lastHintAtRef.current = null;
          setHintCooldown(60);
          setCanUnlockNext(false);
          setUnlockedHints([]);
          setIsTypingFinished(false);
          setAnswerInput("");
          setFeedbackMsg(null);
          setCurrentRoom(data.nextRoom);
          setIsRoomTransitioning(false);
          loadGameState(pin);
        }, 500);
      }
    } catch {
      setFeedbackMsg({ type: "error", text: "정답 제출 중 오류가 발생했습니다." });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!puzzle) {
    return (
      <div className="flex-1 min-h-[100dvh] flex flex-col items-center justify-center p-6 text-stone-300">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-mono">사건 파일을 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col flex-1 min-h-[100dvh] bg-[#161311] text-stone-100 overflow-x-hidden">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-[#1e1916]/95 border-b border-stone-800/80 backdrop-blur-md shadow-md">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded bg-amber-950/80 border border-amber-700/60 text-amber-300 text-xs font-mono font-bold">
            CASE {String(currentRoom).padStart(2, "0")} / {totalPuzzles}
          </span>
          <span className="text-xs font-bold text-stone-300 truncate max-w-[120px]">
            {puzzle.title}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-1 text-stone-300">
            <User className="w-3.5 h-3.5 text-amber-400" />
            <span className="truncate max-w-[80px]">{nickname}</span>
          </div>
          <div className="flex items-center gap-1 text-amber-300 bg-black/40 px-2 py-0.5 rounded border border-stone-800">
            <Clock className="w-3.5 h-3.5" />
            <span>{formatTime(elapsedSeconds)}</span>
          </div>
        </div>
      </header>

      {/* Main Play Area */}
      <div
        className={`flex-1 flex flex-col p-4 pb-28 max-w-md mx-auto w-full transition-all ${
          isRoomTransitioning ? "animate-roomSlide opacity-50 scale-95" : ""
        }`}
      >
        {/* Step 1: Upper Detective Dialogue Speech Box */}
        <section className="relative mb-4">
          <div className="p-5 rounded-2xl bg-[#231d19] border-2 border-amber-700/50 shadow-xl relative">
            <div className="flex items-center gap-2 mb-3 text-amber-400 text-xs font-bold tracking-wider">
              <span className="px-2 py-0.5 rounded bg-amber-900/60 border border-amber-700/50 text-[10px]">
                Q{currentRoom}
              </span>
              <span>탐정의 말</span>
            </div>

            <TypewriterText
              key={`dialogue-${currentRoom}`}
              text={puzzle.dialogue}
              speed={35}
              onComplete={handleTypingComplete}
            />
          </div>
        </section>

        {/* Step 2: Bottom Problem Card (Fades in when typing completes) */}
        {isTypingFinished ? (
          <section className="animate-fadeIn flex flex-col gap-4">
            {/* Clue / Problem Image Card */}
            <div className="rounded-2xl bg-[#26201b] border border-stone-700/80 p-3 shadow-2xl relative overflow-hidden group">
              <div className="relative aspect-[9/10] w-full rounded-xl overflow-hidden bg-black/40 border border-stone-800 flex items-center justify-center">
                <Image
                  src={puzzle.image}
                  alt={`문제 ${currentRoom} 단서`}
                  fill
                  priority
                  className="object-contain cursor-zoom-in group-hover:scale-102 transition duration-300"
                  onClick={() => setIsLightboxOpen(true)}
                />

                <button
                  onClick={() => setIsLightboxOpen(true)}
                  className="absolute bottom-3 right-3 p-2 rounded-xl bg-black/75 text-amber-300 hover:text-white backdrop-blur-md border border-amber-600/40 flex items-center gap-1.5 text-xs font-bold shadow-lg"
                >
                  <ZoomIn className="w-4 h-4" />
                  <span>단서 확대</span>
                </button>
              </div>

              {/* Question Text (format guide deleted as requested) */}
              <div className="mt-3 p-3.5 rounded-xl bg-[#1d1815] border border-stone-800">
                <p className="text-stone-100 font-bold text-sm leading-snug">
                  {puzzle.question}
                </p>
                <div className="mt-2 text-right">
                  <span className="text-[11px] text-stone-400">
                    이미지를 터치하면 크게 볼 수 있습니다
                  </span>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <div className="p-8 text-center text-stone-500 text-xs animate-pulse">
            탐정의 말을 경청하고 있습니다...
          </div>
        )}
      </div>

      {/* Step 3: Fixed Bottom Control Bar (Hint Button + Answer Input) */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-[#191512]/95 border-t border-stone-800 backdrop-blur-md px-4 pt-2.5 pb-6 max-w-md mx-auto">
        {feedbackMsg && (
          <div
            className={`mb-2 p-2 rounded-xl text-xs font-bold flex items-center gap-2 ${
              feedbackMsg.type === "error"
                ? "bg-red-950/90 border border-red-700 text-red-200"
                : "bg-emerald-950/90 border border-emerald-700 text-emerald-200"
            }`}
          >
            {feedbackMsg.type === "error" ? (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        {/* Hint button placed directly above input box on the left */}
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={handleHintButtonClick}
            disabled={unlockedHints.length === 0 && hintCooldown > 0}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow ${
              unlockedHints.length > 0
                ? "bg-stone-800 text-amber-300 hover:bg-stone-700 border border-stone-700 cursor-pointer"
                : hintCooldown === 0
                ? "bg-amber-600 text-stone-950 hover:bg-amber-500 animate-pulseGlow cursor-pointer border border-amber-300"
                : "bg-stone-900 text-stone-500 border border-stone-800 cursor-not-allowed opacity-60"
            }`}
          >
            <Lightbulb
              className={`w-3.5 h-3.5 ${
                hintCooldown === 0 && unlockedHints.length === 0 ? "fill-stone-950" : ""
              }`}
            />
            {unlockedHints.length > 0 ? (
              <span>💡 단서 수첩 ({unlockedHints.length}개 확인)</span>
            ) : hintCooldown === 0 ? (
              <span>💡 단서 힌트 열람</span>
            ) : (
              <span>단서 힌트 ({hintCooldown}초 후)</span>
            )}
          </button>
        </div>

        {/* Answer Input Field (Placeholder simplified as requested) */}
        <form
          onSubmit={handleSubmit}
          className={`flex gap-2 ${isShaking ? "animate-shake" : ""}`}
        >
          <input
            type="text"
            value={answerInput}
            onChange={(e) => setAnswerInput(e.target.value.toUpperCase())}
            placeholder="정답을 입력하세요"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck="false"
            className="flex-1 px-4 py-3 rounded-xl bg-stone-900/90 border-2 border-stone-700 text-stone-100 placeholder-stone-500 font-mono text-sm tracking-wider focus:outline-none focus:border-amber-500 transition shadow-inner"
          />
          <button
            type="submit"
            disabled={isSubmitting || !answerInput.trim()}
            className="px-5 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:bg-stone-800 text-stone-950 font-black text-sm transition flex items-center justify-center gap-1.5 shadow-lg active:scale-95"
          >
            <Send className="w-4 h-4 fill-stone-950" />
            <span>제출</span>
          </button>
        </form>
      </div>

      {/* Lightbox Modal */}
      <LightboxModal
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        imageSrc={puzzle.image}
        title={puzzle.title}
      />

      {/* Hint Modal */}
      <HintModal
        isOpen={isHintModalOpen}
        onClose={() => setIsHintModalOpen(false)}
        onUnlockNext={handleUnlockNextHint}
        unlockedHints={unlockedHints}
        totalHints={puzzle.totalHints}
        nextCooldownRemaining={hintCooldown}
        isLoading={isHintLoading}
      />
    </div>
  );
}
