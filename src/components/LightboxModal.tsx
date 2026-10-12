"use client";

import React from "react";
import { X, ZoomIn } from "lucide-react";

interface LightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  title: string;
}

export default function LightboxModal({
  isOpen,
  onClose,
  imageSrc,
  title,
}: LightboxModalProps) {
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center p-2 bg-black/90 backdrop-blur-md animate-fadeIn"
    >
      <div className="w-full max-w-md flex justify-between items-center text-white p-3">
        <span className="text-xs text-stone-300 font-mono">단서 확대경 ({title})</span>
        <button
          onClick={onClose}
          className="p-1 rounded-full bg-stone-800 text-stone-300 hover:text-white"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[85vh] w-full max-w-md flex items-center justify-center overflow-auto rounded-lg"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc}
          alt={title}
          className="max-h-[80vh] w-auto object-contain rounded-lg shadow-2xl border border-stone-700"
        />
      </div>

      <p className="text-[11px] text-stone-400 mt-2">화면의 바깥을 탭하면 닫힙니다.</p>
    </div>
  );
}
