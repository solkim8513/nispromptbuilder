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

    expect(screen.queryByLabelText("Builder model")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Build Handoff/i }));

    expect(screen.getByLabelText("Builder model")).not.toBeDisabled();
  });

  it("shows local storage warning in the provider panel", () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: /Build Handoff/i }));
    fireEvent.click(screen.getByRole("button", { name: "Provider keys" }));

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

    fireEvent.change(screen.getByLabelText("Original idea"), {
      target: { value: "Create a PRD for an intake tracker." }
    });
    fireEvent.change(screen.getByLabelText("Current context"), {
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

    fireEvent.change(screen.getByLabelText("Original idea"), {
      target: { value: "Create a PRD for an intake tracker." }
    });
    fireEvent.change(screen.getByLabelText("Current context"), {
      target: { value: "Rough notes and a SharePoint list." }
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate PRD" }));

    expect(await screen.findByText("Structured PRD document")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Use PRD for build" }));

    expect(screen.getByLabelText("Editable PRD from Screen 1")).toHaveValue("Structured PRD document");
    expect(screen.queryByLabelText("Original idea")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Repo or app context"), {
      target: { value: "Existing Next.js app." }
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate build prompt" }));

    expect(await screen.findByText("Build prompt with Implementation Report format")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Use build prompt for review" }));

    expect(screen.getByLabelText("Editable original PRD")).toHaveValue("Structured PRD document");
    expect(screen.getByLabelText("Editable build prompt")).toHaveValue("Build prompt with Implementation Report format");
    expect(screen.getByLabelText("Builder's Implementation Report")).toBeInTheDocument();
  });

  it("keeps Screen 1 inputs after moving through later stages", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        text: "Structured PRD document",
        providerLabel: "Company OpenAI",
        model: "test-model"
      })
    } as Response);

    render(<Home />);

    fireEvent.change(screen.getByLabelText("Original idea"), {
      target: { value: "Create a simple school lunch voting app." }
    });
    fireEvent.change(screen.getByLabelText("Current context"), {
      target: { value: "Students vote once per day." }
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate PRD" }));

    expect(await screen.findByText("Structured PRD document")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Use PRD for build" }));
    fireEvent.click(screen.getByRole("button", { name: /Plan PRD/i }));

    expect(screen.getByLabelText("Original idea")).toHaveValue("Create a simple school lunch voting app.");
    expect(screen.getByLabelText("Current context")).toHaveValue("Students vote once per day.");
  });
});
