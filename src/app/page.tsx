"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Search, Play, ArrowRight, ShieldCheck, KeyRound, X } from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [nicknameInput, setNicknameInput] = useState("");
  const [existingSession, setExistingSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Check URL query ?code=... or ?pin=... or local storage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("escape_session");
      if (saved) {
        const parsed = JSON.parse(saved);
        setExistingSession(parsed);
      }

      const urlParams = new URLSearchParams(window.location.search);
      const urlCode = urlParams.get("code") || urlParams.get("pin");
      if (urlCode && urlCode.trim().length === 6) {
        handleLogin(urlCode.trim().toUpperCase());
      }
    } catch (e) {
      console.warn("Storage check failed:", e);
    }
  }, []);

  const handleLogin = async (code: string, nickname?: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const cleanCode = code.trim().toUpperCase();
      const res = await fetch("/api/auth/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: cleanCode, nickname }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || "암호가 올바르지 않습니다.");
        setIsLoading(false);
        return;
      }

      // Save session in localStorage
      localStorage.setItem("escape_session", JSON.stringify(data.session));
      setIsModalOpen(false);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim()) {
      setErrorMsg("수사 암호를 입력해주세요.");
      return;
    }
    handleLogin(passwordInput, nicknameInput);
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
          모바일 웹 방탈출
        </span>
      </header>

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-end px-6 pb-12 pt-8 text-center">
        {/* Title Area (Requested: '카톡 방탈출 시리즈', '- 가인과 아벨 편 -' 삭제) */}
        <div className="mb-6 relative">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-stone-100 drop-shadow-md">
            명탐정의 사건일지
          </h1>
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

        {/* Action Buttons */}
        <div className="w-full max-w-sm space-y-3">
          {existingSession && (
            <button
              onClick={handleResume}
              className="w-full py-3.5 px-6 rounded-2xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold flex items-center justify-center gap-2 border border-stone-600 transition shadow-lg"
            >
              <span>이어서 수사하기 (Room {existingSession.currentRoom})</span>
              <ArrowRight className="w-4 h-4 text-amber-400" />
            </button>
          )}

          <button
            onClick={() => {
              setErrorMsg(null);
              setIsModalOpen(true);
            }}
            disabled={isLoading}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 font-black text-lg tracking-wider flex items-center justify-center gap-2 shadow-2xl transition transform active:scale-95 border border-amber-300/40"
          >
            <Play className="w-5 h-5 fill-stone-950" />
            <span>도전하기</span>
          </button>
        </div>

        <div className="mt-8 text-[11px] text-stone-500 flex items-center gap-2">
          <span>배정받은 수사 암호(6자리)를 입력하여 접속합니다.</span>
        </div>
      </div>

      {/* Password Input Modal (Direct Entry Only - No Camera Scanner) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-sm rounded-2xl bg-[#201a16] border-2 border-amber-600/60 p-6 text-stone-100 shadow-2xl relative flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800 mb-4">
              <div className="flex items-center gap-2 text-amber-400">
                <KeyRound className="w-5 h-5" />
                <h3 className="font-bold text-base">수사 현장 입장</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-red-950/70 border border-red-800 text-red-200 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-amber-400 mb-1.5">
                  수사 암호 입력
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value.toUpperCase())}
                  placeholder="6자리 암호 입력 (예: 7K9X2M)"
                  className="w-full px-4 py-3.5 rounded-xl bg-stone-900 border-2 border-stone-700 text-stone-100 font-mono text-center text-xl tracking-widest uppercase focus:outline-none focus:border-amber-500"
                  autoFocus
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck="false"
                />
                <span className="text-[11px] text-stone-400 mt-1.5 block text-center">
                  배정받은 6자리 영문+숫자 혼합 암호를 입력하세요.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1.5">
                  조수 닉네임 (선택)
                </label>
                <input
                  type="text"
                  value={nicknameInput}
                  onChange={(e) => setNicknameInput(e.target.value)}
                  placeholder="미입력 시 기본 번호로 설정"
                  className="w-full px-4 py-2.5 rounded-xl bg-stone-900 border border-stone-700 text-stone-100 text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-base transition shadow-lg mt-2 disabled:opacity-50"
              >
                {isLoading ? "암호 확인 중..." : "수사 현장 입장하기"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
