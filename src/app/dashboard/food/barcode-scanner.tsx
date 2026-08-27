"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import type { IScannerControls } from "@zxing/browser";

// Continuously scans the device camera for a barcode using zxing (pure JS
// decoding from canvas frames — works across browsers, not just the ones
// that support the native BarcodeDetector API). Calls onDetect once with
// the first barcode found, then stops itself.
export function BarcodeScanner({ onDetect, onClose }: { onDetect: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let controls: IScannerControls | null = null;
    let cancelled = false;

    reader
      .decodeFromVideoDevice(undefined, videoRef.current ?? undefined, (result, err, ctrl) => {
        controls = ctrl;
        if (cancelled) return;
        if (result) {
          ctrl.stop();
          onDetect(result.getText());
        }
        // NotFoundException fires continuously between frames with no
        // barcode in view — that's the normal "still looking" state, not
        // an error worth surfacing.
        void err;
      })
      .catch((err) => {
        console.error("Camera access failed", err);
        setError("เปิดกล้องไม่ได้ — ตรวจสอบว่าอนุญาตให้เว็บนี้ใช้กล้องแล้ว");
      });

    return () => {
      cancelled = true;
      controls?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="rounded-xl border border-neutral-800/80 bg-neutral-900/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-neutral-300">สแกนบาร์โค้ด</h3>
        <button onClick={onClose} className="text-xs text-neutral-500 hover:text-neutral-300">
          ปิด
        </button>
      </div>
      {error ? (
        <p className="py-6 text-center text-sm text-red-400">{error}</p>
      ) : (
        <video ref={videoRef} className="aspect-video w-full rounded-lg bg-black object-cover" muted playsInline />
      )}
      <p className="mt-2 text-center text-xs text-neutral-600">เล็งกล้องไปที่บาร์โค้ดบนบรรจุภัณฑ์</p>
    </div>
  );
}
