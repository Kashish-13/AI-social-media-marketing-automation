# Loom Demo Plan (2–3 minutes)

## Before you record (10 min)

1. **Do a full run first.** Submit the demo campaign and approve it, so a finished execution is waiting in the **Executions** tab. If the live run is slow on camera, cut to this one.
2. **Optional: a run that shows the loop.** In `Campaign Input`, set `quality_threshold` to **85** and run once more. Open `Evaluate Review` and check that it shows **Run 1 / Run 2**. Set it back to **75** afterwards.
3. **Open these tabs, in this order:**
   1. the n8n canvas, zoomed to fit (press **Shift+1**)
   2. the form's **Production URL**, with the workflow set to **Active**
   3. Gmail
   4. the Google Sheet
4. Hide bookmarks and notifications, and set the browser zoom so the whole canvas is readable.
5. Have the demo input ready to paste. It's below and in `sample-data/sample-campaign-input.json`.

## Demo input

| Field | Value |
|---|---|
| Campaign Brief | Launch StudyPilot, an AI productivity app for college students. Students upload their syllabus PDFs and StudyPilot builds a day-by-day study plan, breaks big assignments into small tasks, and sends nudges 48 hours before every deadline. It syncs with Google Calendar. We are opening a waitlist ahead of public launch; the first 1,000 sign-ups get 3 months of Pro free. Competitors are generic to-do apps like Notion and Todoist that students abandon after a week. |
| Product Name | StudyPilot |
| Campaign Goal | Waitlist / Sign-ups |
| Brand Voice | Friendly & Helpful |
| Landing Page URL | https://studypilot.example.com |
| Launch Date | 2026-11-09 (a Monday) |
| Approver Email | your own email |

## Script

| Time | Show | Say (roughly) |
|---|---|---|
| 0:00–0:15 | Whole canvas, zoomed out | "Hi, I'm ___. This is an AI marketing team I built in n8n with Claude. It turns one campaign brief into approved, scheduled, platform-native social content." |
| 0:15–0:30 | Point at the four sticky-note stages | "Four stages: intake, an AI strategy brain, a create-review-improve loop, and human approval and launch." |
| 0:30–0:45 | Form tab: paste the brief, submit | "A marketer describes the campaign once. Here: StudyPilot, an AI study planner for college students." |
| 0:45–1:10 | Open `Strategy Agent` output, then `Audience Agent` output | "Agent 1, the Strategy Agent, picks one angle, a tone and one call to action. Agent 2 builds a persona, right down to the words students actually use. Every agent returns structured JSON, so the next step can rely on it." |
| 1:10–1:35 | Open `Content Agent` output | "Agent 3 writes for each platform separately: a story-style LinkedIn post, an emotional Instagram caption with a carousel concept, and a punchy X post with a thread." |
| 1:35–2:00 | Open `Review Agent`, then `Evaluate Review` (switch Run 1 → Run 2 if you have the loop run) | "Agent 4 scores seven criteria, and code calculates the weighted score, so the AI can't grade its own homework. Below 75, the feedback loops back to the writer, up to three drafts. Here it went from 71 to 83." *(use your real numbers)* |
| 2:00–2:20 | Gmail: open the approval email, click **Approve** | "Nothing gets published without a human. The approver sees the scores and all three posts and clicks approve, or rejects to trigger a rewrite." |
| 2:20–2:40 | Google Sheet row, then the final report email | "Once approved, it builds a six-post launch schedule, saves everything to Google Sheets and emails the team a summary." |
| 2:40–2:55 | Back to the canvas | "Four focused agents, structured outputs, a quality gate and a human in the loop. Next I'd add auto-publishing and a weekly analytics feedback loop. Thanks!" |

## Talking points if you have extra time

- **Why only 4 agents?** Scheduling and scoring maths are deterministic, so they run as code: cheaper, faster and repeatable.
- **Why measured counts?** n8n measures the X post length and passes it to the reviewer, because language models count characters badly.
- **Safety valve.** The workflow stops after 3 drafts and escalates to a human with a ⚠️ in the subject line.
- **Security.** API keys live only in n8n credentials. The exported workflow JSON contains no secrets.

## Honesty checklist

- Use the real scores from your run. Don't read out the example numbers in the script.
- If you raised the threshold to show the loop, say so: "for the demo I've raised the bar to 85."
- StudyPilot is a fictional demo product. Say that if anyone could mistake it for a real company.
