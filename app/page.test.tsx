import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import Home from "./page";

describe("Home", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("keeps personal providers unavailable until the build screen", () => {
    render(<Home />);

    const providerSelect = screen.getByLabelText("Model provider");
    expect(providerSelect).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /Build Instruction/i }));

    expect(providerSelect).not.toBeDisabled();
  });

  it("shows local storage warning in the provider panel", () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Provider" }));

    expect(screen.getByText(/saved only in this browser/i)).toBeInTheDocument();
  });
});
