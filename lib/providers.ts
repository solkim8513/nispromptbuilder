import type { GenerateRequest } from "./prompting";
import { buildUserContent, getSystemPrompt } from "./prompting";

type ProviderResult = {
  text: string;
  providerLabel: string;
  model: string;
};

function cleanText(text: unknown) {
  return typeof text === "string" ? text.trim() : "";
}

export async function generateWithProvider(request: GenerateRequest): Promise<ProviderResult> {
  if (request.provider === "anthropic") {
    return generateWithAnthropic(request);
  }
  if (request.provider === "gemini") {
    return generateWithGemini(request);
  }
  return generateWithOpenAI(request);
}

async function generateWithOpenAI(request: GenerateRequest): Promise<ProviderResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const model = request.model || process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input: [
        { role: "system", content: getSystemPrompt(request.mode) },
        { role: "user", content: buildUserContent(request.fields) }
      ],
      max_output_tokens: 1400
    })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || "OpenAI request failed.");
  }

  const text =
    cleanText(data.output_text) ||
    cleanText(
      data.output
        ?.flatMap((item: { content?: Array<{ text?: string }> }) => item.content || [])
        ?.map((content: { text?: string }) => content.text || "")
        ?.join("")
    );

  if (!text) {
    throw new Error("OpenAI returned an empty response.");
  }

  return { text, providerLabel: "Company OpenAI", model };
}

async function generateWithAnthropic(request: GenerateRequest): Promise<ProviderResult> {
  const model = request.model || "claude-sonnet-4-20250514";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": request.userApiKey || ""
    },
    body: JSON.stringify({
      model,
      max_tokens: 1400,
      system: getSystemPrompt(request.mode),
      messages: [{ role: "user", content: buildUserContent(request.fields) }]
    })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || "Anthropic request failed.");
  }

  const text = cleanText(data.content?.map((part: { text?: string }) => part.text || "").join(""));
  if (!text) {
    throw new Error("Anthropic returned an empty response.");
  }

  return { text, providerLabel: "Claude / Anthropic", model };
}

async function generateWithGemini(request: GenerateRequest): Promise<ProviderResult> {
  const model = request.model || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(request.userApiKey || "")}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: getSystemPrompt(request.mode) }]
      },
      contents: [
        {
          role: "user",
          parts: [{ text: buildUserContent(request.fields) }]
        }
      ],
      generationConfig: {
        maxOutputTokens: 1400,
        temperature: 0.35
      }
    })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || "Gemini request failed.");
  }

  const text = cleanText(
    data.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("")
  );
  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  return { text, providerLabel: "Gemini", model };
}
