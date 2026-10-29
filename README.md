# AI-Powered Social Media Marketing Automation
### n8n + Claude AI Agents

You enter one campaign brief, for example *"Launch an AI productivity tool for college students"*. Four Claude agents then plan the campaign, write separate posts for LinkedIn, Instagram and X, and score the posts out of 100. Drafts scoring below 75 go back for a rewrite. A human approves the result from their inbox, and the workflow then schedules the posts, saves everything to Google Sheets and emails a campaign summary.

**Built with:** n8n (orchestration) · Claude Sonnet 5.5 (Anthropic API) · Google Sheets · Gmail

---

## How it works

```
Form ─► Campaign Input ─► Strategy Agent ─► Audience Agent ─► Content Agent ─► Review Agent ─► Evaluate Review
                                                                  ▲                                │
                                                                  │      score < 75 & retries left │
                                                                  └──────── Prepare Revision ◄─────┤
                                                                                 ▲                 │ score ≥ 75
                                                                        rejected │                 ▼
                     Email Report ◄─ Google Sheets ◄─ Summary ◄─ Schedule ◄─ Approved? ◄─ Human Approval (Gmail)
```

| # | Agent | Job | Output |
|---|---|---|---|
| 1 | **Marketing Strategy Agent** | Turns the brief into an objective, audience, pain points, campaign angle, tone and CTA | `schemas/strategy.schema.json` |
| 2 | **Audience Intelligence Agent** | Builds a persona: interests, objections, platform habits, messaging style | `schemas/audience.schema.json` |
| 3 | **Content Creation Agent** | Writes a separate LinkedIn post, Instagram caption and X post with thread, each with its own hook, CTA and hashtags | `schemas/content.schema.json` |
| 4 | **Content Review Agent** | Scores 7 criteria, lists problems and fixes, returns APPROVE or REGENERATE | `schemas/review.schema.json` |

The other steps run as plain Code nodes or a single LLM call. They are deterministic or simple, so they don't need to be agents:
- **Evaluate Review:** computes the weighted score in code, so the AI doesn't grade its own work.
- **Prepare Revision:** packages the reviewer's feedback for the next draft.
- **Publishing Schedule:** builds a 6-post launch plan from best-practice posting times.
- **Campaign Summary:** writes the final report.

**Quality gate:** overall score ≥ 75 → human approval. Below 75 → rewrite, up to 3 drafts. If the third draft still misses, it goes to a human with a ⚠️ warning.

---

## Project structure

```
├── README.md                     ← you are here
├── workflow/
│   └── ai-social-media-marketing-automation.json   ← import this into n8n
├── prompts/                      ← system message + prompt + settings for each agent
│   ├── 01-marketing-strategy-agent.md
│   ├── 02-audience-intelligence-agent.md
│   ├── 03-content-creation-agent.md
│   ├── 04-content-review-agent.md
│   └── 05-campaign-summary.md
├── schemas/                      ← JSON Schemas for the Structured Output Parsers
├── code-nodes/                   ← JavaScript for the 4 n8n Code nodes
├── sample-data/
│   ├── sample-campaign-input.json   ← demo campaign (StudyPilot)
│   └── google-sheets-headers.csv    ← header row for the Google Sheet
├── docs/
│   ├── BUILD_GUIDE.md            ← detailed node-by-node build + testing guide
│   └── LOOM_DEMO.md              ← 2–3 minute recording plan and script
└── scripts/
    └── build-workflow.js         ← single source of truth; regenerates workflow/prompts/schemas/code-nodes
```

---

## Setup (about 20 minutes)

### 1. Prerequisites
- **n8n:** either [n8n Cloud](https://n8n.io) (easiest) or self-hosted with `npx n8n` (Node.js 20+), then open http://localhost:5678. Use a 2025 or later version.
- **Claude API key:** go to console.anthropic.com → **Settings → API Keys → Create Key**, and add some billing credit.
- **A Google account** for Sheets and Gmail.

### 2. Create the credentials in n8n
In n8n, go to **Overview → Create → Credential** and create:
1. **Anthropic:** paste your API key, then **Save**.
2. **Google Sheets OAuth2 API:** click **Sign in with Google**.
3. **Gmail OAuth2 API:** click **Sign in with Google**.

If you self-host, you first need your own Google OAuth client. See `docs/BUILD_GUIDE.md` §1.3.

### 3. Create the Google Sheet
1. Create a new sheet and rename its first tab to **`Campaigns`**.
2. Paste the header row from `sample-data/google-sheets-headers.csv` into row 1. The names must match exactly.

### 4. Import the workflow
1. In n8n, create a new workflow, then **⋯ → Import from File** → `workflow/ai-social-media-marketing-automation.json`.
2. Assign your **Anthropic** credential to the 5 `Claude · …` nodes. If the model isn't listed, set **Model** → **By ID** → `claude-sonnet-5-5`.
3. Assign **Gmail** to `Human Approval` and `Email Final Report`.
4. In `Save to Google Sheets`, assign your credential, paste your sheet URL and choose the `Campaigns` sheet.
5. Press **Ctrl+S** to save.

### 5. Run it
1. Click **Test workflow**. The form opens in a new tab.
2. Fill it in with the values from `sample-data/sample-campaign-input.json`, using your own email as the approver.
3. After 1–2 minutes the approval email arrives. Click **✅ Approve & Schedule**.
4. Check the new row in your sheet and the summary email.

For a permanent link, toggle the workflow to **Active** and use the form's **Production URL**.

Step-by-step test cases (forcing the loop, testing rejection, testing the happy path) are in `docs/BUILD_GUIDE.md` Part 5.

---

## Customising

| What | Where |
|---|---|
| Quality threshold (75) or max drafts (3) | `Campaign Input` node → `quality_threshold`, `max_attempts` |
| Prompts | Edit them in the n8n node directly, **or** edit `scripts/build-workflow.js` and run `node scripts/build-workflow.js` from the project root to regenerate everything |
| Score weights | `code-nodes/evaluate-review.js` → `weights` |
| Posting times | `code-nodes/publishing-schedule.js` → `slots` |

---

## Security

- API keys and OAuth secrets live **only** in n8n's encrypted credential store. Exported workflow JSON contains no secrets.
- `.gitignore` blocks `.env` files and Google client-secret files. Never commit real keys.

## Dashboard

[`dashboard/index.html`](dashboard/index.html) is a SaaS-style frontend with templates, a live pipeline, strategy/audience/content cards, the quality score, suggestions, approval status and the summary. It reads real data through the read-only **Dashboard Data API** workflow (`dashboard-data-api.json`). Setup and the 1-minute Loom flow are in [`dashboard/README.md`](dashboard/README.md).

> The newest workflow and dashboard files are in the **project root** (`ai-social-media-marketing-automation.json`, `build-workflow.js`, `dashboard-data-api.json`). The copies in `workflow/` and `scripts/` predate the latest fixes.

## Demo

See [`docs/LOOM_DEMO.md`](docs/LOOM_DEMO.md) for the 2–3 minute Loom script, demo input and recording checklist.
