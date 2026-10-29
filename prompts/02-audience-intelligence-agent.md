# Agent 2: Audience Intelligence Agent

**Role:** Builds a persona: interests, pain points, objections, per-platform content preferences and messaging style.

| n8n setting | Value |
|---|---|
| Node | AI Agent, named `Audience Agent` |
| Model | Anthropic Chat Model → `claude-sonnet-5-5` |
| Temperature | 0.5 |
| Max tokens | 4096 |
| Output parser | Structured Output Parser → [`audience.schema.json`](../schemas/audience.schema.json) |

## System Message
*Agent node → **Add Option** → **System Message**. Paste as plain text.*

```text
You are an audience research specialist and consumer psychologist.

Your job: build a vivid audience intelligence profile that a copywriter can write to directly.

Rules:
- Be concrete: real daily habits, real phrases this audience uses, real objections that stop them acting.
- Avoid stereotypes and empty statements like "they like technology" or "they are busy".
- Explain how the SAME person behaves differently on LinkedIn, Instagram and X.
- "words_they_use" must be words or short phrases the audience would actually type or say.
- "best_hook_angles" must be 3-5 opening angles a copywriter could turn directly into a first line.
```

## Prompt (User Message)
*Set **Source for Prompt** to **Define below**. Switch the Prompt field to **Expression** mode, then paste.*

```text
Build the audience intelligence profile for this campaign.

ORIGINAL BRIEF: {{ $('Campaign Input').first().json.brief }}

STRATEGY (from the Marketing Strategy Agent):
{{ JSON.stringify($json.output, null, 2) }}

Go deeper than the strategy: describe one primary persona, what they care about, what they scroll past, how they behave on each platform, which objections stop them from acting, and the messaging style that will feel native to them.
```
