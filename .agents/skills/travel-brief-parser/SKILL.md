---
name: travel-brief-parser
description: Parse a free-form travel request into a structured trip brief with explicit constraints, missing fields, assumptions, and confidence scores. Use when user input is natural language and downstream skills need normalized JSON.
---

# Travel Brief Parser

Goal:
Extract a structured travel brief from a user message.

Inputs:
- Latest user message
- Conversation context
- Known traveler preferences

Instructions:
1. Extract explicit constraints first.
2. Add soft inferences only when strongly supported.
3. Separate confirmed fields from assumptions.
4. List missing critical fields.
5. Never invent legal requirements, live prices, or exact dates.

Output format:
- brief_summary
- structured_trip_brief
- missing_information
- assumptions
- confidence_scores
