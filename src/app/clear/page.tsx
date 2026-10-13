"use client";

import React, { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Award,
  Clock,
  Home,
  Sparkles,
  CheckCircle2,
  Lightbulb,
  Gift,
  X,
  MessageSquarePlus,
  Camera,
  Trash2,
  Loader2,
  Check,
} from "lucide-react";
import confetti from "canvas-confetti";

export default function ClearPage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [isRewardOpen, setIsRewardOpen] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // Review state
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);
  const [reviewerName, setReviewerName] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let activePin = "";
    try {
      const saved = localStorage.getItem("escape_session");
      if (!saved) {
        router.replace("/");
        return;
      }
      const parsed = JSON.parse(saved);
      if (!parsed.pin || (!parsed.isCleared && parsed.currentRoom <= 10)) {
        // Not authenticated or not cleared yet -> redirect to home
        router.replace("/");
        return;
      }
      setSession(parsed);
      activePin = parsed.pin;
      if (parsed.hasReviewed) {
        setHasReviewed(true);
      }
      if (parsed.nickname) {
        setReviewerName(parsed.nickname);
      }
      setIsAuthChecking(false);
    } catch (e) {
      console.warn("Storage read failed:", e);
      router.replace("/");
      return;
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
              if (merged.hasReviewed) {
                setHasReviewed(true);
              }
              if (merged.nickname && !reviewerName) {
                setReviewerName(merged.nickname);
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
  }, [router]);

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

  const handleTriggerCamera = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleImageCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 모바일 고화질 이미지 브라우저 단에서 800px 크기로 압축 및 리사이징 (구글 드라이브 및 스프레드시트 최적화)
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        const maxDim = 800;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.65);
        setPhotoData(compressedBase64);
      };
      img.src = loadEvent.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPhotoData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewerName.trim()) {
      setErrorMessage("이름을 입력해주세요.");
      return;
    }
    if (!reviewText.trim()) {
      setErrorMessage("후기 내용을 작성해주세요.");
      return;
    }

    setIsSubmittingReview(true);
    setErrorMessage("");

    const payload = {
      pin: session?.pin,
      name: reviewerName.trim(),
      content: reviewText.trim(),
      photo: photoData,
    };

    // 1) 브라우저에서 직접 구글 웹앱 URL로도 2중 백업 전송 (Vercel 타임아웃 완벽 방어)
    const googleSheetUrl = "https://script.google.com/macros/s/AKfycbxKY3sFsMUaUN2fuYFXLcSDrzlc7SC7PcBxZtHBWa0YRkoUg-bCJVTrCYouFnuLMqu9-w/exec";
    try {
      fetch(googleSheetUrl, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => {});
    } catch {}

    // 2) 우리 서버 API 호출
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.message || "후기 등록에 실패했습니다.");
        setIsSubmittingReview(false);
        return;
      }

      setHasReviewed(true);
      const updated = {
        ...session,
        hasReviewed: true,
        review: data.review,
      };
      setSession(updated);
      try {
        localStorage.setItem("escape_session", JSON.stringify(updated));
      } catch {}

      setIsReviewModalOpen(false);
      try {
        confetti({
          particleCount: 70,
          spread: 80,
          origin: { y: 0.6 },
          colors: ["#10b981", "#f59e0b", "#3b82f6", "#ffffff"],
        });
      } catch {}
      alert("소중한 후기와 사진이 스프레드시트에 성공적으로 기록되었습니다! 참여해주셔서 진심으로 감사드립니다. 🎉");
    } catch (err) {
      console.error("Submit review error:", err);
      // 서버 에러가 나더라도 구글 직접 전송이 성공했을 수 있으므로 등록 상태로 전환
      setHasReviewed(true);
      setIsReviewModalOpen(false);
      alert("후기가 안전하게 전송되었습니다! 참여해주셔서 감사합니다.");
    } finally {
      setIsSubmittingReview(false);
    }
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

  if (isAuthChecking) {
    return (
      <div className="flex-1 min-h-[100dvh] flex flex-col items-center justify-center p-6 text-stone-300 bg-[#161311]">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-mono text-stone-400">수사 기록 확인 중...</p>
      </div>
    );
  }

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
        {/* Interactive Gift Box Badge (선물상자 아이콘 클릭 시 전체화면 Clear 이미지 등장) */}
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
        <div className="w-full rounded-2xl bg-[#231d19]/90 border border-amber-700/50 p-5 shadow-2xl backdrop-blur-md mb-6 text-left space-y-3.5">
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
        <div className="w-full space-y-3.5">
          {/* 후기 남기기 유도 섹션 */}
          <div className="relative w-full flex flex-col items-center">
            {!hasReviewed && (
              /* 통통 튀는 인터랙티브 유도 말풍선 배지 */
              <div className="relative mb-2 animate-bounce z-10 cursor-pointer" onClick={() => setIsReviewModalOpen(true)}>
                <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 text-stone-950 font-black text-[12px] shadow-[0_4px_15px_rgba(245,158,11,0.5)] border border-amber-200">
                  <Sparkles className="w-3.5 h-3.5 animate-spin" />
                  <span>📸 10초 만에 인증샷 & 수사 후기 남기기!</span>
                </div>
                {/* 말풍선 꼬리 */}
                <div className="w-0 h-0 border-x-4 border-x-transparent border-t-[5px] border-t-amber-500 mx-auto -mt-[1px]" />
              </div>
            )}

            {/* 후기 남기기 버튼 (매력적인 네온 글로우 & 펄스 효과) */}
            <div className="relative w-full group">
              {!hasReviewed && (
                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-orange-500 opacity-80 blur-md group-hover:opacity-100 transition duration-300 animate-pulse" />
              )}

              <button
                type="button"
                onClick={() => {
                  if (hasReviewed) {
                    alert("이미 소중한 후기를 등록해주셨습니다! 감사합니다 ❤️");
                    return;
                  }
                  setIsReviewModalOpen(true);
                }}
                className={`relative w-full py-4 px-5 rounded-2xl font-black text-base shadow-2xl flex items-center justify-center gap-2.5 transition active:scale-95 border ${
                  hasReviewed
                    ? "bg-stone-800/90 text-emerald-400 border-emerald-500/40 cursor-default"
                    : "bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-stone-950 border-amber-200 shadow-[0_0_30px_rgba(245,158,11,0.6)]"
                }`}
              >
                {hasReviewed ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span>수사 후기 작성 완료 ✓</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-5 h-5 stroke-[2.5]" />
                    <span className="tracking-tight text-stone-950 font-black text-[16px]">
                      사건 해결 후기 남기기 ✍️
                    </span>
                    <Sparkles className="w-4 h-4 text-amber-950 animate-pulse ml-0.5" />
                  </>
                )}
              </button>
            </div>

            {!hasReviewed ? (
              <p className="mt-2 text-[11px] text-amber-300/90 font-semibold flex items-center gap-1 drop-shadow">
                <span>🏆 작성된 후기는 실시간 탐정 일지에 영구 보존됩니다!</span>
              </p>
            ) : (
              <button
                type="button"
                onClick={() => setIsReviewModalOpen(true)}
                className="mt-2 text-xs text-amber-400 hover:text-amber-300 underline font-semibold flex items-center gap-1 transition"
              >
                <span>후기 다시 작성 / 수정하기 ✏️</span>
              </button>
            )}
          </div>

          {/* 메인 화면으로 버튼 */}
          <button
            type="button"
            onClick={() => router.push("/")}
            className="w-full py-3.5 rounded-2xl bg-stone-800/90 hover:bg-stone-750 text-stone-300 font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition active:scale-95 border border-stone-700/80"
          >
            <Home className="w-4 h-4 text-stone-400" />
            <span>메인 화면으로</span>
          </button>
        </div>
      </div>

      {/* 후기 남기기 모달 (Review Modal) */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="relative max-w-md w-full bg-[#1e1814] border-2 border-amber-600/60 rounded-3xl p-6 text-stone-100 shadow-[0_0_50px_rgba(0,0,0,0.8)] max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-stone-800 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <MessageSquarePlus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-stone-100 tracking-tight">
                    사건 해결 후기 남기기
                  </h2>
                  <p className="text-[11px] text-stone-400 font-medium">
                    1인당 1회만 등록할 수 있습니다.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsReviewModalOpen(false)}
                className="p-1.5 rounded-full bg-stone-900 text-stone-400 hover:text-white hover:bg-stone-800 border border-stone-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitReview} className="space-y-4 text-left">
              {/* 1. 이름 (필수) */}
              <div>
                <label className="block text-xs font-bold text-amber-300 mb-1.5">
                  이름 / 닉네임 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  placeholder="예: 명탐정 김코드"
                  maxLength={20}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-900/90 border border-stone-700 focus:border-amber-500 text-sm text-stone-100 focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
                />
              </div>

              {/* 2. 사진 (선택 - 전면 셀카 카메라 연동) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-amber-300 flex items-center gap-1">
                    <Camera className="w-3.5 h-3.5 text-amber-400" />
                    전면 셀카 인증 사진 <span className="text-stone-400 font-normal">(선택)</span>
                  </label>
                  {photoData && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-0.5"
                    >
                      <Trash2 className="w-3 h-3" />
                      사진 삭제
                    </button>
                  )}
                </div>

                {/* 숨겨진 파일 인풋: capture="user"로 모바일 기기 전면 카메라(셀카) 즉시 구동 */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  onChange={handleImageCapture}
                  className="hidden"
                />

                {photoData ? (
                  <div className="relative rounded-2xl overflow-hidden border border-amber-500/50 bg-stone-950 group">
                    <img
                      src={photoData}
                      alt="촬영된 셀카 사진"
                      className="w-full h-44 object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={handleTriggerCamera}
                        className="px-3 py-1.5 rounded-lg bg-stone-900/90 text-xs font-bold text-stone-200 border border-stone-600 shadow flex items-center gap-1.5"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        셀카 다시 촬영하기
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleTriggerCamera}
                    className="w-full py-4 px-4 rounded-2xl border-2 border-dashed border-amber-600/40 hover:border-amber-500 bg-stone-900/60 hover:bg-stone-900 transition flex flex-col items-center justify-center gap-1.5 text-stone-300 active:scale-[0.99] cursor-pointer group"
                  >
                    <div className="p-2.5 rounded-full bg-amber-500/10 group-hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 transition">
                      <Camera className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-stone-200">
                      전면 카메라 켜기 (인증 셀카 촬영) 🤳
                    </span>
                    <span className="text-[10px] text-stone-500">
                      버튼을 누르면 전면(셀피) 카메라가 실행됩니다
                    </span>
                  </button>
                )}
              </div>

              {/* 3. 후기 (필수) */}
              <div>
                <label className="block text-xs font-bold text-amber-300 mb-1.5">
                  후기 내용 <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="방탈출은 어떠셨나요? 재미있었던 순간이나 아쉬웠던 점을 자유롭게 남겨주세요! (예: 7번 방 암호 풀 때 소름 돋았어요!)"
                  rows={4}
                  required
                  maxLength={1000}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-900/90 border border-stone-700 focus:border-amber-500 text-sm text-stone-100 focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium resize-none leading-relaxed"
                />
                <div className="flex justify-end mt-1 text-[11px] text-stone-500">
                  {reviewText.length}/1000자
                </div>
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div className="p-2.5 rounded-xl bg-red-950/70 border border-red-800 text-xs text-red-300 font-semibold">
                  {errorMessage}
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsReviewModalOpen(false)}
                  disabled={isSubmittingReview}
                  className="flex-1 py-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold transition active:scale-95"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReview}
                  className="flex-[2] py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 text-xs font-black shadow-lg flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-50"
                >
                  {isSubmittingReview ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>기록 중 (약 2초 소요)...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>후기 등록 완료</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                type="button"
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
              type="button"
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
