---
name: destination-matcher
description: Recommend and rank travel destinations by fit using season, budget, duration, preferences, and crowd tolerance. Use when destination is unknown, uncertain, or needs comparison.
---

# Destination Matcher

Goal:
Recommend realistic destinations with transparent tradeoffs.

Inputs:
- Structured trip brief
- Date window or season
- Budget range
- Traveler interests and dislikes

Instructions:
1. Rank by real fit, not popularity.
2. Account for seasonality and trip duration.
3. Explain budget and logistics tradeoffs.
4. Prefer 3-5 strong options.
5. Do not claim live pricing without tool verification.

References:
- Use [destination_scoring.md](references/destination_scoring.md) for score dimensions.

Output format:
- top_destinations
- fit_rationale
- tradeoffs
- budget_fit
- best_for
- watchouts
