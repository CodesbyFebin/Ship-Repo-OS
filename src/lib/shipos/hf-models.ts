// ─────────────────────────────────────────────────────────────────────────────
// ShipOS — Model Radar data. The free/open Hugging Face landscape as of
// November 2026: the 25 newest open-weight releases, the 10 trending
// specialized models, the established families, the quick picks, and the
// $0 stack that maps onto ShipOS's own engines. Data is a curated snapshot —
// sources cited per row; several "open" releases are gated or custom-terms
// (Muse Spark, some Kimi builds) and are flagged.
// ─────────────────────────────────────────────────────────────────────────────

export const MODEL_RADAR_DATE = "Nov 2026";
export const HF_SEARCH = "https://huggingface.co/models?search=";

export type ModelKind =
  | "text"
  | "multimodal"
  | "vision"
  | "video"
  | "image"
  | "audio"
  | "ocr"
  | "embedding"
  | "code"
  | "science";

export const KIND_META: Record<ModelKind, { label: string }> = {
  text: { label: "Text" },
  multimodal: { label: "Multimodal" },
  vision: { label: "Vision" },
  video: { label: "Video" },
  image: { label: "Image" },
  audio: { label: "Audio" },
  ocr: { label: "OCR" },
  embedding: { label: "Embeddings" },
  code: { label: "Code" },
  science: { label: "Science" },
};

export interface HfModel {
  rank: number;
  model: string;
  org: string;
  size: string;
  license: string;
  notes: string;
  kind: ModelKind;
  /** true = gated weights or custom terms despite the "open" label */
  gated?: boolean;
  source: string;
}

const hf = (model: string) => `${HF_SEARCH}${encodeURIComponent(model)}`;

// ── 1 · Newest open-weight releases (Oct–Nov 2026) ──────────────────────────

export const NEW_MODELS: HfModel[] = [
  { rank: 1, model: "Kimi K3.1 Pro", org: "Moonshot AI", size: "2.8T · 104B active", license: "Modified MIT", notes: "Full weights on HF Nov 2 — the strongest downloadable model right now.", kind: "text", source: "https://kilo.ai/open-source-models" },
  { rank: 2, model: "DeepSeek-V4.1-Flash-1017", org: "deepseek-ai", size: "multimodal MoE", license: "MIT", notes: "#1 trending open-weight model; image-text-to-text.", kind: "multimodal", source: "https://the-ai-future.com/tools/free-ai-models" },
  { rank: 3, model: "Mistral Large 4 (1T-A52B)", org: "mistralai", size: "~1T · 52B active", license: "Apache-2.0 (expected)", notes: "Weights released ~Oct 31; natively multimodal.", kind: "multimodal", source: "https://www.ampere.sh/blog/best-free-ai-models-for-ai-agents" },
  { rank: 4, model: "MiniMax-M3.1-Flash", org: "MiniMaxAI", size: "428B · 23B active", license: "MiniMax community", notes: "Weights published Oct 23 on HF / ModelScope.", kind: "text", source: "https://aegisai.in/best-free-ai-models-2026-comparison/" },
  { rank: 5, model: "Meta Muse Spark Open", org: "meta-llama", size: "816B · 42B active", license: "Gated", notes: "Text+image+video+audio in, 1M context.", kind: "multimodal", gated: true, source: "https://www.ampere.sh/blog/best-free-ai-models-for-ai-agents" },
  { rank: 6, model: "Reflection Beam 1.0", org: "reflection-ai", size: "501B · 23B active", license: "Apache-2.0", notes: "Text-only, 1M context, BF16 / FP8 / NVFP4.", kind: "text", source: "https://www.ampere.sh/blog/best-free-ai-models-for-ai-agents" },
  { rank: 7, model: "NVIDIA Nemotron 3.5 Bolt", org: "nvidia", size: "74B · 9B active", license: "OpenMDW-1.1", notes: "VLM, 2-min video input, 256K context — one 24GB GPU.", kind: "vision", source: "https://www.ampere.sh/blog/best-free-ai-models-for-ai-agents" },
  { rank: 8, model: "Aleph Alpha Kolibri-1", org: "Aleph Alpha", size: "78B · 3.46B active", license: "Apache-2.0", notes: "German + English, runs on a single H200.", kind: "text", source: "https://www.ampere.sh/blog/best-free-ai-models-for-ai-agents" },
  { rank: 9, model: "Qwen3.8-27B", org: "Qwen", size: "27B", license: "Apache-2.0", notes: "Most-downloaded model on HF (~7.5M).", kind: "multimodal", source: "https://github.com/duanyytop/agents-radar/issues/3738" },
  { rank: 10, model: "Qwen3.8-Flash-Next", org: "Qwen", size: "MoE", license: "Apache-2.0", notes: "New lightweight flagship variant.", kind: "text", source: "https://github.com/duanyytop/agents-radar/issues/3858" },
  { rank: 11, model: "GLM 5.2", org: "zai-org", size: "753B", license: "MIT", notes: "Top pick for coding agents — 1M context, SWE-bench Pro 62.1%.", kind: "text", source: "https://github.com/datnguyenquy94/news-radar/issues/931" },
  { rank: 12, model: "GPT-OSS-120B / GPT-OSS-20B", org: "openai", size: "117B / 20B", license: "Apache-2.0", notes: "Best local reasoning + tool calling.", kind: "text", source: "https://github.com/datnguyenquy94/news-radar/issues/919" },
  { rank: 13, model: "Nanbeige4.3-33B", org: "Nanbeige", size: "33B", license: "Open", notes: "Strong performance-to-size ratio.", kind: "text", source: "https://www.deepset.ai/blog/open-source-llm-open-weight-models" },
  { rank: 14, model: "RecursiveSI/flint", org: "RecursiveSI", size: "7B", license: "Open", notes: "Viral conversational fine-tune.", kind: "text", source: "https://www.deepset.ai/blog/open-source-llm-open-weight-models" },
  { rank: 15, model: "XHToken/Spark-X2.6-4B", org: "XHToken", size: "4B", license: "Open", notes: "Edge-device, low-latency.", kind: "text", source: "https://www.deepset.ai/blog/open-source-llm-open-weight-models" },
  { rank: 16, model: "LFM3-1.7B / LFM3-Omni-2B / LFM3-VL-2B", org: "LiquidAI", size: "1.7–2B", license: "Open", notes: "\"Any-to-any\" liquid models.", kind: "multimodal", source: "https://www.deepset.ai/blog/open-source-llm-open-weight-models" },
  { rank: 17, model: "Ternary-Bonsai-2-27B", org: "prism-ml", size: "27B (2-bit)", license: "Apache-2.0", notes: "4.5M+ downloads, llama.cpp optimized.", kind: "text", source: "https://llmbenchmark.ai/trending" },
  { rank: 18, model: "Underdog-Saluki-27B-1.0", org: "ConwayResearch", size: "27B (2-bit)", license: "Apache-2.0", notes: "Tool-calling focused quant.", kind: "text", source: "https://llmbenchmark.ai/trending" },
  { rank: 19, model: "Ornith-1.5-9B / 35B-A3B", org: "ornith-ai", size: "9B / 35B", license: "MIT", notes: "High-download new family.", kind: "text", source: "https://benchlm.ai/blog/posts/llm-news-november-7-2026" },
  { rank: 20, model: "Xing4.0-29B-A4B", org: "XingChen-AGI", size: "29B · 4B active", license: "Apache-2.0", notes: "New MoE entrant.", kind: "text", source: "https://benchlm.ai/blog/posts/llm-news-november-7-2026" },
  { rank: 21, model: "MiniCPM5-2B", org: "openbmb", size: "2B", license: "Apache-2.0", notes: "Tiny on-device model.", kind: "text", source: "https://benchlm.ai/blog/posts/llm-news-november-7-2026" },
  { rank: 22, model: "InternScience/Sage-A1.5", org: "InternScience", size: "1.5B MoE", license: "Open", notes: "Text + vision hybrid.", kind: "vision", source: "https://www.deepset.ai/blog/open-source-llm-open-weight-models" },
  { rank: 23, model: "Hy-SimulMT-30B-A3B-FP8", org: "tencent", size: "30B · 3B active", license: "Open", notes: "Multilingual simultaneous translation.", kind: "text", source: "https://www.deepset.ai/blog/open-source-llm-open-weight-models" },
  { rank: 24, model: "Unlimited-OCR-2", org: "baidu", size: "small", license: "Open", notes: "OCR across 200+ languages.", kind: "ocr", source: "https://local-ai-zone.github.io/blog/October_2026_AI_Model_Updates.html" },
  { rank: 25, model: "Nemotron-3.5-Transcribe-30B-A4B", org: "nvidia", size: "30B · 4B active", license: "Open", notes: "ASR across 40 languages.", kind: "audio", source: "https://local-ai-zone.github.io/blog/October_2026_AI_Model_Updates.html" },
];

// ── 2 · Trending non-text / specialized ─────────────────────────────────────

export const SPECIALIZED_MODELS: HfModel[] = [
  { rank: 26, model: "LTX-2.5", org: "Lightricks", size: "—", license: "Open", notes: "Image→video diffusion — 2.2M+ downloads, viral photo-to-video.", kind: "video", source: "https://local-ai-zone.github.io/blog/October_2026_AI_Model_Updates.html" },
  { rank: 27, model: "sam3", org: "facebook", size: "—", license: "Open", notes: "Video segmentation — 1.9M downloads, temporal SAM.", kind: "video", source: "https://local-ai-zone.github.io/blog/October_2026_AI_Model_Updates.html" },
  { rank: 28, model: "flux-3-image-klein-comfy", org: "black-forest-labs", size: "3.2B backbone", license: "Open", notes: "Image gen/edit, ComfyUI native.", kind: "image", source: "https://local-ai-zone.github.io/blog/October_2026_AI_Model_Updates.html" },
  { rank: 29, model: "Qwen-Image-2.1", org: "Qwen", size: "—", license: "Open", notes: "Official image gen + editing.", kind: "image", source: "https://llmbenchmark.ai/trending" },
  { rank: 30, model: "MOSS-Image", org: "Comfy-Org", size: "—", license: "Open", notes: "Diffusion single-file — 3M downloads.", kind: "image", source: "https://www.deepset.ai/blog/open-source-llm-open-weight-models" },
  { rank: 31, model: "embeddinggemma-2", org: "google", size: "—", license: "Open", notes: "Semantic search / RAG embeddings.", kind: "embedding", source: "https://llmbenchmark.ai/trending" },
  { rank: 32, model: "drama-3", org: "fishaudio", size: "—", license: "Open", notes: "Multi-speaker TTS — expressive voiceover.", kind: "audio", source: "https://local-ai-zone.github.io/blog/October_2026_AI_Model_Updates.html" },
  { rank: 33, model: "MiniCPM-OCR-1.0", org: "openbmb", size: "300M", license: "Open", notes: "Mobile-friendly Chinese-doc OCR.", kind: "ocr", source: "https://local-ai-zone.github.io/blog/October_2026_AI_Model_Updates.html" },
  { rank: 34, model: "Carbon-X", org: "HuggingFaceBio", size: "—", license: "Open", notes: "Genomics LLM — DNA variant description.", kind: "science", source: "https://www.deepset.ai/blog/open-source-llm-open-weight-models" },
  { rank: 35, model: "Qwen3.5-4B-3D-Coder", org: "ccore", size: "4B", license: "Open", notes: "3D / WebGL code — Three.js generation.", kind: "code", source: "https://www.deepset.ai/blog/open-source-llm-open-weight-models" },
];

// ── 3 · Established families (#36–100) ──────────────────────────────────────

export interface ModelFamily {
  id: string;
  label: string;
  blurb: string;
  models: { name: string; note?: string }[];
}

export const MODEL_FAMILIES: ModelFamily[] = [
  {
    id: "qwen",
    label: "Qwen family",
    blurb: "The Apache-2.0 workhorse — dense + MoE, text to coder to VL.",
    models: [
      { name: "Qwen/Qwen3-Coder-480B-A35B-Instruct", note: "Apache-2.0 · 262K ctx · best Apache coding model" },
      { name: "Qwen/Qwen3.6-35B-A3B" },
      { name: "Qwen/Qwen3-4B-Thinking-2507" },
      { name: "Qwen/Qwen2.5-7B-Instruct-1M" },
      { name: "Qwen/Qwen2.5-Coder-32B-Instruct" },
      { name: "Qwen/Qwen2.5-VL-3B-Instruct / 72B-Instruct" },
      { name: "unsloth/Qwen3.8-27B-GGUF", note: "6.5M downloads" },
    ],
  },
  {
    id: "deepseek",
    label: "DeepSeek family",
    blurb: "MIT-licensed frontier MoE — the trending lane.",
    models: [
      { name: "deepseek-ai/DeepSeek-V4-Pro" },
      { name: "deepseek-ai/DeepSeek-V4-Flash-0731", note: "MIT" },
      { name: "deepseek-ai/DeepSeek-R1 / R1-0528" },
      { name: "deepseek-ai/DeepSeek-V3.2" },
      { name: "deepseek-ai/DeepSeek-Coder-V2" },
    ],
  },
  {
    id: "glm",
    label: "GLM / Z.ai",
    blurb: "MIT flagship line built around coding agents.",
    models: [
      { name: "zai-org/GLM-5.3" },
      { name: "zai-org/GLM-4.6" },
      { name: "zai-org/GLM-4.5 / GLM-4.5V / GLM-4.5-Air" },
      { name: "zai-org/GLM-4-9B-Chat" },
    ],
  },
  {
    id: "llama",
    label: "Meta Llama",
    blurb: "Scout → Behemoth, plus the guard model family.",
    models: [
      { name: "meta-llama/Llama-4-Scout / Behemoth" },
      { name: "meta-llama/Llama-3.3-70B-Instruct" },
      { name: "meta-llama/Llama-Guard-4" },
      { name: "meta-llama/Prompt-Guard-2" },
    ],
  },
  {
    id: "gemma",
    label: "Google Gemma",
    blurb: "Apache-2.0 dense sizes 2B–27B + the 3n efficient line.",
    models: [
      { name: "google/gemma-4 (2B/4B/12B/27B)", note: "Apache-2.0" },
      { name: "google/gemma-3n-E4B" },
      { name: "google/gemma-3-27b-it" },
    ],
  },
  {
    id: "mistral",
    label: "Mistral",
    blurb: "Small-but-mighty EU line: general, coder, embed.",
    models: [
      { name: "mistralai/Mistral-Small-3.2-24B" },
      { name: "mistralai/Devstral-Small-2505", note: "Apache-2.0 · SWE-bench Verified 46.8%" },
      { name: "mistralai/Magistral-small" },
      { name: "mistralai/Codestral-22B" },
      { name: "mistralai/Mistral-Embed-3" },
    ],
  },
  {
    id: "nemotron",
    label: "NVIDIA Nemotron",
    blurb: "Long-context open line from the GPU house.",
    models: [
      { name: "nvidia/NVIDIA-Nemotron-3-Ultra", note: "up to 1M context" },
      { name: "nvidia/Nemotron-H-47B" },
      { name: "nvidia/Llama-3.1-Nemotron-Nano" },
    ],
  },
  {
    id: "phi",
    label: "Microsoft Phi & friends",
    blurb: "Small specialists, including ternary BitNet.",
    models: [
      { name: "microsoft/Phi-4 / Phi-4-multimodal / Phi-4-mini" },
      { name: "microsoft/BitNet-b1.58-2B-4T", note: "ternary weights" },
    ],
  },
  {
    id: "other",
    label: "Other strong open LLMs",
    blurb: "The long tail worth knowing — from fully-open OLMo to 405B Hermes.",
    models: [
      { name: "allenai/OLMo-2-1124-13B", note: "fully open — data + weights" },
      { name: "EleutherAI/gpt-oss-finetuned variants" },
      { name: "NousResearch/Hermes-4-405B / Hermes-3-Llama-3.1" },
      { name: "CohereForAI/Command-R-plus / c4ai-command-r7b" },
      { name: "upstage/SOLAR-Open-100B" },
      { name: "lmsys-chatbert · sail/Sailor2-8B" },
      { name: "aisingapore/GemmaSEA-12B" },
      { name: "Falcon-H1R (TII)" },
      { name: "AstraMind-BERT · Ling-1T (InclusionAI)" },
      { name: "Kimi-K2-Instruct / Kimi-K2.5 (Moonshot)" },
      { name: "Llama-3.1-Nemotron-70B" },
      { name: "Sarvam-M (India) · Aya-Expanse (Cohere multilingual)" },
    ],
  },
  {
    id: "coding",
    label: "Coding-specialized",
    blurb: "Dedicated code models — SWE agents to doc parsing.",
    models: [
      { name: "Qwen3-Coder-Next" },
      { name: "Seed-Coder (ByteDance)" },
      { name: "StarCoder2 (BigCode)" },
      { name: "RedPajama-v2 (Together)" },
      { name: "Granite-Docling-2.58B (IBM)" },
      { name: "Laguna-S-2.1", note: "118B/8B MoE · OpenMDW-1.1 · 1M context" },
    ],
  },
  {
    id: "vlm",
    label: "Vision-Language (newer)",
    blurb: "The screenshot-and-video readers.",
    models: [
      { name: "MiniCPM-V-4.6 (openbmb)" },
      { name: "PaliGemma-2 (Google)" },
      { name: "Pixtral-12B (Mistral)" },
      { name: "InternVL3.5 (OpenGVLab)" },
      { name: "Molmo2 (Ai2)" },
      { name: "Eagle-2 / Ovis2" },
    ],
  },
  {
    id: "audio",
    label: "Audio / Speech",
    blurb: "ASR, TTS and full-duplex voice.",
    models: [
      { name: "openai/whisper-large-v3 / whisper-turbo" },
      { name: "facebook/mms-tts · nvidia-parakeet-tdt" },
      { name: "kyutai/Moshi", note: "full-duplex speech" },
      { name: "canary-1b (NVIDIA)" },
    ],
  },
  {
    id: "imagevideo",
    label: "Image / Video",
    blurb: "Diffusion and open video generation.",
    models: [
      { name: "stabilityai/stable-diffusion-3.5 / Stable-Video-Diffusion" },
      { name: "Wan-AI/Wan2.2", note: "open video gen" },
      { name: "HiDream-I1 · SDXL-Lightning" },
      { name: "briaai/RMBG-2.0", note: "background removal" },
    ],
  },
];

// ── 4 · Quick picks ──────────────────────────────────────────────────────────

export const QUICK_PICKS: { label: string; pick: string; why: string }[] = [
  { label: "Best free/open overall", pick: "Qwen3.8-27B", why: "Apache-2.0, multimodal, most downloaded on HF (~7.5M)." },
  { label: "Strongest downloadable", pick: "Kimi K3.1 Pro", why: "Full weights Nov 2 — ranks above most closed models." },
  { label: "Best for coding agents", pick: "GLM 5.2 (MIT) or Qwen3-Coder-480B", why: "SWE-bench Pro 62.1% · the Apache coding flagship, 262K ctx." },
  { label: "Best local / small", pick: "GPT-OSS-20B · Nemotron 3.5 Bolt", why: "Local reasoning + tool calling on a single 24GB GPU." },
  { label: "Best truly-free hosted tiers", pick: "Gemini Flash-Lite · OpenRouter free · Groq", why: "Zero-dollar hosted inference when you can't self-host." },
];

// ── 5 · The $0 stack that powers ShipOS ─────────────────────────────────────

export const SHIPOS_STACK: {
  engine: string;
  models: string;
  kind: ModelKind;
  note: string;
}[] = [
  {
    engine: "LLM copywriting — demo voiceover, optimizer pack, README upgrade",
    models: "GLM 5.2 (MIT) · Qwen3.8-27B (Apache-2.0)",
    kind: "text",
    note: "Every LLM step in ShipOS has a deterministic fallback; these are the permissively-licensed models you can bolt in behind it.",
  },
  {
    engine: "Voiceover + transcription — Render Cloud GPU bursts",
    models: "fishaudio/drama-3 · whisper-large-v3 / turbo · Nemotron-Transcribe",
    kind: "audio",
    note: "Multi-speaker expressive TTS for the narration track; Whisper-class ASR for captions.",
  },
  {
    engine: "Banners + scene art — cinema canvas backplates",
    models: "flux-3-klein · Qwen-Image-2.1",
    kind: "image",
    note: "Deterministic Remotion scenes first; generative backplates only where they earn their keep.",
  },
  {
    engine: "Repo reading — screenshots, docs, diagrams",
    models: "Unlimited-OCR-2 · MiniCPM-OCR-1.0 · Nemotron 3.5 Bolt",
    kind: "ocr",
    note: "200+ language OCR plus a 24GB-GPU VLM for reading what the crawler can't.",
  },
  {
    engine: "Search + dedupe — radar and history rails",
    models: "google/embeddinggemma-2",
    kind: "embedding",
    note: "Semantic search over projects, audits and the model landscape itself.",
  },
  {
    engine: "Agents — the skills layer around all of it",
    models: "GPT-OSS-120B/20B · GLM 5.2",
    kind: "code",
    note: "Apache/MIT tool-calling models drive the ingest claws and fix pipelines as skills.",
  },
];

// ── 6 · Live trackers + caveat ──────────────────────────────────────────────

export const MODEL_TRACKERS: { name: string; href: string; note: string }[] = [
  { name: "huggingface.co/models?sort=trending", href: "https://huggingface.co/models?sort=trending", note: "real-time trending" },
  { name: "llmbenchmark.ai/trending", href: "https://llmbenchmark.ai/trending", note: "30-day release momentum" },
  { name: "github.com/duanyytop/agents-radar", href: "https://github.com/duanyytop/agents-radar", note: "weekly HF trending digest" },
];

export const MODEL_CAVEAT =
  "Snapshot of a fast-moving field. Several \"open\" releases (Meta Muse Spark Open, some Kimi builds) are gated or ship custom terms — license badges below are taken from the cited sources at capture time. Verify on the model page before production use.";
