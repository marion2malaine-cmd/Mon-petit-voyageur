import { render, screen, fireEvent, act, waitFor, cleanup } from "@testing-library/react";
import { vi, describe, it, expect, afterEach } from "vitest";
import App from "../App";
import { api } from "../api";
vi.mock("../Plane3D", () => ({ default: () => <div>Globe</div> }));

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
  afterEach(cleanup);
  it("shows auth form and toggles locale labels", async () => {
    render(<App />);

    expect(await screen.findByRole("heading", { level: 1, name: "Mon Petit Voyageur" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Connexion" })).toBeInTheDocument();

    const languageSelect = screen.getByRole("combobox");
    fireEvent.change(languageSelect, { target: { value: "en" } });

    expect(await screen.findByRole("heading", { level: 2, name: "Login" })).toBeInTheDocument();
  });
  it("keeps the exact description across session expiry and sends the latest text", async () => {
    const account = { id: 1, preferred_language: "fr", has_access: true, billing_enabled: false } as any;
    vi.mocked(api.me).mockResolvedValueOnce(account);
    vi.mocked(api.login).mockResolvedValueOnce(account);
    vi.mocked(api.planTrip).mockRejectedValueOnce(new Error("test planning error"));
    render(<App />);
    const input = await screen.findByRole("textbox", { name: /Précisions/ });
    fireEvent.change(input, { target: { value: "Voyage à Kyoto avec deux enfants" } });
    fireEvent.change(input, { target: { value: "Voyage à Kyoto avec deux enfants, sans voiture" } });
    act(() => window.dispatchEvent(new Event("mlt:session-expired")));
    expect(await screen.findByText(/Votre session a expiré/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Connexion" }));
    expect(await screen.findByRole("textbox", { name: /Précisions/ })).toHaveValue("Voyage à Kyoto avec deux enfants, sans voiture");
    fireEvent.click(screen.getByRole("button", { name: "Lancer l'agent" }));
    await waitFor(() => expect(api.planTrip).toHaveBeenCalledWith(expect.objectContaining({ message: "Voyage à Kyoto avec deux enfants, sans voiture" })));
    expect(await screen.findByText("test planning error")).toBeInTheDocument();
  });

});
