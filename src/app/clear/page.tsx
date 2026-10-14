"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
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
  BookOpen,
  ChevronRight,
  RefreshCw,
  Maximize2,
  UserCheck,
} from "lucide-react";
import confetti from "canvas-confetti";

interface ReviewItem {
  pin: string;
  name: string;
  content: string;
  photo?: string | null;
  createdAt: number;
}

export default function ClearPage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [isRewardOpen, setIsRewardOpen] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // Review submission state
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);
  const [reviewerName, setReviewerName] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Review Board state (게시판 관련)
  const [isBoardOpen, setIsBoardOpen] = useState(false);
  const [boardReviews, setBoardReviews] = useState<ReviewItem[]>([]);
  const [isLoadingBoard, setIsLoadingBoard] = useState(false);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasFiredConfetti = useRef(false);
  const isFetchingBoardRef = useRef(false);

  // 게시판 후기 목록 불러오기 (중복 호출 차단 및 안정화)
  const loadBoardReviews = useCallback(async (pinToUse?: string) => {
    const activePin = pinToUse || session?.pin;
    if (!activePin || isFetchingBoardRef.current) return;

    isFetchingBoardRef.current = true;
    setIsLoadingBoard(true);
    setBoardError(null);

    try {
      const res = await fetch(
        `/api/review?pin=${encodeURIComponent(activePin)}&cleared=true&t=${Date.now()}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        setBoardError(data.message || "후기 게시판을 불러오지 못했습니다.");
        return;
      }

      let list: ReviewItem[] = Array.isArray(data.reviews) ? data.reviews : [];

      // 현재 내 후기가 로컬스토리지에 있는데 서버 목록에 아직 없으면 맨 앞에 합성
      try {
        const saved = localStorage.getItem("escape_session");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.review && !list.some((r) => r.pin === activePin)) {
            list.unshift({
              pin: activePin,
              name: parsed.review.name || parsed.nickname || "명탐정",
              content: parsed.review.content,
              photo: parsed.review.photo,
              createdAt: parsed.review.createdAt || Date.now(),
            });
          }
        }
      } catch {}

      setBoardReviews(list);
      if (data.hasReviewed) {
        setHasReviewed(true);
      }
    } catch (e) {
      console.error("Board fetch error:", e);
      setBoardError("후기 목록을 불러오는 중 네트워크 오류가 발생했습니다.");
    } finally {
      setIsLoadingBoard(false);
      isFetchingBoardRef.current = false;
    }
  }, [session?.pin]);

  // 페이지 마운트 시 단 1회만 초기화 실행
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
        router.replace("/");
        return;
      }

      // 클라이언트 세션 확정 로드
      setSession(parsed);
      activePin = parsed.pin;
      if (parsed.hasReviewed) {
        setHasReviewed(true);
      }
      if (parsed.nickname) {
        setReviewerName(parsed.nickname);
      }
      setIsAuthChecking(false);

      // 서버리스 람다에 세션 클리어 상태 1회 동기화 (백그라운드)
      fetch("/api/game/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin: activePin,
          isCleared: true,
          currentRoom: 11,
          clearedAt: parsed.clearedAt || Date.now(),
          totalTimeSeconds: parsed.totalTimeSeconds || 0,
          totalHintsUsed: parsed.totalHintsUsed || 0,
          nickname: parsed.nickname,
        }),
      }).catch(() => {});

      // 최신 서버 상태 조회 (로컬의 소요 시간 및 클리어 상태 절대 보존)
      fetch(`/api/game/state?pin=${activePin}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.session) {
            setSession((prev: any) => {
              const merged = { ...prev, ...data.session };
              // 로컬의 유효한 값들을 최우선 보존
              merged.isCleared = true;
              merged.currentRoom = Math.max(11, merged.currentRoom || 11);
              merged.totalTimeSeconds =
                prev?.totalTimeSeconds ||
                data.session.totalTimeSeconds ||
                (merged.startedAt && merged.clearedAt
                  ? Math.max(1, Math.floor((merged.clearedAt - merged.startedAt) / 1000))
                  : 0);

              if (prev?.hasReviewed || merged.hasReviewed) {
                merged.hasReviewed = true;
                setHasReviewed(true);
              }
              if (prev?.review) {
                merged.review = prev.review;
              }
              try {
                localStorage.setItem("escape_session", JSON.stringify(merged));
              } catch {}
              return merged;
            });
          }
        })
        .catch(() => {});

      // 게시판 1회 사전 로드
      loadBoardReviews(activePin);
    } catch (e) {
      console.warn("Storage read failed:", e);
      router.replace("/");
      return;
    }

    // 마운트 시 단 1회만 축하 컨페티 실행 (3초 후 완전히 자동 종료)
    if (!hasFiredConfetti.current) {
      hasFiredConfetti.current = true;
      const duration = 2.5 * 1000;
      const end = Date.now() + duration;

      const frame = () => {
        try {
          confetti({
            particleCount: 2,
            angle: 60,
            spread: 45,
            origin: { x: 0, y: 0.7 },
            colors: ["#f59e0b", "#d97706", "#fbbf24", "#ffffff"],
            disableForReducedMotion: true,
          });
          confetti({
            particleCount: 2,
            angle: 120,
            spread: 45,
            origin: { x: 1, y: 0.7 },
            colors: ["#f59e0b", "#d97706", "#fbbf24", "#ffffff"],
            disableForReducedMotion: true,
          });
        } catch {}

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };
      frame();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenReward = () => {
    setIsRewardOpen(true);
    try {
      confetti({
        particleCount: 35,
        spread: 80,
        origin: { y: 0.5 },
        colors: ["#f59e0b", "#d97706", "#fbbf24", "#ffffff", "#10b981"],
        disableForReducedMotion: true,
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

    if (hasReviewed) {
      alert("이미 후기를 등록하셨습니다. 후기는 1회만 등록 가능합니다.");
      setIsReviewModalOpen(false);
      return;
    }

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
      isCleared: true,
      currentRoom: 11,
      clearedAt: session?.clearedAt || Date.now(),
      totalTimeSeconds: session?.totalTimeSeconds || 0,
    };

    // 1) 구글 웹앱 URL 백업 전송
    const googleSheetUrl =
      "https://script.google.com/macros/s/AKfycbxKY3sFsMUaUN2fuYFXLcSDrzlc7SC7PcBxZtHBWa0YRkoUg-bCJVTrCYouFnuLMqu9-w/exec";
    try {
      fetch(googleSheetUrl, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => {});
    } catch {}

    // 2) 서버 API 호출
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data?.message?.includes("이미 후기")) {
          setHasReviewed(true);
          setIsReviewModalOpen(false);
          loadBoardReviews(session?.pin);
          alert("소중한 후기가 이미 안전하게 등록되어 있습니다! ❤️");
          return;
        }

        // 로컬 백업 완료 처리
        const fallbackReview = {
          name: reviewerName.trim(),
          content: reviewText.trim(),
          photo: photoData,
          createdAt: Date.now(),
        };
        setHasReviewed(true);
        const updated = {
          ...session,
          hasReviewed: true,
          review: fallbackReview,
        };
        setSession(updated);
        try {
          localStorage.setItem("escape_session", JSON.stringify(updated));
        } catch {}
        setIsReviewModalOpen(false);
        loadBoardReviews(session?.pin);
        alert("소중한 후기와 사진이 성공적으로 등록되었습니다! 🎉");
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
      loadBoardReviews(session?.pin);

      try {
        confetti({
          particleCount: 50,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#10b981", "#f59e0b", "#3b82f6", "#ffffff"],
          disableForReducedMotion: true,
        });
      } catch {}

      alert("소중한 후기와 사진이 성공적으로 등록되었습니다! 🎉");
    } catch (err) {
      console.error("Submit review error:", err);
      const fallbackReview = {
        name: reviewerName.trim(),
        content: reviewText.trim(),
        photo: photoData,
        createdAt: Date.now(),
      };
      setHasReviewed(true);
      const updated = {
        ...session,
        hasReviewed: true,
        review: fallbackReview,
      };
      setSession(updated);
      try {
        localStorage.setItem("escape_session", JSON.stringify(updated));
      } catch {}
      setIsReviewModalOpen(false);
      loadBoardReviews(session?.pin);
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

  const formatReviewDate = (timestamp: number) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    return `${yyyy}.${mm}.${dd} ${hh}:${min}`;
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
    <div className="relative flex flex-col flex-1 min-h-[100dvh] max-w-md mx-auto w-full bg-[#161311] text-stone-100 select-none overflow-x-hidden shadow-2xl">
      {/* Background watermark: 안정적인 img 태그 및 고정 z-index */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <img
          key="clear-bg-fixed"
          src="/images/Clear_Background.png"
          alt="클리어 배경"
          className="w-full h-full object-cover object-center opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#141110] via-[#141110]/85 to-[#141110]/60" />
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 text-center max-w-sm mx-auto w-full pb-10">
        {/* Interactive Gift Box Badge */}
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
        <div className="w-full space-y-3">
          {/* 후기 남기기 섹션 (1회만 작성 가능, 수정 불가) */}
          <div className="relative w-full flex flex-col items-center">
            {!hasReviewed && (
              <div
                className="relative mb-2 animate-bounce z-10 cursor-pointer"
                onClick={() => setIsReviewModalOpen(true)}
              >
                <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 text-stone-950 font-black text-[12px] shadow-[0_4px_15px_rgba(245,158,11,0.5)] border border-amber-200">
                  <Sparkles className="w-3.5 h-3.5 animate-spin" />
                  <span>📸 10초 만에 인증샷 & 수사 후기 남기기!</span>
                </div>
                <div className="w-0 h-0 border-x-4 border-x-transparent border-t-[5px] border-t-amber-500 mx-auto -mt-[1px]" />
              </div>
            )}

            {/* 후기 작성 버튼 */}
            <div className="relative w-full group">
              {!hasReviewed && (
                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-orange-500 opacity-80 blur-md group-hover:opacity-100 transition duration-300 animate-pulse" />
              )}

              <button
                type="button"
                onClick={() => {
                  if (hasReviewed) {
                    alert("소중한 수사 후기를 이미 등록해주셨습니다! (1인 1회 한정)");
                    return;
                  }
                  setIsReviewModalOpen(true);
                }}
                className={`relative w-full py-4 px-5 rounded-2xl font-black text-base shadow-2xl flex items-center justify-center gap-2.5 transition active:scale-95 border ${
                  hasReviewed
                    ? "bg-[#1c221e] text-emerald-400 border-emerald-500/40 cursor-default"
                    : "bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-stone-950 border-amber-200 shadow-[0_0_30px_rgba(245,158,11,0.6)] cursor-pointer"
                }`}
              >
                {hasReviewed ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span className="tracking-tight text-emerald-300 font-bold text-sm">
                      수사 후기 등록 완료 ✓ (수정 불가)
                    </span>
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
                <span>🏆 작성된 후기는 클리어 전용 탐정 일지에 영구 보존됩니다! (1회 제한)</span>
              </p>
            ) : (
              <p className="mt-2 text-[11px] text-stone-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>1회 등록이 완료되었습니다. 감사합니다!</span>
              </p>
            )}
          </div>

          {/* 명탐정 수사 후기 게시판 열기 버튼 */}
          <div className="relative w-full pt-1">
            <button
              type="button"
              onClick={() => {
                setIsBoardOpen(true);
                loadBoardReviews();
              }}
              className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-stone-900 via-[#221c17] to-stone-900 hover:from-amber-950/70 hover:to-stone-850 text-amber-200 font-black text-sm shadow-xl flex items-center justify-center gap-2.5 transition active:scale-95 border border-amber-500/40 hover:border-amber-400 cursor-pointer group"
            >
              <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 group-hover:scale-110 transition">
                <BookOpen className="w-4 h-4" />
              </div>
              <div className="text-left flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-amber-300 font-black text-[14px]">
                    명탐정 수사 후기 게시판
                  </span>
                  <span className="px-2 py-0.2 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-mono font-bold border border-amber-500/30">
                    {boardReviews.length}
                  </span>
                </div>
                <p className="text-[10px] text-stone-400 font-normal">
                  사건을 해결한 탐정들만의 비밀 후기 모음집
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-amber-400 group-hover:translate-x-1 transition" />
            </button>
          </div>

          {/* 메인 화면으로 버튼 */}
          <button
            type="button"
            onClick={() => router.push("/")}
            className="w-full py-3.5 rounded-2xl bg-stone-800/90 hover:bg-stone-750 text-stone-300 font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition active:scale-95 border border-stone-700/80 cursor-pointer"
          >
            <Home className="w-4 h-4 text-stone-400" />
            <span>메인 화면으로</span>
          </button>
        </div>
      </div>

      {/* 후기 남기기 모달 */}
      {isReviewModalOpen && !hasReviewed && (
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
                  <p className="text-[11px] text-amber-400/90 font-medium">
                    ⚠️ 1인당 1회만 등록 가능하며, 등록 후 수정할 수 없습니다.
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
                  이름 <span className="text-red-400">*</span>
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

              {/* 2. 사진 (선택) */}
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
                  placeholder="방탈출은 어떠셨나요? 재미있었던 순간이나 감상을 자유롭게 남겨주세요! (등록 후에는 수정할 수 없습니다)"
                  rows={4}
                  required
                  maxLength={1000}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-900/90 border border-stone-700 focus:border-amber-500 text-sm text-stone-100 focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium resize-none leading-relaxed"
                />
                <div className="flex justify-end mt-1 text-[11px] text-stone-500">
                  {reviewText.length}/1000자
                </div>
              </div>

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
                      <span>기록 중...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>후기 등록 완료 (1회 한정)</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 명탐정 수사 후기 게시판 모달 */}
      {isBoardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-md animate-fadeIn">
          <div className="relative max-w-lg w-full h-[88vh] bg-[#1a1512] border-2 border-amber-600/70 rounded-3xl p-5 sm:p-6 text-stone-100 shadow-[0_0_60px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-stone-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-inner">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-black text-stone-100 tracking-tight">
                      명탐정 수사 후기 게시판
                    </h2>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 text-[10px] font-black flex items-center gap-1">
                      <UserCheck className="w-3 h-3" />
                      <span>클리어 인증됨</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-400/80 font-medium">
                    사건을 해결한 명탐정들만 입장할 수 있는 비밀 게시판입니다.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => loadBoardReviews()}
                  disabled={isLoadingBoard}
                  title="새로고침"
                  className="p-2 rounded-xl bg-stone-900 text-stone-300 hover:text-amber-300 hover:bg-stone-800 border border-stone-700 transition"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingBoard ? "animate-spin text-amber-400" : ""}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsBoardOpen(false)}
                  className="p-2 rounded-xl bg-stone-900 text-stone-400 hover:text-white hover:bg-stone-800 border border-stone-700 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Sub Bar */}
            <div className="py-2.5 px-3 my-3 rounded-xl bg-stone-900/90 border border-stone-800 flex items-center justify-between shrink-0 text-xs">
              <span className="text-stone-300 font-semibold">
                총 <strong className="text-amber-400 font-mono font-bold text-sm">{boardReviews.length}</strong>개의 수사 일지
              </span>
              {hasReviewed ? (
                <span className="text-emerald-400 text-[11px] font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>내 후기 등록 완료</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsBoardOpen(false);
                    setIsReviewModalOpen(true);
                  }}
                  className="text-amber-300 hover:text-amber-200 text-[11px] font-bold underline flex items-center gap-1"
                >
                  <span>나도 후기 남기기 ✍️</span>
                </button>
              )}
            </div>

            {/* Error Message */}
            {boardError && (
              <div className="p-3 mb-3 rounded-xl bg-red-950/70 border border-red-800 text-xs text-red-300 font-medium shrink-0">
                {boardError}
              </div>
            )}

            {/* Review Cards Feed */}
            <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 text-left custom-scrollbar">
              {isLoadingBoard && boardReviews.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center gap-2 text-stone-400">
                  <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                  <p className="text-xs">명탐정 수사 일지 로딩 중...</p>
                </div>
              ) : boardReviews.length === 0 ? (
                <div className="h-60 flex flex-col items-center justify-center p-6 text-center rounded-2xl bg-stone-900/40 border border-stone-800/80">
                  <div className="p-3 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-3">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-stone-200 mb-1">
                    아직 등록된 후기가 없습니다
                  </h3>
                  <p className="text-xs text-stone-400 mb-4 leading-relaxed">
                    첫 번째로 사건 해결 후기를 남겨 명탐정 일지의 첫 페이지를 장식해보세요!
                  </p>
                  {!hasReviewed && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsBoardOpen(false);
                        setIsReviewModalOpen(true);
                      }}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-black shadow transition active:scale-95"
                    >
                      첫 번째 후기 작성하기 ✍️
                    </button>
                  )}
                </div>
              ) : (
                boardReviews.map((item, idx) => {
                  const isMyReview = item.pin === session?.pin;
                  return (
                    <div
                      key={item.pin || idx}
                      className={`relative rounded-2xl p-4 transition ${
                        isMyReview
                          ? "bg-gradient-to-b from-[#292019] to-[#1e1713] border-2 border-amber-500/80 shadow-[0_4px_20px_rgba(245,158,11,0.15)]"
                          : "bg-[#201915]/90 border border-stone-800/90 hover:border-amber-700/50"
                      }`}
                    >
                      {/* Top info */}
                      <div className="flex items-start justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${
                              isMyReview
                                ? "bg-amber-400 text-stone-950 shadow"
                                : "bg-stone-800 text-amber-300 border border-stone-700"
                            }`}
                          >
                            {item.name ? item.name.charAt(0).toUpperCase() : "탐"}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-bold text-stone-100">
                                {item.name}
                              </span>
                              {isMyReview && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black">
                                  ⭐ 내 후기
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-mono text-stone-500">
                              {formatReviewDate(item.createdAt)}
                            </span>
                          </div>
                        </div>

                        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-stone-900/90 text-amber-400/80 border border-amber-700/30">
                          CLEARED
                        </span>
                      </div>

                      {/* Photo Thumbnail */}
                      {item.photo && (
                        <div className="relative mb-3 rounded-xl overflow-hidden border border-amber-500/30 bg-stone-950">
                          <img
                            src={item.photo}
                            alt={`${item.name}님의 인증 사진`}
                            className="w-full max-h-52 object-cover cursor-pointer hover:scale-[1.02] transition duration-300"
                            onClick={() => setLightboxPhoto(item.photo || null)}
                          />
                          <button
                            type="button"
                            onClick={() => setLightboxPhoto(item.photo || null)}
                            className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-black/70 hover:bg-black/90 text-[11px] font-semibold text-stone-200 backdrop-blur-sm border border-stone-700 flex items-center gap-1 transition"
                          >
                            <Maximize2 className="w-3 h-3 text-amber-400" />
                            <span>사진 크게보기</span>
                          </button>
                        </div>
                      )}

                      {/* Review Text */}
                      <p className="text-xs sm:text-sm text-stone-200 leading-relaxed whitespace-pre-wrap font-medium">
                        {item.content}
                      </p>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Close */}
            <div className="pt-3 border-t border-stone-800 shrink-0">
              <button
                type="button"
                onClick={() => setIsBoardOpen(false)}
                className="w-full py-3 rounded-xl bg-stone-800 hover:bg-stone-750 text-stone-300 text-xs font-bold transition active:scale-95 cursor-pointer"
              >
                게시판 닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 사진 라이트박스 */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-fadeIn"
          onClick={() => setLightboxPhoto(null)}
        >
          <div
            className="relative max-w-lg w-full max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxPhoto(null)}
              className="absolute -top-11 right-0 p-2 rounded-full bg-stone-900 text-stone-300 hover:text-white border border-stone-700 transition"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="relative w-full rounded-2xl overflow-hidden border-2 border-amber-500/60 shadow-2xl bg-stone-950 flex items-center justify-center">
              <img
                src={lightboxPhoto}
                alt="확대된 인증 사진"
                className="w-full max-h-[75vh] object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* 보상 이미지 모달 (직접적이고 안정적인 렌더링) */}
      {isRewardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/95 backdrop-blur-md animate-fadeIn">
          <div className="relative max-w-md w-full max-h-[92vh] flex flex-col items-center justify-between bg-[#191411] border-2 border-amber-500/70 rounded-3xl p-4 shadow-[0_0_60px_rgba(245,158,11,0.4)]">
            {/* Top Bar */}
            <div className="w-full flex items-center justify-between pb-3 border-b border-stone-800 text-stone-300 shrink-0">
              <span className="text-xs font-mono font-bold text-amber-400 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                <span>SPECIAL CLEAR REWARD</span>
              </span>
              <button
                type="button"
                onClick={() => setIsRewardOpen(false)}
                className="p-1.5 rounded-full bg-stone-900/90 hover:bg-stone-800 text-stone-300 hover:text-white border border-stone-700 shadow transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Clear Image: Next.js Image fill 대신 표준 img 태그로 100% 즉시 표시 보장 */}
            <div className="relative w-full flex-1 min-h-[300px] max-h-[65vh] my-3 rounded-2xl overflow-hidden border border-amber-500/40 bg-stone-950 flex items-center justify-center p-2">
              <img
                src="/images/clear.png"
                alt="사건 해결 특별 보상"
                className="w-full h-full object-contain animate-successPop"
              />
            </div>

            {/* Bottom Close Button */}
            <button
              type="button"
              onClick={() => setIsRewardOpen(false)}
              className="w-full py-3.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 text-sm font-black shadow-lg transition active:scale-95 cursor-pointer shrink-0"
            >
              확인 완료 (닫기)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
