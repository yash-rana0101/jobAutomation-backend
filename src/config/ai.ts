import { HfInference } from "@huggingface/inference";

let hf: HfInference | null = null;

function getHFClient(): HfInference {
  if (!hf) {
    hf = new HfInference(process.env.HF_API_KEY);
  }
  return hf;
}

export async function generateText(prompt: string, maxTokens = 2048): Promise<string> {
  const client = getHFClient();
  const result = await client.chatCompletion({
    model: "Qwen/Qwen3.5-397B-A17B",
    messages: [{ role: "user", content: prompt }],
    max_tokens: maxTokens,
  });
  return result.choices[0].message.content ?? "";
}
