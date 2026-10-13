"use client";

import React from "react";
import { Lightbulb, X, Clock, Key, CheckCircle } from "lucide-react";

interface HintItem {
  index: number;
  text: string;
}

interface HintModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUnlockNext: () => void;
  unlockedHints: HintItem[];
  totalHints: number;
  nextCooldownRemaining: number;
  isLoading: boolean;
}

export default function HintModal({
  isOpen,
  onClose,
  onUnlockNext,
  unlockedHints,
  totalHints,
  nextCooldownRemaining,
  isLoading,
}: HintModalProps) {
  if (!isOpen) return null;

  const nextStep = unlockedHints.length + 1;
  const isAllUnlocked = unlockedHints.length >= totalHints;
  const isNextAnswer = nextStep === 4;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-sm rounded-2xl bg-stone-900/95 border border-stone-700/80 p-5 text-stone-100 shadow-2xl relative flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-800 mb-4">
          <div className="flex items-center gap-2 text-amber-400">
            <Lightbulb className="w-5 h-5 fill-amber-500/20" />
            <h3 className="font-bold text-base tracking-wide">탐정의 단서 수첩</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable list of already unlocked hints */}
        <div className="overflow-y-auto flex-1 space-y-3.5 pr-1">
          {unlockedHints.length === 0 ? (
            <div className="py-8 text-center text-stone-400 text-sm">
              <Lightbulb className="w-8 h-8 mx-auto mb-2 text-stone-600" />
              아직 확인한 단서가 없습니다.
            </div>
          ) : (
            unlockedHints.map((hint, i) => {
              const isAnswer = hint.index === 3;
              const isFormat = hint.index === 2;

              return (
                <div
                  key={i}
                  className={`p-4 rounded-xl border text-sm leading-relaxed ${
                    isAnswer
                      ? "bg-red-950/40 border-red-700/60 text-red-100"
                      : isFormat
                      ? "bg-amber-950/40 border-amber-600/50 text-amber-100"
                      : "bg-stone-800/80 border-stone-700 text-stone-200"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                        isAnswer
                          ? "bg-red-900 text-red-200 border-red-700"
                          : isFormat
                          ? "bg-amber-900 text-amber-200 border-amber-700"
                          : "bg-stone-700 text-amber-300 border-stone-600"
                      }`}
                    >
                      {isAnswer
                        ? "🔑 최종 정답"
                        : isFormat
                        ? "💡 암호 형식"
                        : `단서 #${hint.index + 1}`}
                    </span>
                  </div>
                  <p className="whitespace-pre-line font-medium text-stone-100 text-[14px]">
                    {hint.text}
                  </p>
                </div>
              );
            })
          )}
        </div>

        {/* Next Hint / Answer Button Area */}
        <div className="mt-4 pt-3 border-t border-stone-800 flex flex-col gap-2.5">
          {!isAllUnlocked ? (
            <div>
              {nextCooldownRemaining > 0 ? (
                <button
                  disabled
                  className="w-full py-3 rounded-xl bg-stone-800/80 border border-stone-700 text-stone-400 font-bold text-xs flex items-center justify-center gap-2 cursor-not-allowed"
                >
                  <Clock className="w-4 h-4 text-amber-400/80" />
                  <span>
                    다음 단서까지: {nextCooldownRemaining}초 남음
                  </span>
                </button>
              ) : (
                <button
                  onClick={onUnlockNext}
                  disabled={isLoading}
                  className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition shadow-lg active:scale-95 ${
                    isNextAnswer
                      ? "bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white animate-pulse"
                      : "bg-amber-600 hover:bg-amber-500 text-stone-950"
                  }`}
                >
                  {isNextAnswer ? (
                    <>
                      <Key className="w-4 h-4 fill-white" />
                      <span>{isLoading ? "확인 중..." : "🔑 정답 확인하기"}</span>
                    </>
                  ) : (
                    <>
                      <Lightbulb className="w-4 h-4 fill-stone-950" />
                      <span>
                        {isLoading
                          ? "불러오는 중..."
                          : nextStep === 3
                          ? "💡 다음 단서 보기 (암호 형식)"
                          : `💡 다음 단서 보기 (단서 #${nextStep})`}
                      </span>
                    </>
                  )}
                </button>
              )}
            </div>
          ) : (
            <div className="text-center py-1 text-xs text-stone-400 flex items-center justify-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>모든 단서와 정답을 확인했습니다.</span>
            </div>
          )}

          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold transition"
          >
            단서 닫기
          </button>
        </div>
      </div>
    </div>
  );
}
