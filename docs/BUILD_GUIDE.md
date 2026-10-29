# AI-Powered Social Media Marketing Automation: Build Guide (n8n + Claude)

You type one campaign brief into a form. Four Claude agents then plan the campaign, write posts made for each platform, score the posts out of 100, and rewrite them until they pass. You approve the result from your inbox, and the workflow schedules the posts, saves everything to Google Sheets and emails you a summary.

All paths below are relative to the project root. See the [README](../README.md) for the folder layout.

---

## Part 0: The architecture

```
① INTAKE            ② AI STRATEGY BRAIN                 ③ CREATE → REVIEW → IMPROVE LOOP
┌──────────┐   ┌─────────┐   ┌──────────┐   ┌──────────┐   ┌─────────┐   ┌────────┐   ┌──────────┐   ┌────────────┐
│ Campaign │ → │Campaign │ → │ Strategy │ → │ Audience │ → │ Start   │ → │Content │ → │ Review   │ → │ Evaluate   │
│ Brief    │   │ Input   │   │ Agent 🤖 │   │ Agent 🤖 │   │ First   │   │Agent 🤖│   │ Agent 🤖 │   │ Review     │
│ Form     │   │ (Set)   │   └──────────┘   └──────────┘   │ Draft   │   └────────┘   └──────────┘   │ (Code)     │
└──────────┘   └─────────┘                                 └─────────┘        ▲                     └─────┬──────┘
                                                                              │                           ▼
                                                                     ┌────────┴───────┐  no  ┌────────────────┐
                                                                     │Prepare Revision│◄─────│ Score ≥ 75?    │
                                                                     │ (Code)         │ yes  └───────┬────────┘
                                                                     └────────────────┘◄──┐  (via    │ yes
                                                                                          │ Retries   ▼
④ HUMAN APPROVAL & LAUNCH                                                       reject   │ Left?)  ┌──────────────┐
┌───────────┐   ┌───────────┐   ┌──────────────┐   ┌──────────┐   ┌───────┐  ┌──────────┴──┐     │Human Approval│
│ Email     │ ← │ Save to   │ ← │ Build        │ ← │ Campaign │ ← │Publish│ ←│ Approved?   │ ←── │(Gmail, waits)│
│ Final     │   │ Google    │   │ Campaign     │   │ Summary  │   │Sched. │  └─────────────┘     └──────────────┘
│ Report    │   │ Sheets    │   │ Record       │   │ (Claude) │   │(Code) │
└───────────┘   └───────────┘   └──────────────┘   └──────────┘   └───────┘
```

**Design choices to mention in your Loom:**

1. **4 agents only.** Each agent does one job. The schedule and the scoring maths run in plain Code nodes because they don't need AI. Deterministic code is cheaper, faster and always gives the same answer.
2. **Structured outputs.** Every agent must return JSON that matches a schema, so every later node can rely on fields like `output.linkedin.post`.
3. **The AI reviews, code decides.** The Review Agent gives seven criterion scores. The *Evaluate Review* Code node computes the weighted overall score, so a model having a generous day can't wave weak content through.
4. **Safety valve.** The workflow writes at most 3 drafts. If the third still scores below 75, it goes to a human with a ⚠️ warning instead of looping forever.
5. **Human in the loop.** Nothing is scheduled without a person clicking **Approve**. If they click **Reject**, the draft goes back to the Content Agent for a fresh rewrite.

---

## Part 1: Prerequisites (≈15 min)

### 1.1 n8n
Pick **one**:
- **n8n Cloud (easiest).** Sign up at n8n.io for the free trial. Google sign-in works with one click.
- **Self-hosted on your laptop.** Install Node.js 20+ and run `npx n8n` in a terminal, then open http://localhost:5678. Google setup takes one extra step (1.3).

Your n8n needs to be a recent version (2025 or later) so the **AI Agent**, **Anthropic Chat Model** and Gmail **Send and Wait for Response** nodes are available.

### 1.2 Claude API key
1. Go to **console.anthropic.com** and sign in.
2. Open **Settings → Billing** and add a small amount of credit. One full run makes 5 to 9 Claude calls and costs a few cents.
3. Open **Settings → API Keys → Create Key**. Name it `n8n-portfolio` and copy it.
4. In n8n, go to **Overview** (left sidebar) → **Create** dropdown → **Credential**. Search **Anthropic**, paste the key and click **Save**. n8n tests it automatically and shows a green "Connection tested successfully".

> 🔐 The key lives only inside n8n's encrypted credentials. Never paste it into a prompt, a Code node, a sticky note or a file you share. Exported workflow JSON does **not** contain credential secrets, so the JSON is safe to share in your portfolio.

### 1.3 Google (Sheets + Gmail)
**n8n Cloud:** go to **Create → Credential**, then:
- **Google Sheets OAuth2 API** → **Sign in with Google** → allow.
- **Gmail OAuth2 API** → **Sign in with Google** → allow.

**Self-hosted:** first create your own Google OAuth client.
1. Open **console.cloud.google.com** → project dropdown → **New Project** (name it `n8n-marketing`).
2. Open **APIs & Services → Library** and enable **Google Sheets API**, **Google Drive API** and **Gmail API**.
3. Open **APIs & Services → OAuth consent screen**. Choose **External**, fill in an app name and your email, and under **Test users** add your own Gmail address.
4. Open **APIs & Services → Credentials → Create Credentials → OAuth client ID** and choose **Web application**.
5. In n8n, start creating a **Google Sheets OAuth2 API** credential. The modal shows an **OAuth Redirect URL** (like `http://localhost:5678/rest/oauth2-credential/callback`). Copy it into Google's **Authorized redirect URIs** and click **Create**.
6. Copy the Google **Client ID** and **Client Secret** into the n8n credential and click **Sign in with Google**.
7. Repeat steps 5 and 6 for a **Gmail OAuth2 API** credential. It uses the same Client ID and Secret, so no new Google client is needed.

### 1.4 The Google Sheet
1. Create a new Google Sheet named **AI Marketing Campaigns**.
2. Rename the first tab (bottom-left) to **Campaigns**.
3. Paste this header row into row 1, starting at A1. The names must match exactly: they are tab-separated, so each lands in its own column. The same headers are in `sample-data/google-sheets-headers.csv`.

```
Campaign ID	Created At	Brand	Campaign Name	Brief	Goal	Target Audience	Campaign Angle	Tone	Primary CTA	LinkedIn Post	Instagram Caption	Instagram Visual	X Post	X Thread	Quality Score	Score Breakdown	Drafts Needed	Status	Publishing Schedule	Summary
```
4. Optional, for a nicer Loom shot: make row 1 bold, use **View → Freeze → 1 row**, and select all cells → **Format → Wrapping → Clip**.
5. Copy the sheet's URL from the browser.

---

## Part 2: Fast path, import the workflow (≈5 min)

1. In n8n, click **Overview → Create Workflow** (or **+** in the left sidebar).
2. Click the **⋯** menu (top right) → **Import from File…** and pick `workflow/ai-social-media-marketing-automation.json`.
3. Connect credentials. Nodes with a red ⚠ need one:
   - Open each of the 5 **Claude · …** nodes and pick your Anthropic credential under **Credential to connect with**. Check the **Model**: choose **Claude Sonnet 5.5** from the list, or set it **By ID** to `claude-sonnet-5-5`.
   - **Human Approval** and **Email Final Report**: pick your Gmail credential.
   - **Save to Google Sheets**: pick your Sheets credential, paste your sheet URL into **Document** (By URL), and set **Sheet** to `Campaigns` (pick it from the list).
4. Press **Ctrl+S** to save.
5. Skip to **Part 5 (Testing)**.

Even if you import, read Part 3 once. It explains every node, and you'll need that to talk confidently in your Loom.

---

## Part 3: Build it yourself, node by node

**Canvas basics:**
- **Add a node:** click the **+** on the right edge of the previous node, or press **Tab** and search.
- **Rename a node:** select it and press **F2**. Names matter here, because expressions like `$('Strategy Agent')` look nodes up by name.
- **Expression mode:** hover a field and click **Expression** (or type `{{`). The field turns green-bordered and shows a live preview of the result underneath.
- **Run one node:** open the node and click **Test step**. This runs the node using the data from the nodes before it.

### Step 1: "Campaign Brief Form" (n8n Form Trigger)
1. On a new canvas, click **Add first step** → search **n8n Form** → choose **On new n8n Form event**.
2. Set **Form Title** to `AI Social Media Campaign Generator`.
3. Set **Form Description** to `Describe your campaign. Four AI agents will plan it, write platform-native posts for LinkedIn, Instagram and X, score them, and send them to you for approval.`
4. Click **Add Form Element** once for each field below:

| Field Label | Element Type | Required | Options / Placeholder |
|---|---|---|---|
| Campaign Brief | Textarea | ✅ | `e.g. Launch an AI productivity tool for college students` |
| Product Name | Text | ✅ | `e.g. StudyPilot` |
| Campaign Goal | Dropdown | ✅ | Waitlist / Sign-ups · Product Launch Awareness · App Downloads · Event Registrations · Sales |
| Brand Voice | Dropdown | ✅ | Friendly & Helpful · Bold & Energetic · Witty & Playful · Professional & Credible |
| Landing Page URL | Text | | `https://...` |
| Launch Date | Date | ✅ | |
| Approver Email | Email | ✅ | |

5. Set **Respond When** to `Form Is Submitted`.
6. Under **Add option**:
   - Turn **Append n8n Attribution** off.
   - Set **Form Response** → **Text to Show** to `✅ Brief received! The AI agents are working. Check your inbox for the approval email in about 1–2 minutes.`

**Output:** one item whose keys are the field labels, for example `{"Campaign Brief": "...", "Product Name": "StudyPilot", ...}`.

### Step 2: "Campaign Input" (Edit Fields / Set)
This node turns the form's label-style keys into clean variable names and holds the workflow's settings. Every later node reads from here.

1. Click **+** → search **Edit Fields (Set)** → mode **Manual Mapping**.
2. Click **Add Field** for each row:

| Name | Type | Value (Expression) |
|---|---|---|
| campaign_id | String | `CMP-{{ $now.toFormat('yyyyMMdd-HHmmss') }}` |
| created_at | String | `{{ $now.toFormat('yyyy-MM-dd HH:mm') }}` |
| brief | String | `{{ $json['Campaign Brief'] }}` |
| brand_name | String | `{{ $json['Product Name'] }}` |
| campaign_goal | String | `{{ $json['Campaign Goal'] }}` |
| brand_voice | String | `{{ $json['Brand Voice'] }}` |
| landing_url | String | `{{ $json['Landing Page URL'] }}` |
| launch_date | String | `{{ $json['Launch Date'] }}` |
| approver_email | String | `{{ $json['Approver Email'] }}` |
| quality_threshold | Number | `75` |
| max_attempts | Number | `3` |

The threshold and attempt limit live here rather than inside the IF nodes, so you can change them in one place.

### Step 3: "Strategy Agent" (AI Agent) + Claude + Structured Output Parser
1. Click **+** → search **AI Agent**. Rename it `Strategy Agent`.
2. Set **Source for Prompt (User Message)** to `Define below`.
3. In **Prompt (User Message)**, switch to Expression and paste the prompt in `prompts/01-marketing-strategy-agent.md` from [`../prompts/`](../prompts/).
4. Turn on **Require Specific Output Format**. This adds an **Output Parser** connector under the node.
5. Click **Add Option → System Message** and paste its System Message.
6. **Connect Claude.** Under the agent, click the **+** on **Chat Model** → **Anthropic Chat Model**. Pick your credential, set the model to **Claude Sonnet 5.5**, then **Add Option → Sampling Temperature = 0.4** and **Maximum Number of Tokens = 4096**. Rename it `Claude · Strategy`.
7. **Connect the parser.** Click the **+** on **Output Parser** → **Structured Output Parser**. Set **Schema Type** to `Define using JSON Schema` and paste `schemas/strategy.schema.json`. Rename it `Strategy Schema`.

**Input:** the Campaign Input item.
**Output:** `{"output": {campaign_name, objective, target_audience, pain_points[], campaign_angle, key_message, value_propositions[], tone, primary_cta, kpis[], assumptions[]}}`. With a parser attached, the agent's result is always under `output`.

Temperatures: Strategy 0.4 (focused), Audience 0.5, Content 0.8 (creative), Review 0.2 (consistent), Summary 0.3.

### Step 4: "Audience Agent"
Build it exactly like Step 3, using `prompts/02-audience-intelligence-agent.md` and `schemas/audience.schema.json`. Name the model `Claude · Audience` (temperature 0.5) and the parser `Audience Schema`.

The prompt passes the whole strategy along with `{{ JSON.stringify($json.output, null, 2) }}`, so the audience work builds on the strategy instead of starting over.

**Output:** `output.persona`, `interests`, `pain_points`, `motivations`, `objections`, `content_preferences.{linkedin,instagram,x}`, `messaging_style.{do,dont,words_they_use}` and `best_hook_angles`.

### Step 5: "Start First Draft" (Edit Fields / Set)
The Content Agent runs more than once. Each time, it needs a `feedback` field and a `previous_draft` field. This node supplies them for the first draft. Later runs get them from *Prepare Revision*.

| Name | Type | Value |
|---|---|---|
| feedback | String | `None. This is the first draft.` |
| previous_draft | String | `N/A` |

### Step 6: "Content Agent"
Build it like Step 3 with `prompts/03-content-creation-agent.md` and `schemas/content.schema.json`. Name the model `Claude · Content` (temperature **0.8**) and the parser `Content Schema`.

Key expressions inside the prompt:
- `{{ $runIndex + 1 }}`: which draft this is. `$runIndex` counts how many times this node has already run in this execution.
- `{{ JSON.stringify($('Strategy Agent').first().json.output, null, 2) }}`: pulls the strategy from earlier in the workflow by node name.
- `{{ $json.feedback }}` and `{{ $json.previous_draft }}`: come from *Start First Draft* on the first pass and *Prepare Revision* on later passes.

The system message gives each platform its own length, structure, emoji and hashtag rules. That's what keeps the three posts from being copies of each other.

**Output:** `output.campaign_tagline`, `output.linkedin.{hook, post, cta, hashtags[]}`, `output.instagram.{hook, caption, cta, hashtags[], visual_concept}` and `output.x.{post, thread[], cta, hashtags[]}`.

### Step 7: "Review Agent"
Build it like Step 3 with `prompts/04-content-review-agent.md` and `schemas/review.schema.json`. Name the model `Claude · Review` (temperature **0.2**) and the parser `Review Schema`.

One detail: the prompt hands the reviewer **counts measured by n8n**, such as `{{ $json.output.x.post.length }}` for the X post length, because language models are bad at counting characters. Mention this in your Loom.

**Output:** `output.scores.{hook, clarity, engagement, brand_alignment, cta, grammar, platform_fit}`, `overall_score`, `platform_feedback`, `strongest_element`, `problems[]`, `improvements[]` and `decision`.

### Step 8: "Evaluate Review" (Code)
1. Click **+** → **Code**. Keep the language as JavaScript and the mode as **Run Once for All Items**.
2. Paste the **Evaluate Review** code from [`../prompts/`](../prompts/).

What the code does:
- Computes the weighted overall score: hook 20, engagement 20, platform fit 15, clarity 15, brand 10, CTA 10, grammar 10.
- Sets `attempt` = `$runIndex + 1`.
- Sets `can_retry` = `attempt < max_attempts`.
- Builds `approval_html`, the formatted approval email with score bars and the three posts.

**Output:** `{campaign_id, attempt, threshold, overall_score, ai_overall_score, decision, can_retry, scores, problems, improvements, platform_feedback, strongest_element, content, approval_html}`.

### Step 9: "Score ≥ 75?" (If)
1. Click **+** → **If**.
2. Value 1: `{{ $json.overall_score }}`. Operator: **Number → is greater than or equal to**. Value 2: `{{ $json.threshold }}`.
3. The **true** output goes to *Human Approval* (Step 12). The **false** output goes to *Retries Left?* (Step 10).

### Step 10: "Retries Left?" (If)
1. Value 1: `{{ $json.can_retry }}`. Operator: **Boolean → is true**.
2. The **true** output goes to *Prepare Revision* (Step 11).
3. The **false** output goes to *Human Approval*. The email subject then shows ⚠️ so the approver knows the content is below the bar.

### Step 11: "Prepare Revision" (Code) ← the loop
1. Add a **Code** node and paste `code-nodes/prepare-revision.js`.
2. **Drag its output back to the input of `Content Agent`.** That one connection is what creates the loop. n8n allows nodes to have more than one input, and it draws the line looping backwards.

The code collects the reviewer's score, problems, improvements and per-platform notes into one `feedback` text and stores the old draft in `previous_draft`. If it's reached from a human **Reject**, it tells the agent to write a noticeably different version instead.

### Step 12: "Human Approval" (Gmail → Send and Wait for Response)
1. Click **+** → **Gmail** → action **Send message and wait for response**. Pick your Gmail credential.
2. **To:** `{{ $('Campaign Input').first().json.approver_email }}`
3. **Subject:** `{{ $json.overall_score >= $json.threshold ? '✅' : '⚠️' }} Approve campaign: {{ $('Campaign Input').first().json.brand_name }} (score {{ $json.overall_score }}/100)`
4. **Message:** `{{ $json.approval_html }}`
5. **Response Type:** `Approval`. **Type of Approval:** `Approve and Disapprove`. **Approve Button Label:** `✅ Approve & Schedule`. **Disapprove Button Label:** `❌ Reject & Rewrite`.
6. Optional: **Add option → Limit Wait Time** (for example 1 day).

The execution pauses here with status *Waiting*. Clicking a button in the email resumes it.
**Output:** `{"data": {"approved": true}}` or `{"data": {"approved": false}}`.

> If you self-host on `localhost`, the buttons point to `localhost:5678`. Click them on the same computer that runs n8n.

### Step 13: "Approved?" (If)
1. Value 1: `{{ $json.data.approved }}`. Operator: **Boolean → is true**.
2. The **true** output goes to *Publishing Schedule*.
3. Drag the **false** output to *Prepare Revision*. A rejected draft then goes back for a rewrite, and the approver gets a new approval email.

### Step 14: "Publishing Schedule" (Code)
Paste `code-nodes/publishing-schedule.js`. Starting from the launch date, it creates a 6-post plan across 5 days using best-practice posting times: LinkedIn on weekday mornings, X at lunch and in the late afternoon, Instagram in the evening. It also moves any LinkedIn post that lands on a weekend to Monday.
**Output:** `{campaign_id, final_score, schedule[], schedule_text}`.

### Step 15: "Campaign Summary" (Basic LLM Chain)
1. Click **+** → **Basic LLM Chain**. This is a single Claude call, not an agent.
2. Set **Source for Prompt** to `Define below` and paste `prompts/05-campaign-summary.md` in Expression mode.
3. Attach an **Anthropic Chat Model** named `Claude · Summary` with temperature 0.3.

**Output:** `{"text": "CAMPAIGN\n- ..."}`.

### Step 16: "Build Campaign Record" (Code)
Paste `code-nodes/build-campaign-record.js`. It flattens everything into one object whose keys match the sheet's column headers exactly.

### Step 17: "Save to Google Sheets"
1. Click **+** → **Google Sheets** → action **Append row in sheet**. Pick your credential.
2. **Document:** By URL → paste your sheet URL. **Sheet:** `Campaigns`.
3. **Mapping Column Mode:** `Map Automatically`. This works because the previous node's keys equal the header names.

### Step 18: "Email Final Report" (Gmail → Send a message)
1. **To:** `{{ $('Campaign Input').first().json.approver_email }}`
2. **Subject:** `🚀 Campaign approved & scheduled: {{ $json['Campaign Name'] }}`
3. **Email Type:** Text.
4. **Message:** `{{ $json['Summary'] }}` followed by a line with the campaign ID.
5. **Add option → Append n8n Attribution:** off.

### Step 19: Make it look good
- Add **Sticky Notes** with **Shift+S** (or the right-click menu) behind each stage: ① Intake, ② AI Strategy Brain, ③ Create → Review → Improve, ④ Human Approval & Launch. Give each stage its own colour.
- Line nodes up on one horizontal row and keep the Claude and parser sub-nodes directly below their agents.
- Press **Ctrl+S**.

---

## Part 4: Data flow cheat sheet

| From → To | What is passed | How the next node reads it |
|---|---|---|
| Form → Campaign Input | Raw form answers | `$json['Campaign Brief']` |
| Campaign Input → Strategy | Clean config | `$json.brief`; anywhere later: `$('Campaign Input').first().json.brief` |
| Strategy → Audience | Strategy JSON | `$json.output`; later: `$('Strategy Agent').first().json.output` |
| Audience → Content | Persona JSON | `$('Audience Agent').first().json.output` |
| Start First Draft / Prepare Revision → Content | Feedback + previous draft | `$json.feedback`, `$json.previous_draft` |
| Content → Review | Draft JSON | `$json.output.linkedin.post` |
| Review → Evaluate | Review JSON | `$input.first().json.output`; the draft via `$('Content Agent').last().json.output` |
| Evaluate → IFs / Gmail | Score, decision, HTML | `$json.overall_score`, `$json.approval_html` |
| Later nodes | Final approved draft | `$('Evaluate Review').last().json.content` |

**Why `.first()` and `.last()`?** Nodes inside the loop can run several times. `$('Node').last()` reads that node's most recent output, which is the latest draft. Nodes outside the loop only run once, so `.first()` is enough.

---

## Part 5: Testing (do it in this order)

**T1: Form and input.** Open *Campaign Brief Form* → **Test step**. A form opens in a new tab. Fill it with `sample-data/sample-campaign-input.json` and submit. Back in n8n, open *Campaign Input* and click **Test step**. Check that all 11 fields have values.
➡️ Open the Form Trigger and click the **📌 pin** icon on its output. From now on, every test reuses this submission and you don't need to refill the form.

**T2: Each agent separately.** Open *Strategy Agent* → **Test step**. Read the output. Is the angle specific? Is the CTA a single action? Repeat for *Audience Agent*, *Start First Draft*, *Content Agent* and *Review Agent*. If an agent fails with a parsing error, see Troubleshooting.

**T3: Scoring.** Run *Evaluate Review* and confirm that `overall_score`, `can_retry` and `approval_html` exist.

**T4: Force the regeneration loop.** In *Campaign Input*, temporarily set `quality_threshold` to **95**. Click **Test workflow** (bottom of canvas). You should see:
- *Content Agent*, *Review Agent* and *Evaluate Review* each run 3 times (the node badge shows the run count).
- An approval email whose subject starts with ⚠️.
- Open *Evaluate Review* and use the **Run** selector (Run 1 / 2 / 3) to watch the score change from draft to draft.

Set the threshold back to **75** afterwards.

**T5: Rejection path.** Run again and click **❌ Reject & Rewrite** in the email. A new draft is written and a second approval email arrives.

**T6: Happy path, end to end.** Run again and click **✅ Approve & Schedule**. Then check:
- A new row appears in the Google Sheet.
- The "🚀 Campaign approved" email arrives.
- Every node has a green tick.

**T7: Production.** Unpin the form data. Toggle the workflow to **Active** (top right). Open *Campaign Brief Form*, switch to the **Production URL** and copy it. That's the link you'll use in the Loom. Production runs appear under the **Executions** tab.

---

## Part 6: Demo campaign for the Loom

The demo input (StudyPilot, an AI study planner for college students) is in `sample-data/sample-campaign-input.json`. The full recording plan is in [`LOOM_DEMO.md`](LOOM_DEMO.md).

---

## Part 7: Visual polish without extra complexity

- ✅ Four coloured sticky notes, one per stage (already in the imported JSON).
- ✅ Clear node names (`Strategy Agent`, `Score ≥ 75?`). Avoid defaults like "AI Agent1".
- ✅ The backward loop line from *Prepare Revision* to *Content Agent* is the most visually striking part, so keep it uncluttered.
- ✅ The HTML approval email with score bars looks great on camera.
- ✅ A tidy Google Sheet: frozen header and clipped text.
- ❌ Skip image generation, auto-posting APIs and more agents. Each adds setup risk without adding much to a 3-minute demo. Mention them as "next steps": auto-publishing through Buffer or the LinkedIn API, and a weekly analytics feedback loop.

---

## Part 8: Troubleshooting

| Problem | Fix |
|---|---|
| `Failed to parse output` / `Could not parse LLM output` on an agent | Open the parser → **Add option** → turn on **Auto-Fix Format** if your version has it. Or attach the parser to a new Claude model with temperature ≤ 0.5. Also check that the agent's **Maximum Number of Tokens** is 4096. |
| `Cannot read properties of undefined (reading 'output')` | A node was renamed. Expressions use exact node names: `Strategy Agent`, `Audience Agent`, `Content Agent`, `Campaign Input`, `Evaluate Review`, `Publishing Schedule`. |
| Model not in the dropdown | Switch **Model** to **By ID** and type `claude-sonnet-5-5`. |
| Form Test URL doesn't respond | Test URLs only work while the canvas is listening, right after **Test step** or **Test workflow**. Use the Production URL with the workflow set to Active. |
| Execution stuck on *Waiting* | It's waiting for the email click. Check spam. On localhost, click the button on the same computer. |
| Sheets row has empty columns | The header text in the sheet doesn't exactly match the keys in *Build Campaign Record*. Watch for trailing spaces. |
| HTML shows as raw tags in the approval email | Use a plain-text message instead: `Score {{ $json.overall_score }}/100` followed by `{{ $json.content.linkedin.post }}`, and so on. |
| `Launch Date` shows as an invalid date | The schedule then falls back to tomorrow. Check that the form field type is **Date**. |

---

## Part 9: Sharing this project

- Export with **⋯ → Download**. The exported JSON contains no API keys.
- Never commit a `.env` file, API keys or Google client secrets. If you put this in a YFS GitHub repo, follow the team workflow: create a `feature/n8n-marketing-automation` branch from the latest `development`, commit the JSON and these guides, and open a PR into `development` with Yogesh or Abhijith as reviewer.
