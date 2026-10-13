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

  return (
    <div
      onClick={handleSkip}
      className={`cursor-pointer transition-all select-none relative ${className}`}
      title="터치하여 대사 즉시 완료"
    >
      {/* 50% larger font size (text-xl instead of text-sm) */}
      <p className="whitespace-pre-line leading-relaxed font-bold text-lg sm:text-xl text-stone-100 tracking-wide drop-shadow-sm">
        {displayedText}
        {!isFinished && (
          <span className="inline-block w-2.5 h-5 ml-1.5 bg-amber-400 animate-pulse align-middle" />
        )}
      </p>
      {!isFinished && (
        <span className="text-xs text-amber-300/80 block mt-3 font-mono text-right">
          (화면을 터치하면 대사를 바로 건너뜁니다)
        </span>
      )}
    </div>
  );
}
