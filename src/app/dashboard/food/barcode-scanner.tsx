"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import type { IScannerControls } from "@zxing/browser";

// getUserMedia rejects with a DOMException whose .name identifies the exact
// failure — surfacing that (instead of one generic message) is the
// difference between a user knowing to re-enable a blocked permission vs.
// just seeing "camera doesn't work" with no path forward. Names per the
// Media Capture spec: https://w3c.github.io/mediacapture-main/#navigatormediadevices-getusermedia
function cameraErrorMessage(err: unknown): string {
  const name = err instanceof Error ? err.name : "";
  switch (name) {
    case "NotAllowedError":
      return "ไม่ได้รับอนุญาตให้ใช้กล้อง — เข้าไปเปิดสิทธิ์กล้องให้เว็บนี้ในตั้งค่าเบราว์เซอร์ (ไอคอนกุญแจ/ล็อกข้าง URL) แล้วลองใหม่";
    case "NotFoundError":
    case "OverconstrainedError":
      return "ไม่พบกล้องที่ใช้ได้บนอุปกรณ์นี้";
    case "NotReadableError":
      return "เปิดกล้องไม่ได้ — อาจมีแอปอื่นกำลังใช้กล้องอยู่ ลองปิดแอปนั้นแล้วลองใหม่";
    default:
      if (typeof navigator !== "undefined" && !navigator.mediaDevices) {
        return "เบราว์เซอร์นี้ไม่รองรับการใช้กล้องผ่านเว็บ หรือหน้านี้ไม่ได้เข้าผ่าน HTTPS";
      }
      return "เปิดกล้องไม่ได้ — พิมพ์เลขบาร์โค้ดเองด้านล่างแทนได้";
  }
}

// Continuously scans the device camera for a barcode using zxing (pure JS
// decoding from canvas frames — works across browsers, not just the ones
// that support the native BarcodeDetector API). Calls onDetect once with
// the first barcode found, then stops itself. A manual barcode-number entry
// is always offered alongside the camera view — real devices vary widely
// in camera-permission behavior, and this keeps the feature usable even
// when the camera itself won't cooperate.
export function BarcodeScanner({ onDetect, onClose }: { onDetect: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");

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
        setError(cameraErrorMessage(err));
      });

    return () => {
      cancelled = true;
      controls?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submitManualCode() {
    const digits = manualCode.replace(/[^0-9]/g, "");
    if (digits) onDetect(digits);
  }

  return (
    <div className="rounded-xl border border-neutral-800/80 bg-neutral-900/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-neutral-300">สแกนบาร์โค้ด</h3>
        <button onClick={onClose} className="text-xs text-neutral-500 hover:text-neutral-300">
          ปิด
        </button>
      </div>
      {error ? (
        <p className="py-4 text-center text-sm text-red-400">{error}</p>
      ) : (
        <>
          <video ref={videoRef} className="aspect-video w-full rounded-lg bg-black object-cover" muted playsInline />
          <p className="mt-2 text-center text-xs text-neutral-600">เล็งกล้องไปที่บาร์โค้ดบนบรรจุภัณฑ์</p>
        </>
      )}

      <div className="mt-3 flex gap-2 border-t border-neutral-800 pt-3">
        <input
          type="text"
          inputMode="numeric"
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitManualCode()}
          placeholder="หรือพิมพ์เลขบาร์โค้ดเอง"
          className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200 outline-none placeholder:text-neutral-600 focus:ring-1 focus:ring-neutral-600"
        />
        <button
          onClick={submitManualCode}
          disabled={!manualCode.replace(/[^0-9]/g, "")}
          className="flex-none rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 transition hover:border-neutral-600 disabled:opacity-50"
        >
          ค้นหา
        </button>
      </div>
    </div>
  );
}
