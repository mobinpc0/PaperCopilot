# ✦ PAPER COPILOT // Autonomous Research Lab

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16.4-black?style=for-the-badge&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.5-blue?style=for-the-badge&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Google_Gemini-3.8_Flash-4285F4?style=for-the-badge&logo=google" alt="Gemini" />
  <img src="https://img.shields.io/badge/Groq-LPU_Inference-f55036?style=for-the-badge" alt="Groq" />
  <img src="https://img.shields.io/badge/OpenRouter-Free_Catalog-6366f1?style=for-the-badge" alt="OpenRouter" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License" />
</p>

<p align="center">
  <strong>An autonomous AI-powered research console designed to decompose, cross-examine, compare, and synthesize scientific literature in real-time.</strong>
</p>

---

## 🔬 Overview

**Paper Copilot** transforms how researchers, engineers, and students interact with academic manuscripts. Instead of manually parsing dense multi-column PDFs, Paper Copilot ingests scientific papers natively, provides structured dimensional analyses, supports multi-paper cross-examination, builds comparative matrices across up to 10 papers, and drafts full literature reviews exportable to Word or Markdown.

Built with an ultra-responsive futuristic laboratory UI featuring real-time Server-Sent Events (SSE) streaming, zero-delay reasoning tokens, and in-memory multi-modal caching.

---
## link https://papercopilot-peach.vercel.app/
## ✨ Core Features

### 1. 📄 Structured Manuscript Decomposition
- Extracts critical research dimensions into standardized taxonomies:
  - `01 // PROBLEM`: Core research question, objective, and hypothesis.
  - `02 // METHOD`: Algorithmic design, system architecture, and novelty.
  - `03 // DATASET`: Benchmarks, corpora, and empirical setup.
  - `04 // RESULTS`: Primary metrics, baselines, and performance deltas.
  - `05 // LIMITS`: Boundary conditions, compute constraints, and failure modes.
- Parses metadata including authors, publication year, journal/venue, and DOI.

### 2. 💬 Interactive Corpus Dialogue (Single & Multi-Paper)
- Natural language query engine citing verbatim sections and page numbers.
- **Single Paper Chat**: Ask targeted questions about architectures, proofs, or hyperparameter setups.
- **Knowledge Base Chat**: Cross-examine an entire library simultaneously (e.g., *"Which papers benchmarked against state-space models and what were their findings?"*).
- **Streaming Responses**: Token-by-token streaming under 500ms Time-To-First-Token (TTFT).

### 3. ⚖ Comparative Matrix (2 to 10 Papers)
- Side-by-side comparative table evaluating multiple manuscripts simultaneously.
- Compare directly from uploaded PDFs or select existing assets from your indexed library.
- Parallel batch execution using distributed asynchronous inference.

### 4. ✍ Automated Literature Review Synthesis
- Generates 600–900 word publication-grade literature review drafts from selected papers.
- Synthesizes recurring themes, compares contrasting methodologies, identifies research gaps, and highlights future directions.
- **One-Click Export**: Export directly as **Markdown (`.md`)** or formatted **Microsoft Word (`.doc`)**.

### 5. 📎 Bibliographic Citation Generation
- Automatic citation extraction for all indexed papers.
- Export in **BibTeX** (`@article{...}`) or **APA 7th Edition** format with instant clipboard copying and file downloads.

### 6. ⚡ High-Speed Pipeline & Zero-Delay Inference
- **Reasoning Budget Optimization (`thinkingBudget: 0`)**: Bypasses 5–15 second latent thinking tokens on Flash models for immediate token streaming.
- **In-Memory PDF Caching**: Uploads the multi-megabyte PDF binary once and caches it server-side. Subsequent question-answering payloads drop from ~4,000 KB to under 1 KB.
- **Zero-Dependency PDF Stream Parser**: Built-in FlateDecode stream extractor using standard Node.js libraries for text-only model inference.

---

## 🤖 Supported AI Providers (100% Free Tiers)

Paper Copilot includes native, multi-model dispatching across major free AI providers:

| Provider | Model | Free Tier Allowance | Input Modality |
| :--- | :--- | :--- | :--- |
| **Google AI Studio** | `gemini-3.5-flash-lite` | Highest throughput, low latency | Native Multi-modal PDF |
| **Google AI Studio** | `gemini-3.8-flash` | 15 RPM / 1,500 RPD (1M context) | Native Multi-modal PDF |
| **Groq Cloud** | `llama-3.1-8b-instant` | 30 RPM / 14,400 RPD (500+ tok/s) | Stream-extracted Text |
| **OpenRouter** | `openrouter/free` | Dynamic free router (:free catalog) | Native PDF / Text |
| **GitHub Models** | `gpt-4o-mini` | 150 requests/day (Free with PAT) | Stream-extracted Text |

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16 (Turbopack, App Router)](https://nextjs.org/)
- **Language**: [TypeScript 5.5](https://www.typescriptlang.org/)
- **UI & Styling**: Pure modern CSS with custom futuristic design tokens, dark/light laboratory themes, and Google Fonts (`Orbitron`, `Space Grotesk`, `JetBrains Mono`).
- **AI Runtimes**: Native `fetch` streaming via Web Streams API and Server-Sent Events (SSE).
- **Document Processing**: Binary base64 buffer ingestion with built-in `zlib` stream inflation.

---

## 📁 Repository Structure

```
paper-copilot/
├── app/
│   ├── api/
│   │   ├── ai/
│   │   │   └── route.ts            # Single-paper summary & streaming Q&A endpoint
│   │   ├── compare/
│   │   │   └── route.ts            # Multi-paper comparative matrix endpoint (2-10 papers)
│   │   ├── library-chat/
│   │   │   └── route.ts            # Cross-corpus multi-document dialogue streaming
│   │   └── review/
│   │       └── route.ts            # Literature review synthesis & generator endpoint
│   ├── globals.css                 # Futuristic research laboratory stylesheet
│   ├── layout.tsx                  # Root layout with preconnected typography
│   └── page.tsx                    # Multi-module research console UI
├── lib/
│   └── providers.ts                # Unified AI dispatchers, fallbacks, & PDF extractor
├── .env.example                    # Template for environment credentials
├── .env.local                      # Local active environment keys (git-ignored)
├── next.config.mjs                 # Next.js configuration
├── package.json                    # Dependencies & build scripts
└── tsconfig.json                   # Strict TypeScript compiler options
```


## 🔒 Security & Privacy

- **Local Processing**: Uploaded PDFs are parsed in-memory and cached in volatile RAM only during your active session. Files are never stored permanently on disk.
- **Secrets Management**: API tokens are read exclusively server-side via `process.env` and are never exposed to the client bundle.

---

## 👤 Author & Credits

Developed and maintained by **Md Samiul Islam Mobin**.

- **Project**: Paper Copilot
- **Copyright**: © 2026 Md Samiul Islam Mobin. All rights reserved.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
