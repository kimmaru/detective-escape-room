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
      setAuthError("비밀번호가 올바르지 않습니다. (기본: 2026)");
    }
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
          className="w-full max-w-sm p-6 rounded-2xl bg-[#201a16] border border-amber-600/40 shadow-2xl text-center"
        >
          <div className="w-12 h-12 rounded-full bg-amber-950/80 border border-amber-600/50 flex items-center justify-center mx-auto mb-4 text-amber-400">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold mb-1">관리자 대시보드</h2>
          <p className="text-xs text-stone-400 mb-6">
            사건일지 운영자 인증 비밀번호를 입력하세요.
          </p>

          {authError && (
            <div className="mb-4 p-2.5 rounded-lg bg-red-950/80 border border-red-800 text-red-200 text-xs">
              {authError}
            </div>
          )}

          <input
            type="password"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            placeholder="비밀번호 입력 (기본: 2026)"
            className="w-full px-4 py-3 rounded-xl bg-stone-900 border border-stone-700 text-center font-mono text-stone-100 mb-4 focus:outline-none focus:border-amber-500"
            autoFocus
          />

          <button
            type="submit"
            className="w-full py-3.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold transition shadow-lg"
          >
            대시보드 접속
          </button>
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

  return (
    <div className="flex-1 min-h-[100dvh] bg-[#141110] text-stone-100 p-4 md:p-6 max-w-5xl mx-auto w-full">
      {/* Top Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-800 mb-6">
        <div>
          <div className="flex items-center gap-2 text-amber-500">
            <ShieldAlert className="w-5 h-5" />
            <span className="text-xs font-mono font-bold tracking-widest">
              OPERATION CONTROL
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-stone-100 mt-0.5">
            명탐정 방탈출 실시간 관제 대시보드
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
              autoRefresh
                ? "bg-emerald-950/60 border-emerald-600 text-emerald-300"
                : "bg-stone-900 border-stone-700 text-stone-400"
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${autoRefresh ? "animate-spin" : ""}`} />
            <span>자동갱신 {autoRefresh ? "ON (3.5s)" : "OFF"}</span>
          </button>

          <button
            onClick={fetchStats}
            disabled={isLoading}
            className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 transition"
            title="새로고침"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={exportCSV}
            className="px-3 py-2 rounded-xl bg-amber-700/80 hover:bg-amber-600 text-stone-100 text-xs font-bold flex items-center gap-1.5 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV 내보내기</span>
          </button>
        </div>
      </header>

      {/* Action Notification Message */}
      {actionMsg && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-950/80 border border-emerald-700 text-emerald-200 text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{actionMsg}</span>
        </div>
      )}

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="p-4 rounded-2xl bg-[#201a16] border border-stone-800">
          <div className="flex items-center gap-2 text-stone-400 text-xs mb-1">
            <Users className="w-4 h-4 text-amber-500" />
            <span>실시간 접속자</span>
          </div>
          <div className="text-2xl font-black font-mono text-stone-100">
            {stats?.activeCount ?? 0}{" "}
            <span className="text-xs font-normal text-stone-400">/ 100명</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#201a16] border border-stone-800">
          <div className="flex items-center gap-2 text-stone-400 text-xs mb-1">
            <Clock className="w-4 h-4 text-blue-400" />
            <span>수사 시작한 참가자</span>
          </div>
          <div className="text-2xl font-black font-mono text-blue-400">
            {stats?.startedCount ?? 0}명
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#201a16] border border-stone-800">
          <div className="flex items-center gap-2 text-stone-400 text-xs mb-1">
            <Award className="w-4 h-4 text-emerald-400" />
            <span>탈출 성공 (CLEAR)</span>
          </div>
          <div className="text-2xl font-black font-mono text-emerald-400">
            {stats?.clearedCount ?? 0}명
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#201a16] border border-stone-800">
          <div className="flex items-center gap-2 text-stone-400 text-xs mb-1">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>평균 소요 시간</span>
          </div>
          <div className="text-2xl font-black font-mono text-amber-300">
            {formatSeconds(stats?.avgClearSeconds ?? 0)}
          </div>
        </div>
      </div>

      {/* Room Distribution Statistics Chart (Room 1 ~ 10 + Clear) */}
      <section className="mb-8 p-5 rounded-2xl bg-[#1e1916] border border-amber-900/40 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-amber-300 flex items-center gap-2">
            <span>📊 방별 체류 인원 실시간 통계</span>
          </h2>
          <span className="text-xs text-stone-400">
            (총 10개 수사 현장 + 클리어)
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-6 lg:grid-cols-11 gap-2.5">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((room) => {
            const count = stats?.roomDistribution?.[String(room)] || 0;
            const isBottleneck = (stats?.bottlenecks || []).includes(room);

            return (
              <div
                key={room}
                onClick={() => setRoomFilter(String(room))}
                className={`p-3 rounded-xl border flex flex-col items-center justify-between cursor-pointer transition ${
                  roomFilter === String(room)
                    ? "bg-amber-950/80 border-amber-500 scale-105"
                    : isBottleneck
                    ? "bg-red-950/50 border-red-700 hover:bg-red-900/60"
                    : "bg-[#251f1b] border-stone-800 hover:border-amber-700/60"
                }`}
              >
                <div className="text-xs font-mono font-bold text-stone-400 flex items-center gap-1">
                  <span>Q{room}</span>
                  {isBottleneck && (
                    <AlertTriangle className="w-3 h-3 text-red-400" />
                  )}
                </div>
                <div
                  className={`text-xl font-black font-mono my-1 ${
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

          {/* Clear Room */}
          <div
            onClick={() => setRoomFilter("clear")}
            className={`p-3 rounded-xl border flex flex-col items-center justify-between cursor-pointer transition ${
              roomFilter === "clear"
                ? "bg-emerald-950/80 border-emerald-500 scale-105"
                : "bg-[#1f2820] border-emerald-900/60 hover:border-emerald-700"
            }`}
          >
            <div className="text-xs font-mono font-bold text-emerald-400">
              CLEAR
            </div>
            <div className="text-xl font-black font-mono text-emerald-300 my-1">
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
          <div className="mt-4 p-2.5 rounded-xl bg-red-950/50 border border-red-800/60 text-red-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>
              <strong>병목 경고:</strong>{" "}
              {stats.bottlenecks.map((r) => `Q${r}번 방`).join(", ")}에 인원이
              다수 체류하고 있습니다. 현장 힌트 지원을 고려하세요.
            </span>
          </div>
        )}
      </section>

      {/* Participant List & Table Controls */}
      <section className="rounded-2xl bg-[#1e1916] border border-stone-800 shadow-xl overflow-hidden">
        <div className="p-4 border-b border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-stone-100">
              참가자 100인 진행 명단
            </h2>
            <span className="text-xs text-stone-400">
              ({filteredUsers.length}명 표시)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Box */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="수사 암호 또는 닉네임 검색"
                className="pl-8 pr-3 py-1.5 rounded-xl bg-stone-900 border border-stone-700 text-xs text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Room Filter Selector */}
            <select
              value={roomFilter}
              onChange={(e) => setRoomFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-stone-900 border border-stone-700 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
            >
              <option value="all">전체 방 보기</option>
              <option value="playing">진행 중인 유저만</option>
              <option value="clear">클리어 유저만</option>
              <option value="ready">미시작 유저만</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => (
                <option key={r} value={String(r)}>
                  Q{r}번 방 유저
                </option>
              ))}
            </select>

            {/* Reset All Button */}
            <button
              onClick={() => handleAction("reset")}
              className="px-3 py-1.5 rounded-xl bg-red-950/70 border border-red-800 hover:bg-red-900 text-red-200 text-xs font-bold transition flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>전체 초기화</span>
            </button>
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#241e1a] text-stone-400 border-b border-stone-800 font-mono">
              <tr>
                <th className="py-3 px-4">수사 암호 (6자리)</th>
                <th className="py-3 px-4">닉네임</th>
                <th className="py-3 px-4">현재 위치</th>
                <th className="py-3 px-4">현재 방 체류시간</th>
                <th className="py-3 px-4">총 소요시간</th>
                <th className="py-3 px-4">힌트 사용</th>
                <th className="py-3 px-4">상태</th>
                <th className="py-3 px-4 text-right">관리자 제어</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800 font-sans">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-stone-500">
                    조건에 맞는 참가자가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isOnline =
                    u.lastActiveAt && Date.now() - u.lastActiveAt < 3 * 60 * 1000;

                  return (
                    <tr
                      key={u.pin}
                      className="hover:bg-[#251f1b] transition duration-150"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-amber-400">
                        {u.pin}
                      </td>
                      <td className="py-3 px-4 font-bold text-stone-200">
                        {u.nickname}
                      </td>
                      <td className="py-3 px-4">
                        {u.isCleared ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-300 font-bold font-mono">
                            CLEAR 🏆
                          </span>
                        ) : u.startedAt ? (
                          <span className="px-2 py-0.5 rounded bg-amber-950 border border-amber-700 text-amber-300 font-bold font-mono">
                            Q{u.currentRoom}
                          </span>
                        ) : (
                          <span className="text-stone-500 font-mono">대기중</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-stone-300">
                        {u.startedAt && !u.isCleared
                          ? formatLiveStayTime(u.roomEnteredAt)
                          : "-"}
                      </td>
                      <td className="py-3 px-4 font-mono text-stone-300">
                        {u.isCleared
                          ? formatSeconds(u.totalTimeSeconds)
                          : u.startedAt
                          ? formatLiveStayTime(u.startedAt)
                          : "-"}
                      </td>
                      <td className="py-3 px-4 font-mono text-stone-400">
                        {u.unlockedHints?.length || 0}개
                      </td>
                      <td className="py-3 px-4">
                        {u.isCleared ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            완료
                          </span>
                        ) : isOnline ? (
                          <span className="inline-flex items-center gap-1 text-amber-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                            접속중
                          </span>
                        ) : u.startedAt ? (
                          <span className="inline-flex items-center gap-1 text-stone-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-stone-500" />
                            자리비움
                          </span>
                        ) : (
                          <span className="text-stone-500">미접속</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!u.isCleared && u.startedAt && (
                            <button
                              onClick={() => handleAction("pass", u.pin)}
                              className="px-2 py-1 rounded-lg bg-amber-800/80 hover:bg-amber-700 text-stone-100 font-bold text-[11px] flex items-center gap-1 transition"
                              title="해당 참가자를 다음 방으로 강제 이동"
                            >
                              <FastForward className="w-3 h-3" />
                              <span>패스</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleAction("reset", u.pin)}
                            className="px-2 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-[11px] transition"
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
  );
}
