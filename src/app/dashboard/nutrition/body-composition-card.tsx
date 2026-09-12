"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { parseBodyCompositionText } from "@/lib/body-composition-import-parse";

export interface BodyCompositionEntry {
  id: string;
  loggedAtMs: number;
  weightKg: number;
  bodyFatPercent: number | null;
  skeletalMuscleMassKg: number | null;
  visceralFatLevel: number | null;
  inbodyReportedBmr: number | null;
}

const INPUT_CLASS =
  "w-full rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-sm text-neutral-200 outline-none placeholder:text-neutral-600 focus:ring-1 focus:ring-neutral-600";

// A ready-made prompt for pasting an InBody photo into an external AI chat
// (Claude, ChatGPT — the same "attach a photo, ask it a question" people
// already do) — same zero-API-cost pattern as food's "นำเข้าจาก AI"
// (src/app/dashboard/food/import-meal-panel.tsx): MooPaTa never calls a
// vision/OCR API itself, it just tells the user how to ask one they
// already have access to, then parses the plain-text answer back
// (src/lib/body-composition-import-parse.ts). Asking for exactly 5 fixed
// "label: value" lines — rather than a table like the food prompt — is
// simpler here because one InBody scan always has the same handful of
// fields, no variable-length row list to align columns for.
const AI_PROMPT_TEMPLATE = `อ่านค่าจากรูปผลตรวจ InBody ที่แนบมาให้หน่อย แล้วตอบกลับมาแค่ 5 บรรทัดนี้เป๊ะๆ ไม่ต้องมีคำอธิบายอื่นแทรก (ถ้าค่าไหนไม่มีในรูปให้ใส่ "-" แทนตัวเลข):
น้ำหนัก: [ค่า]
% ไขมัน: [ค่า]
มวลกล้ามเนื้อโครงร่าง: [ค่า]
ไขมันในช่องท้อง: [ค่า]
BMR: [ค่า]

ตัวอย่าง:
น้ำหนัก: 70.1
% ไขมัน: 19.3
มวลกล้ามเนื้อโครงร่าง: 32.1
ไขมันในช่องท้อง: 5
BMR: 1592`;

// Body-composition scans (InBody or similar) are periodic, not everyday —
// unlike the water card (see WaterLogCard), a growing list of past entries
// here isn't clutter, since there's realistically only a handful a year.
// Lets someone paste in whatever their InBody printout/app export shows
// (only weight is required, since not every scan reports every field), and
// once a scan has a body-fat%, src/lib/nutrition.ts automatically switches
// from the plain weight-based BMR formula to Katch-McArdle for every
// target shown across the app.
export function BodyCompositionCard({ entries }: { entries: BodyCompositionEntry[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(entries.length === 0);
  const [weightKg, setWeightKg] = useState("");
  const [bodyFatPercent, setBodyFatPercent] = useState("");
  const [skeletalMuscleMassKg, setSkeletalMuscleMassKg] = useState("");
  const [visceralFatLevel, setVisceralFatLevel] = useState("");
  const [inbodyReportedBmr, setInbodyReportedBmr] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<"manual" | "import">("manual");
  const [pasteText, setPasteText] = useState("");
  const [copied, setCopied] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(AI_PROMPT_TEMPLATE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setImportNotice("คัดลอกไม่สำเร็จ ลองกดค้างที่ข้อความด้านล่างเพื่อคัดลอกเองแทน");
    }
  }

  function applyParsedText() {
    const parsed = parseBodyCompositionText(pasteText);
    if (parsed.weightKg !== null) setWeightKg(String(parsed.weightKg));
    if (parsed.bodyFatPercent !== null) setBodyFatPercent(String(parsed.bodyFatPercent));
    if (parsed.skeletalMuscleMassKg !== null) setSkeletalMuscleMassKg(String(parsed.skeletalMuscleMassKg));
    if (parsed.visceralFatLevel !== null) setVisceralFatLevel(String(parsed.visceralFatLevel));
    if (parsed.inbodyReportedBmr !== null) setInbodyReportedBmr(String(parsed.inbodyReportedBmr));

    const missing = [
      parsed.weightKg === null && "น้ำหนัก",
      parsed.bodyFatPercent === null && "% ไขมัน",
      parsed.skeletalMuscleMassKg === null && "มวลกล้ามเนื้อ",
      parsed.visceralFatLevel === null && "ไขมันช่องท้อง",
      parsed.inbodyReportedBmr === null && "BMR",
    ].filter(Boolean) as string[];

    if (parsed.weightKg === null) {
      setImportNotice('อ่านค่าไม่ได้เลย ลองวางข้อความใหม่ หรือดูว่าตรงกับตัวอย่างมั้ย');
      return;
    }
    setImportNotice(missing.length > 0 ? `อ่านไม่ได้: ${missing.join(", ")} — กรอกเองเพิ่มด้านล่างได้` : null);
    setMode("manual");
  }

  const latest = entries[0] as BodyCompositionEntry | undefined;
  const recent = entries.slice(0, 6);

  async function save() {
    const w = Number(weightKg);
    if (!Number.isFinite(w) || w <= 0) {
      setError("กรอกน้ำหนักให้ถูกต้องก่อน");
      return;
    }
    setError(null);
    setSaving(true);
    const res = await fetch("/api/body-composition/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        weightKg: w,
        bodyFatPercent: bodyFatPercent || undefined,
        skeletalMuscleMassKg: skeletalMuscleMassKg || undefined,
        visceralFatLevel: visceralFatLevel || undefined,
        inbodyReportedBmr: inbodyReportedBmr || undefined,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setWeightKg("");
      setBodyFatPercent("");
      setSkeletalMuscleMassKg("");
      setVisceralFatLevel("");
      setInbodyReportedBmr("");
      setPasteText("");
      setImportNotice(null);
      setMode("manual");
      setShowForm(false);
      router.refresh();
    } else {
      setError("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
  }

  async function deleteEntry(id: string) {
    const res = await fetch(`/api/body-composition/log/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  return (
    <div className="mb-6 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-violet-500/10 text-violet-400">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
              <path
                d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9c0-3.9 3.1-7 7-7s7 3.1 7 7"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M9 12h6M12 9v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
          <h2 className="font-medium">องค์ประกอบร่างกาย (InBody)</h2>
        </div>
        {entries.length > 0 && (
          <button onClick={() => setShowForm((v) => !v)} className="text-xs text-neutral-500 hover:text-neutral-300">
            {showForm ? "ปิด" : "+ เพิ่มผลตรวจ"}
          </button>
        )}
      </div>

      {latest ? (
        <div className="mb-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <p className="font-semibold text-neutral-200">{latest.weightKg.toFixed(1)} กก.</p>
            <p className="text-xs text-neutral-500">น้ำหนัก</p>
          </div>
          <div>
            <p className="font-semibold text-neutral-200">{latest.bodyFatPercent !== null ? `${latest.bodyFatPercent.toFixed(1)}%` : "-"}</p>
            <p className="text-xs text-neutral-500">% ไขมัน</p>
          </div>
          <div>
            <p className="font-semibold text-neutral-200">
              {latest.skeletalMuscleMassKg !== null ? `${latest.skeletalMuscleMassKg.toFixed(1)} กก.` : "-"}
            </p>
            <p className="text-xs text-neutral-500">มวลกล้ามเนื้อ</p>
          </div>
          <div>
            <p className="font-semibold text-neutral-200">{latest.visceralFatLevel !== null ? latest.visceralFatLevel : "-"}</p>
            <p className="text-xs text-neutral-500">ไขมันช่องท้อง</p>
          </div>
        </div>
      ) : (
        <p className="mb-4 text-xs text-neutral-600">
          ยังไม่มีข้อมูล — ถ้าไม่เคยตรวจ InBody ข้ามส่วนนี้ไปได้เลย แอพจะคำนวณ BMR จากสูตรมาตรฐาน (น้ำหนัก/ส่วนสูง/อายุ) แทน
        </p>
      )}

      {latest?.bodyFatPercent !== null && latest !== undefined && (
        <p className="mb-4 rounded-lg bg-violet-500/10 px-3 py-2 text-xs text-violet-400">
          ✓ ใช้ผลตรวจล่าสุดคำนวณ BMR แบบ Katch-McArdle (อิงมวลกล้ามเนื้อจริง) และโปรตีนจากมวลไร้ไขมันแทนสูตรมาตรฐานแล้ว — แม่นยำกว่าเดิม{" "}
          <Link href="/dashboard/knowledge" className="underline hover:text-violet-300">
            ดูวิธีคำนวณ
          </Link>
        </p>
      )}

      {showForm && (
        <div className="mb-2 space-y-2 rounded-xl border border-neutral-800 bg-neutral-900/60 p-3">
          <div className="flex gap-1.5 text-xs">
            <button
              onClick={() => setMode("manual")}
              className={`rounded-md px-2.5 py-1 font-medium transition ${
                mode === "manual" ? "bg-violet-600 text-white" : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              กรอกเอง
            </button>
            <button
              onClick={() => setMode("import")}
              className={`rounded-md px-2.5 py-1 font-medium transition ${
                mode === "import" ? "bg-violet-600 text-white" : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              นำเข้าจาก AI
            </button>
          </div>

          {mode === "import" ? (
            <div className="space-y-2">
              <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3">
                <p className="text-xs text-neutral-400">
                  1. คัดลอกคำสั่งนี้ไปวางถาม AI (Claude, ChatGPT) แล้วแนบรูปผลตรวจ InBody เข้าไปด้วย
                </p>
                <button
                  type="button"
                  onClick={copyPrompt}
                  className="mt-2 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-300 transition hover:border-neutral-600 hover:bg-neutral-800"
                >
                  {copied ? "คัดลอกแล้ว ✓" : "คัดลอกคำสั่งสำหรับถาม AI"}
                </button>
                <p className="mt-2 text-xs text-neutral-400">2. คัดลอกคำตอบที่ได้มาวางในช่องด้านล่างนี้</p>
              </div>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={`น้ำหนัก: 70.1\n% ไขมัน: 19.3\nมวลกล้ามเนื้อโครงร่าง: 32.1\nไขมันในช่องท้อง: 5\nBMR: 1592`}
                rows={6}
                className={`${INPUT_CLASS} resize-y font-mono text-xs`}
              />
              {importNotice && <p className="text-xs text-amber-400">{importNotice}</p>}
              <button
                onClick={applyParsedText}
                disabled={!pasteText.trim()}
                className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-violet-500 disabled:opacity-50"
              >
                แปลงข้อมูล
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[10px] text-neutral-500">น้ำหนัก (กก.) *</label>
                  <input
                    type="number"
                    min="1"
                    step="0.1"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] text-neutral-500">% ไขมัน (ไม่บังคับ)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={bodyFatPercent}
                    onChange={(e) => setBodyFatPercent(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] text-neutral-500">มวลกล้ามเนื้อโครงร่าง (กก.)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={skeletalMuscleMassKg}
                    onChange={(e) => setSkeletalMuscleMassKg(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] text-neutral-500">ไขมันในช่องท้อง (ระดับ)</label>
                  <input
                    type="number"
                    min="0"
                    value={visceralFatLevel}
                    onChange={(e) => setVisceralFatLevel(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[10px] text-neutral-500">BMR ที่ InBody คำนวณให้ (ถ้ามี — ไว้เทียบเฉยๆ ไม่ได้ใช้คำนวณจริง)</label>
                <input
                  type="number"
                  min="0"
                  value={inbodyReportedBmr}
                  onChange={(e) => setInbodyReportedBmr(e.target.value)}
                  className={`${INPUT_CLASS} w-32`}
                />
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <button
                onClick={save}
                disabled={saving || !weightKg}
                className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-violet-500 disabled:opacity-50"
              >
                {saving ? "กำลังบันทึก..." : "บันทึกผลตรวจ"}
              </button>
            </>
          )}
        </div>
      )}

      {recent.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {recent.map((e) => (
            <button
              key={e.id}
              onClick={() => deleteEntry(e.id)}
              title="กดเพื่อลบ"
              className="flex items-center gap-1 rounded-full border border-neutral-800 bg-neutral-900/60 px-2.5 py-1 text-xs text-neutral-400 transition hover:border-red-800 hover:text-red-300"
            >
              {new Date(e.loggedAtMs).toLocaleDateString("th-TH", { day: "numeric", month: "short" })} · {e.weightKg.toFixed(1)}กก.
              {e.bodyFatPercent !== null && ` · ${e.bodyFatPercent.toFixed(1)}%`}
              <svg viewBox="0 0 20 20" fill="none" className="h-2.5 w-2.5">
                <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
