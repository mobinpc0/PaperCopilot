import zlib from "zlib";

export type ProviderId =
  | "gemini-flash"
  | "gemini-flash-lite"
  | "groq-llama"
  | "openrouter-free"
  | "github-gpt4o-mini";

export const PROVIDERS: { id: ProviderId; label: string; note: string }[] = [
  {
    id: "gemini-flash-lite",
    label: "Gemini 3.5 Flash Lite",
    note: "Google AI Studio key, ultra-fast & high quota availability, native PDF",
  },
  {
    id: "gemini-flash",
    label: "Gemini Flash (3.8 / 2.0)",
    note: "Google AI Studio key, 1M context, native PDF parsing",
  },
  {
    id: "groq-llama",
    label: "Groq (Auto-detected Llama / Qwen)",
    note: "Groq key, ultra-fast 500+ tok/s free tier",
  },
  {
    id: "openrouter-free",
    label: "OpenRouter (Free Catalog)",
    note: "OpenRouter key, auto-routes to active zero-cost models",
  },
  {
    id: "github-gpt4o-mini",
    label: "GitHub Models (GPT-4o mini)",
    note: "GitHub Personal Access Token, free 150 req/day",
  },
];

export type AIRequest = {
  provider: ProviderId;
  pdfBase64: string;          // single PDF (keep for backward compat, use "" if using pdfBase64List)
  pdfBase64List?: string[];   // multiple PDFs (library chat, compare)
  prompt: string;
  json?: boolean;
};

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}. Add it to .env.local and restart the dev server.`);
  return v;
}

// Extract plain text from PDF stream with zero external dependencies
export function extractTextFromPdf(base64: string): string {
  try {
    const buffer = Buffer.from(base64, "base64");
    const content = buffer.toString("binary");
    const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
    let fullText = "";
    let match: RegExpExecArray | null;

    while ((match = streamRegex.exec(content)) !== null) {
      let rawStream = Buffer.from(match[1], "binary");
      try {
        rawStream = zlib.inflateSync(rawStream);
      } catch {
        // Stream not compressed with flate or already uncompressed
      }
      const streamStr = rawStream.toString("utf-8");

      const textMatches = streamStr.match(/\(([^)]*)\)\s*(?:Tj|'|")/g);
      if (textMatches) {
        for (const tm of textMatches) {
          const inner = tm.replace(/^\(/, "").replace(/\)\s*(?:Tj|'|")$/, "");
          fullText += inner + " ";
        }
      }

      const arrayMatches = streamStr.match(/\[(.*?)\]\s*TJ/g);
      if (arrayMatches) {
        for (const am of arrayMatches) {
          const innerStrings = am.match(/\(([^)]*)\)/g);
          if (innerStrings) {
            for (const s of innerStrings) {
              fullText += s.slice(1, -1);
            }
            fullText += " ";
          }
        }
      }
    }

    const cleaned = fullText.replace(/\\([()\\])/g, "$1").replace(/\s+/g, " ").trim();
    return cleaned;
  } catch (err) {
    console.error("PDF text extraction error:", err);
    return "";
  }
}

// -------------------------------------------------------------
// Google Gemini Provider
// -------------------------------------------------------------
function createGeminiPayload(r: AIRequest, model: string, withThinking = true) {
  // Lite models reject thinkingConfig with "Request contains an invalid argument"
  const isLite = model.toLowerCase().includes("lite");

  // Build PDF parts from list (multi-PDF) or single pdfBase64 (backward compat)
  const pdfList = r.pdfBase64List?.length ? r.pdfBase64List : (r.pdfBase64 ? [r.pdfBase64] : []);
  const pdfParts = pdfList.map((pdf) => ({ inlineData: { mimeType: "application/pdf", data: pdf } }));
  const parts = [...pdfParts, { text: r.prompt }];

  return {
    contents: [
      {
        parts,
      },
    ],
    generationConfig: {
      ...(r.json ? { responseMimeType: "application/json" } : {}),
      ...(!isLite && withThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
    },
  };
}

async function callGemini(r: AIRequest, modelOverride?: string): Promise<string> {
  const key = need("GEMINI_API_KEY");
  let model = modelOverride || process.env.GEMINI_MODEL || "gemini-3.8-flash";
  let url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

  let res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(createGeminiPayload(r, model, true)),
  });

  let data = await res.json().catch(() => ({}));

  // Fallback if thinkingConfig is not supported (status 400 or invalid argument)
  if (!res.ok && (res.status === 400 || data?.error?.message?.toLowerCase().includes("invalid argument"))) {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createGeminiPayload(r, model, false)),
    });
    data = await res.json().catch(() => ({}));
  }

  // Fallback if high demand / overloaded: automatically switch to gemini-3.5-flash-lite
  if (!res.ok && (res.status === 503 || data?.error?.message?.toLowerCase().includes("high demand"))) {
    const fallback = process.env.GEMINI_LITE_MODEL || "gemini-3.5-flash-lite";
    if (model !== fallback) {
      model = fallback;
      url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createGeminiPayload(r, model, false)),
      });
      data = await res.json().catch(() => ({}));
    }
  }

  if (!res.ok) throw new Error(data?.error?.message || `Gemini request failed (${res.status})`);
  return (data.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
}

function processSseLine(
  line: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder
) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data: ")) return;

  const jsonStr = trimmed.slice(6).trim();
  if (jsonStr === "[DONE]") return;

  try {
    const data = JSON.parse(jsonStr);
    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p: { text?: string }) => p.text ?? "")
      .join("");
    if (text) {
      controller.enqueue(encoder.encode(text));
    }
  } catch {
    // Incomplete chunk
  }
}

async function callGeminiStream(r: AIRequest, modelOverride?: string): Promise<ReadableStream<Uint8Array>> {
  const key = need("GEMINI_API_KEY");
  let model = modelOverride || process.env.GEMINI_MODEL || "gemini-3.8-flash";
  let url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${key}`;

  let res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(createGeminiPayload(r, model, true)),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    if (errText.toLowerCase().includes("invalid argument") || errText.toLowerCase().includes("thinkingconfig")) {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createGeminiPayload(r, model, false)),
      });
    } else if (errText.toLowerCase().includes("high demand") || res.status === 503) {
      const fallback = process.env.GEMINI_LITE_MODEL || "gemini-3.5-flash-lite";
      if (model !== fallback) {
        url = `https://generativelanguage.googleapis.com/v1beta/models/${fallback}:streamGenerateContent?alt=sse&key=${key}`;
        res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createGeminiPayload(r, fallback, false)),
        });
      }
    } else {
      let msg = `Gemini request failed (${res.status})`;
      try {
        const parsed = JSON.parse(errText);
        if (parsed?.error?.message) msg = parsed.error.message;
      } catch {}
      throw new Error(msg);
    }
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `Gemini request failed (${res.status})`);
  }

  if (!res.body) {
    throw new Error("No response body received from Gemini");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (buffer.trim()) {
            processSseLine(buffer, controller, encoder);
          }
          controller.close();
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          processSseLine(line, controller, encoder);
        }
      }
    },
    cancel() {
      reader.cancel();
    },
  });
}

// -------------------------------------------------------------
// OpenAI-Compatible Providers (Groq, OpenRouter, GitHub Models)
// -------------------------------------------------------------
async function resolveGroqModel(key: string, preferred: string): Promise<string> {
  try {
    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (res.ok) {
      const data = await res.json();
      const ids: string[] = (data.data || []).map((m: { id: string }) => m.id);
      if (ids.includes(preferred)) return preferred;
      const candidates = [
        "llama-3.3-70b-versatile",
        "llama-3.1-8b-instant",
        "llama3-70b-8192",
        "llama3-8b-8192",
        "qwen/qwen3.8-27b",
        "mixtral-8x7b-32768",
        "gemma2-9b-it",
      ];
      for (const c of candidates) {
        if (ids.includes(c)) return c;
      }
      const anyText = ids.find((id) => !id.includes("whisper") && !id.includes("guard"));
      if (anyText) return anyText;
    }
  } catch {}
  return preferred;
}

function buildOpenAIMessages(r: AIRequest, supportsPdf: boolean) {
  let userContent: unknown;

  // Build the list of PDFs from pdfBase64List (multi) or pdfBase64 (single, backward compat)
  const pdfList = r.pdfBase64List?.length ? r.pdfBase64List : (r.pdfBase64 ? [r.pdfBase64] : []);

  if (supportsPdf) {
    // OpenRouter: send all PDFs as separate file parts
    const fileParts = pdfList.map((pdf, i) => ({
      type: "file",
      file: {
        filename: pdfList.length > 1 ? `paper${i + 1}.pdf` : "paper.pdf",
        file_data: `data:application/pdf;base64,${pdf}`,
      },
    }));
    userContent = [
      ...fileParts,
      { type: "text", text: r.prompt },
    ];
  } else {
    // Text-based providers: extract and concatenate text from all PDFs
    const extracted = pdfList
      .map((pdf, i) => `[Paper ${i + 1}]\n${extractTextFromPdf(pdf).slice(0, 60000)}`)
      .join("\n\n---\n\n");
    userContent = extracted
      ? `Paper Content:\n${extracted}\n\nInstructions:\n${r.prompt}`
      : `Instructions:\n${r.prompt}`;
  }

  return [
    {
      role: "system",
      content:
        "You are an expert research assistant. When asked for JSON, output valid JSON only without markdown fences.",
    },
    { role: "user", content: userContent },
  ];
}

async function callOpenAICompatible(
  url: string,
  key: string,
  model: string,
  r: AIRequest,
  providerLabel: string,
  supportsPdf = false
): Promise<string> {
  const send = async (targetUrl: string, targetModel: string) => {
    return fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "User-Agent": "paper-copilot/1.0",
      },
      body: JSON.stringify({
        model: targetModel,
        messages: buildOpenAIMessages(r, supportsPdf),
        max_tokens: 2048,
        temperature: 0.2,
      }),
    });
  };

  let res: Response;
  try {
    res = await send(url, model);
  } catch (err) {
    if (url.includes("models.github.ai")) {
      res = await send("https://models.inference.ai.azure.com/chat/completions", model);
    } else {
      throw new Error(`${providerLabel} network error: ${err instanceof Error ? err.message : "connection failed"}`);
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `${providerLabel} request failed (${res.status})`);
  }

  const choice = data.choices?.[0];
  if (!choice) {
    throw new Error(`${providerLabel} returned no response choices.`);
  }

  if (choice.message?.refusal) {
    throw new Error(`${providerLabel} refused: ${choice.message.refusal}`);
  }

  const content = choice.message?.content || "";
  if (!content.trim()) {
    throw new Error(`${providerLabel} returned empty content.`);
  }

  return content;
}

async function callOpenAICompatibleStream(
  url: string,
  key: string,
  model: string,
  r: AIRequest,
  providerLabel: string,
  supportsPdf = false
): Promise<ReadableStream<Uint8Array>> {
  const send = async (targetUrl: string, targetModel: string) => {
    return fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "User-Agent": "paper-copilot/1.0",
      },
      body: JSON.stringify({
        model: targetModel,
        messages: buildOpenAIMessages(r, supportsPdf),
        max_tokens: 2048,
        stream: true,
        temperature: 0.2,
      }),
    });
  };

  let res: Response;
  try {
    res = await send(url, model);
  } catch (err) {
    if (url.includes("models.github.ai")) {
      res = await send("https://models.inference.ai.azure.com/chat/completions", model);
    } else {
      throw new Error(`${providerLabel} stream error: ${err instanceof Error ? err.message : "connection failed"}`);
    }
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    let msg = `${providerLabel} stream failed (${res.status})`;
    try {
      const parsed = JSON.parse(errText);
      if (parsed?.error?.message) msg = parsed.error.message;
    } catch {}
    throw new Error(msg);
  }

  if (!res.body) throw new Error(`No response body received from ${providerLabel}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const jsonStr = trimmed.slice(6).trim();
          if (jsonStr === "[DONE]") {
            controller.close();
            return;
          }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content ?? "";
            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          } catch {
            // Partial chunk
          }
        }
      }
    },
    cancel() {
      reader.cancel();
    },
  });
}

// -------------------------------------------------------------
// Public Dispatchers
// -------------------------------------------------------------
export async function callAI(r: AIRequest): Promise<string> {
  switch (r.provider) {
    case "gemini-flash":
      return callGemini(r, process.env.GEMINI_MODEL || "gemini-3.8-flash");

    case "gemini-flash-lite":
      return callGemini(r, process.env.GEMINI_LITE_MODEL || "gemini-3.5-flash-lite");

    case "groq-llama": {
      const key = need("GROQ_API_KEY");
      const model = await resolveGroqModel(key, process.env.GROQ_MODEL || "llama-3.1-8b-instant");
      return callOpenAICompatible(
        "https://api.groq.com/openai/v1/chat/completions",
        key,
        model,
        r,
        `Groq (${model})`,
        false
      );
    }

    case "openrouter-free": {
      const key = need("OPENROUTER_API_KEY");
      const model = process.env.OPENROUTER_MODEL || "openrouter/free";
      return callOpenAICompatible(
        "https://openrouter.ai/api/v1/chat/completions",
        key,
        model,
        r,
        "OpenRouter",
        true
      );
    }

    case "github-gpt4o-mini": {
      const key = need("GITHUB_TOKEN");
      const model = process.env.GITHUB_MODEL || "gpt-4o-mini";
      return callOpenAICompatible(
        "https://models.github.ai/inference/chat/completions",
        key,
        model,
        r,
        "GitHub Models",
        false
      );
    }

    default:
      throw new Error("Unknown provider");
  }
}

export async function callAIStream(r: AIRequest): Promise<ReadableStream<Uint8Array>> {
  switch (r.provider) {
    case "gemini-flash":
      return callGeminiStream(r, process.env.GEMINI_MODEL || "gemini-3.8-flash");

    case "gemini-flash-lite":
      return callGeminiStream(r, process.env.GEMINI_LITE_MODEL || "gemini-3.5-flash-lite");

    case "groq-llama": {
      const key = need("GROQ_API_KEY");
      const model = await resolveGroqModel(key, process.env.GROQ_MODEL || "llama-3.1-8b-instant");
      return callOpenAICompatibleStream(
        "https://api.groq.com/openai/v1/chat/completions",
        key,
        model,
        r,
        `Groq (${model})`,
        false
      );
    }

    case "openrouter-free": {
      const key = need("OPENROUTER_API_KEY");
      const model = process.env.OPENROUTER_MODEL || "openrouter/free";
      return callOpenAICompatibleStream(
        "https://openrouter.ai/api/v1/chat/completions",
        key,
        model,
        r,
        "OpenRouter",
        true
      );
    }

    case "github-gpt4o-mini": {
      const key = need("GITHUB_TOKEN");
      const model = process.env.GITHUB_MODEL || "gpt-4o-mini";
      return callOpenAICompatibleStream(
        "https://models.github.ai/inference/chat/completions",
        key,
        model,
        r,
        "GitHub Models",
        false
      );
    }

    default:
      throw new Error("Unknown provider");
  }
}
