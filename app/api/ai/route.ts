import { NextResponse } from "next/server";
import { callAI, callAIStream, PROVIDERS, ProviderId } from "@/lib/providers";

export const runtime = "nodejs";
export const maxDuration = 60;

const SUMMARY_PROMPT = `You are a research assistant. Read this paper and reply with ONLY valid JSON, no markdown fences, with exactly these keys:
{"title": string, "authors": string, "year": string, "journal": string, "doi": string, "problem": string, "method": string, "dataset": string, "results": string, "limitations": string, "keywords": string[]}
- authors: list the paper authors as they appear (e.g. "Smith, J., Lee, K."), use "Not stated" if absent
- year: publication year as a 4-digit string, use "Not stated" if absent
- journal: journal or conference name, use "Not stated" if absent  
- doi: DOI if present (e.g. "10.1234/abc"), use "Not stated" if absent
- All other fields: be concise (1-3 sentences). Use "Not stated" when the paper does not say.`;

function parseJson(text: string) {
  if (!text || !text.trim()) {
    throw new Error("AI returned empty content. Please try again or switch model.");
  }
  let clean = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const firstBrace = clean.indexOf("{");
  const lastBrace = clean.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    clean = clean.slice(firstBrace, lastBrace + 1);
  }
  try {
    return JSON.parse(clean);
  } catch {
    throw new Error(`Could not parse JSON from model output: ${clean.slice(0, 200)}...`);
  }
}

const pdfCache = new Map<string, { base64: string; lastAccess: number }>();

function getCachedPdf(id: string): string | undefined {
  const entry = pdfCache.get(id);
  if (!entry) return undefined;
  entry.lastAccess = Date.now();
  return entry.base64;
}

function cachePdf(id: string, base64: string) {
  if (pdfCache.size >= 20) {
    const oldestKey = Array.from(pdfCache.entries()).sort(
      (a, b) => a[1].lastAccess - b[1].lastAccess
    )[0]?.[0];
    if (oldestKey) pdfCache.delete(oldestKey);
  }
  pdfCache.set(id, { base64, lastAccess: Date.now() });
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const fileIdInput = form.get("fileId");
    const provider = String(form.get("provider")) as ProviderId;
    const mode = String(form.get("mode") || "summary");
    const question = String(form.get("question") || "");

    if (!PROVIDERS.some((p) => p.id === provider)) {
      return NextResponse.json({ error: "Pick an AI model." }, { status: 400 });
    }

    let pdfBase64 = "";
    let fileId = typeof fileIdInput === "string" ? fileIdInput : "";

    if (fileId && getCachedPdf(fileId)) {
      pdfBase64 = getCachedPdf(fileId)!;
    } else if (file instanceof File) {
      if (file.size > 4 * 1024 * 1024) {
        return NextResponse.json({ error: "PDF is over 4 MB. Use a smaller file." }, { status: 413 });
      }
      pdfBase64 = Buffer.from(await file.arrayBuffer()).toString("base64");
      fileId = `${file.name}_${file.size}_${file.lastModified}`;
      cachePdf(fileId, pdfBase64);
    } else {
      return NextResponse.json({ error: "Upload a PDF first." }, { status: 400 });
    }

    if (mode === "ask") {
      if (!question.trim()) {
        return NextResponse.json({ error: "Type a question." }, { status: 400 });
      }

      const stream = await callAIStream({
        provider,
        pdfBase64,
        prompt: `Answer the question using only this paper. Mention page numbers when you can. If the paper does not say, say so.\n\nQuestion: ${question}`,
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache",
          "X-File-Id": fileId,
        },
      });
    }

    const text = await callAI({ provider, pdfBase64, prompt: SUMMARY_PROMPT, json: true });
    return NextResponse.json({ summary: parseJson(text), fileId });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Something went wrong." },
      { status: 500 }
    );
  }
}
