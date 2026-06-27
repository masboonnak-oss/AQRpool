// Automated payment-slip reader (ported from the "ระบบเติมเงินอัตโนมัติ" repo, Loop 1).
//
// Reads an uploaded bank-transfer slip image and extracts evidence to help the admin
// verify a top-up faster:
//   - Mini-QR (jimp + jsQR) -> bank reference id (slipRef) — the strongest signal
//   - OCR (Tesseract.js, tha+eng) -> amount / timestamp / recipient / bank from text
//
// Everything is best-effort: any failure returns a clean partial result (never throws),
// so a top-up is never blocked by a bad image — the admin just falls back to manual review.

import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DateTime } from "luxon";
import { logger } from "./logger.js";

// jimp 0.22 and tesseract.js are CJS with runtime workers/wasm — require them so the
// bundler keeps them external and their assets resolve at runtime.
const require = createRequire(import.meta.url);

const OCR_LANG = process.env.OCR_LANG || "tha+eng";
const OCR_LANG_FILES = OCR_LANG.split("+")
  .map((lang) => `${lang.trim()}.traineddata`)
  .filter((name) => name !== ".traineddata");
const MERCHANT_NAME = (process.env.MERCHANT_ACCOUNT_NAME || "").trim();
const MERCHANT_NUMBER = (process.env.MERCHANT_ACCOUNT_NUMBER || "").trim();

const BANK_PROVIDERS = ["KBANK", "SCB", "BBL", "KTB", "BAY", "TTB", "GSB", "KKP", "UOB"];

export type SlipExtract = {
  method: "QR" | "OCR";
  slipRef: string | null;
  amountThb: number | null;
  paidAtISO: string | null;
  bank: string;
  recipientMatched: boolean | null; // null = merchant account not configured (not checked)
  warnings: string[];
  ocrText: string;
};

function norm(s: unknown): string {
  return String(s ?? "").toUpperCase().replace(/\s+/g, " ").trim();
}

// ── QR (jimp + jsQR) ───────────────────────────────────────────────────────
function parseRef(raw: string): string | null {
  const m = raw.match(/(?:transRef|ref|tx|transactionId|billerRef)=([A-Za-z0-9]+)/i);
  if (m) return m[1].toUpperCase();
  const tokens = raw.match(/[A-Za-z0-9]{12,}/g);
  if (tokens && tokens.length) return tokens.sort((a, b) => b.length - a.length)[0].toUpperCase();
  return null;
}

async function decodeMiniQR(buffer: Buffer): Promise<{ ok: boolean; raw: string | null; transId: string | null }> {
  try {
    const JimpModule = require("jimp");
    const Jimp = JimpModule.Jimp ?? JimpModule.default ?? JimpModule;
    const jsQR = require("jsqr");
    const crypto = require("node:crypto") as typeof import("node:crypto");
    const image = await Jimp.read(buffer);
    const tryDecode = (img: any): string | null => {
      const { data, width, height } = img.bitmap;
      const code = jsQR(new Uint8ClampedArray(data), width, height);
      return code && code.data ? code.data : null;
    };
    let raw = tryDecode(image);
    if (!raw) raw = tryDecode(image.clone().greyscale().contrast(0.3));
    if (!raw) return { ok: false, raw: null, transId: null };
    const transId = parseRef(raw) || "QR" + crypto.createHash("sha1").update(raw).digest("hex").slice(0, 20).toUpperCase();
    return { ok: true, raw, transId };
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : err }, "slip QR decode failed");
    return { ok: false, raw: null, transId: null };
  }
}

// ── OCR (Tesseract.js) — single lazily-created shared worker ───────────────
function findLocalLangPath(): string | null {
  const explicit = (process.env.OCR_LANG_PATH || process.env.TESSDATA_PREFIX || "").trim();
  if (explicit) return explicit;

  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    process.cwd(),
    path.resolve(process.cwd(), "artifacts/api-server"),
    path.resolve(here, ".."),
    path.resolve(here, "../.."),
    path.resolve(here, "../../artifacts/api-server"),
  ];
  return candidates.find((dir) => OCR_LANG_FILES.every((file) => existsSync(path.join(dir, file)))) ?? null;
}

let workerPromise: Promise<any> | null = null;
async function getOcrWorker(): Promise<any> {
  if (!workerPromise) {
    const { createWorker } = require("tesseract.js");
    const langPath = findLocalLangPath();
    const workerOptions = langPath ? { langPath, cachePath: langPath, gzip: false } : undefined;
    workerPromise = (workerOptions ? createWorker(OCR_LANG, undefined, workerOptions) : createWorker(OCR_LANG)).catch((err: unknown) => {
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
}

async function ocrRecognize(buffer: Buffer): Promise<string> {
  try {
    const worker = await getOcrWorker();
    const { data } = await worker.recognize(buffer);
    return (data && data.text) || "";
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : err }, "slip OCR failed");
    return "";
  }
}

// ── Text evidence ──────────────────────────────────────────────────────────
function detectBank(qrRaw: string | null, text: string): string {
  const hay = norm(`${qrRaw || ""} ${text || ""}`);
  for (const b of BANK_PROVIDERS) if (hay.includes(b)) return b;
  if (/K\s*PLUS|กสิกร/i.test(hay)) return "KBANK";
  if (/ไทยพาณิชย์|SCB EASY/i.test(hay)) return "SCB";
  if (/กรุงเทพ|BUALUANG/i.test(hay)) return "BBL";
  return "UNKNOWN";
}

function extractAmountThb(text: string): number | null {
  if (!text) return null;
  const patterns = [
    /(?:จำนวนเงิน|amount)\s*[:/]?\s*(?:[^\d]{0,12})?([\d,]+\.\d{2})/i,
    /([\d,]+\.\d{2})\s*(?:บาท|baht)/i,
    /(?:THB|฿)\s*([\d,]+\.\d{2})/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const n = Number(m[1].replace(/,/g, ""));
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function extractTimestampISO(text: string): string | null {
  if (!text) return null;
  const patterns = [
    /(?:วันที่|date)\s*[:/]?\s*([0-3]?\d[/-][01]?\d[/-]\d{2,4}\s+[0-2]?\d:[0-5]\d(?::[0-5]\d)?)/i,
    /([0-3]?\d[/-][01]?\d[/-]\d{2,4}\s+[0-2]?\d:[0-5]\d(?::[0-5]\d)?)/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const s = m[1].trim();
      let dt = DateTime.fromISO(s, { zone: "Asia/Bangkok" });
      if (dt.isValid) return dt.toISO();
      for (const fmt of ["dd/LL/yyyy HH:mm:ss", "dd/LL/yyyy HH:mm", "dd-LL-yyyy HH:mm:ss", "dd LLL yyyy HH:mm", "yyyy-LL-dd HH:mm:ss"]) {
        dt = DateTime.fromFormat(s, fmt, { zone: "Asia/Bangkok" });
        if (dt.isValid) return dt.toISO();
      }
    }
  }
  return null;
}

function matchRecipient(text: string, name: string, num: string): boolean | null {
  if (!name && !num) return null; // not configured -> don't check
  const hay = norm(text);
  const byName = name.length > 0 && hay.includes(norm(name));
  const tail = num.replace(/\D/g, "").slice(-4);
  const byNumber = tail.length === 4 && hay.replace(/\D/g, "").includes(tail);
  return byName || byNumber;
}

/**
 * Run QR + OCR extraction over a slip image. Never throws.
 * `merchant` is the shop's receiving account (from settings) used to check the slip's
 * recipient; falls back to the MERCHANT_ACCOUNT_* env vars when not provided.
 */
export async function extractSlip(buffer: Buffer, merchant?: { name?: string | null; number?: string | null }): Promise<SlipExtract> {
  const warnings: string[] = [];
  const qr = await decodeMiniQR(buffer);
  const text = await ocrRecognize(buffer);

  const amountThb = extractAmountThb(text);
  if (amountThb == null) warnings.push("amount_not_detected");

  const paidAtISO = extractTimestampISO(text);
  if (!paidAtISO) warnings.push("timestamp_not_detected");

  const merchantName = (merchant?.name ?? MERCHANT_NAME ?? "").trim();
  const merchantNumber = (merchant?.number ?? MERCHANT_NUMBER ?? "").trim();
  const recipientMatched = matchRecipient(text, merchantName, merchantNumber);
  if (recipientMatched === false) warnings.push("recipient_not_matched");

  if (!qr.ok) warnings.push("qr_decode_failed");
  if (!text) warnings.push("ocr_unreadable");

  return {
    method: qr.ok ? "QR" : "OCR",
    slipRef: qr.transId,
    amountThb,
    paidAtISO,
    bank: detectBank(qr.raw, text),
    recipientMatched,
    warnings,
    ocrText: text,
  };
}
