---
name: trip-summary-export
description: Merge all planning outputs into a final user-facing summary and structured JSON payload for product rendering or persistence.
---

# Trip Summary Export

Goal:
Assemble a coherent final answer from all completed skills.

Inputs:
- Brief
- Destination result
- Budget
- Research outputs
- Itinerary
- Packing checklist

Instructions:
1. Merge confirmed data first.
2. Separate verified facts from estimates.
3. Keep output scan-friendly.
4. Highlight unresolved checks.
5. Return both readable summary and structured JSON.

Output format:
- traveler_summary
- final_trip_plan
- structured_json
- open_verifications
- next_steps
