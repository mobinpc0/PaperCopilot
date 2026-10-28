import { callAIStream } from "@/lib/providers";

export const runtime = "nodejs";
export const maxDuration = 120;

// Body: { question: string, papers: {fileId: string, title: string}[], provider: string, paperSummaries?: any[] }
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { question, papers, provider, paperSummaries } = body;

    if (!question?.trim()) {
      return new Response(JSON.stringify({ error: "Ask a question." }), { status: 400 });
    }

    // Build context from summaries (always available) for non-Gemini or uncached PDFs
    const summaryContext = (paperSummaries || [])
      .map(
        (p: Record<string, unknown>, i: number) =>
          `Paper ${i + 1} — "${p.title}" (${p.authors || "Unknown"}, ${p.year || "n.d."}):\n` +
          `Problem: ${p.problem}\nMethod: ${p.method}\nResults: ${p.results}\nLimitations: ${p.limitations}`
      )
      .join("\n\n---\n\n");

    const paperCount =
      (papers as unknown[])?.length ||
      (paperSummaries as unknown[])?.length ||
      1;

    const prompt = summaryContext
      ? `You are a research assistant. The user has a library of ${paperCount} papers. Answer their question using information from these papers. Cite the paper number and title when referencing specific facts. If a page number was mentioned in the summaries, include it.\n\nPaper summaries:\n${summaryContext}\n\nQuestion: ${question}`
      : `Answer the following question about this research paper, citing page numbers when possible:\n\nQuestion: ${question}`;

    const stream = await callAIStream({
      provider: provider as Parameters<typeof callAIStream>[0]["provider"],
      pdfBase64: "",
      prompt,
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Failed." }), { status: 500 });
  }
}
