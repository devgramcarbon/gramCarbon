// Import the inner implementation directly — pdf-parse's index.js has a debug-mode
// check (`!module.parent`) that misfires under Next.js's bundler and crashes on load.
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import logger from './logger';

export interface ExtractedPoFields {
  poNumber?: string;
  client?: string;
  date?: string;
  qty?: number;
  rate?: number;
  amount?: number;
}

function firstMatch(text: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return undefined;
}

function parseNumber(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const cleaned = raw.replace(/,/g, '');
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : undefined;
}

/** Best-effort field extraction from a PO PDF's text layer. Only text-based PDFs are supported — scanned/image PDFs will yield empty results. */
export async function extractPoFields(buffer: Buffer): Promise<ExtractedPoFields> {
  let text = '';
  try {
    const parsed = await pdfParse(buffer);
    text = parsed.text || '';
  } catch (err) {
    logger.error('Failed to parse PDF for PO extraction', { error: err instanceof Error ? err.message : String(err) });
    return {};
  }

  const poNumber = firstMatch(text, [
    /Voucher\s*No\.?\s*:?\s*([A-Za-z0-9\-\/]+)/i,
    /Purchase Order\s*No\.?\s*:?\s*([A-Za-z0-9\-\/]+)/i,
    /P\.?O\.?\s*No\.?\s*:?\s*([A-Za-z0-9\-\/]+)/i,
    /Reference No\.?\s*&?\s*Date\.?\s*:?\s*([A-Za-z0-9\-\/]+)/i,
  ]);

  const client = firstMatch(text, [
    /Supplier\s*\(Bill from\)\s*:?\s*\n?\s*([^\n,]+)/i,
    /Supplier\s*:?\s*\n?\s*([^\n,]+)/i,
    /Invoice To\s*:?\s*\n?\s*([^\n,]+)/i,
  ]);

  const date = firstMatch(text, [
    /Dated\s*:?\s*(\d{1,2}[-\/][A-Za-z]{3}[-\/]\d{2,4})/i,
    /Date\s*:?\s*(\d{1,2}[-\/][A-Za-z]{3}[-\/]\d{2,4})/i,
    /Dated\s*:?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
  ]);

  // Strict Indian/plain decimal number — requires a decimal point so it can't glom
  // together adjacent table cells the way a loose [\d,]+ run would. The leading
  // negative lookbehind rejects a match that starts mid-digit-run (pdf-parse
  // sometimes drops the space between adjacent table cells, e.g. a date's
  // trailing "26" fusing directly onto the next cell's quantity digits) — in
  // that case there's no way to recover the true number, so we skip it rather
  // than return a garbled value.
  const DECIMAL = '(?<![\\d,.])\\d{1,3}(?:,\\d{2,3})*\\.\\d+';

  // Both the quantity cell ("11,000.0000 KGS") and the per-unit rate cell
  // ("15.50 KGS") are immediately followed by the literal unit "KGS" in this
  // layout — but their reading order in the extracted text isn't reliable
  // (the Total row repeats the quantity, and cell fusion can corrupt one
  // occurrence while leaving another intact). Instead of trusting position,
  // pick by magnitude: for bulk feed orders the total quantity (thousands of
  // KG) is always far larger than the per-kg rate (tens of rupees).
  const kgsNumbers: number[] = [];
  const kgsRegex = new RegExp(`(${DECIMAL})\\s*KGS`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = kgsRegex.exec(text))) {
    const n = parseNumber(m[1]);
    if (n !== undefined) kgsNumbers.push(n);
  }
  const uniqueKgs = [...new Set(kgsNumbers)].sort((a, b) => b - a);
  const qty = uniqueKgs[0];
  const rate = uniqueKgs.length > 1 ? uniqueKgs[uniqueKgs.length - 1] : undefined;

  const amountRaw = firstMatch(text, [
    new RegExp(`(?:₹|Rs\\.?|INR)\\s*(${DECIMAL})`, 'i'),
  ]);

  return {
    poNumber,
    client,
    date,
    qty,
    rate,
    amount: parseNumber(amountRaw),
  };
}
