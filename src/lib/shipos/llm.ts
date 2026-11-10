// ─────────────────────────────────────────────────────────────────────────────
// ShipOS — LLM bridge (backend only). Strict-JSON chat with retry + fallback.
// ─────────────────────────────────────────────────────────────────────────────
import ZAI from "z-ai-web-dev-sdk";
import type { ZodType } from "zod";

export async function chatJson<T>(opts: {
  system: string;
  user: string;
  schema: ZodType<T>;
  retries?: number;
  maxTokens?: number;
}): Promise<T | null> {
  const retries = opts.retries ?? 2;
  let zai: Awaited<ReturnType<typeof ZAI.create>>;
  try {
    zai = await ZAI.create();
  } catch (err) {
    console.error("[shipos:llm] ZAI.create failed:", err);
    return null;
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const completion = await zai.chat.completions.create({
        messages: [
          { role: "assistant", content: opts.system },
          { role: "user", content: opts.user },
        ],
        thinking: { type: "disabled" },
        ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
      });
      const raw = completion.choices[0]?.message?.content ?? "";
      const parsed = extractJson(raw);
      if (parsed == null) throw new Error("no JSON found in response");
      const result = opts.schema.safeParse(parsed);
      if (result.success) return result.data;
      throw new Error(`schema mismatch: ${result.error.message.slice(0, 200)}`);
    } catch (err) {
      console.error(`[shipos:llm] attempt ${attempt + 1} failed:`, err instanceof Error ? err.message : err);
      if (attempt < retries) await new Promise((r) => setTimeout(r, 900 * (attempt + 1)));
    }
  }
  return null;
}

/** Extract the outermost JSON object from an LLM response (handles code fences). */
export function extractJson(raw: string): unknown {
  if (!raw) return null;
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}
