export type Mode = "prd" | "build" | "review";
export type Provider = "company-openai" | "anthropic" | "gemini";

export type PromptFields = {
  role: string;
  goal: string;
  context: string;
  constraints?: string;
  output: string;
  extraNotes?: string;
  prdDocument?: string;
  buildPrompt?: string;
  implementationReport?: string;
};

export type GenerateRequest = {
  mode: Mode;
  provider: Provider;
  fields: PromptFields;
  userApiKey?: string;
  model?: string;
};

export const modeLabels: Record<Mode, string> = {
  prd: "PRD / Clarify",
  build: "Build Instruction",
  review: "Review / Red Team"
};

export function validateGenerateRequest(body: unknown): GenerateRequest {
  if (!body || typeof body !== "object") {
    throw new Error("Request body is required.");
  }

  const candidate = body as Partial<GenerateRequest>;
  if (!candidate.mode || !["prd", "build", "review"].includes(candidate.mode)) {
    throw new Error("A valid mode is required.");
  }
  if (!candidate.provider || !["company-openai", "anthropic", "gemini"].includes(candidate.provider)) {
    throw new Error("A valid provider is required.");
  }
  if (candidate.provider !== "company-openai" && candidate.mode !== "build") {
    throw new Error("Personal provider keys are supported on the build screen only.");
  }
  if (candidate.provider !== "company-openai" && !candidate.userApiKey?.trim()) {
    throw new Error("A personal API key is required for this provider.");
  }
  if (!candidate.fields || typeof candidate.fields !== "object") {
    throw new Error("Prompt fields are required.");
  }

  const fields = candidate.fields as Partial<PromptFields>;
  for (const key of ["role", "goal", "context", "output"] as const) {
    if (!fields[key]?.trim()) {
      throw new Error(`${key} is required.`);
    }
  }

  return {
    mode: candidate.mode,
    provider: candidate.provider,
    fields: {
      role: fields.role!.trim(),
      goal: fields.goal!.trim(),
      context: fields.context!.trim(),
      constraints: fields.constraints?.trim(),
      output: fields.output!.trim(),
      extraNotes: fields.extraNotes?.trim(),
      prdDocument: fields.prdDocument?.trim(),
      buildPrompt: fields.buildPrompt?.trim(),
      implementationReport: fields.implementationReport?.trim()
    },
    userApiKey: candidate.userApiKey?.trim(),
    model: candidate.model?.trim()
  };
}

export function buildUserContent(fields: PromptFields) {
  return [
    `Role: ${fields.role}`,
    `Goal: ${fields.goal}`,
    `Context: ${fields.context}`,
    fields.constraints ? `Constraints: ${fields.constraints}` : null,
    fields.prdDocument ? `Original PRD / Plan:\n${fields.prdDocument}` : null,
    fields.buildPrompt ? `Build Prompt / Instructions:\n${fields.buildPrompt}` : null,
    fields.implementationReport ? `Implementation Evidence:\n${fields.implementationReport}` : null,
    `Desired Output: ${fields.output}`,
    fields.extraNotes ? `Additional Notes: ${fields.extraNotes}` : null
  ]
    .filter(Boolean)
    .join("\n");
}

export function getSystemPrompt(mode: Mode) {
  const shared = `You are an expert prompt architect for internal software teams.

The user will provide rough notes and workflow artifacts. Transform them into the requested delivery artifact for a planning, building, and review workflow.

Rules:
- Output only the final artifact text.
- Do not wrap the answer in markdown fences.
- Keep the prompt structured, practical, and directly usable.
- Preserve explicit user constraints.
- Flag assumptions inside the generated prompt when the notes are ambiguous.
- Include validation or review steps whenever useful.`;

  if (mode === "prd") {
    return `${shared}

This mode creates the actual PRD / planning document that later build and review stages will use as the source of truth.
The final artifact should include: overview, users, goals, non-goals, core workflows, requirements, acceptance criteria, data model notes, edge cases, risks, assumptions, and open questions.
Make the document concrete enough for a coding agent to build from, while clearly marking unknowns that need confirmation.`;
  }

  if (mode === "build") {
    return `${shared}

This mode creates an implementation prompt for an agentic coding tool such as Codex or Claude Code.
The final prompt should include: mission, the original PRD, current implementation context, implementation scope, non-goals, files/areas to inspect, exact constraints, step-by-step working expectations, testing/verification steps, and final response format.
It must work for both new builds and existing-code changes, across stacks such as Power Apps, React, SharePoint, Power Automate, LangChain, Node, Python, and SQL.
When the user did not provide exact file paths or stack details, instruct the coding agent to inspect first and adapt to the existing project patterns.
The final response format must require an "Implementation Report" with these sections: Summary, Requirements Covered, Files Changed, Tests Run, Manual QA, Screenshots / URLs, Known Gaps, Risks.`;
  }

  return `${shared}

This mode creates a review prompt that evaluates actual implementation evidence against the original PRD and build prompt.
The final prompt must tell the reviewer not to only critique the prompt. It should compare Original PRD vs Build Prompt vs Implementation Evidence.
The review should require findings first, ordered by severity, with concrete file/behavior references when available.
Include review dimensions: spec coverage, correctness, security, privacy, edge cases, regression risk, maintainability, UX, and test gaps.
Use sections: Must Fix, Should Fix, Spec Gaps, Test Gaps, What Works, Fix Prompt, Questions.`;
}

export function recommendedProviderForMode(mode: Mode): Provider {
  return mode === "build" ? "company-openai" : "company-openai";
}
