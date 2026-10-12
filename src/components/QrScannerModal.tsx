"use client";

import React, { useState, useEffect, useRef } from "react";
import { Camera, X, KeyRound, AlertTriangle } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPin: (pin: string, nickname?: string) => void;
}

export default function QrScannerModal({
  isOpen,
  onClose,
  onSelectPin,
}: QrScannerModalProps) {
  const [mode, setMode] = useState<"camera" | "manual">("camera");
  const [manualPin, setManualPin] = useState("");
  const [manualNickname, setManualNickname] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    if (mode === "camera") {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, mode]);

  const parsePinFromRaw = (text: string): string | null => {
    // 1. Direct 4-digit check: "1001" ~ "1100"
    const trimmed = text.trim();
    if (/^\d{4}$/.test(trimmed)) {
      return trimmed;
    }

    // 2. URL search params check: ?pin=1001
    try {
      const url = new URL(trimmed);
      const pinParam = url.searchParams.get("pin");
      if (pinParam && /^\d{4}$/.test(pinParam)) {
        return pinParam;
      }
    } catch {
      // not a standard URL, continue regex
    }

    // 3. Regex match for 4 digits (e.g. DETECTIVE:1001 or PIN-1005)
    const match = trimmed.match(/\b(10\d\d|1100|\d{4})\b/);
    if (match) {
      return match[1];
    }

    return null;
  };

  const startCamera = async () => {
    setErrorMsg(null);
    try {
      const elementId = "qr-reader-container";
      const html5QrCode = new Html5Qrcode(elementId);
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          const pin = parsePinFromRaw(decodedText);
          if (pin) {
            stopCamera();
            onSelectPin(pin);
          } else {
            setErrorMsg(`인식된 내용: ${decodedText} (올바른 4자리 PIN 코드가 아닙니다)`);
          }
        },
        () => {
          // scanning frame failed (ignore)
        }
      );
      setIsCameraActive(true);
    } catch (err: any) {
      console.warn("Camera start failed:", err);
      setIsCameraActive(false);
      setErrorMsg("카메라 권한을 허용할 수 없습니다. 아래 '직접 입력' 탭을 이용해 주세요.");
      setMode("manual");
    }
  };

  const stopCamera = async () => {
    if (scannerRef.current && isCameraActive) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (e) {
        // ignore stop errors
      }
      scannerRef.current = null;
      setIsCameraActive(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pin = manualPin.trim();
    if (!pin) {
      setErrorMsg("PIN 번호를 입력해주세요.");
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      setErrorMsg("PIN 번호는 4자리 숫자여야 합니다 (예: 1001).");
      return;
    }
    onSelectPin(pin, manualNickname.trim() || undefined);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-sm rounded-2xl bg-[#201a16] border-2 border-amber-600/60 p-6 text-stone-100 shadow-2xl relative flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-800 mb-4">
          <div className="flex items-center gap-2 text-amber-400">
            <Camera className="w-5 h-5" />
            <h3 className="font-bold text-base">탐정 인증 & 입장</h3>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switch Tabs */}
        <div className="flex rounded-xl bg-stone-900 p-1 mb-4 border border-stone-800">
          <button
            onClick={() => setMode("camera")}
            className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition ${
              mode === "camera"
                ? "bg-amber-600 text-stone-950 shadow"
                : "text-stone-400 hover:text-stone-200"
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            QR 스캔
          </button>
          <button
            onClick={() => setMode("manual")}
            className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition ${
              mode === "manual"
                ? "bg-amber-600 text-stone-950 shadow"
                : "text-stone-400 hover:text-stone-200"
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            직접 입력
          </button>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/70 border border-red-800 text-red-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <p>{errorMsg}</p>
          </div>
        )}

        {/* Camera Scanner View */}
        {mode === "camera" ? (
          <div className="flex flex-col items-center">
            <div
              id="qr-reader-container"
              className="w-full h-64 bg-black rounded-xl overflow-hidden border border-stone-800 relative flex items-center justify-center"
            >
              {!isCameraActive && (
                <div className="text-center p-4 text-xs text-stone-400">
                  <Camera className="w-8 h-8 mx-auto mb-2 text-amber-500 animate-pulse" />
                  카메라 권한을 불러오는 중입니다...
                  <br />
                  (권한 요청 창이 뜨면 허용을 눌러주세요)
                </div>
              )}
            </div>
            <p className="text-[11px] text-stone-400 text-center mt-3 leading-relaxed">
              사전에 부여받은 방탈출 QR 코드를 화면 안에 맞춰주세요.
              <br />
              카메라 사용이 어려우시면 상단의 <strong>[직접 입력]</strong> 탭을 이용하세요.
            </p>
          </div>
        ) : (
          /* Manual Input Form */
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-amber-400 mb-1">
                PIN 번호 (4자리)
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={manualPin}
                onChange={(e) => setManualPin(e.target.value)}
                placeholder="예: 1001"
                className="w-full px-4 py-3 rounded-xl bg-stone-900 border border-stone-700 text-stone-100 font-mono text-center text-lg tracking-widest focus:outline-none focus:border-amber-500"
                autoFocus
              />
              <span className="text-[10px] text-stone-400 mt-1 block">
                배정받은 1001 ~ 1100 사이의 번호를 입력하세요.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-300 mb-1">
                탐정 닉네임 (선택)
              </label>
              <input
                type="text"
                value={manualNickname}
                onChange={(e) => setManualNickname(e.target.value)}
                placeholder="미입력 시 기본 번호로 설정"
                className="w-full px-4 py-2.5 rounded-xl bg-stone-900 border border-stone-700 text-stone-100 text-sm focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold transition shadow-lg mt-2"
            >
              수사 현장 입장하기
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
