"""Natural-language parser service using Claude API.

Converts free-text input into structured Log_Entry records for the
Compound habit tracker. Handles gym, sleep, hydration, and protein entries.
"""

import asyncio
import json
from typing import Optional

import anthropic


EXCLUDED_CATEGORIES = {"cardio", "schoolwork", "canvas", "sms"}

SUPPORTED_CATEGORIES = {"gym", "sleep", "hydration", "habit"}


class NLParserService:
    """Wraps Claude API calls for natural-language log entry parsing."""

    def __init__(self, api_key: str):
        self.client = anthropic.AsyncAnthropic(api_key=api_key)

    async def parse_input(self, text: str, today: str) -> dict:
        """Parse free-text input into structured log entries.

        Args:
            text: Free-text input (up to 2000 chars) describing habits/workouts.
            today: ISO 8601 date string (YYYY-MM-DD) used as default date.

        Returns:
            dict with keys:
                "entries": list of dicts with category, metric, value, notes, date
                "errors": list of strings describing unparseable portions

        Raises:
            TimeoutError: If Claude API does not respond within 30 seconds.
            ValueError: If Claude returns invalid/unparseable JSON.
        """
        prompt = self.build_prompt(text, today)

        try:
            response = await asyncio.wait_for(
                self.client.messages.create(
                    model="claude-sonnet-4-20250514",
                    max_tokens=1024,
                    messages=[{"role": "user", "content": prompt}],
                ),
                timeout=30.0,
            )
        except asyncio.TimeoutError:
            raise TimeoutError("Claude API did not respond within 30 seconds")

        # Extract text content from response
        raw_text = response.content[0].text

        # Parse JSON from response
        try:
            parsed = json.loads(raw_text)
        except json.JSONDecodeError:
            # Try to extract JSON from markdown code blocks
            parsed = self._extract_json(raw_text)
            if parsed is None:
                raise ValueError(
                    f"Could not parse Claude response as valid JSON: {raw_text[:200]}"
                )

        # Validate structure
        entries = parsed.get("entries", [])
        errors = parsed.get("errors", [])

        # Filter out excluded categories
        filtered_entries = [
            entry
            for entry in entries
            if entry.get("category", "").lower() not in EXCLUDED_CATEGORIES
            and entry.get("category", "").lower() in SUPPORTED_CATEGORIES
        ]

        # Ensure all entries have required fields and default date
        validated_entries = []
        for entry in filtered_entries:
            validated = {
                "category": entry.get("category", ""),
                "metric": entry.get("metric", ""),
                "value": float(entry.get("value", 0)),
                "notes": entry.get("notes"),
                "date": entry.get("date") or today,
            }
            validated_entries.append(validated)

        return {"entries": validated_entries, "errors": errors}

    def build_prompt(self, text: str, today: str) -> str:
        """Build the Claude prompt with schema instructions.

        Args:
            text: The user's free-text input.
            today: ISO 8601 date string for date defaulting.

        Returns:
            Complete prompt string for Claude API.
        """
        return f"""You are a structured data parser for a personal habit and gym tracking app.
Parse the following free-text input into structured log entries.

RULES:
1. Only parse entries for these supported categories: gym, sleep, hydration, habit
2. IGNORE any mentions of: cardio, schoolwork, Canvas, SMS, or other unsupported categories
3. If no date is mentioned in the text, use "{today}" as the date for all entries
4. If a specific date is mentioned, use that date in ISO 8601 format (YYYY-MM-DD)

CATEGORY MAPPING:
- Gym exercises: category "gym", metric = exercise name (lowercase), value = weight in lbs, notes = "{{reps}}r x {{sets}}s"
- Sleep quality: category "sleep", metric "sleep_quality", value = quality rating 1-10
- Water/hydration: category "hydration", metric "oz_water", value = ounces of water
- Protein: category "habit", metric "protein_g", value = grams of protein

EXAMPLES:
- "bench press 185 for 3x8" → {{"category": "gym", "metric": "bench press", "value": 185, "notes": "8r x 3s", "date": "{today}"}}
- "slept 7/10" → {{"category": "sleep", "metric": "sleep_quality", "value": 7, "notes": null, "date": "{today}"}}
- "drank 80oz water" → {{"category": "hydration", "metric": "oz_water", "value": 80, "notes": null, "date": "{today}"}}
- "had 150g protein" → {{"category": "habit", "metric": "protein_g", "value": 150, "notes": null, "date": "{today}"}}

OUTPUT FORMAT:
Return ONLY valid JSON (no markdown, no explanation) in this exact format:
{{
  "entries": [
    {{"category": "string", "metric": "string", "value": number, "notes": "string or null", "date": "YYYY-MM-DD"}}
  ],
  "errors": ["string descriptions of any parts that could not be parsed"]
}}

If nothing can be parsed, return {{"entries": [], "errors": ["Could not parse any valid entries from the input"]}}

USER INPUT:
{text}"""

    def _extract_json(self, text: str) -> Optional[dict]:
        """Attempt to extract JSON from text that may contain markdown code blocks."""
        # Try stripping markdown code fences
        stripped = text.strip()
        if stripped.startswith("```"):
            lines = stripped.split("\n")
            # Remove first line (```json or ```) and last line (```)
            json_lines = []
            in_block = False
            for line in lines:
                if line.strip().startswith("```") and not in_block:
                    in_block = True
                    continue
                elif line.strip() == "```" and in_block:
                    break
                elif in_block:
                    json_lines.append(line)
            if json_lines:
                try:
                    return json.loads("\n".join(json_lines))
                except json.JSONDecodeError:
                    pass

        # Try finding JSON object in the text
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(text[start : end + 1])
            except json.JSONDecodeError:
                pass

        return None
