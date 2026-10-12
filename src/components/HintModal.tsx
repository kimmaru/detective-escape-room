"use client";

import React from "react";
import { Lightbulb, X, AlertCircle, Clock } from "lucide-react";

interface HintModalProps {
  isOpen: boolean;
  isConfirmStep: boolean;
  onClose: () => void;
  onConfirm: () => void;
  unlockedHints: { index: number; text: string }[];
  currentHintIndex: number;
  totalHints: number;
  nextCooldownRemaining: number;
  isLoading: boolean;
}

export default function HintModal({
  isOpen,
  isConfirmStep,
  onClose,
  onConfirm,
  unlockedHints,
  currentHintIndex,
  totalHints,
  nextCooldownRemaining,
  isLoading,
}: HintModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      {/* Confirmation Step */}
      {isConfirmStep ? (
        <div className="w-full max-w-sm rounded-2xl bg-[#26201c] border-2 border-amber-600/60 p-6 text-stone-100 shadow-2xl relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-stone-400 hover:text-stone-200 p-1"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-4 text-amber-400">
            <Lightbulb className="w-6 h-6 animate-pulse" />
            <h3 className="text-lg font-bold">힌트 확인</h3>
          </div>

          <p className="text-sm text-stone-300 leading-relaxed mb-6">
            힌트를 확인하시겠습니까?
            <br />
            <span className="text-xs text-amber-300/80">
              (현재 단계: {unlockedHints.length + 1}번째 / 총 {totalHints}단계)
            </span>
          </p>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-stone-800 text-stone-300 font-medium hover:bg-stone-700 transition"
            >
              취소
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className="flex-1 py-3 rounded-xl bg-amber-600 text-stone-900 font-bold hover:bg-amber-500 transition shadow-lg disabled:opacity-50"
            >
              {isLoading ? "확인 중..." : "확인"}
            </button>
          </div>
        </div>
      ) : (
        /* Translucent Gray Hint Window */
        <div className="w-full max-w-sm rounded-2xl bg-stone-900/90 border border-stone-700 p-6 text-stone-100 shadow-2xl relative backdrop-blur-md max-h-[85vh] flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-stone-800 mb-4">
            <div className="flex items-center gap-2 text-amber-400">
              <Lightbulb className="w-5 h-5" />
              <h3 className="font-bold text-base">탐정의 단서 메모</h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 space-y-4 pr-1">
            {unlockedHints.map((hint, i) => (
              <div
                key={i}
                className="p-4 rounded-xl bg-stone-800/80 border border-amber-600/30 text-stone-200 text-sm leading-relaxed"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-amber-400 px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/50">
                    단서 #{hint.index + 1}
                  </span>
                </div>
                <p className="whitespace-pre-line text-stone-100 font-sans">
                  {hint.text}
                </p>
              </div>
            ))}
          </div>

          {/* Next hint cooldown alert if more hints exist */}
          {unlockedHints.length < totalHints && (
            <div className="mt-4 pt-3 border-t border-stone-800 flex items-center justify-between text-xs text-stone-400">
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-400" />
                다음 힌트 활성화:
              </span>
              <span className="font-mono text-amber-300 font-bold">
                {nextCooldownRemaining > 0
                  ? `${nextCooldownRemaining}초 후`
                  : "지금 확인 가능"}
              </span>
            </div>
          )}

          <button
            onClick={onClose}
            className="mt-5 w-full py-3 rounded-xl bg-amber-700/80 hover:bg-amber-600 text-stone-100 font-bold transition shadow"
          >
            단서 닫기
          </button>
        </div>
      )}
    </div>
  );
}
