"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Award, Clock, RotateCcw, Home, Sparkles, CheckCircle2, Lightbulb } from "lucide-react";
import confetti from "canvas-confetti";

export default function ClearPage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    let activePin = "";
    try {
      const saved = localStorage.getItem("escape_session");
      if (saved) {
        const parsed = JSON.parse(saved);
        setSession(parsed);
        if (parsed.pin) activePin = parsed.pin;
      }
    } catch (e) {
      console.warn("Storage read failed:", e);
    }

    // Sync latest state from server to guarantee totalTimeSeconds and totalHintsUsed
    if (activePin) {
      fetch(`/api/game/state?pin=${activePin}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.session) {
            setSession((prev: any) => {
              const merged = { ...prev, ...data.session };
              if (!merged.totalTimeSeconds && merged.startedAt && merged.clearedAt) {
                merged.totalTimeSeconds = Math.max(1, Math.floor((merged.clearedAt - merged.startedAt) / 1000));
              }
              try {
                localStorage.setItem("escape_session", JSON.stringify(merged));
              } catch {}
              return merged;
            });
          }
        })
        .catch(() => {});
    }

    // Trigger celebratory confetti cannon
    const duration = 3.5 * 1000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ["#f59e0b", "#d97706", "#fbbf24", "#ffffff"],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ["#f59e0b", "#d97706", "#fbbf24", "#ffffff"],
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  }, []);

  const formatTotalTime = (seconds: number) => {
    let effectiveSeconds = seconds;
    if (!effectiveSeconds || effectiveSeconds <= 0) {
      if (session?.startedAt && session?.clearedAt) {
        effectiveSeconds = Math.max(1, Math.floor((session.clearedAt - session.startedAt) / 1000));
      } else {
        return "기록 없음";
      }
    }
    const hrs = Math.floor(effectiveSeconds / 3600);
    const mins = Math.floor((effectiveSeconds % 3600) / 60);
    const secs = effectiveSeconds % 60;
    if (hrs > 0) {
      return `${hrs}시간 ${mins}분 ${secs}초`;
    }
    if (mins > 0) {
      return `${mins}분 ${secs}초`;
    }
    return `${secs}초`;
  };

  return (
    <div className="relative flex flex-col flex-1 min-h-[100dvh] bg-[#161311] text-stone-100 select-none overflow-hidden">
      {/* Background medal watermark */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/clear.png"
          alt="클리어 축하"
          fill
          priority
          className="object-cover object-center opacity-25"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#141110] via-[#141110]/80 to-[#141110]/60" />
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 text-center max-w-sm mx-auto w-full">
        {/* Medal Icon Badge */}
        <div className="relative mb-6">
          <div className="w-32 h-32 relative mx-auto drop-shadow-2xl animate-fadeIn">
            <Image
              src="/images/clear.png"
              alt="메달"
              fill
              className="object-contain"
            />
          </div>
          <Sparkles className="w-7 h-7 text-amber-400 absolute -top-1 -right-1 animate-bounce" />
        </div>

        {/* Celebration Title */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-600/20 border border-amber-600/50 text-amber-300 text-xs font-bold mb-3 shadow">
          <Award className="w-3.5 h-3.5" />
          <span>MISSION ACCOMPLISHED</span>
        </div>

        <h1 className="text-3xl font-black text-stone-100 drop-shadow-lg tracking-tight mb-2">
          축하드립니다!
        </h1>
        <p className="text-sm font-semibold text-amber-400/90 mb-8 leading-relaxed">
          카톡 방탈출 시리즈
          <br />
          <strong className="text-stone-100 text-base">&apos;가인과 아벨&apos;</strong>을 완벽히 클리어 하셨습니다!
        </p>

        {/* Result Summary Card */}
        <div className="w-full rounded-2xl bg-[#231d19]/90 border border-amber-700/50 p-5 shadow-2xl backdrop-blur-md mb-8 text-left space-y-3.5">
          <div className="flex items-center justify-between pb-3 border-b border-stone-800">
            <span className="text-xs text-stone-400">참가자 닉네임</span>
            <span className="text-sm font-bold text-amber-300">
              {session?.nickname || `조수_${session?.pin || "1001"}`}
            </span>
          </div>

          <div className="flex items-center justify-between pb-3 border-b border-stone-800">
            <span className="text-xs text-stone-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              총 소요 시간
            </span>
            <span className="text-base font-mono font-bold text-emerald-400">
              {formatTotalTime(session?.totalTimeSeconds || 0)}
            </span>
          </div>

          <div className="flex items-center justify-between pb-3 border-b border-stone-800">
            <span className="text-xs text-stone-400 flex items-center gap-1">
              <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
              사용한 힌트
            </span>
            <span className="text-base font-mono font-bold text-amber-300">
              {session?.totalHintsUsed ?? 0}개
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-stone-400">최종 사건 해결 번호</span>
            <span className="text-xs font-mono font-bold text-stone-200 px-2 py-0.5 rounded bg-stone-800">
              CASE 10 COMPLETE
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full space-y-3">
          <button
            onClick={() => router.push("/")}
            className="w-full py-4 rounded-2xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-black text-base shadow-xl flex items-center justify-center gap-2 transition active:scale-95 border border-amber-300/40"
          >
            <Home className="w-5 h-5 fill-stone-950" />
            <span>메인 화면으로</span>
          </button>
        </div>
      </div>
    </div>
  );
}
