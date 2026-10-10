import { createOpenAI } from "@ai-sdk/openai";
import { streamText, Output, NoObjectGeneratedError } from "ai";
import type { z } from "zod";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";

export class AiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

function friendly(status: number, fallback: string) {
  if (status === 429) return "The AI service is busy right now. Please wait a moment and try again.";
  if (status === 402) return "AI credits have run out for this workspace. Add credits in Settings → Plans & credits.";
  if (status === 403) return "AI access is currently blocked for this workspace.";
  if (status === 401) return "The AI service is not configured.";
  return fallback;
}

/** Streamed structured call; consumed server-side, returns the parsed object. */
export async function structuredCall<T>(opts: {
  schema: z.ZodType<T>;
  instructions: string;
  prompt: string;
}): Promise<T> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new AiError("The AI service is not configured.", 401);
  let runId: string | undefined;
  let status = 200;
  const provider = createOpenAI({
    baseURL: GATEWAY,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers);
      if (runId) headers.set("X-Lovable-AIG-Run-ID", runId);
      const res = await fetch(input, { ...init, headers });
      runId ??= res.headers.get("X-Lovable-AIG-Run-ID") ?? undefined;
      status = res.status;
      return res;
    },
  });
  let streamError: unknown;
  const result = streamText({
    model: provider.responses(MODEL),
    instructions: opts.instructions,
    prompt: opts.prompt,
    output: Output.object({ schema: opts.schema }),
    onError: ({ error }) => {
      streamError = error;
    },
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  } as Parameters<typeof streamText>[0]);
  try {
    const out = (await result.output) as T;
    return out;
  } catch (e) {
    console.error("AI call failed", status, streamError ?? e);
    if (status >= 400) throw new AiError(friendly(status, "The AI analysis failed."), status);
    if (NoObjectGeneratedError.isInstance(e)) {
      throw new AiError("The AI returned an unreadable answer for this batch.", 502);
    }
    throw new AiError("The AI analysis failed. Please try again.", 500);
  }
}
