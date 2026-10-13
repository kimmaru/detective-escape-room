"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Award, Clock, RotateCcw, Home, Sparkles, CheckCircle2, Lightbulb, Gift, X } from "lucide-react";
import confetti from "canvas-confetti";

export default function ClearPage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [isRewardOpen, setIsRewardOpen] = useState(false);

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

  const handleOpenReward = () => {
    setIsRewardOpen(true);
    try {
      confetti({
        particleCount: 50,
        spread: 90,
        origin: { y: 0.5 },
        colors: ["#f59e0b", "#d97706", "#fbbf24", "#ffffff", "#10b981"],
      });
    } catch {}
  };

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
      {/* Background watermark */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/Clear_Background.png"
          alt="클리어 배경"
          fill
          priority
          className="object-cover object-center opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#141110] via-[#141110]/80 to-[#141110]/60" />
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 text-center max-w-sm mx-auto w-full">
        {/* Interactive Gift Box Badge (Requested: 선물상자 아이콘 클릭 시 전체화면 Clear 이미지 등장) */}
        <div className="relative mb-6">
          <button
            type="button"
            onClick={handleOpenReward}
            className="group relative p-6 rounded-3xl bg-gradient-to-b from-amber-500/20 to-amber-900/40 border-2 border-amber-400/70 shadow-[0_0_35px_rgba(245,158,11,0.35)] hover:scale-105 active:scale-95 transition duration-300 animate-pulseGlow cursor-pointer flex flex-col items-center gap-2.5 mx-auto"
          >
            <div className="relative">
              <Gift className="w-20 h-20 text-amber-400 group-hover:rotate-6 transition duration-300 drop-shadow-[0_0_18px_rgba(251,191,36,0.9)]" />
              <Sparkles className="w-7 h-7 text-amber-300 absolute -top-2 -right-2 animate-bounce" />
            </div>
            <span className="text-xs font-black tracking-wider text-amber-300 bg-amber-950/90 px-3.5 py-1 rounded-full border border-amber-400/60 shadow animate-bounce">
              🎁 선물상자를 터치하여 보상 열기!
            </span>
          </button>
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
          <strong className="text-stone-100 text-base">&apos;가인과 아벨&apos;</strong> 사건의 전말을 모두 밝혀내셨습니다!
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

      {/* Fullscreen Clear Image "짜잔!" Modal (선물상자 클릭 시 등장) */}
      {isRewardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/95 backdrop-blur-md animate-fadeIn">
          <div className="relative max-w-lg w-full h-[90vh] flex flex-col items-center justify-between">
            {/* Top Close Button */}
            <div className="w-full flex items-center justify-between pb-2 text-stone-300">
              <span className="text-xs font-mono font-bold text-amber-400 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                <span>SPECIAL CLEAR REWARD</span>
              </span>
              <button
                onClick={() => setIsRewardOpen(false)}
                className="p-1.5 rounded-full bg-stone-900/90 hover:bg-stone-800 text-stone-300 hover:text-white border border-stone-700 shadow-xl transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Clear Image with Pop Animation */}
            <div className="relative w-full flex-1 rounded-2xl overflow-hidden border-2 border-amber-500/60 shadow-[0_0_50px_rgba(245,158,11,0.4)] animate-successPop bg-[#181310] flex items-center justify-center">
              <Image
                src="/images/clear.png"
                alt="사건 해결 특별 보상"
                fill
                priority
                className="object-contain"
              />
            </div>

            {/* Bottom Close Button */}
            <button
              onClick={() => setIsRewardOpen(false)}
              className="mt-3.5 w-full py-3.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 text-sm font-black shadow-lg transition active:scale-95"
            >
              확인 완료 (닫기)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
