"use client";
import { useState, useRef, useEffect } from "react";
import { PROVIDERS, ProviderId } from "@/lib/providers";

// ─── Types ────────────────────────────────────────────────────────────────────
type FullSummary = {
  title: string;
  authors: string;
  year: string;
  journal: string;
  doi: string;
  problem: string;
  method: string;
  dataset: string;
  results: string;
  limitations: string;
  keywords: string[];
};

type LibraryPaper = {
  id: string;
  file: File | null;
  fileId: string;
  summary: FullSummary | null;
  loading: boolean;
  error: string;
};

const SUMMARY_ROWS: [string, keyof FullSummary, string][] = [
  ["Research Objective & Problem", "problem", "01 // PROBLEM"],
  ["Methodology & Architecture", "method", "02 // METHOD"],
  ["Datasets & Experimental Setup", "dataset", "03 // DATASET"],
  ["Empirical Findings & Metrics", "results", "04 // RESULTS"],
  ["Limitations & Boundary Conditions", "limitations", "05 // LIMITS"],
];

function uid() { return Math.random().toString(36).slice(2, 10); }
function newPaper(): LibraryPaper {
  return { id: uid(), file: null, fileId: "", summary: null, loading: false, error: "" };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function copyText(text: string) { navigator.clipboard?.writeText(text).catch(() => {}); }

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function downloadMarkdown(content: string, filename = "literature-review.md") {
  downloadBlob(content, filename, "text/markdown");
}

function downloadWord(content: string, filename = "literature-review.doc") {
  const htmlBody = content
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br/>");
  const doc = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Literature Review</title><style>body{font-family:Times New Roman,serif;font-size:12pt;line-height:1.8;margin:2cm}h1,h2,h3{font-family:Arial,sans-serif}p{margin:0 0 1em}</style></head><body><p>${htmlBody}</p></body></html>`;
  downloadBlob(doc, filename, "application/msword");
}

function makeBibtex(papers: LibraryPaper[]): string {
  return papers.filter(p => p.summary).map((p, i) => {
    const s = p.summary!;
    const key = (s.authors.split(",")[0]?.split(" ").pop() || `Paper${i+1}`) + (s.year !== "Not stated" ? s.year : "");
    return `@article{${key.toLowerCase()},\n  title   = {${s.title}},\n  author  = {${s.authors !== "Not stated" ? s.authors : ""}},\n  year    = {${s.year !== "Not stated" ? s.year : ""}},\n  journal = {${s.journal !== "Not stated" ? s.journal : ""}},\n  doi     = {${s.doi !== "Not stated" ? s.doi : ""}},\n  keywords= {${s.keywords?.join(", ")}}\n}`;
  }).join("\n\n");
}

function makeAPA(papers: LibraryPaper[]): string {
  return papers.filter(p => p.summary).map((p, i) => {
    const s = p.summary!;
    const authors = s.authors !== "Not stated" ? s.authors : "Unknown Author";
    const year = s.year !== "Not stated" ? `(${s.year})` : "(n.d.)";
    const journal = s.journal !== "Not stated" ? `. ${s.journal}` : "";
    const doi = s.doi !== "Not stated" ? `. https://doi.org/${s.doi}` : "";
    return `${authors} ${year}. ${s.title}${journal}${doi}`;
  }).join("\n\n");
}

// ─── Shared PDF Upload Button ─────────────────────────────────────────────────
function FileButton({ label, onFile }: { label?: string; onFile: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button className="btn-outline btn-sm" onClick={() => ref.current?.click()}>
        <span className="btn-icon">＋</span> {label ?? "Add PDF Corpus"}
      </button>
      <input ref={ref} type="file" accept="application/pdf" style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) { onFile(f); e.target.value = ""; } }} />
    </>
  );
}

// ─── Summary Card ─────────────────────────────────────────────────────────────
function SummaryCard({ summary, slot }: { summary: FullSummary; slot?: number }) {
  return (
    <div className="summary-card">
      <div className="card-top-tag">
        <span className="telemetry-badge">
          {slot !== undefined ? `CORPUS_NODE_${slot + 1}` : "DOCUMENT_ANALYSIS"}
        </span>
        {summary.doi !== "Not stated" && (
          <span className="doi-tag">DOI: {summary.doi}</span>
        )}
      </div>

      <h3 className="summary-title">{summary.title}</h3>

      {(summary.authors !== "Not stated" || summary.year !== "Not stated") && (
        <p className="summary-meta">
          <span className="meta-icon">👤</span> {summary.authors !== "Not stated" ? summary.authors : "Unknown authors"}
          {summary.year !== "Not stated" && ` [${summary.year}]`}
          {summary.journal !== "Not stated" && ` · ${summary.journal}`}
        </p>
      )}

      <div className="summary-grid">
        {SUMMARY_ROWS.map(([label, key, code]) => (
          <div key={key} className="summary-cell">
            <span className="cell-label">
              <span className="cell-code">{code}</span>
              {label}
            </span>
            <p className="cell-text">{summary[key] as string}</p>
          </div>
        ))}
      </div>

      <div className="kw-row">
        <span className="cell-label"><span className="cell-code">TAXONOMY</span> KEYWORDS</span>
        <div className="tags">{summary.keywords?.map(k => <span className="tag" key={k}>{k}</span>)}</div>
      </div>
    </div>
  );
}

// ─── Analyze Tab ──────────────────────────────────────────────────────────────
function AnalyzeTab({ provider, library, setLibrary }: {
  provider: ProviderId;
  library: LibraryPaper[];
  setLibrary: React.Dispatch<React.SetStateAction<LibraryPaper[]>>;
}) {
  const [paper, setPaper] = useState<LibraryPaper>(newPaper());
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [askLoading, setAskLoading] = useState(false);
  const [askError, setAskError] = useState("");

  function updatePaper(patch: Partial<LibraryPaper>) {
    setPaper(prev => ({ ...prev, ...patch }));
  }

  async function summarize(file: File) {
    updatePaper({ file, summary: null, error: "", loading: true, fileId: "" });
    const fd = new FormData();
    fd.append("file", file);
    fd.append("provider", provider);
    fd.append("mode", "summary");
    try {
      const res = await fetch("/api/ai", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      updatePaper({ summary: data.summary, fileId: data.fileId, loading: false });
    } catch (e) {
      updatePaper({ error: e instanceof Error ? e.message : "Failed.", loading: false });
    }
  }

  async function ask() {
    if (!question.trim() || !paper.file) return;
    setAskLoading(true); setAskError(""); setAnswer("");
    const fd = new FormData();
    if (paper.fileId) fd.append("fileId", paper.fileId);
    if (paper.file) fd.append("file", paper.file);
    fd.append("provider", provider);
    fd.append("mode", "ask");
    fd.append("question", question);
    try {
      const res = await fetch("/api/ai", { method: "POST", body: fd });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "Inference failed"); }
      if (res.headers.get("X-File-Id")) updatePaper({ fileId: res.headers.get("X-File-Id")! });
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += dec.decode(value, { stream: true });
        setAnswer(full);
      }
    } catch (e) {
      setAskError(e instanceof Error ? e.message : "Inference failed.");
    } finally {
      setAskLoading(false);
    }
  }

  function addToLibrary() {
    if (!paper.summary) return;
    const exists = library.some(p => p.fileId && p.fileId === paper.fileId);
    if (!exists) setLibrary(prev => [...prev, { ...paper, id: uid() }]);
  }

  const inLibrary = library.some(p => p.fileId && p.fileId === paper.fileId && paper.fileId);

  return (
    <div>
      {!paper.file ? (
        <div className="upload-zone card" onClick={() => document.getElementById("analyze-file-input")?.click()}>
          <div className="upload-reticle">
            <span className="reticle-crosshair">✛</span>
            <div className="upload-icon">⚛</div>
          </div>
          <p className="upload-title">LOAD RESEARCH CORPUS</p>
          <p className="upload-label">Drag &amp; drop manuscript or click to ingest (PDF, up to 4 MB)</p>
          <div className="upload-telemetry-pill">SYSTEM PROTOCOL: MULTI-MODAL PARSER READY</div>
          <input id="analyze-file-input" type="file" accept="application/pdf" style={{ display: "none" }}
            onChange={e => { const f = e.target.files?.[0]; if (f) summarize(f); }} />
        </div>
      ) : (
        <div className="card file-bar">
          <div className="file-info-cluster">
            <span className="file-icon">⚡</span>
            <div>
              <span className="file-status-label">ACTIVE INGESTED CORPUS</span>
              <span className="file-nm">{paper.file.name}</span>
            </div>
          </div>
          <button className="btn-ghost btn-xs" onClick={() => { setPaper(newPaper()); setAnswer(""); }}>✕ EJECT CORPUS</button>
        </div>
      )}

      {paper.loading && (
        <div className="card loading-state">
          <span className="spinner-lg" />
          <div>
            <span className="loading-headline">PROCESSING NEURAL DECOMPOSITION…</span>
            <span className="loading-subline">Extracting hypothesis, methodology, empirical bounds &amp; metadata</span>
          </div>
        </div>
      )}
      {paper.error && <p className="err">⚠ {paper.error}</p>}

      {paper.summary && (
        <>
          <div className="card-actions">
            <button className={`btn-outline btn-sm ${inLibrary ? "btn-success" : ""}`} onClick={addToLibrary} disabled={inLibrary}>
              {inLibrary ? "✓ SAVED IN REPOSITORY" : "＋ COMMIT TO LIBRARY"}
            </button>
          </div>
          <SummaryCard summary={paper.summary} />
          <CitationPanel papers={[{ ...paper, id: "x" }]} />
        </>
      )}

      {paper.file && (
        <div className="card">
          <label className="section-label">
            <span className="section-label-code">QUERY ENGINE</span>
            TARGETED CORPUS DIALOGUE
          </label>
          <p className="hint">Execute natural-language queries across this paper. Answers cite verbatim sections and pages.</p>
          <div className="row" style={{ marginTop: "12px" }}>
            <input type="text" value={question} placeholder="e.g. What baseline models were evaluated, and on what loss function?"
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && question.trim() && !askLoading) ask(); }} />
            <button className="btn-primary" disabled={!question.trim() || askLoading || !paper.file} onClick={ask}>
              {askLoading ? <><span className="spinner" />INFERRING…</> : "QUERY CORPUS"}
            </button>
          </div>
          {askError && <p className="err">⚠ {askError}</p>}
          {answer && (
            <div className="answer-box">
              <span className="cell-label"><span className="cell-code">OUTPUT</span> SYNTHESIZED RESPONSE</span>
              <div className="answer">{answer}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Citation Panel ───────────────────────────────────────────────────────────
function CitationPanel({ papers }: { papers: LibraryPaper[] }) {
  const [tab, setTab] = useState<"bibtex" | "apa">("bibtex");
  const [copied, setCopied] = useState(false);
  const active = papers.filter(p => p.summary);
  if (!active.length) return null;
  const content = tab === "bibtex" ? makeBibtex(active) : makeAPA(active);
  function copy() {
    copyText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="card cite-card">
      <div className="cite-header">
        <span className="section-label" style={{ margin: 0 }}>
          <span className="section-label-code">CITATION</span>
          BIBLIOGRAPHIC TELEMETRY
        </span>
        <div className="cite-tabs">
          <button className={`cite-tab ${tab === "bibtex" ? "cite-tab-active" : ""}`} onClick={() => setTab("bibtex")}>BIBTEX</button>
          <button className={`cite-tab ${tab === "apa" ? "cite-tab-active" : ""}`} onClick={() => setTab("apa")}>APA 7TH</button>
        </div>
        <button className="btn-outline btn-xs" onClick={copy}>{copied ? "✓ COPIED" : "COPY"}</button>
        <button className="btn-outline btn-xs" onClick={() => downloadBlob(content, `citations.${tab === "bibtex" ? "bib" : "txt"}`, "text/plain")}>
          ⬇ EXPORT
        </button>
      </div>
      <pre className="cite-box">{content}</pre>
    </div>
  );
}

// ─── Library & Chat Tab ───────────────────────────────────────────────────────
function LibraryTab({ provider, library, setLibrary }: {
  provider: ProviderId;
  library: LibraryPaper[];
  setLibrary: React.Dispatch<React.SetStateAction<LibraryPaper[]>>;
}) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function addPaper(file: File) {
    const slot: LibraryPaper = { ...newPaper(), file, loading: true };
    setLibrary(prev => [...prev, slot]);
    const fd = new FormData();
    fd.append("file", file); fd.append("provider", provider); fd.append("mode", "summary");
    try {
      const res = await fetch("/api/ai", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setLibrary(prev => prev.map(p => p.id === slot.id ? { ...p, summary: data.summary, fileId: data.fileId, loading: false } : p));
    } catch (e) {
      setLibrary(prev => prev.map(p => p.id === slot.id ? { ...p, error: e instanceof Error ? e.message : "Failed.", loading: false } : p));
    }
  }

  function removePaper(id: string) { setLibrary(prev => prev.filter(p => p.id !== id)); }

  async function askLibrary() {
    if (!question.trim() || !library.length) return;
    setLoading(true); setError(""); setAnswer("");
    try {
      const res = await fetch("/api/library-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          papers: library.map(p => ({ fileId: p.fileId, title: p.summary?.title || p.file?.name || "Unknown" })),
          paperSummaries: library.filter(p => p.summary).map(p => p.summary),
          provider,
        }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "Failed"); }
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += dec.decode(value, { stream: true });
        setAnswer(full);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="lib-header card">
        <div className="lib-title-row">
          <div>
            <span className="section-label" style={{ margin: 0 }}>
              <span className="section-label-code">REPOSITORY</span>
              RESEARCH KNOWLEDGE BASE
            </span>
            <span className="lib-count-badge">{library.length} MANUSCRIPTS INDEXED</span>
          </div>
          <FileButton label="Ingest Manuscript" onFile={addPaper} />
        </div>
        {library.length === 0 && (
          <p className="empty-hint">No manuscripts indexed. Upload papers to build your persistent research corpus.</p>
        )}
        {library.length > 0 && (
          <div className="lib-list">
            {library.map((p, idx) => (
              <div key={p.id} className={`lib-item ${p.loading ? "lib-item-loading" : ""}`}>
                <span className="lib-index-tag">[{idx + 1 < 10 ? `0${idx + 1}` : idx + 1}]</span>
                <span className="lib-icon">{p.loading ? <span className="spinner-sm" /> : "📄"}</span>
                <div className="lib-info">
                  <span className="lib-title">{p.summary?.title || p.file?.name || "Unknown"}</span>
                  {p.summary && (
                    <span className="lib-meta">
                      {p.summary.authors !== "Not stated" ? p.summary.authors : "Unknown authors"}
                      {p.summary.year !== "Not stated" ? ` [${p.summary.year}]` : ""}
                    </span>
                  )}
                  {p.error && <span className="lib-err">⚠ {p.error}</span>}
                </div>
                <button className="btn-ghost btn-xs" onClick={() => removePaper(p.id)}>✕ REMOVE</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {library.length > 0 && (
        <div className="card">
          <label className="section-label">
            <span className="section-label-code">MULTI-CORPUS SEARCH</span>
            CROSS-LIBRARY DIALOGUE ENGINE
          </label>
          <p className="hint">Inference engine will cross-reference claims, datasets, and methods across all {library.length} papers simultaneously.</p>
          <div className="row" style={{ marginTop: "12px" }}>
            <input type="text" value={question} placeholder="e.g. Which of these papers compare attention mechanisms against state space models?"
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && question.trim() && !loading) askLibrary(); }} />
            <button className="btn-primary" disabled={!question.trim() || loading} onClick={askLibrary}>
              {loading ? <><span className="spinner" />SCANNING…</> : "EXECUTE"}
            </button>
          </div>
          {error && <p className="err">⚠ {error}</p>}
          {answer && (
            <div className="answer-box">
              <span className="cell-label"><span className="cell-code">SYNTHESIS</span> CROSS-CORPUS REASONING</span>
              <div className="answer">{answer}</div>
            </div>
          )}
        </div>
      )}

      {library.filter(p => p.summary).length > 0 && (
        <CitationPanel papers={library} />
      )}
    </div>
  );
}

// ─── Compare Tab ──────────────────────────────────────────────────────────────
function CompareTab({ provider, library }: { provider: ProviderId; library: LibraryPaper[] }) {
  const MAX = 10;
  const [slots, setSlots] = useState<LibraryPaper[]>([newPaper(), newPaper()]);
  const [comparing, setComparing] = useState(false);
  const [globalError, setGlobalError] = useState("");
  const [useLibrary, setUseLibrary] = useState(library.length >= 2);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else if (next.size < MAX) next.add(id);
      return next;
    });
  }

  function addSlot() { if (slots.length < MAX) setSlots(prev => [...prev, newPaper()]); }
  function removeSlot(i: number) { setSlots(prev => prev.filter((_, idx) => idx !== i)); }

  function setSlotField(i: number, patch: Partial<LibraryPaper>) {
    setSlots(prev => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  }

  async function compare() {
    const activePapers = useLibrary
      ? library.filter(p => selected.has(p.id))
      : slots.filter(s => s.file);

    if (activePapers.length < 2) {
      setGlobalError(`Select at least 2 papers.`);
      return;
    }
    setGlobalError(""); setComparing(true);

    if (activePapers.every(p => p.summary)) {
      setComparing(false);
      return;
    }

    const fd = new FormData();
    fd.append("provider", provider);
    activePapers.forEach((p, i) => {
      if (p.file) fd.append(`file${i}`, p.file);
      if (p.fileId) fd.append(`fileId${i}`, p.fileId);
    });
    try {
      const res = await fetch("/api/compare", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Comparison failed");
      data.summaries?.forEach((r: { summary: FullSummary | null; fileId: string; error?: string }, i: number) => {
        setSlotField(i, { summary: r.summary || null, fileId: r.fileId || "", error: r.error || "", loading: false });
      });
    } catch (e) {
      setGlobalError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setComparing(false);
    }
  }

  const papersToShow: LibraryPaper[] = useLibrary && selected.size >= 2
    ? library.filter(p => selected.has(p.id))
    : slots.filter(s => s.summary);

  const hasSummaries = papersToShow.some(p => p.summary);

  return (
    <div>
      {library.length >= 2 && (
        <div className="mode-toggle card">
          <span className="section-label" style={{ margin: 0 }}>
            <span className="section-label-code">CORPUS SOURCE</span>
            INPUT SELECTION PROTOCOL
          </span>
          <div className="toggle-row">
            <button className={`toggle-btn ${useLibrary ? "toggle-active" : ""}`} onClick={() => setUseLibrary(true)}>LIBRARY ASSETS</button>
            <button className={`toggle-btn ${!useLibrary ? "toggle-active" : ""}`} onClick={() => setUseLibrary(false)}>UPLOAD NEW BATCH</button>
          </div>
        </div>
      )}

      {useLibrary && library.length >= 2 ? (
        <div className="card">
          <p className="section-label">SELECT 2 TO {MAX} PAPERS FOR MATRIX COMPARISON</p>
          <div className="lib-list">
            {library.map(p => (
              <label key={p.id} className={`lib-item lib-item-select ${selected.has(p.id) ? "lib-item-checked" : ""}`}>
                <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} />
                <span className="lib-icon">📄</span>
                <div className="lib-info">
                  <span className="lib-title">{p.summary?.title || p.file?.name || "Unknown"}</span>
                  {p.summary && <span className="lib-meta">{p.summary.year !== "Not stated" ? p.summary.year : ""}</span>}
                </div>
              </label>
            ))}
          </div>
          <div style={{ marginTop: "14px" }}>
            <button className="btn-primary btn-wide" disabled={selected.size < 2 || comparing} onClick={compare}>
              {comparing ? <><span className="spinner" />GENERATING MATRIX…</> : `EXECUTE COMPARATIVE MATRIX (${selected.size} PAPERS)`}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="compare-slots">
            {slots.map((slot, i) => (
              <div key={slot.id} className={`compare-slot card ${slot.file ? "slot-active" : ""}`}>
                <div className="slot-head">
                  <span className="slot-badge">CORPUS_{i + 1}{i >= 2 ? "" : " *"}</span>
                  {slots.length > 2 && (
                    <button className="btn-ghost btn-xs" onClick={() => removeSlot(i)}>✕</button>
                  )}
                </div>
                <div className="slot-file">
                  <input type="file" accept="application/pdf"
                    onChange={e => setSlotField(i, { file: e.target.files?.[0] ?? null, summary: null, error: "", fileId: "" })} />
                  {slot.file
                    ? <span className="file-name-sm">📄 {slot.file.name}</span>
                    : <span className="file-ph">{i < 2 ? "[REQUIRED]" : "[OPTIONAL]"}</span>}
                </div>
                {slot.loading && <div className="slot-load"><span className="spinner-sm" /> Ingesting…</div>}
                {slot.error && <p className="err slot-err">⚠ {slot.error}</p>}
              </div>
            ))}
            {slots.length < MAX && (
              <button className="add-slot-btn" onClick={addSlot}>＋ ADD CORPUS SLOT</button>
            )}
          </div>
          <div className="compare-actions">
            <button className="btn-primary btn-wide" disabled={comparing || slots.filter(s => s.file).length < 2} onClick={compare}>
              {comparing ? <><span className="spinner" />BUILDING COMPARATIVE MATRIX…</> : "GENERATE COMPARATIVE MATRIX"}
            </button>
          </div>
        </>
      )}

      {globalError && <p className="err">⚠ {globalError}</p>}

      {hasSummaries && (
        <div className="compare-table-wrap">
          <div className="compare-table-title">
            <span className="table-title-code">MATRIX_VIEW</span>
            CROSS-CORPUS MULTI-DIMENSIONAL COMPARISON
          </div>
          <div className="compare-scroll">
            <table className="compare-table">
              <thead>
                <tr>
                  <th className="ct-field-col">DIMENSION</th>
                  {papersToShow.filter(p => p.summary).map((p, i) => (
                    <th key={i}>
                      <span className="ct-paper-num">CORPUS // 0{i + 1}</span>
                      <span className="ct-paper-title">{p.summary!.title}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["Authors", "authors"],
                  ["Year", "year"],
                  ["Venue / Journal", "journal"],
                  ...SUMMARY_ROWS.map(r => [r[0], r[1]]),
                  ["Keywords", "keywords"],
                ].map(([label, key]) => (
                  <tr key={key as string}>
                    <td className="ct-label">{label}</td>
                    {papersToShow.filter(p => p.summary).map((p, i) => {
                      const val = p.summary![key as keyof FullSummary];
                      return (
                        <td key={i} className="ct-data">
                          {Array.isArray(val)
                            ? <div className="tags tags-sm">{(val as string[]).map(k => <span className="tag" key={k}>{k}</span>)}</div>
                            : (val as string)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Review & Export Tab ──────────────────────────────────────────────────────
function ReviewTab({ provider, library }: { provider: ProviderId; library: LibraryPaper[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [review, setReview] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function toggle(id: string) {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  async function generate() {
    const papers = library.filter(p => selected.has(p.id) && p.summary).map(p => p.summary);
    if (!papers.length) { setError("Select at least 1 paper with a summary."); return; }
    setError(""); setLoading(true); setReview("");
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ papers, provider }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "Failed"); }
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += dec.decode(value, { stream: true });
        setReview(full);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Synthesis failed.");
    } finally {
      setLoading(false);
    }
  }

  const eligible = library.filter(p => p.summary);

  return (
    <div>
      {eligible.length === 0 ? (
        <div className="card empty-state">
          <p className="empty-title">CORPUS BUFFER EMPTY</p>
          <p>Please ingest and commit papers into the <strong>Library</strong> tab first to synthesize a literature review.</p>
        </div>
      ) : (
        <>
          <div className="card">
            <span className="section-label">
              <span className="section-label-code">SYNTHESIS SCOPE</span>
              SELECT MANUSCRIPTS FOR LITERATURE REVIEW
            </span>
            <div className="lib-list">
              {eligible.map(p => (
                <label key={p.id} className={`lib-item lib-item-select ${selected.has(p.id) ? "lib-item-checked" : ""}`}>
                  <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                  <span className="lib-icon">📄</span>
                  <div className="lib-info">
                    <span className="lib-title">{p.summary!.title}</span>
                    <span className="lib-meta">{p.summary!.authors !== "Not stated" ? p.summary!.authors : ""}{p.summary!.year !== "Not stated" ? ` [${p.summary!.year}]` : ""}</span>
                  </div>
                </label>
              ))}
            </div>
            <div style={{ marginTop: "14px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button className="btn-primary" disabled={selected.size === 0 || loading} onClick={generate}>
                {loading ? <><span className="spinner" />SYNTHESIZING…</> : "GENERATE LITERATURE REVIEW"}
              </button>
              {review && (
                <>
                  <button className="btn-outline" onClick={() => downloadMarkdown(review)}>⬇ EXPORT MARKDOWN (.md)</button>
                  <button className="btn-outline" onClick={() => downloadWord(review)}>⬇ EXPORT WORD (.doc)</button>
                </>
              )}
            </div>
          </div>

          {error && <p className="err">⚠ {error}</p>}

          {review && (
            <div className="card review-card">
              <div className="review-head">
                <span className="section-label" style={{ margin: 0 }}>
                  <span className="section-label-code">SYNTHESIZED DRAFT</span>
                  LITERATURE REVIEW DRAFT
                </span>
                <button className="btn-outline btn-xs" onClick={() => copyText(review)}>COPY DRAFT</button>
              </div>
              <div className="review-body">
                {review.split("\n").map((line, i) => {
                  if (line.startsWith("## ")) return <h2 key={i} className="rv-h2">{line.slice(3)}</h2>;
                  if (line.startsWith("### ")) return <h3 key={i} className="rv-h3">{line.slice(4)}</h3>;
                  if (line.startsWith("# ")) return <h1 key={i} className="rv-h1">{line.slice(2)}</h1>;
                  if (!line.trim()) return <div key={i} style={{ height: "12px" }} />;
                  return <p key={i} className="rv-p">{line}</p>;
                })}
              </div>
            </div>
          )}

          <CitationPanel papers={eligible.filter(p => selected.has(p.id))} />
        </>
      )}
    </div>
  );
}

// ─── Root Page ────────────────────────────────────────────────────────────────
type Tab = "analyze" | "library" | "compare" | "review";

const TABS: { id: Tab; icon: React.ReactNode; index: string; label: string }[] = [
  {
    id: "analyze",
    index: "01",
    label: "Analyze",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
  {
    id: "library",
    index: "02",
    label: "Library & Dialogue",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  },
  {
    id: "compare",
    index: "03",
    label: "Comparative Matrix",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="18" rx="1" />
        <rect x="14" y="3" width="7" height="18" rx="1" />
        <line x1="10" y1="8" x2="14" y2="8" />
        <line x1="10" y1="16" x2="14" y2="16" />
      </svg>
    ),
  },
  {
    id: "review",
    index: "04",
    label: "Review & Export",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
  },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("analyze");
  const [provider, setProvider] = useState<ProviderId>("gemini-flash-lite");
  const [library, setLibrary] = useState<LibraryPaper[]>([]);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const current = PROVIDERS.find(p => p.id === provider)!;

  useEffect(() => {
    try {
      const saved = localStorage.getItem("paper_copilot_theme") as "dark" | "light" | null;
      const initial = saved || "dark";
      setTheme(initial);
      document.documentElement.setAttribute("data-theme", initial);
    } catch {}
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem("paper_copilot_theme", next);
      document.documentElement.setAttribute("data-theme", next);
    } catch {}
  };

  return (
    <>
      {/* Top-Right Floating Animated Round Theme Switcher */}
      <button
        type="button"
        className={`theme-toggle-btn ${theme === "dark" ? "theme-dark" : "theme-light"}`}
        onClick={toggleTheme}
        title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
        aria-label={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
      >
        <span className="theme-toggle-orbital" aria-hidden="true" />
        <span className="theme-toggle-glow" aria-hidden="true" />
        <div className="theme-toggle-icon-wrap">
          {/* Sun Icon */}
          <svg
            className="theme-svg-icon theme-sun-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
          {/* Moon Icon */}
          <svg
            className="theme-svg-icon theme-moon-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        </div>
      </button>

      <header className="site-header">
        <div className="header-inner">
          <div className="hud-telemetry-bar">
            <span className="hud-pill"><span className="pulse-indicator"></span>LAB PROTOCOL: ONLINE</span>
            <span className="hud-pill">CORPUS ENGINE: MULTI-MODAL PDF</span>
            <span className="hud-pill">COGNITIVE INDEX: ACTIVE</span>
          </div>

          <div className="brand">
            <div className="brand-orbital">
              <span className="orbital-ring"></span>
              <span className="brand-icon">✦</span>
            </div>
            <h1 className="brand-name">PAPER COPILOT</h1>
          </div>
          <p className="brand-sub">AUTONOMOUS SCIENTIFIC INTELLIGENCE // MULTI-CORPUS SYNTHESIS CONSOLE</p>
        </div>
      </header>

      <main className="main-content">
        <div className="model-bar card">
          <div className="model-bar-inner">
            <div className="model-hud-tag">
              <span className="hud-dot"></span>
              <label htmlFor="ai-select" className="model-label">NEURAL ENGINE</label>
            </div>
            <select id="ai-select" className="model-select" value={provider} onChange={e => setProvider(e.target.value as ProviderId)}>
              {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            <span className="model-note">{current.note}</span>
          </div>
        </div>

        <nav className="tabs" aria-label="Research Modules">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`tab ${tab === t.id ? "tab-active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              <span className="tab-left">
                <span className="tab-index">{t.index}</span>
                <span className="tab-icon">{t.icon}</span>
              </span>
              <span className="tab-label">{t.label}</span>
              {t.id === "library" && library.length > 0 && (
                <span className="tab-badge">{library.length}</span>
              )}
              <span className="tab-indicator" />
            </button>
          ))}
        </nav>

        <div className="tab-content">
          {tab === "analyze" && <AnalyzeTab provider={provider} library={library} setLibrary={setLibrary} />}
          {tab === "library" && <LibraryTab provider={provider} library={library} setLibrary={setLibrary} />}
          {tab === "compare" && <CompareTab provider={provider} library={library} />}
          {tab === "review" && <ReviewTab provider={provider} library={library} />}
        </div>
      </main>

      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-terminal-badge">AUTONOMOUS RESEARCH ENVIRONMENT // NODE_ID: 88A4-EXP</div>
          <p className="footer-copy">© {new Date().getFullYear()} <strong>Md Samiul Islam Mobin</strong>. All rights reserved.</p>
          <p className="footer-sub">PAPER COPILOT · SCIENTIFIC RESEARCH &amp; LITERATURE REASONING SYSTEM</p>
        </div>
      </footer>
    </>
  );
}
