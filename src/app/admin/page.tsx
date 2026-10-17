"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ShieldAlert,
  Users,
  Award,
  Clock,
  RefreshCw,
  AlertTriangle,
  RotateCcw,
  FastForward,
  Download,
  Search,
  Lock,
  CheckCircle,
  Lightbulb,
  LogOut,
  Eye,
  EyeOff,
  MessageSquare,
  Image as ImageIcon,
  X,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Check,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Sparkles,
} from "lucide-react";
import { getPinOrder } from "@/data/pinOrder";

interface AdminReview {
  pin: string;
  name: string;
  content: string;
  photo?: string | null;
  createdAt: number;
  hidden?: boolean;
}

interface AdminUser {
  pin: string;
  nickname: string;
  currentRoom: number;
  startedAt: number | null;
  roomEnteredAt: number | null;
  unlockedHints: number[];
  totalHintsUsed: number;
  isCleared: boolean;
  clearedAt: number | null;
  totalTimeSeconds: number;
  lastActiveAt: number | null;
  status: string;
  hasReviewed?: boolean;
}

interface StatsData {
  totalUsers: number;
  startedCount: number;
  activeCount: number;
  clearedCount: number;
  avgClearSeconds: number;
  totalReviews?: number;
  hiddenReviews?: number;
  roomDistribution: Record<string, number>;
  bottlenecks: number[];
  users: AdminUser[];
}

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState<string>("");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [stats, setStats] = useState<StatsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [roomFilter, setRoomFilter] = useState<string>("all");
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  // Dedicated review management state (decoupled from stats auto-refresh)
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [isReviewsLoading, setIsReviewsLoading] = useState<boolean>(false);
  const [isSheetSyncing, setIsSheetSyncing] = useState<boolean>(false);
  const [isReviewCardOpen, setIsReviewCardOpen] = useState<boolean>(true);
  const [reviewsLoaded, setReviewsLoaded] = useState<boolean>(false);

  // Participant memo state
  const [editingMemos, setEditingMemos] = useState<Record<string, string>>({});
  const [savingPins, setSavingPins] = useState<Record<string, boolean>>({});
  const [savedPins, setSavedPins] = useState<Record<string, boolean>>({});

  // Participant sort state (기본: 처음 설정한 핀번호 순서 오름차순 고정)
  const [sortField, setSortField] = useState<"pin" | "room" | "time" | "hints">("pin");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [passingPins, setPassingPins] = useState<Record<string, boolean>>({});

  const handleToggleSort = (field: "pin" | "room" | "time" | "hints") => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Load stats (Fast, light, in-memory)
  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/stats?_nc=${Date.now()}_${Math.random().toString(36).substring(7)}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      });
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.warn("Failed to fetch admin stats:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch reviews independently
  const fetchReviews = useCallback(async (syncSheet = false) => {
    if (syncSheet) {
      setIsSheetSyncing(true);
    } else {
      setIsReviewsLoading(true);
    }
    try {
      const url = `/api/admin/reviews?_nc=${Date.now()}_${Math.random().toString(36).substring(7)}${syncSheet ? "&syncSheet=true" : ""}`;
      const res = await fetch(url, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      });
      const data = await res.json();
      if (data && data.reviews) {
        setReviews(data.reviews);
        setReviewsLoaded(true);
        if (syncSheet) {
          setActionMsg("구글 스프레드시트 최신 후기가 성공적으로 동기화되었습니다.");
          setTimeout(() => setActionMsg(null), 3500);
        }
      }
    } catch (e) {
      console.warn("Failed to fetch reviews:", e);
    } finally {
      setIsReviewsLoading(false);
      setIsSheetSyncing(false);
    }
  }, []);

  // Check stored auth
  useEffect(() => {
    const savedKey = sessionStorage.getItem("escape_admin_key");
    if (savedKey) {
      setAdminKey(savedKey);
      setIsAuthenticated(true);
    }
  }, []);

  // Auto refresh loop (Only refreshes participant live stats every 3.5s)
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchStats();
    if (!reviewsLoaded) {
      fetchReviews(false);
    }

    if (!autoRefresh) return;
    const interval = setInterval(fetchStats, 3500);
    return () => clearInterval(interval);
  }, [isAuthenticated, autoRefresh, fetchStats, reviewsLoaded, fetchReviews]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminKey === "2026" || adminKey === "admin" || adminKey === "cain2026") {
      setIsAuthenticated(true);
      sessionStorage.setItem("escape_admin_key", adminKey);
      setAuthError(null);
    } else {
      setAuthError("비밀번호가 올바르지 않습니다.");
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("escape_admin_key");
    setIsAuthenticated(false);
    setAdminKey("");
  };

  const [reviewFilter, setReviewFilter] = useState<"all" | "visible" | "hidden">("all");
  const [reviewSearch, setReviewSearch] = useState<string>("");
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [selectedReview, setSelectedReview] = useState<AdminReview | null>(null);

  // Filtered reviews list for grid & detail modal navigation
  const filteredReviews = reviews.filter((r) => {
    if (reviewFilter === "visible" && r.hidden) return false;
    if (reviewFilter === "hidden" && !r.hidden) return false;
    if (reviewSearch) {
      const q = reviewSearch.toLowerCase();
      const matchPin = r.pin?.toLowerCase().includes(q);
      const matchName = r.name?.toLowerCase().includes(q);
      const matchContent = r.content?.toLowerCase().includes(q);
      return matchPin || matchName || matchContent;
    }
    return true;
  });

  const currentReviewIndex = selectedReview
    ? filteredReviews.findIndex(
        (r) => r.pin.toUpperCase() === selectedReview.pin.toUpperCase()
      )
    : -1;

  const handlePrevReview = () => {
    if (currentReviewIndex > 0) {
      setSelectedReview(filteredReviews[currentReviewIndex - 1]);
    }
  };

  const handleNextReview = () => {
    if (
      currentReviewIndex >= 0 &&
      currentReviewIndex < filteredReviews.length - 1
    ) {
      setSelectedReview(filteredReviews[currentReviewIndex + 1]);
    }
  };

  // Keyboard navigation for review card modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedReview) return;
      if (previewPhoto) return; // let image lightbox handle itself first
      if (e.key === "Escape") {
        setSelectedReview(null);
      } else if (e.key === "ArrowLeft") {
        handlePrevReview();
      } else if (e.key === "ArrowRight") {
        handleNextReview();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedReview, previewPhoto, currentReviewIndex, filteredReviews]);

  const handleAction = async (action: "pass" | "reset", pin?: string) => {
    if (action === "reset" && !pin) {
      if (!confirm("⚠️ 주의: 전체 100명 참가자의 진행 상태를 초기화하시겠습니까?")) {
        return;
      }
    }

    try {
      const res = await fetch("/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, pin, adminKey }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMsg(data.message || `${pin}번 참가자 처리 완료`);
        setTimeout(() => setActionMsg(null), 3000);
        fetchStats();
      } else {
        alert(data.error || "작업에 실패했습니다.");
      }
    } catch {
      alert("서버 통신 실패");
    }
  };

  const handlePass = async (pin: string) => {
    setPassingPins((prev) => ({ ...prev, [pin]: true }));
    try {
      const res = await fetch("/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pass", pin, adminKey }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMsg(data.message || `${pin}번 참가자 패스 완료`);
        setTimeout(() => setActionMsg(null), 2500);
        await fetchStats();
      } else {
        alert(data.error || "패스 처리에 실패했습니다.");
      }
    } catch {
      alert("서버 통신 실패");
    } finally {
      setPassingPins((prev) => ({ ...prev, [pin]: false }));
    }
  };

  const handleSaveMemo = async (pin: string, newMemo: string) => {
    setSavingPins((prev) => ({ ...prev, [pin]: true }));
    try {
      const res = await fetch("/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateNickname",
          pin,
          nickname: newMemo,
          adminKey,
        }),
      });
      if (res.ok) {
        setSavedPins((prev) => ({ ...prev, [pin]: true }));
        setTimeout(() => {
          setSavedPins((prev) => ({ ...prev, [pin]: false }));
        }, 1500);
        // Instant local update
        setStats((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            users: prev.users.map((u) => (u.pin === pin ? { ...u, nickname: newMemo } : u)),
          };
        });
      }
    } catch (e) {
      console.error("Failed to save memo:", e);
    } finally {
      setSavingPins((prev) => ({ ...prev, [pin]: false }));
    }
  };

  const handleToggleReview = async (pin: string, targetHide: boolean) => {
    // 1. 즉각적인 UI 반영 (낙관적 업데이트)
    setReviews((prev) =>
      prev.map((r) =>
        r.pin.toUpperCase() === pin.trim().toUpperCase() ? { ...r, hidden: targetHide } : r
      )
    );
    setSelectedReview((prev) =>
      prev && prev.pin.toUpperCase() === pin.trim().toUpperCase()
        ? { ...prev, hidden: targetHide }
        : prev
    );

    try {
      const res = await fetch("/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggleReview",
          pin,
          hide: targetHide,
          adminKey,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMsg(data.message || `${pin}번 후기 상태 변경 완료`);
        setTimeout(() => setActionMsg(null), 3000);
      } else {
        alert(data.error || "후기 상태 변경 실패");
        fetchReviews(false);
      }
    } catch {
      alert("서버 통신 실패");
      fetchReviews(false);
    }
  };

  const formatSeconds = (sec: number) => {
    if (!sec) return "-";
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}분 ${s}초`;
  };

  const formatLiveStayTime = (enteredAt: number | null) => {
    if (!enteredAt) return "-";
    const diffSec = Math.floor((Date.now() - enteredAt) / 1000);
    const mins = Math.floor(diffSec / 60);
    const s = diffSec % 60;
    return `${mins}분 ${s}초`;
  };

  const exportCSV = () => {
    if (!stats) return;
    let csv = "수사암호,닉네임/메모,현재방,상태,사용한힌트총수,총소요시간(초)\n";
    stats.users.forEach((u) => {
      csv += `${u.pin},${u.nickname},${u.isCleared ? "CLEAR" : u.currentRoom},${u.status},${u.totalHintsUsed || 0},${u.totalTimeSeconds || 0}\n`;
    });
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `방탈출_진행통계_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  if (!isAuthenticated) {
    return (
      <div className="flex-1 min-h-[100dvh] bg-[#141110] flex items-center justify-center p-4 text-stone-100">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm p-8 rounded-3xl bg-[#1e1916] border border-amber-600/40 shadow-2xl text-center"
        >
          <div className="w-14 h-14 rounded-2xl bg-amber-950/80 border border-amber-600/50 flex items-center justify-center mx-auto mb-4 text-amber-400 shadow-inner">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-black mb-1 tracking-tight text-stone-100">
            관리자 대시보드
          </h2>
          <p className="text-xs text-stone-400 mb-6 font-medium">
            사건일지 운영자 인증을 진행하세요.
          </p>

          {authError && (
            <div className="mb-4 p-2.5 rounded-xl bg-red-950/80 border border-red-800 text-red-200 text-xs font-semibold">
              {authError}
            </div>
          )}

          <div className="space-y-3">
            <input
              type="password"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              placeholder="비밀번호 입력"
              className="w-full px-4 py-3.5 rounded-xl bg-stone-900 border border-stone-700 text-center font-mono text-stone-100 placeholder-stone-500 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              autoFocus
            />

            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 font-black text-sm transition shadow-lg active:scale-95 cursor-pointer"
            >
              대시보드 접속
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Filter and sort users
  const filteredUsers = (stats?.users || [])
    .filter((u) => {
      const currentName = editingMemos[u.pin] !== undefined ? editingMemos[u.pin] : u.nickname;
      const matchesSearch =
        !searchFilter ||
        u.pin.includes(searchFilter) ||
        currentName.toLowerCase().includes(searchFilter.toLowerCase());

      if (!matchesSearch) return false;
      if (roomFilter === "all") return true;
      if (roomFilter === "clear") return u.isCleared;
      if (roomFilter === "playing") return u.startedAt && !u.isCleared;
      if (roomFilter === "ready") return !u.startedAt;
      return String(u.currentRoom) === roomFilter;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortField === "pin") {
        comparison = getPinOrder(a.pin) - getPinOrder(b.pin);
      } else if (sortField === "room") {
        const roomA = a.isCleared ? 11 : a.currentRoom;
        const roomB = b.isCleared ? 11 : b.currentRoom;
        comparison = roomA - roomB;
      } else if (sortField === "time") {
        const timeA = a.totalTimeSeconds || 0;
        const timeB = b.totalTimeSeconds || 0;
        comparison = timeA - timeB;
      } else if (sortField === "hints") {
        const hintsA = a.totalHintsUsed || 0;
        const hintsB = b.totalHintsUsed || 0;
        comparison = hintsA - hintsB;
      }

      // 같은 값이면 처음 설정한 핀번호 순서로 정렬 유지
      if (comparison === 0) {
        comparison = getPinOrder(a.pin) - getPinOrder(b.pin);
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

  const totalHintsUsedCount = (stats?.users || []).reduce(
    (acc, u) => acc + (u.totalHintsUsed || 0),
    0
  );

  return (
    <div className="min-h-[100dvh] bg-[#120f0d] text-stone-100 select-text">
      {/* Desktop Optimized Container */}
      <div className="w-full max-w-[1750px] mx-auto px-4 sm:px-6 lg:px-10 py-6">
        {/* Top Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-stone-800/80 mb-6">
          <div>
            <div className="flex items-center gap-2 text-amber-500 mb-1">
              <ShieldAlert className="w-5 h-5" />
              <span className="text-xs font-mono font-bold tracking-widest text-amber-400">
                CASE CONTROL CENTER • DESKTOP OPS
              </span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-stone-100">
              명탐정 방탈출 실시간 관제 대시보드
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Auto refresh badge/button */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-bold border transition flex items-center gap-2 ${
                autoRefresh
                  ? "bg-emerald-950/70 border-emerald-600 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                  : "bg-stone-900 border-stone-700 text-stone-400"
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${autoRefresh ? "animate-spin" : ""}`} />
              <span>실시간 자동갱신 {autoRefresh ? "ON (3.5s)" : "OFF"}</span>
            </button>

            {/* Manual refresh button */}
            <button
              onClick={fetchStats}
              disabled={isLoading}
              className="p-2.5 rounded-xl bg-stone-800 hover:bg-stone-750 text-stone-200 border border-stone-700 transition"
              title="수동 새로고침"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>

            {/* CSV Export */}
            <button
              onClick={exportCSV}
              className="px-3.5 py-2.5 rounded-xl bg-amber-700/80 hover:bg-amber-600 text-stone-100 text-xs font-bold flex items-center gap-2 transition shadow-md"
            >
              <Download className="w-3.5 h-3.5" />
              <span>기록 CSV 추출</span>
            </button>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="p-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-stone-200 border border-stone-800 transition"
              title="대시보드 로그아웃"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Action Notification Message */}
        {actionMsg && (
          <div className="mb-5 p-3.5 rounded-2xl bg-emerald-950/90 border border-emerald-600 text-emerald-200 text-xs font-bold flex items-center gap-2 shadow-lg animate-fadeIn">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>{actionMsg}</span>
          </div>
        )}

        {/* Key Metrics Cards - Desktop 6-Columns Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5 mb-6">
          <div className="p-4 lg:p-5 rounded-2xl bg-[#1d1714] border border-stone-800 shadow-md">
            <div className="flex items-center gap-2 text-stone-400 text-xs mb-1.5">
              <Users className="w-4 h-4 text-amber-500" />
              <span className="font-semibold">실시간 동시 접속자</span>
            </div>
            <div className="text-3xl font-black font-mono text-stone-100 tracking-tight">
              {stats?.activeCount ?? 0}
              <span className="text-xs font-mono font-medium text-stone-400 ml-1.5">
                / {stats?.totalUsers || 100}명
              </span>
            </div>
            <div className="mt-2 text-[11px] text-stone-500 font-mono">
              전체 수사관 중 {Math.round(((stats?.activeCount || 0) / (stats?.totalUsers || 100)) * 100)}% 활동 중
            </div>
          </div>

          <div className="p-4 lg:p-5 rounded-2xl bg-[#1d1714] border border-stone-800 shadow-md">
            <div className="flex items-center gap-2 text-stone-400 text-xs mb-1.5">
              <Clock className="w-4 h-4 text-sky-400" />
              <span className="font-semibold">수사 진행 참가자</span>
            </div>
            <div className="text-3xl font-black font-mono text-sky-400 tracking-tight">
              {stats?.startedCount ?? 0}명
            </div>
            <div className="mt-2 text-[11px] text-stone-500 font-mono">
              미접속/대기: {(stats?.totalUsers || 100) - (stats?.startedCount || 0)}명
            </div>
          </div>

          <div className="p-4 lg:p-5 rounded-2xl bg-[#1d1714] border border-stone-800 shadow-md">
            <div className="flex items-center gap-2 text-stone-400 text-xs mb-1.5">
              <Award className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold">사건 해결 (CLEAR)</span>
            </div>
            <div className="text-3xl font-black font-mono text-emerald-400 tracking-tight">
              {stats?.clearedCount ?? 0}명
            </div>
            <div className="mt-2 text-[11px] text-emerald-500/80 font-mono">
              클리어율: {Math.round(((stats?.clearedCount || 0) / Math.max(1, stats?.startedCount || 1)) * 100)}%
            </div>
          </div>

          <div className="p-4 lg:p-5 rounded-2xl bg-[#1d1714] border border-stone-800 shadow-md">
            <div className="flex items-center gap-2 text-stone-400 text-xs mb-1.5">
              <MessageSquare className="w-4 h-4 text-amber-400" />
              <span className="font-semibold">등록된 수사 후기</span>
            </div>
            <div className="text-3xl font-black font-mono text-amber-400 tracking-tight">
              {stats?.totalReviews ?? 0}
              <span className="text-xs font-mono font-medium text-stone-400 ml-1.5">건</span>
            </div>
            <div className="mt-2 text-[11px] text-stone-400 font-mono flex items-center gap-1.5">
              <span className="text-emerald-400 font-bold">노출 {(stats?.totalReviews || 0) - (stats?.hiddenReviews || 0)}</span>
              <span>/</span>
              <span className="text-red-400 font-bold">숨김 {stats?.hiddenReviews || 0}</span>
            </div>
          </div>

          <div className="p-4 lg:p-5 rounded-2xl bg-[#1d1714] border border-stone-800 shadow-md">
            <div className="flex items-center gap-2 text-stone-400 text-xs mb-1.5">
              <Clock className="w-4 h-4 text-amber-400" />
              <span className="font-semibold">평균 클리어 소요 시간</span>
            </div>
            <div className="text-3xl font-black font-mono text-amber-300 tracking-tight">
              {formatSeconds(stats?.avgClearSeconds ?? 0)}
            </div>
            <div className="mt-2 text-[11px] text-stone-500 font-mono">
              완료자 기준 평균 기록
            </div>
          </div>

          <div className="p-4 lg:p-5 rounded-2xl bg-[#1d1714] border border-stone-800 shadow-md">
            <div className="flex items-center gap-2 text-stone-400 text-xs mb-1.5">
              <Lightbulb className="w-4 h-4 text-yellow-400" />
              <span className="font-semibold">총 힌트 사용 건수</span>
            </div>
            <div className="text-3xl font-black font-mono text-yellow-300 tracking-tight">
              {totalHintsUsedCount}회
            </div>
            <div className="mt-2 text-[11px] text-stone-500 font-mono">
              참가자당 평균 {(totalHintsUsedCount / Math.max(1, stats?.startedCount || 1)).toFixed(1)}개
            </div>
          </div>
        </div>

        {/* Room Distribution Statistics (Room 1 ~ 10 + Clear) - Desktop 11-Columns Grid */}
        <section className="mb-6 p-5 lg:p-6 rounded-3xl bg-[#1b1613] border border-amber-900/40 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-base lg:text-lg font-black text-amber-300 tracking-tight">
                📊 방별 체류 인원 실시간 모니터링
              </h2>
              <span className="text-xs text-stone-400 font-mono">
                (카드를 클릭하면 해당 방 참가자만 필터링됩니다)
              </span>
            </div>
            {roomFilter !== "all" && (
              <button
                onClick={() => setRoomFilter("all")}
                className="text-xs text-amber-400 hover:underline font-bold"
              >
                필터 해제 (전체 보기)
              </button>
            )}
          </div>

          {/* 11 Columns for 10 Rooms + Clear */}
          <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-11 gap-2.5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((room) => {
              const count = stats?.roomDistribution?.[String(room)] || 0;
              const isBottleneck = (stats?.bottlenecks || []).includes(room);
              const isSelected = roomFilter === String(room);

              return (
                <div
                  key={room}
                  onClick={() => setRoomFilter(isSelected ? "all" : String(room))}
                  className={`p-3 lg:p-3.5 rounded-2xl border flex flex-col items-center justify-between cursor-pointer transition select-none ${
                    isSelected
                      ? "bg-amber-950/90 border-amber-400 ring-2 ring-amber-500 scale-[1.03]"
                      : isBottleneck
                      ? "bg-red-950/40 border-red-700/80 hover:bg-red-900/50"
                      : "bg-[#231d19] border-stone-800 hover:border-amber-700/70"
                  }`}
                >
                  <div className="text-xs font-mono font-bold text-stone-400 flex items-center gap-1">
                    <span>Q{room}</span>
                    {isBottleneck && (
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400 animate-pulse" />
                    )}
                  </div>
                  <div
                    className={`text-2xl font-black font-mono my-1.5 ${
                      isBottleneck
                        ? "text-red-400"
                        : count > 0
                        ? "text-amber-300"
                        : "text-stone-600"
                    }`}
                  >
                    {count}명
                  </div>
                  <div className="w-full bg-stone-900 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full ${
                        isBottleneck ? "bg-red-500" : "bg-amber-500"
                      }`}
                      style={{
                        width: `${Math.min(100, (count / 15) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}

            {/* Clear Room Column */}
            <div
              onClick={() => setRoomFilter(roomFilter === "clear" ? "all" : "clear")}
              className={`p-3 lg:p-3.5 rounded-2xl border flex flex-col items-center justify-between cursor-pointer transition select-none ${
                roomFilter === "clear"
                  ? "bg-emerald-950/90 border-emerald-400 ring-2 ring-emerald-500 scale-[1.03]"
                  : "bg-[#18231c] border-emerald-900/60 hover:border-emerald-700"
              }`}
            >
              <div className="text-xs font-mono font-bold text-emerald-400">
                CLEAR 🏆
              </div>
              <div className="text-2xl font-black font-mono text-emerald-300 my-1.5">
                {stats?.roomDistribution?.["clear"] || 0}명
              </div>
              <div className="w-full bg-stone-900 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full bg-emerald-500"
                  style={{
                    width: `${Math.min(
                      100,
                      ((stats?.roomDistribution?.["clear"] || 0) / 15) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {stats?.bottlenecks && stats.bottlenecks.length > 0 && (
            <div className="mt-4 p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 animate-pulse" />
              <span>
                <strong>실시간 병목 주의보:</strong> 현재{" "}
                {stats.bottlenecks.map((r) => `Q${r}번 방`).join(", ")}에 체류 인원이
                밀려있습니다. 현장 힌트 지원 또는 난이도 안내를 권장합니다.
              </span>
            </div>
          )}
        </section>

        {/* Review Management Section (Independent Card) */}
        <section className="mb-6 p-5 lg:p-6 rounded-3xl bg-[#1b1613] border border-stone-800 shadow-xl transition">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-800/80 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base lg:text-lg font-black text-stone-100 tracking-tight">
                    수사 후기 관리 및 게시판 숨김 제어
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-stone-800 text-amber-400 text-xs font-mono font-bold">
                    총 {reviews.length}건
                  </span>
                  {reviews.some((r) => r.hidden) && (
                    <span className="px-2 py-0.5 rounded-full bg-red-950/80 border border-red-700/60 text-red-300 text-[11px] font-bold">
                      {reviews.filter((r) => r.hidden).length}건 숨김
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-400 mt-0.5">
                  비밀 후기 게시판의 후기를 조회하고 숨김/노출을 제어합니다. (대시보드 실시간 갱신과 분리되어 딜레이 없음)
                </p>
              </div>
            </div>

            {/* Action buttons: Refresh, Sync Google Sheet, Collapse/Expand */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fetchReviews(false)}
                disabled={isReviewsLoading || isSheetSyncing}
                className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold transition flex items-center gap-1.5 border border-stone-700 disabled:opacity-50 cursor-pointer"
                title="등록된 후기 목록 새로고침"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isReviewsLoading ? "animate-spin text-amber-400" : ""}`} />
                <span>{isReviewsLoading ? "조회 중..." : "후기 새로고침"}</span>
              </button>

              <button
                type="button"
                onClick={() => fetchReviews(true)}
                disabled={isReviewsLoading || isSheetSyncing}
                className="px-3 py-1.5 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 text-xs font-bold transition flex items-center gap-1.5 border border-amber-500/40 disabled:opacity-50 cursor-pointer"
                title="구글 스프레드시트에서 최신 후기 가져오기"
              >
                <FileSpreadsheet className={`w-3.5 h-3.5 ${isSheetSyncing ? "animate-spin text-amber-400" : ""}`} />
                <span>{isSheetSyncing ? "시트 동기화 중..." : "구글 시트 동기화"}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsReviewCardOpen(!isReviewCardOpen)}
                className="px-2.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-200 text-xs transition border border-stone-700 cursor-pointer"
                title={isReviewCardOpen ? "후기 카드 접기" : "후기 카드 펼치기"}
              >
                {isReviewCardOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {isReviewCardOpen && (
            <>
              {/* Filter buttons & search */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="relative min-w-[200px] flex-1 max-w-sm">
                  <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={reviewSearch}
                    onChange={(e) => setReviewSearch(e.target.value)}
                    placeholder="작성자, 암호 또는 내용 검색"
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-stone-900 border border-stone-700 text-xs text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500 font-medium"
                  />
                </div>

                <div className="flex rounded-xl bg-stone-900 p-1 border border-stone-800 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setReviewFilter("all")}
                    className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                      reviewFilter === "all" ? "bg-amber-600 text-stone-950 font-black" : "text-stone-400 hover:text-stone-200"
                    }`}
                  >
                    전체 ({reviews.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewFilter("visible")}
                    className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                      reviewFilter === "visible" ? "bg-emerald-600 text-stone-950 font-black" : "text-stone-400 hover:text-stone-200"
                    }`}
                  >
                    노출 중 ({reviews.filter((r) => !r.hidden).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewFilter("hidden")}
                    className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                      reviewFilter === "hidden" ? "bg-red-600 text-white font-black" : "text-stone-400 hover:text-stone-200"
                    }`}
                  >
                    숨김 ({reviews.filter((r) => r.hidden).length})
                  </button>
                </div>
              </div>

              {/* Review List Grid */}
              {isReviewsLoading && reviews.length === 0 ? (
                <div className="py-12 text-center text-amber-400/80 text-xs rounded-2xl bg-[#161210] border border-stone-800/80 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
                  <span>후기 목록을 불러오는 중입니다...</span>
                </div>
              ) : filteredReviews.length === 0 ? (
                <div className="py-10 text-center text-stone-500 text-xs rounded-2xl bg-[#161210] border border-stone-800/80">
                  {reviews.length > 0
                    ? "선택한 조건에 맞는 후기가 없습니다."
                    : "아직 등록된 수사 후기가 없습니다."}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 max-h-[500px] overflow-y-auto pr-1">
                  {filteredReviews.map((r) => {
                    const isHidden = !!r.hidden;
                    return (
                      <div
                        key={r.pin}
                        onClick={() => setSelectedReview(r)}
                        className={`p-4 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer group hover:scale-[1.01] hover:shadow-xl ${
                          isHidden
                            ? "bg-[#181412]/80 border-red-900/40 opacity-75 hover:opacity-100 hover:border-red-700"
                            : "bg-[#221b17] border-stone-800 hover:border-amber-500 hover:bg-[#28201a]"
                        }`}
                        title="클릭하여 새 카드로 이름, 사진, 후기 전체 보기"
                      >
                        <div>
                          {/* Card Top */}
                          <div className="flex items-start justify-between gap-2 mb-2.5 pb-2 border-b border-stone-800/80">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="px-2 py-0.5 rounded-md bg-amber-950 font-mono font-black text-amber-400 text-xs tracking-wider border border-amber-600/50 shadow-sm">
                                  PIN: {r.pin}
                                </span>
                                <span className="font-bold text-sm text-stone-100 group-hover:text-amber-300 transition">
                                  {r.name}
                                </span>
                              </div>
                              <span className="text-[10px] text-stone-500 font-mono mt-0.5 block">
                                {r.createdAt ? new Date(r.createdAt).toLocaleString("ko-KR") : "-"}
                              </span>
                            </div>

                            {isHidden ? (
                              <span className="px-2 py-0.5 rounded-full bg-red-950 text-red-400 border border-red-800 text-[10px] font-bold flex items-center gap-1 shrink-0">
                                <EyeOff className="w-3 h-3" />
                                <span>게시판 숨김됨</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold flex items-center gap-1 shrink-0">
                                <Eye className="w-3 h-3" />
                                <span>게시판 노출 중</span>
                              </span>
                            )}
                          </div>

                          {/* Photo thumbnail if exists */}
                          {r.photo && (
                            <div className="relative mb-2.5 rounded-xl overflow-hidden border border-amber-600/30 bg-stone-950 h-32 group/img">
                              <img
                                src={r.photo}
                                alt={`${r.name} 사진`}
                                className="w-full h-full object-cover group-hover/img:scale-105 transition duration-300"
                              />
                              <div className="absolute inset-0 bg-black/45 opacity-0 group-hover/img:opacity-100 transition flex items-center justify-center text-[11px] font-bold text-stone-200 gap-1 backdrop-blur-[1px]">
                                <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
                                <span>새 카드로 크게보기</span>
                              </div>
                            </div>
                          )}

                          {/* Content text */}
                          <p className="text-xs text-stone-300 leading-relaxed whitespace-pre-wrap line-clamp-3 font-medium mb-3">
                            {r.content}
                          </p>
                        </div>

                        {/* Card Action Button & Hint */}
                        <div className="pt-2 border-t border-stone-800/80 flex items-center justify-between gap-2">
                          <span className="text-[10px] text-amber-400/90 font-medium flex items-center gap-1 group-hover:text-amber-300 transition">
                            <Sparkles className="w-3 h-3 text-amber-400" />
                            <span>새 카드로 자세히 보기</span>
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleReview(r.pin, !isHidden);
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0 ${
                              isHidden
                                ? "bg-emerald-900/80 hover:bg-emerald-800 text-emerald-200 border border-emerald-600"
                                : "bg-red-950/90 hover:bg-red-900 text-red-200 border border-red-700"
                            }`}
                          >
                            {isHidden ? (
                              <>
                                <Eye className="w-3.5 h-3.5" />
                                <span>노출하기</span>
                              </>
                            ) : (
                              <>
                                <EyeOff className="w-3.5 h-3.5" />
                                <span>숨기기</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>

        {/* Participant Table Controls & List - Full Desktop Table */}
        <section className="rounded-3xl bg-[#1b1613] border border-stone-800 shadow-xl overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-stone-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
            <div className="flex items-center gap-3">
              <h2 className="text-base lg:text-lg font-black text-stone-100">
                참가자 100인 진행 명단
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-stone-800 text-amber-400 text-xs font-mono font-bold">
                {filteredUsers.length}명 조회
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search Box */}
              <div className="relative min-w-[220px]">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="암호 또는 닉네임 검색"
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-stone-900 border border-stone-700 text-xs text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500 font-medium"
                />
              </div>

              {/* Room Filter Selector */}
              <select
                value={roomFilter}
                onChange={(e) => setRoomFilter(e.target.value)}
                className="px-3.5 py-2 rounded-xl bg-stone-900 border border-stone-700 text-xs text-stone-100 focus:outline-none focus:border-amber-500 font-medium cursor-pointer"
              >
                <option value="all">전체 상태 보기</option>
                <option value="playing">진행 중 유저만</option>
                <option value="clear">클리어 유저만</option>
                <option value="ready">미접속 유저만</option>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => (
                  <option key={r} value={String(r)}>
                    Q{r}번 방 유저
                  </option>
                ))}
              </select>

              {/* Reset All Button */}
              <button
                onClick={() => handleAction("reset")}
                className="px-3.5 py-2 rounded-xl bg-red-950/70 border border-red-800 hover:bg-red-900 text-red-200 text-xs font-bold transition flex items-center gap-1.5 shadow"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>전체 100명 초기화</span>
              </button>
            </div>
          </div>

          {/* Desktop Optimized Table */}
          <div className="overflow-x-auto max-h-[650px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10 bg-[#221b17] text-stone-400 border-b border-stone-800 font-mono shadow-sm">
                <tr>
                  <th
                    onClick={() => handleToggleSort("pin")}
                    className="py-3.5 px-5 cursor-pointer hover:text-amber-400 transition select-none group"
                    title="클릭하여 처음 설정한 핀번호 순서로 정렬"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>수사 암호(PIN)</span>
                      {sortField === "pin" ? (
                        sortOrder === "asc" ? (
                          <ArrowUp className="w-3.5 h-3.5 text-amber-400" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-amber-400" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-stone-600 group-hover:text-amber-400/70" />
                      )}
                    </div>
                  </th>
                  <th className="py-3.5 px-5 min-w-[200px]">참가자 이름 / 메모 (수정 가능)</th>
                  <th
                    onClick={() => handleToggleSort("room")}
                    className="py-3.5 px-5 cursor-pointer hover:text-amber-400 transition select-none group"
                    title="클릭하여 현재 방 번호 위치 순으로 정렬"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>현재 위치</span>
                      {sortField === "room" ? (
                        sortOrder === "asc" ? (
                          <ArrowUp className="w-3.5 h-3.5 text-amber-400" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-amber-400" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-stone-600 group-hover:text-amber-400/70" />
                      )}
                    </div>
                  </th>
                  <th className="py-3.5 px-5">현재 방 체류시간</th>
                  <th
                    onClick={() => handleToggleSort("time")}
                    className="py-3.5 px-5 cursor-pointer hover:text-amber-400 transition select-none group"
                    title="클릭하여 총 소요 시간 순으로 정렬"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>총 소요시간</span>
                      {sortField === "time" ? (
                        sortOrder === "asc" ? (
                          <ArrowUp className="w-3.5 h-3.5 text-amber-400" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-amber-400" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-stone-600 group-hover:text-amber-400/70" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleToggleSort("hints")}
                    className="py-3.5 px-5 cursor-pointer hover:text-amber-400 transition select-none group"
                    title="클릭하여 사용한 힌트 개수 순으로 정렬"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>사용한 힌트</span>
                      {sortField === "hints" ? (
                        sortOrder === "asc" ? (
                          <ArrowUp className="w-3.5 h-3.5 text-amber-400" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-amber-400" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-stone-600 group-hover:text-amber-400/70" />
                      )}
                    </div>
                  </th>
                  <th className="py-3.5 px-5">접속 상태</th>
                  <th className="py-3.5 px-5 text-right">운영자 제어</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/80 font-sans">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-stone-500 text-sm">
                      조건에 일치하는 참가자가 없습니다.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isOnline =
                      u.lastActiveAt && Date.now() - u.lastActiveAt < 3 * 60 * 1000;

                    return (
                      <tr
                        key={u.pin}
                        className="hover:bg-[#251e1a] transition duration-150"
                      >
                        <td className="py-3.5 px-5 font-mono font-bold text-amber-400 text-sm">
                          {u.pin}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-stone-200">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={editingMemos[u.pin] !== undefined ? editingMemos[u.pin] : u.nickname}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditingMemos((prev) => ({ ...prev, [u.pin]: val }));
                              }}
                              onBlur={(e) => {
                                const val = e.target.value.trim();
                                if (val !== u.nickname) {
                                  handleSaveMemo(u.pin, val);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.currentTarget.blur();
                                }
                              }}
                              placeholder="참가자 메모 입력"
                              className="w-36 lg:w-48 px-2.5 py-1.5 rounded-lg bg-stone-900 border border-stone-700/80 hover:border-amber-500/60 focus:border-amber-500 text-xs text-stone-100 placeholder-stone-600 focus:outline-none transition font-medium"
                              title="이름 또는 메모를 입력하고 Enter를 누르면 저장됩니다"
                            />
                            {savingPins[u.pin] ? (
                              <span className="text-[10px] text-amber-400 animate-pulse font-mono shrink-0">저장중...</span>
                            ) : savedPins[u.pin] ? (
                              <span className="text-[10px] text-emerald-400 font-bold font-mono shrink-0 flex items-center gap-0.5">
                                <Check className="w-3 h-3" /> 저장됨
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="py-3.5 px-5">
                          {u.isCleared ? (
                            <div className="flex flex-col gap-1.5 items-start">
                              <span className="px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-600 text-emerald-300 font-bold font-mono">
                                CLEAR 🏆
                              </span>
                              {reviews.some((r) => r.pin.toUpperCase() === u.pin.toUpperCase()) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const rev = reviews.find(
                                      (r) => r.pin.toUpperCase() === u.pin.toUpperCase()
                                    );
                                    if (rev) setSelectedReview(rev);
                                  }}
                                  className="px-2 py-0.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer shadow-sm"
                                  title="작성한 후기 새 카드로 확인"
                                >
                                  <MessageSquare className="w-2.5 h-2.5 text-amber-400" />
                                  <span>후기 카드 보기</span>
                                </button>
                              )}
                            </div>
                          ) : u.startedAt ? (
                            <span className="px-2.5 py-1 rounded-lg bg-amber-950/80 border border-amber-600 text-amber-300 font-bold font-mono">
                              Q{u.currentRoom}번 방
                            </span>
                          ) : (
                            <span className="text-stone-500 font-mono text-xs">
                              대기 중
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-5 font-mono text-stone-300">
                          {u.startedAt && !u.isCleared
                            ? formatLiveStayTime(u.roomEnteredAt)
                            : "-"}
                        </td>
                        <td className="py-3.5 px-5 font-mono text-stone-300">
                          {u.isCleared
                            ? formatSeconds(u.totalTimeSeconds)
                            : u.startedAt
                            ? formatLiveStayTime(u.startedAt)
                            : "-"}
                        </td>
                        <td className="py-3.5 px-5 font-mono text-stone-300">
                          <span className="font-bold text-amber-400">{u.totalHintsUsed ?? 0}</span>개 사용
                          {u.unlockedHints && u.unlockedHints.length > 0 && !u.isCleared && (
                            <span className="text-[11px] text-stone-500 ml-1.5">(현 Q{u.currentRoom}: {u.unlockedHints.length}개)</span>
                          )}
                        </td>
                        <td className="py-3.5 px-5">
                          {u.isCleared ? (
                            <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold">
                              <span className="w-2 h-2 rounded-full bg-emerald-400" />
                              탈출완료
                            </span>
                          ) : isOnline ? (
                            <span className="inline-flex items-center gap-1.5 text-amber-400 font-semibold">
                              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                              실시간 접속
                            </span>
                          ) : u.startedAt ? (
                            <span className="inline-flex items-center gap-1.5 text-stone-400">
                              <span className="w-2 h-2 rounded-full bg-stone-500" />
                              자리비움
                            </span>
                          ) : (
                            <span className="text-stone-500 text-xs">미접속</span>
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {!u.isCleared ? (
                              <button
                                onClick={() => handlePass(u.pin)}
                                disabled={passingPins[u.pin]}
                                className="px-2.5 py-1.5 rounded-lg bg-amber-700/80 hover:bg-amber-600 text-stone-100 font-bold text-xs flex items-center gap-1 transition shadow disabled:opacity-50 cursor-pointer"
                                title="해당 참가자를 다음 방으로 강제 이동"
                              >
                                <FastForward className={`w-3.5 h-3.5 ${passingPins[u.pin] ? "animate-spin" : ""}`} />
                                <span>{passingPins[u.pin] ? "처리중" : "패스"}</span>
                              </button>
                            ) : (
                              <span className="text-[11px] font-bold text-emerald-400 px-2 py-1 rounded bg-emerald-950/60 border border-emerald-800/50">
                                탈출완료
                              </span>
                            )}
                            <button
                              onClick={() => handleAction("reset", u.pin)}
                              className="px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-stone-100 text-xs font-semibold transition border border-stone-700 cursor-pointer"
                              title="해당 참가자 초기화"
                            >
                              초기화
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* 관리자 수사 후기 상세 새 카드 모달 */}
      {selectedReview && (
        <div
          className="fixed inset-0 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fadeIn"
          style={{ zIndex: 90 }}
          onClick={() => setSelectedReview(null)}
        >
          <div
            className="relative w-full max-w-2xl bg-[#1b1512] border-2 border-amber-600/70 rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.95)] overflow-hidden flex flex-col max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-800 bg-[#211a15]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-stone-100 flex items-center gap-2">
                    <span>명탐정 수사 후기 상세 카드</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-950 text-amber-400 border border-amber-600/50 text-xs font-mono font-bold">
                      PIN: {selectedReview.pin}
                    </span>
                  </h3>
                  <p className="text-[11px] text-stone-400">
                    작성자 정보, 인증 사진 및 후기 전문을 확인하고 게시판 노출을 제어합니다.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Prev / Next buttons */}
                {filteredReviews.length > 1 && (
                  <div className="flex items-center bg-stone-900 rounded-xl border border-stone-800 p-0.5">
                    <button
                      type="button"
                      disabled={currentReviewIndex <= 0}
                      onClick={handlePrevReview}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition"
                      title="이전 후기 (단축키: ←)"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-2 text-[11px] font-mono text-stone-400">
                      {currentReviewIndex >= 0 ? currentReviewIndex + 1 : 1}/{filteredReviews.length}
                    </span>
                    <button
                      type="button"
                      disabled={
                        currentReviewIndex < 0 ||
                        currentReviewIndex >= filteredReviews.length - 1
                      }
                      onClick={handleNextReview}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition"
                      title="다음 후기 (단축키: →)"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setSelectedReview(null)}
                  className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-100 transition border border-stone-700 cursor-pointer"
                  title="닫기 (ESC)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-left">
              {/* 1. Profile / Info Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-[#251e19] border border-amber-900/30">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-stone-950 font-black text-xl flex items-center justify-center shadow-lg shrink-0">
                    {selectedReview.name ? selectedReview.name.charAt(0).toUpperCase() : "탐"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-amber-400 font-bold">수사관</span>
                      <h4 className="text-lg font-black text-stone-100 tracking-tight">
                        {selectedReview.name}
                      </h4>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-stone-400 font-mono mt-0.5">
                      <span>수사 암호: <strong className="text-amber-300">{selectedReview.pin}</strong></span>
                      <span>•</span>
                      <span>
                        {selectedReview.createdAt
                          ? new Date(selectedReview.createdAt).toLocaleString("ko-KR", {
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "-"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {selectedReview.hidden ? (
                    <span className="px-3 py-1.5 rounded-xl bg-red-950 text-red-300 border border-red-700/80 text-xs font-bold flex items-center gap-1.5 shadow-sm">
                      <EyeOff className="w-3.5 h-3.5 text-red-400" />
                      <span>게시판 숨김 상태</span>
                    </span>
                  ) : (
                    <span className="px-3 py-1.5 rounded-xl bg-emerald-950 text-emerald-300 border border-emerald-700/80 text-xs font-bold flex items-center gap-1.5 shadow-sm">
                      <Eye className="w-3.5 h-3.5 text-emerald-400" />
                      <span>클리어 유저에게 노출 중</span>
                    </span>
                  )}
                </div>
              </div>

              {/* 2. Photo Section */}
              {selectedReview.photo ? (
                <div className="rounded-2xl overflow-hidden border border-amber-600/40 bg-stone-950 shadow-inner relative group">
                  <div className="bg-[#120e0b] px-3.5 py-2 border-b border-stone-800/80 flex items-center justify-between text-xs font-semibold text-stone-300">
                    <span className="flex items-center gap-1.5 text-amber-400">
                      <ImageIcon className="w-3.5 h-3.5" />
                      현장 인증 사진
                    </span>
                    <button
                      type="button"
                      onClick={() => setPreviewPhoto(selectedReview.photo || null)}
                      className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-[11px] font-bold border border-stone-700 flex items-center gap-1 transition cursor-pointer"
                    >
                      <Maximize2 className="w-3 h-3 text-amber-400" />
                      <span>전체화면 확대</span>
                    </button>
                  </div>
                  <div
                    className="p-2 flex items-center justify-center bg-stone-950/80 cursor-pointer"
                    onClick={() => setPreviewPhoto(selectedReview.photo || null)}
                    title="클릭하여 원본 전체화면 보기"
                  >
                    <img
                      src={selectedReview.photo}
                      alt={`${selectedReview.name} 수사 인증 사진`}
                      className="max-h-[360px] w-auto max-w-full object-contain rounded-xl shadow-md transition hover:scale-[1.01]"
                    />
                  </div>
                </div>
              ) : (
                <div className="py-5 px-4 rounded-2xl bg-[#181310] border border-dashed border-stone-800 text-center text-stone-500 text-xs flex items-center justify-center gap-2">
                  <ImageIcon className="w-4 h-4 text-stone-600" />
                  <span>등록된 현장 인증 사진이 없습니다.</span>
                </div>
              )}

              {/* 3. Review Content Section */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#14100c] border border-amber-900/40 shadow-inner">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400 mb-2.5 pb-2 border-b border-stone-800/80">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>수사 후기 내용 전문</span>
                </div>
                <p className="text-stone-100 text-sm sm:text-base leading-relaxed whitespace-pre-wrap font-medium break-words">
                  {selectedReview.content}
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-t border-stone-800 bg-[#211a15]">
              <span className="text-xs text-stone-400 hidden sm:inline">
                {selectedReview.hidden
                  ? "현재 비밀 후기 게시판에서 숨김 처리되어 있습니다."
                  : "현재 비밀 후기 게시판에 정상 노출 중입니다."}
              </span>

              <div className="flex items-center gap-2.5 ml-auto sm:ml-0">
                <button
                  type="button"
                  onClick={() => handleToggleReview(selectedReview.pin, !selectedReview.hidden)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow ${
                    selectedReview.hidden
                      ? "bg-emerald-900/90 hover:bg-emerald-800 text-emerald-100 border border-emerald-600"
                      : "bg-red-950/90 hover:bg-red-900 text-red-100 border border-red-700"
                  }`}
                >
                  {selectedReview.hidden ? (
                    <>
                      <Eye className="w-4 h-4" />
                      <span>게시판에 노출하기</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-4 h-4" />
                      <span>게시판에서 숨기기</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedReview(null)}
                  className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold transition border border-stone-700 cursor-pointer"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 관리자 후기 사진 확대 모달 */}
      {previewPhoto && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-fadeIn"
          style={{ zIndex: 110 }}
          onClick={() => setPreviewPhoto(null)}
        >
          <div
            className="relative max-w-lg w-full max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewPhoto(null)}
              className="absolute -top-11 right-0 p-2 rounded-full bg-stone-900 text-stone-300 hover:text-white border border-stone-700 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="relative w-full rounded-2xl overflow-hidden border-2 border-amber-500/60 shadow-2xl bg-stone-950 flex items-center justify-center">
              <img
                src={previewPhoto}
                alt="확대된 인증 사진"
                className="w-full max-h-[75vh] object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
