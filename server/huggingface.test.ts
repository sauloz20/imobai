import { describe, expect, it } from "vitest";

const token = process.env.HUGGINGFACE_API_KEY;
const model = process.env.HUGGINGFACE_MODEL || "Qwen/Qwen3.8-27B";

describe("Hugging Face Router", () => {
  it.skipIf(!token)(
    "executa o modelo configurado",
    async () => {
      const response = await fetch(
        "https://router.huggingface.co/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "user",
                content: "Responda apenas: conexãoo funcionando",
              },
            ],
            max_tokens: 30,
            temperature: 0,
          } ),
        },
      );

      const body = await response.json();

      expect(
        response.ok,
        `Erro ${response.status}: ${JSON.stringify(body)}`,
      ).toBe(true);

      expect(body.choices?.[0]?.message?.content).toBeTruthy();
    },
    60_000,
  );
});
