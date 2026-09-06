---
name: flight-hotel-research
description: Compare flight and accommodation options using live data sources, and present concise tradeoffs by price, duration, comfort, and cancellation flexibility.
---

# Flight Hotel Research

Goal:
Produce curated flight and stay options aligned to traveler priorities.

Inputs:
- Origin and destination
- Dates
- Budget
- Preferences

Instructions:
1. Query live tools when available. When the input carries `live_prices`, those
   are real Google Flights / Google Hotels results already fetched for these dates:
   copy them as-is into `recommended_flights` / `recommended_stays` and comment on
   them. Never invent a price, a fare or a hotel that is not in `live_prices`; if it
   is empty, leave those arrays empty and say why in `tradeoff_notes`.
2. Rank by relevance, not only lowest price.
3. Explain tradeoffs (price, time, comfort, location, flexibility).
4. Keep shortlist compact.
5. Mark stale/unverified data.

## Ground transport — always required

Fill `ground_transport`. This is the first money the traveler spends on
arrival, and the most often forgotten. It is required whether or not a car is
rented.

### `airport_to_center`

List **every realistic way** to get from the arrival airport to the city centre
or the chosen accommodation — typically 3 to 5 entries covering the cheap end
and the door-to-door end:

- the metro, tram, train or public bus line, with its actual line name;
- the dedicated airport shuttle, if one exists;
- the official taxi (flat fare when the city has one);
- the ride-hailing option (Uber, Bolt, FreeNow) with a realistic fare range.

For each entry give:

- `price_per_person_eur` and, when the group changes the maths (a taxi split
  four ways beats four metro tickets), `price_group_eur` for the whole party;
- `price_note`: the exact wording of the fare ("4,50 € l'aller, 8 € l'aller-
  retour", "forfait 25 € jour / 30 € nuit et dimanche");
- `duration` and `frequency`;
- `last_departure`: the last service of the day. A metro that stops at 23h is
  useless for a flight landing at 23h30 — say it in `notes`.
- `notes`: luggage room, stairs, night surcharge, where to buy the ticket,
  whether the driver takes cards.

Set `recommended` to one sentence naming the best option **for this group**,
with the reason (price, luggage, children, arrival time).

### `city_transport`

The cost of moving around during the stay: `single_ticket_eur`, `day_pass_eur`,
any multi-day or tourist card in `multi_day_pass`, and whether the pass is
worth it in `notes`. Set `estimated_total_eur` for the whole group over the
whole stay — and put 0 when the centre is walkable, saying so in `notes`.

### `total_estimate_eur`

Airport transfers (both ways, whole group) plus city transport. This is the
number the budget uses, so keep it realistic rather than optimistic.

Leave `booking_links` and `search_links` empty: the application builds them.

## Car rental pickup

Fill `car_rental.recommended.pickup` and `pickup_note` with what you know about
the arrival airport specifically:

- `in_terminal` — rental desks are inside the terminal building.
- `shuttle` — the desks or the car park are off-site and a shuttle bus is
  required; say roughly how long the transfer takes.
- `off_airport` — the cheap suppliers are in town, not at the airport at all.
- `unknown` — say so rather than guessing.

Write `pickup_note` as one concrete sentence, e.g. "À Héraklion, les grandes
enseignes sont dans le hall des arrivées, mais les loueurs low-cost sont à
5 minutes en navette." Leave prices, categories, alerts and links empty: the
application computes them from the budget.

Output format:
- recommended_flights
- recommended_stays
- car_rental (pickup and pickup_note only)
- tradeoff_notes
- best_choice_by_profile
- live_data_status
