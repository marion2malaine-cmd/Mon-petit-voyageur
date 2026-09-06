import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect } from "vitest";
import App from "../App";

vi.mock("../api", () => {
  return {
    api: {
      getDevTestCredentials: vi.fn().mockReturnValue({
        email: "marion2malaine@gmail.com",
        password: "MonPetitVoyageur123!"
      }),
      me: vi.fn().mockRejectedValue(new Error("no session")),
      register: vi.fn(),
      login: vi.fn(),
      googleLoginUrl: vi.fn(() => "/api/auth/google"),
      logout: vi.fn(),
      planTrip: vi.fn(),
      listTrips: vi.fn().mockResolvedValue([])
    }
  };
});

describe("App", () => {
  it("shows auth form and toggles locale labels", async () => {
    render(<App />);

    expect(await screen.findByRole("heading", { level: 1, name: "Mon Petit Voyageur" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Connexion" })).toBeInTheDocument();

    const languageSelect = screen.getByRole("combobox");
    fireEvent.change(languageSelect, { target: { value: "en" } });

    expect(await screen.findByRole("heading", { level: 2, name: "Login" })).toBeInTheDocument();
  });
});
