import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./page";

describe("Home", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps personal providers unavailable until the build screen", () => {
    render(<Home />);

    const providerSelect = screen.getByLabelText("Model provider");
    expect(providerSelect).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /Build Handoff/i }));

    expect(providerSelect).not.toBeDisabled();
  });

  it("shows local storage warning in the provider panel", () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Provider" }));

    expect(screen.getByText(/saved only in this browser/i)).toBeInTheDocument();
  });

  it("submits prompt inputs and renders the generated prompt", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        text: "Generated test prompt",
        providerLabel: "Company OpenAI",
        model: "test-model"
      })
    } as Response);

    render(<Home />);

    fireEvent.change(screen.getByLabelText("What are you trying to do?"), {
      target: { value: "Create a PRD for an intake tracker." }
    });
    fireEvent.change(screen.getByLabelText("What do you already have?"), {
      target: { value: "Rough notes and a SharePoint list." }
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate PRD" }));

    expect(await screen.findByText("Generated test prompt")).toBeInTheDocument();
    expect(screen.getByText("Generated with Company OpenAI (test-model)")).toBeInTheDocument();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/generate",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" }
      })
    );
  });

  it("forwards generated PRD and build prompt into later workflow stages", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          text: "Structured PRD document",
          providerLabel: "Company OpenAI",
          model: "test-model"
        })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          text: "Build prompt with Implementation Report format",
          providerLabel: "Company OpenAI",
          model: "test-model"
        })
      } as Response);

    render(<Home />);

    fireEvent.change(screen.getByLabelText("What are you trying to do?"), {
      target: { value: "Create a PRD for an intake tracker." }
    });
    fireEvent.change(screen.getByLabelText("What do you already have?"), {
      target: { value: "Rough notes and a SharePoint list." }
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate PRD" }));

    expect(await screen.findByText("Structured PRD document")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Use PRD for build" }));

    expect(screen.getByLabelText("PRD from Screen 1")).toHaveValue("Structured PRD document");

    fireEvent.change(screen.getByLabelText("What are you trying to do?"), {
      target: { value: "Build the intake tracker." }
    });
    fireEvent.change(screen.getByLabelText("What do you already have?"), {
      target: { value: "Existing Next.js app." }
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate build prompt" }));

    expect(await screen.findByText("Build prompt with Implementation Report format")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Use build prompt for review" }));

    expect(screen.getByLabelText("Original PRD")).toHaveValue("Structured PRD document");
    expect(screen.getByLabelText("Build prompt sent to Claude/Codex")).toHaveValue(
      "Build prompt with Implementation Report format"
    );
    expect(screen.getByLabelText("Implementation Report from builder")).toBeInTheDocument();
  });
});
