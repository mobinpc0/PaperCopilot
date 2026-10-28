import { NextResponse } from "next/server";
import { callAI, PROVIDERS, ProviderId } from "@/lib/providers";

export const runtime = "nodejs";
export const maxDuration = 120;

const SUMMARY_PROMPT = `You are a research assistant. Read this paper and reply with ONLY valid JSON, no markdown fences, with exactly these keys:
{"title": string, "authors": string, "year": string, "journal": string, "doi": string, "problem": string, "method": string, "dataset": string, "results": string, "limitations": string, "keywords": string[]}
- authors: list the paper authors as they appear (e.g. "Smith, J., Lee, K."), use "Not stated" if absent
- year: publication year as a 4-digit string, use "Not stated" if absent
- journal: journal or conference name, use "Not stated" if absent  
- doi: DOI if present (e.g. "10.1234/abc"), use "Not stated" if absent
- All other fields: be concise (1-3 sentences). Use "Not stated" when the paper does not say.`;

function parseJson(text: string) {
  if (!text || !text.trim()) throw new Error("AI returned empty content.");
  let clean = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const first = clean.indexOf("{");
  const last = clean.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) clean = clean.slice(first, last + 1);
  try {
    return JSON.parse(clean);
  } catch {
    throw new Error(`Could not parse JSON: ${clean.slice(0, 200)}`);
  }
}

const pdfCache = new Map<string, { base64: string; lastAccess: number }>();

function getCachedPdf(id: string) {
  const e = pdfCache.get(id);
  if (!e) return undefined;
  e.lastAccess = Date.now();
  return e.base64;
}

function cachePdf(id: string, base64: string) {
  if (pdfCache.size >= 20) {
    const oldest = Array.from(pdfCache.entries()).sort((a, b) => a[1].lastAccess - b[1].lastAccess)[0]?.[0];
    if (oldest) pdfCache.delete(oldest);
  }
  pdfCache.set(id, { base64, lastAccess: Date.now() });
}

async function summarizePdf(
  file: File | null,
  fileId: string,
  provider: ProviderId
): Promise<{ summary: Record<string, unknown>; fileId: string }> {
  let pdfBase64 = "";
  let resolvedId = fileId;

  if (resolvedId && getCachedPdf(resolvedId)) {
    pdfBase64 = getCachedPdf(resolvedId)!;
  } else if (file instanceof File) {
    if (file.size > 4 * 1024 * 1024) throw new Error(`"${file.name}" is over 4 MB. Use a smaller file.`);
    pdfBase64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    resolvedId = `${file.name}_${file.size}_${file.lastModified}`;
    cachePdf(resolvedId, pdfBase64);
  } else {
    throw new Error("A PDF file is required.");
  }

  const text = await callAI({ provider, pdfBase64, prompt: SUMMARY_PROMPT, json: true });
  return { summary: parseJson(text), fileId: resolvedId };
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const provider = String(form.get("provider")) as ProviderId;

    if (!PROVIDERS.some((p) => p.id === provider)) {
      return NextResponse.json({ error: "Pick an AI model." }, { status: 400 });
    }

    const MAX_PAPERS = 10;
    const files: (File | null)[] = [];
    const fileIds: string[] = [];
    for (let i = 0; i < MAX_PAPERS; i++) {
      const f = form.get(`file${i}`);
      files.push(f instanceof File ? f : null);
      fileIds.push(String(form.get(`fileId${i}`) || ""));
    }

    // Filter active slots (has file OR has fileId)
    const activeIndices = Array.from({ length: MAX_PAPERS }, (_, i) => i).filter(
      (i) => files[i] || fileIds[i]
    );
    if (activeIndices.length < 2) {
      return NextResponse.json({ error: "Upload at least 2 papers to compare." }, { status: 400 });
    }

    const results = await Promise.allSettled(
      activeIndices.map((i) => summarizePdf(files[i], fileIds[i], provider))
    );

    const summaries = results.map((r, idx) => {
      const i = activeIndices[idx];
      if (r.status === "fulfilled") return r.value;
      return { summary: null, fileId: fileIds[i], error: r.reason?.message || "Failed" };
    });

    return NextResponse.json({ summaries });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Something went wrong." },
      { status: 500 }
    );
  }
}
