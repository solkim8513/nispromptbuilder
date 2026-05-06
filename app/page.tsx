"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Mode, Provider, PromptFields } from "@/lib/prompting";
import { modeLabels } from "@/lib/prompting";

const modes: Array<{ id: Mode; title: string; subtitle: string; icon: string }> = [
  { id: "prd", title: "Plan PRD", subtitle: "Company OpenAI", icon: "01" },
  { id: "build", title: "Build Handoff", subtitle: "OpenAI / Claude / Gemini", icon: "02" },
  { id: "review", title: "Review Result", subtitle: "Company OpenAI", icon: "03" }
];

const providerLabels: Record<Provider, string> = {
  "company-openai": "Company OpenAI",
  anthropic: "Claude / Anthropic",
  gemini: "Gemini"
};

const defaultsByMode: Record<Mode, PromptFields> = {
  prd: {
    role: "Senior product manager and software delivery partner",
    goal: "",
    context: "",
    constraints: "",
    output: "A structured PRD document with requirements, acceptance criteria, risks, assumptions, and open questions.",
    extraNotes: ""
  },
  build: {
    role: "Senior engineer who follows the existing project patterns",
    goal: "Build the product described in the PRD.",
    context: "",
    constraints: "",
    output: "A build prompt for Claude/Codex that includes the PRD, implementation steps, validation steps, and a required Implementation Report return format.",
    extraNotes: ""
  },
  review: {
    role: "Senior code reviewer focused on correctness, UX, maintainability, and spec coverage",
    goal: "Review the actual implementation evidence against the original PRD and build instructions.",
    context: "Use the PRD and build prompt as the standard. Use the implementation report as evidence of what was actually built.",
    constraints: "Do not rewrite from scratch. Prioritize actionable findings.",
    output: "Must Fix, Should Fix, Spec Gaps, Test Gaps, What Works, Fix Prompt, and Questions.",
    extraNotes: ""
  }
};

const examplesByMode: Record<Mode, string[]> = {
  prd: [
    "I have an idea but not a full spec yet.",
    "This is for an internal company tool.",
    "Please include open questions so I can review assumptions."
  ],
  build: [
    "This may be an existing app, so inspect before changing files.",
    "The stack may be Power Apps, React, SharePoint, LangChain, or mixed.",
    "Avoid broad refactors unless required for the requested behavior."
  ],
  review: [
    "Paste the Implementation Report returned by Claude/Codex.",
    "Compare actual evidence against the original PRD.",
    "Generate a concrete fix prompt for the builder."
  ]
};

type WorkflowArtifacts = {
  prdDocument: string;
  buildPrompt: string;
  implementationReport: string;
};

const sectionTitles: Record<Mode, string> = {
  prd: "Plan inputs",
  build: "Build handoff",
  review: "Review evidence"
};

const outputTitles: Record<Mode, string> = {
  prd: "Structured PRD",
  build: "Build prompt for Claude/Codex",
  review: "Review findings and fix prompt"
};

const emptyOutputText: Record<Mode, string> = {
  prd: "Describe the idea, then generate a structured PRD.",
  build: "Confirm the PRD and repo notes, then generate the build handoff.",
  review: "Paste the builder's report, then generate the review prompt."
};

const loadingText: Record<Mode, string> = {
  prd: "Writing a structured PRD...",
  build: "Preparing the build handoff...",
  review: "Preparing the review prompt..."
};

type ProviderSettings = {
  anthropicKey: string;
  anthropicModel: string;
  geminiKey: string;
  geminiModel: string;
};

type GenerateResponse = {
  text?: string;
  providerLabel?: string;
  model?: string;
  error?: string;
};

const settingsKey = "nis-prompt-builder-provider-settings";
const defaultProviderSettings: ProviderSettings = {
  anthropicKey: "",
  anthropicModel: "claude-sonnet-4-20250514",
  geminiKey: "",
  geminiModel: "gemini-2.0-flash"
};

function loadProviderSettings(): ProviderSettings {
  if (typeof window === "undefined") {
    return defaultProviderSettings;
  }

  const saved = window.localStorage.getItem(settingsKey);
  if (!saved) {
    return defaultProviderSettings;
  }

  try {
    return { ...defaultProviderSettings, ...JSON.parse(saved) };
  } catch {
    return defaultProviderSettings;
  }
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("prd");
  const [provider, setProvider] = useState<Provider>("company-openai");
  const [fieldsByMode, setFieldsByMode] = useState<Record<Mode, PromptFields>>(defaultsByMode);
  const [settings, setSettings] = useState<ProviderSettings>(loadProviderSettings);
  const [artifacts, setArtifacts] = useState<WorkflowArtifacts>({
    prdDocument: "",
    buildPrompt: "",
    implementationReport: ""
  });
  const [outputs, setOutputs] = useState<Record<Mode, string>>({
    prd: "",
    build: "",
    review: ""
  });
  const [generatedMetas, setGeneratedMetas] = useState<Record<Mode, string>>({
    prd: "",
    build: "",
    review: ""
  });
  const [showProviderPanel, setShowProviderPanel] = useState(false);
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const output = outputs[mode];
  const generatedMeta = generatedMetas[mode];
  const fields = fieldsByMode[mode];

  useEffect(() => {
    window.localStorage.setItem(settingsKey, JSON.stringify(settings));
  }, [settings]);

  const readiness = useMemo(() => {
    if (mode === "build") {
      if (artifacts.prdDocument && fields.context && fields.constraints) return "Strong";
      if (artifacts.prdDocument && fields.context) return "Good";
      return "Needs context";
    }
    if (mode === "review") {
      if (artifacts.prdDocument && artifacts.buildPrompt && artifacts.implementationReport) return "Strong";
      if (artifacts.prdDocument && artifacts.buildPrompt) return "Good";
      return "Needs evidence";
    }

    const required = [fields.goal, fields.context].filter(Boolean).length;
    if (required === 2 && fields.constraints) return "Strong";
    if (required === 2) return "Good";
    return "Needs context";
  }, [artifacts, fields, mode]);

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setProvider("company-openai");
    setStatus("");
    setCopied(false);
    setShowProviderPanel(false);
  }

  function updateField(key: keyof PromptFields, value: string) {
    setFieldsByMode((current) => ({
      ...current,
      [mode]: {
        ...current[mode],
        [key]: value
      }
    }));
  }

  function providerKeyForCurrentSelection() {
    if (provider === "anthropic") return settings.anthropicKey;
    if (provider === "gemini") return settings.geminiKey;
    return undefined;
  }

  function modelForCurrentSelection() {
    if (provider === "anthropic") return settings.anthropicModel;
    if (provider === "gemini") return settings.geminiModel;
    return undefined;
  }

  function buildFieldsForRequest(): PromptFields {
    return {
      ...fields,
      prdDocument: mode === "build" || mode === "review" ? artifacts.prdDocument : undefined,
      buildPrompt: mode === "review" ? artifacts.buildPrompt : undefined,
      implementationReport: mode === "review" ? artifacts.implementationReport : undefined
    };
  }

  function updateArtifact(key: keyof WorkflowArtifacts, value: string) {
    setArtifacts((current) => ({ ...current, [key]: value }));
  }

  function advanceToBuild() {
    setMode("build");
    setProvider("company-openai");
    setStatus("");
    setCopied(false);
  }

  function advanceToReview() {
    setMode("review");
    setProvider("company-openai");
    setStatus("");
    setCopied(false);
  }

  async function generatePrompt(event: FormEvent) {
    event.preventDefault();
    if (mode === "review" && !artifacts.implementationReport.trim()) {
      setStatus("Paste the builder's Implementation Report before generating a review prompt.");
      return;
    }

    setIsLoading(true);
    setStatus("");
    setCopied(false);
    setOutputs((current) => ({ ...current, [mode]: "" }));
    setGeneratedMetas((current) => ({ ...current, [mode]: "" }));

    try {
      const requestFields = buildFieldsForRequest();
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          provider,
          fields: requestFields,
          userApiKey: providerKeyForCurrentSelection(),
          model: modelForCurrentSelection()
        })
      });
      const data = (await res.json()) as GenerateResponse;
      if (!res.ok || data.error) {
        throw new Error(data.error || "Generation failed.");
      }
      const text = data.text || "";
      setOutputs((current) => ({ ...current, [mode]: text }));
      setGeneratedMetas((current) => ({
        ...current,
        [mode]: `Generated with ${data.providerLabel || providerLabels[provider]}${data.model ? ` (${data.model})` : ""}`
      }));
      if (mode === "prd") {
        setArtifacts((current) => ({ ...current, prdDocument: text }));
      }
      if (mode === "build") {
        setArtifacts((current) => ({ ...current, buildPrompt: text }));
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Generation failed.");
    } finally {
      setIsLoading(false);
    }
  }

  async function copyPrompt() {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function renderProviderControls() {
    if (mode !== "build") {
      return (
        <div className="provider-strip fixed-provider">
          <span>Model provider</span>
          <strong>Company OpenAI</strong>
        </div>
      );
    }

    return (
      <>
        <div className="provider-strip">
          <label htmlFor="provider">Builder model</label>
          <select id="provider" value={provider} onChange={(event) => setProvider(event.target.value as Provider)}>
            <option value="company-openai">Company OpenAI</option>
            <option value="anthropic">Claude / Anthropic</option>
            <option value="gemini">Gemini</option>
          </select>
        </div>

        {showProviderPanel ? (
          <div className="provider-panel">
            <p>Claude and Gemini keys are saved only in this browser. Do not use this option on shared computers.</p>
            <div className="field-pair">
              <label htmlFor="anthropic-key">Claude API key</label>
              <input
                id="anthropic-key"
                type="password"
                value={settings.anthropicKey}
                onChange={(event) => setSettings((current) => ({ ...current, anthropicKey: event.target.value }))}
                placeholder="sk-ant-..."
              />
            </div>
            <div className="field-pair">
              <label htmlFor="anthropic-model">Claude model</label>
              <input
                id="anthropic-model"
                value={settings.anthropicModel}
                onChange={(event) => setSettings((current) => ({ ...current, anthropicModel: event.target.value }))}
              />
            </div>
            <div className="field-pair">
              <label htmlFor="gemini-key">Gemini API key</label>
              <input
                id="gemini-key"
                type="password"
                value={settings.geminiKey}
                onChange={(event) => setSettings((current) => ({ ...current, geminiKey: event.target.value }))}
                placeholder="AIza..."
              />
            </div>
            <div className="field-pair">
              <label htmlFor="gemini-model">Gemini model</label>
              <input
                id="gemini-model"
                value={settings.geminiModel}
                onChange={(event) => setSettings((current) => ({ ...current, geminiModel: event.target.value }))}
              />
            </div>
          </div>
        ) : null}
      </>
    );
  }

  function renderAdvancedFields() {
    return (
      <details className="advanced-panel">
        <summary>Advanced settings</summary>
        <div className="field-pair">
          <label htmlFor={`${mode}-role`}>AI role</label>
          <input id={`${mode}-role`} value={fields.role} onChange={(event) => updateField("role", event.target.value)} required />
        </div>
        <div className="field-pair">
          <label htmlFor={`${mode}-output-format`}>Final answer should include</label>
          <textarea
            id={`${mode}-output-format`}
            value={fields.output}
            onChange={(event) => updateField("output", event.target.value)}
            required
          />
        </div>
      </details>
    );
  }

  function renderPlanFields() {
    return (
      <>
        <div className="screen-card plan-card">
          <div className="field-pair">
            <label htmlFor="original-idea">Original idea</label>
            <textarea
              id="original-idea"
              value={fields.goal}
              onChange={(event) => updateField("goal", event.target.value)}
              placeholder="Tell the planner what you want to make. Plain words are perfect."
              required
            />
          </div>
          <div className="field-pair">
            <label htmlFor="current-context">Current context</label>
            <textarea
              id="current-context"
              value={fields.context}
              onChange={(event) => updateField("context", event.target.value)}
              placeholder="Mention existing app, users, data, screenshots, links, or current process."
              required
            />
          </div>
          <div className="field-pair">
            <label htmlFor="plan-limits">Rules or limits</label>
            <textarea
              id="plan-limits"
              value={fields.constraints || ""}
              onChange={(event) => updateField("constraints", event.target.value)}
              placeholder="Anything the plan must avoid, include, or protect."
            />
          </div>
          <div className="field-pair">
            <label htmlFor="plan-notes">Extra notes</label>
            <textarea
              id="plan-notes"
              value={fields.extraNotes || ""}
              onChange={(event) => updateField("extraNotes", event.target.value)}
              placeholder="Paste rough notes, questions, or team preferences."
            />
          </div>
        </div>
        {renderAdvancedFields()}
      </>
    );
  }

  function renderBuildFields() {
    return (
      <>
        {renderProviderControls()}
        <div className="screen-card build-card">
          <div className="field-pair">
            <label htmlFor="prd-document">Editable PRD from Screen 1</label>
            <textarea
              id="prd-document"
              className="large-textarea"
              value={artifacts.prdDocument}
              onChange={(event) => updateArtifact("prdDocument", event.target.value)}
              placeholder="Generate Screen 1 first, or paste a PRD here."
              required
            />
          </div>
          <div className="field-pair">
            <label htmlFor="repo-context">Repo or app context</label>
            <textarea
              id="repo-context"
              value={fields.context}
              onChange={(event) => updateField("context", event.target.value)}
              placeholder="Tell the builder where this will be built: repo, stack, files, platform, data source, or tools."
              required
            />
          </div>
          <div className="field-pair">
            <label htmlFor="build-constraints">Build guardrails</label>
            <textarea
              id="build-constraints"
              value={fields.constraints || ""}
              onChange={(event) => updateField("constraints", event.target.value)}
              placeholder="What should Claude/Codex avoid changing? Add style, test, or rollout rules."
            />
          </div>
          <div className="field-pair">
            <label htmlFor="builder-notes">Builder notes</label>
            <textarea
              id="builder-notes"
              value={fields.extraNotes || ""}
              onChange={(event) => updateField("extraNotes", event.target.value)}
              placeholder="Optional details to help the builder produce better work."
            />
          </div>
        </div>
        {renderAdvancedFields()}
      </>
    );
  }

  function renderReviewFields() {
    return (
      <>
        {renderProviderControls()}
        <div className="screen-card review-card">
          <div className="field-pair">
            <label htmlFor="review-prd-document">Editable original PRD</label>
            <textarea
              id="review-prd-document"
              value={artifacts.prdDocument}
              onChange={(event) => updateArtifact("prdDocument", event.target.value)}
              placeholder="Generate Screen 1 first, or paste the PRD here."
            />
          </div>
          <div className="field-pair">
            <label htmlFor="review-build-prompt">Editable build prompt</label>
            <textarea
              id="review-build-prompt"
              value={artifacts.buildPrompt}
              onChange={(event) => updateArtifact("buildPrompt", event.target.value)}
              placeholder="Generate Screen 2 first, or paste the build prompt here."
            />
          </div>
          <div className="field-pair primary-evidence">
            <label htmlFor="implementation-report">Builder&apos;s Implementation Report</label>
            <textarea
              id="implementation-report"
              className="large-textarea"
              value={artifacts.implementationReport}
              onChange={(event) => updateArtifact("implementationReport", event.target.value)}
              placeholder="Paste Claude/Codex final report, changed files, test output, screenshots notes, or manual QA notes."
              required
            />
          </div>
          <div className="field-pair">
            <label htmlFor="review-focus">Review focus</label>
            <textarea
              id="review-focus"
              value={fields.extraNotes || ""}
              onChange={(event) => updateField("extraNotes", event.target.value)}
              placeholder="Optional: tell the reviewer what you are most worried about."
            />
          </div>
          <div className="field-pair">
            <label htmlFor="review-limits">Review guardrails</label>
            <textarea
              id="review-limits"
              value={fields.constraints || ""}
              onChange={(event) => updateField("constraints", event.target.value)}
              placeholder="What should the review avoid or prioritize?"
            />
          </div>
        </div>
        {renderAdvancedFields()}
      </>
    );
  }

  return (
    <main className="shell">
      <section className="workspace" aria-label="NIS Prompt Builder">
        <header className="app-header">
          <div>
            <p className="eyebrow">NIS Prompt Builder</p>
            <h1>Coordinate planning, building, and review across multiple AI tools.</h1>
          </div>
          <div className="readiness">
            <span>Readiness</span>
            <strong>{readiness}</strong>
          </div>
        </header>

        <nav className="mode-row" aria-label="Prompt modes">
          {modes.map((item) => (
            <button
              className={`mode-button ${mode === item.id ? "active" : ""}`}
              key={item.id}
              type="button"
              onClick={() => switchMode(item.id)}
            >
              <span className="mode-icon">{item.icon}</span>
              <span>{item.title}</span>
              <small>{item.subtitle}</small>
            </button>
          ))}
        </nav>

        <form className="builder-grid" onSubmit={generatePrompt}>
          <section className="input-panel">
            <div className="section-header">
              <div>
                <p className="eyebrow">{modeLabels[mode]}</p>
                <h2>{sectionTitles[mode]}</h2>
              </div>
              {mode === "build" ? (
                <button className="secondary-button" type="button" onClick={() => setShowProviderPanel((open) => !open)}>
                  Provider keys
                </button>
              ) : null}
            </div>

            {mode === "prd" ? renderPlanFields() : null}
            {mode === "build" ? renderBuildFields() : null}
            {mode === "review" ? renderReviewFields() : null}

            <div className="example-box">
              <strong>Helpful things to include</strong>
              {examplesByMode[mode].map((example) => (
                <span key={example}>{example}</span>
              ))}
            </div>
          </section>

          <section className="output-panel">
            <div className="section-header">
              <div>
                <p className="eyebrow">Final artifact</p>
                <h2>{outputTitles[mode]}</h2>
              </div>
              <button className="secondary-button" type="button" onClick={copyPrompt} disabled={!output}>
                {copied ? "Copied" : "Copy"}
              </button>
            </div>

            <div className={`output-box ${output ? "" : "empty"}`}>
              {isLoading ? loadingText[mode] : output || emptyOutputText[mode]}
            </div>

            {generatedMeta ? <p className="meta-line">{generatedMeta}</p> : null}
            {status ? <p className="error-line">{status}</p> : null}

            <div className="action-row">
              <button className="primary-button" type="submit" disabled={isLoading}>
                {isLoading ? "Generating..." : mode === "prd" ? "Generate PRD" : mode === "build" ? "Generate build prompt" : "Generate review prompt"}
              </button>
            </div>

            {mode === "prd" && output ? (
              <button className="secondary-button followup-button" type="button" onClick={advanceToBuild}>
                Use PRD for build
              </button>
            ) : null}

            {mode === "build" && output ? (
              <button className="secondary-button followup-button" type="button" onClick={advanceToReview}>
                Use build prompt for review
              </button>
            ) : null}
          </section>
        </form>
      </section>
    </main>
  );
}
