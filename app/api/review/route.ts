import { callAIStream } from "@/lib/providers";

export const runtime = "nodejs";
export const maxDuration = 120;

// Body: { papers: FullSummary[], provider: string }
export async function POST(req: Request) {
  try {
    const { papers, provider } = await req.json();
    if (!papers?.length || papers.length < 1) {
      return new Response(JSON.stringify({ error: "Select at least 1 paper." }), { status: 400 });
    }

    const paperList = papers
      .map((p: Record<string, unknown>, i: number) => {
        const lines = [
          `Paper ${i + 1}: ${p.title}`,
          p.authors !== "Not stated" ? `Authors: ${p.authors}` : null,
          p.year !== "Not stated" ? `Year: ${p.year}` : null,
          p.journal !== "Not stated" ? `Journal/Conference: ${p.journal}` : null,
          `Problem: ${p.problem}`,
          `Method: ${p.method}`,
          `Dataset: ${p.dataset}`,
          `Results: ${p.results}`,
          `Limitations: ${p.limitations}`,
          `Keywords: ${Array.isArray(p.keywords) ? (p.keywords as string[]).join(", ") : p.keywords}`,
        ].filter(Boolean);
        return lines.join("\n");
      })
      .join("\n\n");

    const prompt = `You are an academic writing assistant. Based on the following ${papers.length} research paper(s), write a comprehensive literature review section.

${paperList}

Write a coherent, well-structured literature review (600-900 words) that:
1. Opens with a brief introduction to the research area
2. Synthesizes key themes and methodologies across the papers
3. Compares and contrasts findings, noting agreements and contradictions
4. Identifies research gaps or future directions
5. Uses academic writing style with proper attribution (refer to papers by title or as "Paper 1", "Paper 2", etc.)
6. Ends with a summary paragraph

Format with markdown headings (##) for major sections.`;

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
