import { describe, expect, it } from "vitest";
import { buildUserContent, getSystemPrompt, validateGenerateRequest } from "./prompting";

const validFields = {
  role: "Senior engineer",
  goal: "Add RSVP editing",
  context: "Existing Power Apps + SharePoint process",
  output: "Build prompt"
};

describe("validateGenerateRequest", () => {
  it("accepts company OpenAI for every mode without a user key", () => {
    const request = validateGenerateRequest({
      mode: "review",
      provider: "company-openai",
      fields: validFields
    });

    expect(request.provider).toBe("company-openai");
    expect(request.mode).toBe("review");
  });

  it("allows personal Claude keys only on the build screen", () => {
    const request = validateGenerateRequest({
      mode: "build",
      provider: "anthropic",
      userApiKey: "sk-ant-test",
      fields: validFields
    });

    expect(request.userApiKey).toBe("sk-ant-test");
  });

  it("rejects personal providers outside the build screen", () => {
    expect(() =>
      validateGenerateRequest({
        mode: "prd",
        provider: "gemini",
        userApiKey: "test",
        fields: validFields
      })
    ).toThrow("build screen only");
  });

  it("rejects missing required prompt fields", () => {
    expect(() =>
      validateGenerateRequest({
        mode: "build",
        provider: "company-openai",
        fields: { ...validFields, goal: "" }
      })
    ).toThrow("goal is required");
  });
});

describe("prompt construction", () => {
  it("includes optional constraints and extra notes when present", () => {
    const content = buildUserContent({
      ...validFields,
      constraints: "Do not rewrite",
      extraNotes: "Use existing patterns"
    });

    expect(content).toContain("Constraints: Do not rewrite");
    expect(content).toContain("Additional Notes: Use existing patterns");
  });

  it("creates a build system prompt that supports mixed technologies", () => {
    const prompt = getSystemPrompt("build");

    expect(prompt).toContain("Power Apps");
    expect(prompt).toContain("LangChain");
    expect(prompt).toContain("inspect first");
  });
});
