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
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const currentTextRef = useRef(text);

  useEffect(() => {
    currentTextRef.current = text;
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
        onCompleteRef.current();
      }
    }, speed);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [text, speed]);

  const handleSkip = () => {
    if (isFinished) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setDisplayedText(text);
    setIsFinished(true);
    onCompleteRef.current();
  };

  const lines = displayedText.split("\n");

  return (
    <div
      onClick={handleSkip}
      className={`cursor-pointer transition-all select-none relative text-center ${className}`}
      title="터치하여 대사 즉시 완료"
    >
      <div className="leading-relaxed text-center tracking-wide drop-shadow-sm space-y-1">
        {lines.map((line, idx) => {
          const isTargetSubtle =
            line.includes("내 이름") || line.includes("눈치챘지");
          return (
            <p
              key={idx}
              className={`${
                isTargetSubtle
                  ? "text-stone-400 text-sm sm:text-base font-medium opacity-70 pt-2"
                  : "text-stone-100 text-lg sm:text-xl font-bold"
              }`}
            >
              {line}
              {idx === lines.length - 1 && !isFinished && (
                <span className="inline-block w-2.5 h-4 ml-1 bg-amber-400 animate-pulse align-middle" />
              )}
            </p>
          );
        })}
      </div>
      {!isFinished && (
        <span className="text-xs text-amber-300/80 block mt-3 font-mono text-center">
          (화면을 터치하면 대사를 바로 건너뜁니다)
        </span>
      )}
    </div>
  );
}
