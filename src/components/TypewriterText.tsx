"use client";

import React, { useState, useEffect, useRef } from "react";

interface TypewriterTextProps {
  text: string;
  speed?: number; // ms per char
  onComplete: () => void;
  className?: string;
}

export default function TypewriterText({
  text,
  speed = 35,
  onComplete,
  className = "",
}: TypewriterTextProps) {
  const [displayedText, setDisplayedText] = useState("");
  const [isFinished, setIsFinished] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setDisplayedText("");
    setIsFinished(false);
    let currentIndex = 0;

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      currentIndex++;
      if (currentIndex <= text.length) {
        setDisplayedText(text.slice(0, currentIndex));
      } else {
        if (timerRef.current) clearInterval(timerRef.current);
        setIsFinished(true);
        onComplete();
      }
    }, speed);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [text, speed, onComplete]);

  const handleSkip = () => {
    if (isFinished) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setDisplayedText(text);
    setIsFinished(true);
    onComplete();
  };

  return (
    <div
      onClick={handleSkip}
      className={`cursor-pointer transition-all select-none relative ${className}`}
      title="터치하여 전체 보기"
    >
      <p className="whitespace-pre-line leading-relaxed font-medium">
        {displayedText}
        {!isFinished && (
          <span className="inline-block w-2 h-4 ml-1 bg-amber-400 animate-pulse align-middle" />
        )}
      </p>
      {!isFinished && (
        <span className="text-[10px] text-amber-300/70 block mt-2 font-mono text-right">
          (화면을 탭하면 대사 스킵)
        </span>
      )}
    </div>
  );
}
