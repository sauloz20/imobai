import { describe, expect, it } from "vitest";

const modelId = "mistralai/mistral-small-3.1-24b-instruct";
const token = process.env.OPENROUTER_API_KEY;

// Assim como no teste do Hugging Face, esta suíte só faz sentido com uma credencial
// real configurada. Sem OPENROUTER_API_KEY, pulamos em vez de quebrar o `npm test`.
describe("OpenRouter credentials", () => {
  it.skipIf(!token)("accepts the configured key and exposes the requested Mistral model", async () => {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);
    const body = await response.json() as { data?: Array<{ id?: string }> };
    expect(body.data?.some(model => model.id === modelId)).toBe(true);

    const completion = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://imobai-portal.manus.computer",
        "X-OpenRouter-Title": "ImobAI Portal",
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: "Responda apenas: OK" }],
        max_tokens: 8,
      }),
    });

    expect(completion.status).toBe(200);
    const result = await completion.json() as { choices?: Array<{ message?: { content?: string } }> };
    expect(result.choices?.[0]?.message?.content).toBeTruthy();
  }, 30_000);
});
