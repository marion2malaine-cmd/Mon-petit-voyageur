import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import TripCompanion from "../TripCompanion";
import { api } from "../api";
vi.mock("../api", () => ({ api: { editItinerary: vi.fn() } }));
it("saves activity choices and does not claim success when saving fails", async () => {
  const result = { trip_id: 1, structured_json: { itinerary: { itinerary_by_day: [{ day: 1, title: "Paris", free_visits: [], restaurants: [], paid_options: [{ title: "Musée", price_from_eur: 20, price_source: "estimate" }] }] } } };
  const onChange = vi.fn();
  vi.mocked(api.editItinerary).mockResolvedValueOnce(result as any).mockRejectedValueOnce(new Error("offline"));
  render(<TripCompanion result={result} onChange={onChange} locale="fr" />);
  fireEvent.click(screen.getByLabelText("Inclure dans mon parcours et mon budget"));
  await waitFor(() => expect(onChange).toHaveBeenCalledWith(result));
  expect(api.editItinerary).toHaveBeenCalledWith(1, expect.objectContaining({ action: "select", selected: true }));
  await waitFor(() => expect(screen.getByLabelText("Inclure dans mon parcours et mon budget")).not.toBeDisabled());
  fireEvent.click(screen.getByLabelText("Inclure dans mon parcours et mon budget"));
  expect(await screen.findByRole("alert")).toHaveTextContent("Modification non enregistrée");
  expect(onChange).toHaveBeenCalledTimes(1);
});
