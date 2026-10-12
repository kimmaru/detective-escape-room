"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Search, Play, ArrowRight, ShieldCheck } from "lucide-react";
import QrScannerModal from "@/components/QrScannerModal";

export default function HomePage() {
  const router = useRouter();
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [existingSession, setExistingSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Check URL query ?pin=... or local storage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("escape_session");
      if (saved) {
        const parsed = JSON.parse(saved);
        setExistingSession(parsed);
      }

      // Check url param
      const urlParams = new URLSearchParams(window.location.search);
      const urlPin = urlParams.get("pin");
      if (urlPin && /^\d{4}$/.test(urlPin)) {
        handleLogin(urlPin);
      }
    } catch (e) {
      console.warn("Storage check failed:", e);
    }
  }, []);

  const handleLogin = async (pin: string, nickname?: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/auth/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, nickname }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || "인증에 실패했습니다.");
        setIsLoading(false);
        return;
      }

      // Save session in localStorage
      localStorage.setItem("escape_session", JSON.stringify(data.session));
      setIsScannerOpen(false);

      if (data.session.isCleared) {
        router.push("/clear");
      } else {
        router.push("/play");
      }
    } catch (err: any) {
      setErrorMsg("서버 통신에 실패했습니다. 다시 시도해주세요.");
      setIsLoading(false);
    }
  };

  const handleResume = () => {
    if (existingSession) {
      if (existingSession.isCleared) {
        router.push("/clear");
      } else {
        router.push("/play");
      }
    }
  };

  return (
    <div className="relative flex flex-col flex-1 min-h-[100dvh] bg-[#1a1614] text-stone-100 overflow-hidden select-none">
      {/* Background Cover Image with darkening gradient */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/cover.png"
          alt="명탐정의 사건일지"
          fill
          priority
          className="object-cover object-top opacity-35"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#141110] via-[#141110]/60 to-[#141110]/30" />
      </div>

      {/* Header Info */}
      <header className="relative z-10 flex items-center justify-between p-4 border-b border-stone-800/60 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Search className="w-5 h-5 text-amber-500" />
          <span className="text-xs font-mono font-bold tracking-widest text-amber-400">
            DETECTIVE CASE FILE
          </span>
        </div>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-stone-800/80 text-stone-300 border border-stone-700">
          모바일 전용
        </span>
      </header>

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-end px-6 pb-12 pt-8 text-center">
        {/* Title Badge / Tape */}
        <div className="mb-6 relative">
          <div className="px-4 py-1 rounded bg-amber-600/20 border border-amber-600/50 text-amber-300 text-xs font-bold tracking-widest mb-3 inline-block shadow-sm">
            카톡 방탈출 시리즈
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-stone-100 drop-shadow-md">
            명탐정의 사건일지
          </h1>
          <p className="text-sm font-medium text-amber-400/90 mt-1 tracking-wider">
            - 가인과 아벨 편 -
          </p>
        </div>

        {/* Narrative Teaser Box */}
        <div className="w-full max-w-sm p-4 rounded-2xl bg-stone-900/80 border border-amber-700/40 text-stone-300 text-xs leading-relaxed mb-8 backdrop-blur-md shadow-xl text-left">
          <div className="flex items-center gap-2 text-amber-400 font-bold mb-2">
            <ShieldCheck className="w-4 h-4" />
            <span>사건 브리핑</span>
          </div>
          <p>
            &quot;이봐, 한가한 소리를 할 때가 아니야. 살인사건이 나버렸다고!&quot;
            <br />
            당신은 탐정의 조수가 되어 10개의 단서를 풀고 현장의 진실을 밝혀내야 합니다.
          </p>
        </div>

        {errorMsg && (
          <div className="w-full max-w-sm mb-4 p-3 rounded-xl bg-red-950/80 border border-red-800 text-red-200 text-xs">
            {errorMsg}
          </div>
        )}

        {/* Action Buttons */}
        <div className="w-full max-w-sm space-y-3">
          {existingSession && (
            <button
              onClick={handleResume}
              className="w-full py-3.5 px-6 rounded-2xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold flex items-center justify-center gap-2 border border-stone-600 transition shadow-lg"
            >
              <span>이어서 계속하기 (Room {existingSession.currentRoom})</span>
              <ArrowRight className="w-4 h-4 text-amber-400" />
            </button>
          )}

          <button
            onClick={() => setIsScannerOpen(true)}
            disabled={isLoading}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 font-black text-lg tracking-wider flex items-center justify-center gap-2 shadow-2xl transition transform active:scale-95 border border-amber-300/40"
          >
            <Play className="w-5 h-5 fill-stone-950" />
            <span>{isLoading ? "접속 중..." : "도전하기"}</span>
          </button>
        </div>

        {/* Footer info */}
        <div className="mt-8 text-[11px] text-stone-500 flex items-center gap-2">
          <span>QR 코드를 스캔하거나 배정받은 PIN 번호로 입장합니다.</span>
        </div>
      </div>

      {/* QR Scanner Modal */}
      <QrScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onSelectPin={(pin, nickname) => handleLogin(pin, nickname)}
      />
    </div>
  );
}
