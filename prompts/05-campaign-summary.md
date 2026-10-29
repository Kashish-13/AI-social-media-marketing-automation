# Campaign Summary (single LLM call, not an agent)

**Role:** Writes the final plain-text campaign report that is saved to Google Sheets and emailed.

| n8n setting | Value |
|---|---|
| Node | Basic LLM Chain, named `Campaign Summary` |
| Model | Anthropic Chat Model → `claude-sonnet-5-5` |
| Temperature | 0.3 |
| Max tokens | 4096 |

## Prompt (User Message)
*Set **Source for Prompt** to **Define below**. Switch the Prompt field to **Expression** mode, then paste.*

```text
Write a campaign summary report for the marketing team.

Format: plain text, max 250 words, short headings in CAPITALS, "-" bullets. Do not use markdown symbols such as ** or #.

Include these sections:
CAMPAIGN: name, product and objective
AUDIENCE: one line
BIG IDEA: the campaign angle and key message
CONTENT: one line per platform describing what that post does
QUALITY: final score and how many drafts it took
SCHEDULE: the publishing schedule
WEEK-ONE KPIs: 3 measurable KPIs to track

DATA
Product: {{ $('Campaign Input').first().json.brand_name }}
Strategy: {{ JSON.stringify($('Strategy Agent').first().json.output) }}
Persona: {{ JSON.stringify($('Audience Agent').first().json.output.persona) }}
Tagline: {{ $('Evaluate Review').last().json.content.campaign_tagline }}
Final quality score: {{ $('Evaluate Review').last().json.overall_score }}/100 after {{ $('Evaluate Review').last().json.attempt }} draft(s)
Schedule:
{{ $json.schedule_text }}
```
