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
} from "lucide-react";

interface AdminUser {
  pin: string;
  nickname: string;
  currentRoom: number;
  startedAt: number | null;
  roomEnteredAt: number | null;
  unlockedHints: number[];
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

  // Load stats
  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/stats");
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.warn("Failed to fetch admin stats:", e);
    } finally {
      setIsLoading(false);
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

  // Auto refresh loop
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchStats();

    if (!autoRefresh) return;
    const interval = setInterval(fetchStats, 3500);
    return () => clearInterval(interval);
  }, [isAuthenticated, autoRefresh, fetchStats]);

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
    let csv = "수사암호,닉네임,현재방,상태,사용힌트수,총소요시간(초)\n";
    stats.users.forEach((u) => {
      csv += `${u.pin},${u.nickname},${u.isCleared ? "CLEAR" : u.currentRoom},${u.status},${u.unlockedHints?.length || 0},${u.totalTimeSeconds || 0}\n`;
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

  // Filter users
  const filteredUsers = (stats?.users || []).filter((u) => {
    const matchesSearch =
      u.pin.includes(searchFilter) ||
      u.nickname.toLowerCase().includes(searchFilter.toLowerCase());

    if (!matchesSearch) return false;
    if (roomFilter === "all") return true;
    if (roomFilter === "clear") return u.isCleared;
    if (roomFilter === "playing") return u.startedAt && !u.isCleared;
    if (roomFilter === "ready") return !u.startedAt;
    return String(u.currentRoom) === roomFilter;
  });

  const totalHintsUsedCount = (stats?.users || []).reduce(
    (acc, u) => acc + (u.unlockedHints?.length || 0),
    0
  );

  return (
    <div className="min-h-[100dvh] bg-[#120f0d] text-stone-100">
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

        {/* Key Metrics Cards - Desktop 5-Columns Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3.5 mb-6">
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

          <div className="p-4 lg:p-5 rounded-2xl bg-[#1d1714] border border-stone-800 shadow-md col-span-2 md:col-span-1">
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
                  <th className="py-3.5 px-5">수사 암호</th>
                  <th className="py-3.5 px-5">참가자 닉네임</th>
                  <th className="py-3.5 px-5">현재 위치</th>
                  <th className="py-3.5 px-5">현재 방 체류시간</th>
                  <th className="py-3.5 px-5">총 소요시간</th>
                  <th className="py-3.5 px-5">사용한 힌트</th>
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
                        <td className="py-3.5 px-5 font-bold text-stone-200">
                          {u.nickname}
                        </td>
                        <td className="py-3.5 px-5">
                          {u.isCleared ? (
                            <span className="px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-600 text-emerald-300 font-bold font-mono">
                              CLEAR 🏆
                            </span>
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
                        <td className="py-3.5 px-5 font-mono text-stone-400">
                          {u.unlockedHints?.length || 0}개 사용
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
                            {!u.isCleared && u.startedAt && (
                              <button
                                onClick={() => handleAction("pass", u.pin)}
                                className="px-2.5 py-1.5 rounded-lg bg-amber-700/80 hover:bg-amber-600 text-stone-100 font-bold text-xs flex items-center gap-1 transition shadow"
                                title="해당 참가자를 다음 방으로 강제 이동"
                              >
                                <FastForward className="w-3.5 h-3.5" />
                                <span>패스</span>
                              </button>
                            )}
                            <button
                              onClick={() => handleAction("reset", u.pin)}
                              className="px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-stone-100 text-xs font-semibold transition border border-stone-700"
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
    </div>
  );
}
