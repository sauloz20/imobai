import { ENV } from "./env";
import { invokeLLM, type InvokeParams, type InvokeResult, type Message } from "./llm";

const DEFAULT_HUGGINGFACE_URL = "https://router.huggingface.co/v1/chat/completions";
const DEFAULT_HUGGINGFACE_MODEL = "Qwen/Qwen3.8-27B";
const DEFAULT_OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_OPENROUTER_MODEL = "mistralai/mistral-7b-instruct-v0.3";

function normalizeMessage(message: Message) {
  const content = Array.isArray(message.content)
    ? message.content.map(part => typeof part === "string" ? { type: "text", text: part } : part)
    : typeof message.content === "string"
      ? message.content
      : message.content;

  return {
    role: message.role === "function" ? "tool" : message.role,
    ...(message.name ? { name: message.name } : {}),
    ...(message.tool_call_id ? { tool_call_id: message.tool_call_id } : {}),
    content,
  };
}

function responseFormatFromParams(params: InvokeParams) {
  const explicit = params.responseFormat ?? params.response_format;
  if (explicit) return explicit;

  const schema = params.outputSchema ?? params.output_schema;
  if (!schema) return undefined;

  return {
    type: "json_schema" as const,
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
}

function createPayload(params: InvokeParams, model: string) {
  const payload: Record<string, unknown> = {
    model,
    messages: params.messages.map(normalizeMessage),
  };

  if (params.tools?.length) payload.tools = params.tools;
  if (params.toolChoice ?? params.tool_choice) {
    payload.tool_choice = params.toolChoice ?? params.tool_choice;
  }

  const maxTokens = params.maxTokens ?? params.max_tokens;
  if (typeof maxTokens === "number") payload.max_tokens = maxTokens;

  const responseFormat = responseFormatFromParams(params);
  if (responseFormat) payload.response_format = responseFormat;

  if (params.thinking) payload.thinking = params.thinking;
  if (params.reasoning) payload.reasoning = params.reasoning;

  return payload;
}

async function invokeOpenAICompatible(
  provider: "OpenRouter" | "Hugging Face",
  endpoint: string,
  token: string,
  params: InvokeParams,
  model: string,
): Promise<InvokeResult> {
  const response = await fetch(endpoint.replace(/\/$/, ""), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...(provider === "OpenRouter"
        ? {
            "HTTP-Referer": "https://imobai-portal.manus.computer",
            "X-OpenRouter-Title": "ImobAI Portal",
          }
        : {}),
    },
    body: JSON.stringify(createPayload(params, model)),
    signal: AbortSignal.timeout(30_000),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${provider} request failed: ${response.status} ${response.statusText} – ${body.slice(0, 500)}`);
  }

  return JSON.parse(body) as InvokeResult;
}

export async function invokeHuggingFace(params: InvokeParams): Promise<InvokeResult> {
  if (!ENV.huggingfaceApiKey) throw new Error("HUGGINGFACE_API_KEY is not configured");
  return invokeOpenAICompatible(
    "Hugging Face",
    ENV.huggingfaceApiUrl || DEFAULT_HUGGINGFACE_URL,
    ENV.huggingfaceApiKey,
    params,
    params.model ?? ENV.huggingfaceModel ?? DEFAULT_HUGGINGFACE_MODEL,
  );
}

export async function invokeOpenRouter(params: InvokeParams): Promise<InvokeResult> {
  if (!ENV.openrouterApiKey) throw new Error("OPENROUTER_API_KEY is not configured");
  return invokeOpenAICompatible(
    "OpenRouter",
    ENV.openrouterApiUrl || DEFAULT_OPENROUTER_URL,
    ENV.openrouterApiKey,
    params,
    ENV.openrouterModel || DEFAULT_OPENROUTER_MODEL,
  );
}

/**
 * OpenRouter is preferred because it exposes the exact Mistral model as a
 * compatible chat/text-generation API. Hugging Face and the built-in provider
 * remain resilient fallbacks when the external provider is unavailable.
 */
export async function invokeAgentLLM(params: InvokeParams): Promise<InvokeResult> {
  if (ENV.openrouterApiKey) {
    try {
      return await invokeOpenRouter(params);
    } catch (error) {
      console.warn(
        "[ImobAI] OpenRouter unavailable; trying Hugging Face:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  if (ENV.huggingfaceApiKey) {
    try {
      return await invokeHuggingFace(params);
    } catch (error) {
      console.warn(
        "[ImobAI] Hugging Face unavailable; using configured fallback provider:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  return invokeLLM(params);
}

export const HUGGINGFACE_MODEL = DEFAULT_HUGGINGFACE_MODEL;
export const OPENROUTER_MODEL = DEFAULT_OPENROUTER_MODEL;

