import type { AppConfig } from "../config";
import { getExchangeRate } from "./exchangeRate";
import { searchFlights, searchForumThreads, searchGetYourGuideOffers, searchHotels, searchRestaurants } from "./serpapi";
import { getEntryRequirements } from "./sherpa";
import { getCheapestMonths, getPriceCalendar } from "./travelpayouts";
import { getWeather } from "./weather";
import { getLocalTransportInfo } from "./googleTransit";
import { findPhoto, findPhotos } from "./photos";
import { findHotelPhoto, type HotelPhotoQuery } from "./googlePlaces";
import { ok, type ToolResult } from "./types";
import type { AppDb } from "../db";

export function createTools(config: AppConfig, db?: AppDb) {
  const ctx = { config };

  return {
    search_flights: (input: {
      originCity: string;
      destinationCity: string;
      departureDate?: string | null;
      returnDate?: string | null;
      adults?: number;
      currency?: string;
      locale?: "fr" | "en";
    }) => searchFlights(ctx, input),

    search_hotels: (input: {
      city: string;
      checkInDate?: string | null;
      checkOutDate?: string | null;
      adults?: number;
      currency?: string;
      locale?: "fr" | "en";
    }) => searchHotels(ctx, input),

    search_restaurants: (input: { area: string; destination: string; locale?: "fr" | "en" }) =>
      searchRestaurants(ctx, input),

    search_forum_tips: (input: { destination: string; locale?: "fr" | "en"; topic?: string | null }) =>
      searchForumThreads(ctx, input),

    search_getyourguide: (input: { destination: string; locale?: "fr" | "en" }) =>
      searchGetYourGuideOffers(ctx, input),

    get_price_calendar: (input: { originCodes: string; destinationCodes: string; month: string; tripDuration: number; currency?: string }) =>
      getPriceCalendar(ctx, input),

    get_cheapest_months: (input: { originCodes: string; destinationCodes: string; tripDuration: number; currency?: string; months?: number }) =>
      getCheapestMonths(ctx, input),

    get_weather: (input: { city: string }) => getWeather(ctx, input),

    get_entry_requirements: (input: {
      nationality: string;
      destination: string;
      departureDate?: string | null;
      returnDate?: string | null;
    }) => getEntryRequirements(ctx, input),

    get_exchange_rate: (input: { from: string; to: string }) => getExchangeRate(ctx, input),

    get_local_transport_info: (input: { origin: string; destination: string }) =>
      getLocalTransportInfo(ctx, input),

    find_photo: (input: { query: string; locale: "fr" | "en"; destination?: string | null }) =>
      findPhoto({ config, locale: input.locale, destination: input.destination }, input.query),

    find_photos: (input: { queries: string[]; locale: "fr" | "en"; destination?: string | null }) =>
      findPhotos({ config, locale: input.locale, destination: input.destination }, input.queries),

    find_hotel_photo: (input: HotelPhotoQuery) => findHotelPhoto(config, input),

    save_trip: async (input: {
      userId: number;
      title: string;
      brief: any;
      plan: any;
      verificationFlags?: string[];
      tripId?: number;
    }): Promise<ToolResult<{ trip_id: number }>> => {
      if (!db) {
        return {
          status: "degraded",
          source: "sqlite",
          verified_at: null,
          data: { trip_id: input.tripId ?? -1 },
          warnings: ["Database tool is not configured"],
          raw_ref: null
        };
      }

      let tripId = input.tripId;
      if (tripId) {
        db.updateTrip({
          userId: input.userId,
          tripId,
          title: input.title,
          brief: input.brief,
          plan: input.plan,
          verificationFlags: input.verificationFlags ?? []
        });
      } else {
        tripId = db.createTrip({
          userId: input.userId,
          title: input.title,
          brief: input.brief,
          plan: input.plan,
          verificationFlags: input.verificationFlags ?? []
        });
      }

      return ok("sqlite", { trip_id: tripId }, "sqlite:trips");
    }
  };
}

export type LiveTools = ReturnType<typeof createTools>;
