# Campaign Studio Dashboard

A single-page frontend (`index.html`, no build step) for the n8n workflow. It shows **only real data** from your workflow and Google Sheet. Nothing is generated in the browser.

| Dashboard feature | Where the data comes from |
|---|---|
| 5 campaign templates | Pre-fill the same 7 fields as the n8n form. No separate flow. |
| Generate Campaign | `POST /webhook/campaign-dashboard-submit` → **Dashboard Trigger** → Dashboard Input → the existing **Campaign Input** → the unchanged 4-agent flow |
| AI Marketing Pipeline | **Status Log** rows. A step gets a ✓ only when n8n reports it. Before the first review lands, the likely current step is highlighted and nothing is ticked. |
| Strategy, Audience, LinkedIn / Instagram / X | The latest `Draft Reviewed` row in the **Status Log** tab (the agents' JSON output) |
| Quality score + 7-criterion breakdown | The same row: `Score` (the weighted score computed in *Evaluate Review*) and `Scores` (from the Review Agent) |
| ✅ Ready for Approval / ⚠️ Needs Improvement | `Score ≥ Threshold` (75), the same rule as the `Score ≥ 75?` node |
| 💡 AI Optimization Suggestions | The `Recommendations` column (the Review Agent's `improvements`). The card is hidden if there are none. |
| Human Approval: Pending / Rejected / Approved | Status Log `Next Step` / `Rejected by Human` events, plus whether a **Campaigns** row exists. You still approve **in the email**, the existing mechanism. |
| Campaign Summary, schedule, ID, created date, drafts | The **Campaigns** row written by `Save to Google Sheets` |

---

## What changed in n8n (additive only)

All 31 original nodes and their connections are byte-for-byte unchanged, apart from the text and size of the ① Intake sticky note.

**Main workflow: 5 new nodes**

| New node | Connected | Purpose |
|---|---|---|
| `Dashboard Trigger` (Webhook, POST `campaign-dashboard-submit`) | → `Dashboard Input` | Second entry point next to the form |
| `Dashboard Input` (Code) | → `Campaign Input` | Reshapes the dashboard JSON into the form's field names |
| `Log Review Event` (Code) | `Evaluate Review` → *(extra output)* → this → `Append Status Log` | One Status Log row per reviewed draft |
| `Log Rejection Event` (Code) | `Approved?` **false** → *(extra output)* → this → `Append Status Log` | Status Log row when the approver rejects |
| `Append Status Log` (Google Sheets, append to `Status Log`) | | Writes those rows |

The log nodes are **side branches** set to *On Error → Continue*. The routing nodes still receive exactly the same data as before, so a logging problem can never block the campaign flow. They sit higher on the canvas, so n8n (execution order v1) runs them *before* the approval email starts waiting.

**New second workflow:** [`../dashboard-data-api.json`](../dashboard-data-api.json), the read-only "Dashboard Data API".
`GET /webhook/campaign-dashboard-data` → Read Campaigns → Read Status Log → Build Dashboard Data → Respond with JSON.

---

## Setup (≈10 minutes, after the main workflow works)

### 1. Add the `Status Log` tab
1. In your **AI Marketing Campaigns** spreadsheet, click **+** (bottom-left) to add a tab, and name it exactly **`Status Log`**.
2. Paste this into **A1**. It's tab-separated, so it fills A to Q.

```text
Timestamp	Campaign ID	Event	Draft	Score	Threshold	Decision	Next Step	Brand	Goal	Brand Voice	Scores	Problems	Recommendations	Strategy	Audience	Content
```
3. Select **A1:Q1**. The bottom-right corner should show **Count: 17**.

The same headers are in `sample-data/status-log-headers.csv`.

### 2. Add the 5 nodes to your existing workflow
You already configured credentials, so **paste** the new nodes rather than re-importing:
1. Open `dashboard/n8n-additions-snippet.json` in a text editor. Select all and copy.
2. Open your workflow in n8n, click an empty area of the canvas, and press **Ctrl+V**. The 5 nodes appear, with 3 connections already between them.
3. Drag them into place:
   - `Dashboard Trigger` + `Dashboard Input`: below the form, in the ① sticky note.
   - `Log Review Event` + `Append Status Log`: **above** `Score ≥ 75?`.
   - `Log Rejection Event`: to the right of `Approved?`, **above** `Prepare Revision`.

   Being above matters: it makes n8n run the log branch first.
4. Draw the 3 connections to existing nodes. Don't remove any existing line.
   - `Dashboard Input` → `Campaign Input`
   - `Evaluate Review` → `Log Review Event`. This is an *extra* line; the one to `Score ≥ 75?` stays.
   - `Approved?` **false** output → `Log Rejection Event`. This is an *extra* line; the one to `Prepare Revision` stays.
5. Open `Append Status Log`:
   - **Credential:** your Google Sheets credential
   - **Document:** By URL → the same spreadsheet URL
   - **Sheet:** `Status Log`
6. Press **Ctrl+S**.

*Alternative:* import `ai-social-media-marketing-automation.json` again as a **new** workflow. It already contains everything. Reconnect the 3 existing credentials and paste the sheet URL into both Sheets nodes. Before activating it, **deactivate the old copy**: both use the same form and webhook paths, so they can't be active at the same time.

### 3. Import the Dashboard Data API workflow
1. **Overview → Create Workflow → ⋯ → Import from File** → `dashboard-data-api.json`.
2. In **`Read Campaigns`** and **`Read Status Log`**:
   - **Credential:** Google Sheets
   - **Document:** By URL → your spreadsheet
   - **Sheet:** `Campaigns` and `Status Log` respectively
3. Save, then toggle **Active**.

### 4. Activate the main workflow
Toggle the main workflow to **Active**. The dashboard uses the production URLs (`/webhook/...`).

### 5. Open the dashboard
1. Double-click `dashboard/index.html`. It opens in your browser; no server needed.
2. Click **⚙︎** → n8n base URL `http://localhost:5678`, mode **Production** → **Test connection**. You should see "✅ Connected".
3. The dot in the top bar turns green.

---

## First dashboard test
1. Click **🎓 Student / EdTech**. The form fills with StudyPilot. Enter your **Approver Email**.
2. Click **Generate Campaign**. The pipeline card appears and the timer starts.
3. Within 1–2 minutes, steps 1–5 turn ✓. The Strategy, Audience, Platform Content, Quality Score and Suggestions cards appear, and Human Approval shows **Pending Approval**.
4. In Gmail, click **✅ Approve & Schedule**. Within about 5 seconds the dashboard shows **Approved & Scheduled**, along with the summary and the publishing schedule.
5. In the sheet, check for one new `Campaigns` row and 1–3 new `Status Log` rows.

| Problem | Fix |
|---|---|
| Red dot / "Can't reach the Dashboard Data API" | The Dashboard Data API workflow isn't **Active**, or the base URL is wrong. In `Dashboard Data Request` → **Options**, make sure **Allowed Origins (CORS)** is `*`. |
| "n8n rejected the request (HTTP 404)" | The main workflow isn't **Active**, or the snippet's `Dashboard Trigger` wasn't saved |
| Pipeline never leaves the first steps | Open **Executions** in n8n and look at the run. If it succeeded, `Append Status Log` may not be connected to the `Status Log` tab. |
| Cards show but text is empty | The `Status Log` headers don't match exactly. Re-paste the header line. |
| Old campaigns show no suggestions or audience details | Expected. Runs from before the Status Log existed only have their Campaigns row. |

`scripts/dashboard-mock-server.js` is a **development-only** stand-in with placeholder text for layout checks. Don't use it in the demo.

---

## 1-minute Loom flow

| Time | On screen |
|---|---|
| 0:00–0:08 | Dashboard home: "an AI marketing automation system: n8n orchestrates four Claude agents." |
| 0:08–0:15 | Click **🎓 Student / EdTech**. The form fills itself. Click **Generate Campaign**. |
| 0:15–0:22 | The pipeline animates: "strategy, audience, content, then a quality review." |
| 0:22–0:35 | Steps tick ✓. Scroll through **AI Strategy**, **Audience Intelligence**, then the **LinkedIn / Instagram / X** cards. |
| 0:35–0:45 | **Quality score** ring and breakdown, then **AI Optimization Suggestions**: "below 75 it rewrites automatically." Point at the draft history if it looped. |
| 0:45–0:55 | **Human Approval: Pending**. Switch to Gmail, click **Approve**, switch back. It shows **Approved & Scheduled**. |
| 0:55–1:00 | **Campaign Summary** + schedule: "saved to Google Sheets and reported." |

The live run takes 1–2 minutes. Either cut the waiting out of the recording, or start the run before recording and open it from **Previous campaigns** (or with `index.html#campaign=CMP-…`). Use your real scores in the voice-over.
