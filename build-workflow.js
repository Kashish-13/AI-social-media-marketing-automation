// Generates the importable n8n workflow JSON.
const fs = require('fs');
const crypto = require('crypto');
const id = () => crypto.randomUUID();
const OUT = process.argv[2];

const MODEL = 'claude-sonnet-5-5';

// ---------- JSON SCHEMAS ----------
const strategySchema = {
  type: 'object',
  properties: {
    campaign_name: { type: 'string', description: 'Short, memorable internal campaign name' },
    objective: { type: 'string', description: 'The measurable business objective of the campaign' },
    target_audience: { type: 'string', description: 'Primary audience in one specific sentence' },
    pain_points: { type: 'array', items: { type: 'string' }, description: '3-5 specific pain points' },
    campaign_angle: { type: 'string', description: 'The single big idea that makes this campaign stand out' },
    key_message: { type: 'string', description: 'One-sentence core message' },
    value_propositions: { type: 'array', items: { type: 'string' } },
    tone: { type: 'string', description: 'Recommended tone of voice, with 3 adjectives' },
    primary_cta: { type: 'string', description: 'The one action we want people to take' },
    kpis: { type: 'array', items: { type: 'string' } },
    assumptions: { type: 'array', items: { type: 'string' } }
  },
  required: ['campaign_name', 'objective', 'target_audience', 'pain_points', 'campaign_angle', 'key_message', 'value_propositions', 'tone', 'primary_cta', 'kpis', 'assumptions']
};

const audienceSchema = {
  type: 'object',
  properties: {
    persona: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Persona nickname, e.g. "Deadline-Juggling Priya"' },
        age_range: { type: 'string' },
        description: { type: 'string' },
        a_day_in_their_life: { type: 'string' }
      },
      required: ['name', 'age_range', 'description', 'a_day_in_their_life']
    },
    interests: { type: 'array', items: { type: 'string' } },
    pain_points: { type: 'array', items: { type: 'string' } },
    motivations: { type: 'array', items: { type: 'string' } },
    objections: { type: 'array', items: { type: 'string' }, description: 'Reasons they might NOT act' },
    content_preferences: {
      type: 'object',
      properties: {
        linkedin: { type: 'string' },
        instagram: { type: 'string' },
        x: { type: 'string' }
      },
      required: ['linkedin', 'instagram', 'x']
    },
    messaging_style: {
      type: 'object',
      properties: {
        do: { type: 'array', items: { type: 'string' } },
        dont: { type: 'array', items: { type: 'string' } },
        words_they_use: { type: 'array', items: { type: 'string' } }
      },
      required: ['do', 'dont', 'words_they_use']
    },
    best_hook_angles: { type: 'array', items: { type: 'string' } }
  },
  required: ['persona', 'interests', 'pain_points', 'motivations', 'objections', 'content_preferences', 'messaging_style', 'best_hook_angles']
};

const contentSchema = {
  type: 'object',
  properties: {
    campaign_tagline: { type: 'string' },
    linkedin: {
      type: 'object',
      properties: {
        hook: { type: 'string', description: 'First line, max 12 words' },
        post: { type: 'string', description: 'Full ready-to-publish post: hook + body + CTA + hashtags' },
        cta: { type: 'string' },
        hashtags: { type: 'array', items: { type: 'string' } }
      },
      required: ['hook', 'post', 'cta', 'hashtags']
    },
    instagram: {
      type: 'object',
      properties: {
        hook: { type: 'string', description: 'First 125 characters of the caption' },
        caption: { type: 'string', description: 'Full ready-to-publish caption including CTA and hashtags' },
        cta: { type: 'string' },
        hashtags: { type: 'array', items: { type: 'string' } },
        visual_concept: { type: 'string', description: 'Carousel slide-by-slide outline or Reel concept' }
      },
      required: ['hook', 'caption', 'cta', 'hashtags', 'visual_concept']
    },
    x: {
      type: 'object',
      properties: {
        post: { type: 'string', description: 'Main post, max 270 characters including hashtags' },
        thread: { type: 'array', items: { type: 'string' }, description: '3-4 follow-up tweets, each max 270 characters' },
        cta: { type: 'string' },
        hashtags: { type: 'array', items: { type: 'string' } }
      },
      required: ['post', 'thread', 'cta', 'hashtags']
    }
  },
  required: ['campaign_tagline', 'linkedin', 'instagram', 'x']
};

const reviewSchema = {
  type: 'object',
  properties: {
    scores: {
      type: 'object',
      properties: {
        hook: { type: 'number' },
        clarity: { type: 'number' },
        engagement: { type: 'number' },
        brand_alignment: { type: 'number' },
        cta: { type: 'number' },
        grammar: { type: 'number' },
        platform_fit: { type: 'number' }
      },
      required: ['hook', 'clarity', 'engagement', 'brand_alignment', 'cta', 'grammar', 'platform_fit']
    },
    overall_score: { type: 'number', description: '0-100' },
    platform_feedback: {
      type: 'object',
      properties: {
        linkedin: { type: 'string' },
        instagram: { type: 'string' },
        x: { type: 'string' }
      },
      required: ['linkedin', 'instagram', 'x']
    },
    strongest_element: { type: 'string' },
    problems: { type: 'array', items: { type: 'string' } },
    improvements: { type: 'array', items: { type: 'string' } },
    decision: { type: 'string', enum: ['APPROVE', 'REGENERATE'] }
  },
  required: ['scores', 'overall_score', 'platform_feedback', 'strongest_element', 'problems', 'improvements', 'decision']
};

// ---------- PROMPTS ----------
const strategySystem = `You are a senior growth marketing strategist with 15 years of experience launching consumer and B2B products to students and young professionals.

Your job: turn a short campaign brief into a sharp, specific, actionable campaign strategy.

Rules:
- Every field must be specific to THIS product and THIS audience. If a sentence could describe any product, rewrite it.
- Never use filler such as "revolutionize", "game-changer", "unlock your potential", "in today's fast-paced world".
- Pick ONE campaign angle (the big idea) and ONE primary CTA. Do not hedge with several.
- If the brief is missing information, make realistic assumptions and list them in "assumptions".
- KPIs must be measurable (e.g. "500 waitlist sign-ups in 14 days"), not vague ("increase awareness").`;

const strategyUser = `=Create the campaign strategy for this brief.

CAMPAIGN BRIEF: {{ $json.brief }}
BRAND / PRODUCT NAME: {{ $json.brand_name }}
CAMPAIGN GOAL: {{ $json.campaign_goal }}
BRAND VOICE: {{ $json.brand_voice }}
LANDING PAGE: {{ $json.landing_url || 'not provided' }}
LAUNCH DATE: {{ $json.launch_date }}

Work out: the real business objective, who will actually use this, the pain they feel today, the single angle that makes this campaign stand out from competitors, the right tone, and one primary call to action.`;

const audienceSystem = `You are an audience research specialist and consumer psychologist.

Your job: build a vivid audience intelligence profile that a copywriter can write to directly.

Rules:
- Be concrete: real daily habits, real phrases this audience uses, real objections that stop them acting.
- Avoid stereotypes and empty statements like "they like technology" or "they are busy".
- Explain how the SAME person behaves differently on LinkedIn, Instagram and X.
- "words_they_use" must be words or short phrases the audience would actually type or say.
- "best_hook_angles" must be 3-5 opening angles a copywriter could turn directly into a first line.`;

const audienceUser = `=Build the audience intelligence profile for this campaign.

ORIGINAL BRIEF: {{ $('Campaign Input').first().json.brief }}

STRATEGY (from the Marketing Strategy Agent):
{{ JSON.stringify($json.output, null, 2) }}

Go deeper than the strategy: describe one primary persona, what they care about, what they scroll past, how they behave on each platform, which objections stop them from acting, and the messaging style that will feel native to them.`;

const contentSystem = `You are an award-winning social media copywriter who writes natively for each platform. You NEVER paste the same text across platforms; each platform gets its own angle, length, structure and rhythm.

PLATFORM RULES
LINKEDIN
- 120-220 words. The first line is the hook: under 12 words, it must make people click "...see more".
- Short paragraphs of 1-2 lines with white space between them.
- Structure: hook, then a relatable story or insight, then the lesson or solution, then the CTA, then a question that invites comments.
- Credible and specific. Max 2 emojis. 3-5 hashtags at the very end.

INSTAGRAM
- Caption of 60-150 words. The hook must land in the first 125 characters (before "more").
- Conversational, emotional, relatable. Emojis are welcome as visual bullets.
- The CTA says "link in bio"; never paste URLs into the caption.
- 8-15 hashtags mixing broad, niche and one branded tag.
- visual_concept: describe a 5-slide carousel (slide by slide) OR a 15-second Reel (shot by shot).

X / TWITTER
- Main post MAX 270 characters INCLUDING hashtags. Punchy, opinionated or curiosity-driven, never corporate.
- 0-2 hashtags.
- thread: 3-4 follow-up tweets that expand the idea, each max 270 characters, and the last one carries the CTA.

GENERAL RULES
- Write in the audience's own vocabulary (see "words_they_use").
- One clear CTA per platform, aligned with the strategy's primary CTA.
- Banned: "game-changer", "revolutionize", "unlock", "elevate", "in today's fast-paced world", "look no further".
- No invented statistics, fake testimonials or fake user numbers.
- Respect the brand voice.
- If reviewer feedback is provided, fix EVERY problem it lists and keep what it praised.`;

const contentUser = `=Write the campaign content. This is draft attempt #{{ $runIndex + 1 }}.

BRAND / PRODUCT: {{ $('Campaign Input').first().json.brand_name }}
BRAND VOICE: {{ $('Campaign Input').first().json.brand_voice }}
LANDING PAGE: {{ $('Campaign Input').first().json.landing_url || 'not provided' }}

STRATEGY:
{{ JSON.stringify($('Strategy Agent').first().json.output, null, 2) }}

AUDIENCE INTELLIGENCE:
{{ JSON.stringify($('Audience Agent').first().json.output, null, 2) }}

REVIEWER FEEDBACK ON THE PREVIOUS DRAFT:
{{ $json.feedback }}

PREVIOUS DRAFT (improve on it; do not repeat its weaknesses):
{{ $json.previous_draft }}`;

const reviewSystem = `You are the strict head of content at a top social media agency. You review every draft before it goes to the client.

Score each criterion from 0 to 100:
- hook: would the first line stop the scroll for THIS audience?
- clarity: is the message instantly understandable?
- engagement: will people like, comment, save or share it?
- brand_alignment: does it match the brand voice and the campaign angle?
- cta: is there one clear, compelling, low-friction next step?
- grammar: spelling, grammar, punctuation, readability.
- platform_fit: does each post follow its platform's native conventions?

Calibration: average content scores 60-70, good content 75-85, exceptional content 90+. Do NOT give everything 90+.

Hard rules (any violation caps platform_fit at 60):
- The X post is at most 280 characters (use the character count the system gives you; do not count yourself).
- The LinkedIn hook is at most 12 words.
- The Instagram CTA uses "link in bio" and the caption contains no URLs.
- No invented statistics or fake testimonials.
- The three platforms are not copies of each other.

overall_score is your holistic 0-100 score.
problems and improvements must be specific and actionable. Quote the exact line you are criticising and say exactly what to change.
decision = "APPROVE" if overall_score >= 75, otherwise "REGENERATE".`;

const reviewUser = `=Review this social media campaign draft (attempt #{{ $runIndex + 1 }}).

BRAND VOICE: {{ $('Campaign Input').first().json.brand_voice }}

STRATEGY (what the content must deliver):
{{ JSON.stringify($('Strategy Agent').first().json.output, null, 2) }}

TARGET PERSONA:
{{ JSON.stringify($('Audience Agent').first().json.output.persona, null, 2) }}

DRAFT TO REVIEW:
{{ JSON.stringify($json.output, null, 2) }}

SYSTEM-MEASURED FACTS (trust these):
- X post length: {{ $json.output.x.post.length }} characters (limit 280)
- LinkedIn hook length: {{ $json.output.linkedin.hook.trim().split(/\\s+/).length }} words (limit 12)`;

const summaryUser = `=Write a campaign summary report for the marketing team.

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
{{ $json.schedule_text }}`;

// ---------- CODE NODES ----------
const evaluateCode = `// Combines the draft + the review, recalculates the score deterministically,
// and decides what happens next.
const review = $input.first().json.output;
const content = $('Content Agent').last().json.output;
const cfg = $('Campaign Input').first().json;

// Weighted score (weights add up to 100). Code does the maths, not the AI.
const weights = { hook: 20, engagement: 20, platform_fit: 15, clarity: 15, brand_alignment: 10, cta: 10, grammar: 10 };
let weighted = 0;
for (const [key, weight] of Object.entries(weights)) {
  weighted += (Number(review.scores[key]) || 0) * weight;
}
const overall = Math.round(weighted / 100);

const attempt = $runIndex + 1; // 1st run of this node = draft 1, 2nd = draft 2 ...
const threshold = Number(cfg.quality_threshold);
const passed = overall >= threshold;

// ---- Approval email (HTML) ----
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\\n/g, '<br>');
const bar = (label, v) =>
  '<tr><td style="padding:4px 8px;font-size:13px">' + label + '</td>' +
  '<td style="padding:4px 8px;width:220px"><div style="background:#eee;border-radius:4px">' +
  '<div style="width:' + Math.max(0, Math.min(100, v)) + '%;background:' + (v >= threshold ? '#16a34a' : '#f59e0b') + ';color:#fff;font-size:11px;padding:2px 6px;border-radius:4px">' + v + '</div></div></td></tr>';
const card = (title, body) =>
  '<div style="border:1px solid #e5e7eb;border-radius:8px;padding:14px;margin:12px 0">' +
  '<div style="font-weight:700;margin-bottom:8px">' + title + '</div>' +
  '<div style="font-size:14px;line-height:1.5">' + body + '</div></div>';

const approval_html =
  '<div style="font-family:Arial,sans-serif;max-width:640px">' +
  (passed ? '' : '<p style="background:#fef3c7;padding:10px;border-radius:6px">⚠️ This draft did not reach the ' + threshold + ' quality bar after ' + attempt + ' attempts. Please review it carefully.</p>') +
  '<h2 style="margin:0 0 4px">' + esc(cfg.brand_name) + ': campaign ready for approval</h2>' +
  '<p style="color:#555;margin:0 0 12px">Campaign ' + esc(cfg.campaign_id) + ' · Draft #' + attempt + ' · <b>Score ' + overall + '/100</b></p>' +
  '<p><i>"' + esc(content.campaign_tagline) + '"</i></p>' +
  '<table>' + Object.keys(weights).map((k) => bar(k.replace('_', ' '), Number(review.scores[k]) || 0)).join('') + '</table>' +
  card('💼 LinkedIn', esc(content.linkedin.post)) +
  card('📸 Instagram', esc(content.instagram.caption) + '<br><br><b>Visual:</b> ' + esc(content.instagram.visual_concept)) +
  card('𝕏 X / Twitter', esc(content.x.post) + '<br><br><b>Thread:</b><br>' + content.x.thread.map((t, i) => (i + 1) + '/ ' + esc(t)).join('<br>')) +
  '<p><b>Reviewer\\'s favourite part:</b> ' + esc(review.strongest_element) + '</p>' +
  '</div>';

return [{
  json: {
    campaign_id: cfg.campaign_id,
    attempt,
    threshold,
    overall_score: overall,
    ai_overall_score: review.overall_score,
    ai_decision: review.decision,
    decision: passed ? 'APPROVE' : 'REGENERATE',
    can_retry: attempt < Number(cfg.max_attempts),
    scores: review.scores,
    platform_feedback: review.platform_feedback,
    strongest_element: review.strongest_element,
    problems: review.problems,
    improvements: review.improvements,
    content,
    approval_html
  }
}];`;

const revisionCode = `// Builds the feedback package that is sent back to the Content Agent.
const r = $('Evaluate Review').last().json;
const humanRejected = $input.first().json.data?.approved === false;

// Hard stop so repeated human rejections can't loop forever
// (automatic retries are already capped by max_attempts in "Retries Left?").
const hardLimit = Number($('Campaign Input').first().json.max_attempts) + 2;
if (r.attempt >= hardLimit) {
  throw new Error('Stopped after ' + r.attempt + ' drafts. Revise the brief and submit the form again.');
}

const lines = [];
if (humanRejected) {
  lines.push('A HUMAN APPROVER REJECTED the previous draft. Write a noticeably different, stronger version with a fresh hook on every platform.');
} else {
  lines.push('The reviewer scored the previous draft ' + r.overall_score + '/100. The quality bar is ' + r.threshold + '.');
}
lines.push('', 'Scores: ' + JSON.stringify(r.scores));
lines.push('', 'Problems to fix:');
r.problems.forEach((p) => lines.push('- ' + p));
lines.push('', 'Required improvements:');
r.improvements.forEach((i) => lines.push('- ' + i));
lines.push('', 'Per-platform feedback:');
lines.push('- LinkedIn: ' + r.platform_feedback.linkedin);
lines.push('- Instagram: ' + r.platform_feedback.instagram);
lines.push('- X: ' + r.platform_feedback.x);
lines.push('', 'Keep what worked: ' + r.strongest_element);

return [{
  json: {
    feedback: lines.join('\\n'),
    previous_draft: JSON.stringify(r.content, null, 2)
  }
}];`;

const scheduleCode = `// Builds a 6-post launch schedule from the launch date using platform best-practice times.
const cfg = $('Campaign Input').first().json;
const final = $('Evaluate Review').last().json;

let start = DateTime.fromISO(String(cfg.launch_date));
if (!start.isValid) start = DateTime.now().plus({ days: 1 });

const slots = [
  { day: 0, time: '09:00', platform: 'LinkedIn', item: 'Launch post', why: 'Professionals and students check LinkedIn at the start of the weekday' },
  { day: 0, time: '12:30', platform: 'X', item: 'Launch post', why: 'Lunch-break scrolling peak; fast-moving feed rewards being early' },
  { day: 0, time: '19:00', platform: 'Instagram', item: 'Launch carousel / Reel', why: 'Students are most active on Instagram in the evening' },
  { day: 1, time: '17:30', platform: 'X', item: 'Follow-up thread', why: 'Second touch while launch momentum is still fresh' },
  { day: 3, time: '08:30', platform: 'LinkedIn', item: 'Repost with a comment / early reactions', why: 'Re-surfaces the launch to people who missed day one' },
  { day: 4, time: '20:00', platform: 'Instagram', item: 'Story reminder with link sticker', why: 'Stories drive clicks; evening reminder before the weekend' }
];

// LinkedIn engagement drops at weekends, so move those posts to Monday.
const skipWeekend = (d) => (d.weekday >= 6 ? d.plus({ days: 8 - d.weekday }) : d);

const schedule = slots.map((s) => {
  let day = start.plus({ days: s.day });
  if (s.platform === 'LinkedIn') day = skipWeekend(day);
  const [h, m] = s.time.split(':').map(Number);
  const at = day.set({ hour: h, minute: m, second: 0, millisecond: 0 });
  return { platform: s.platform, item: s.item, publish_at: at.toFormat('ccc dd LLL yyyy, HH:mm'), iso: at.toISO(), why: s.why };
}).sort((a, b) => a.iso.localeCompare(b.iso));

const schedule_text = schedule
  .map((s) => '- ' + s.publish_at + ' | ' + s.platform + ' | ' + s.item + ' (' + s.why + ')')
  .join('\\n');

return [{ json: { campaign_id: cfg.campaign_id, final_score: final.overall_score, schedule, schedule_text } }];`;

const recordCode = `// One flat row for Google Sheets. The keys must match the sheet's header row exactly.
const cfg = $('Campaign Input').first().json;
const strategy = $('Strategy Agent').first().json.output;
const final = $('Evaluate Review').last().json;
const sched = $('Publishing Schedule').first().json;
const c = final.content;

return [{
  json: {
    'Campaign ID': cfg.campaign_id,
    'Created At': cfg.created_at,
    'Brand': cfg.brand_name,
    'Campaign Name': strategy.campaign_name,
    'Brief': cfg.brief,
    'Goal': cfg.campaign_goal,
    'Target Audience': strategy.target_audience,
    'Campaign Angle': strategy.campaign_angle,
    'Tone': strategy.tone,
    'Primary CTA': strategy.primary_cta,
    'LinkedIn Post': c.linkedin.post,
    'Instagram Caption': c.instagram.caption,
    'Instagram Visual': c.instagram.visual_concept,
    'X Post': c.x.post,
    'X Thread': c.x.thread.join('\\n\\n'),
    'Quality Score': final.overall_score,
    'Score Breakdown': Object.entries(final.scores).map(([k, v]) => k + ': ' + v).join(', '),
    'Drafts Needed': final.attempt,
    'Status': 'Approved',
    'Publishing Schedule': sched.schedule_text,
    'Summary': $input.first().json.text
  }
}];`;

// ---------- NODE HELPERS ----------
const nodes = [];
const add = (n) => { nodes.push({ id: id(), ...n }); return n.name; };

const claude = (name, pos, temperature) => add({
  name, type: '@n8n/n8n-nodes-langchain.lmChatAnthropic', typeVersion: 1.3, position: pos,
  parameters: {
    model: { __rl: true, mode: 'id', value: MODEL },
    options: { maxTokensToSample: 4096, temperature }
  }
});
const parser = (name, pos, schema) => add({
  name, type: '@n8n/n8n-nodes-langchain.outputParserStructured', typeVersion: 1.2, position: pos,
  parameters: { schemaType: 'manual', inputSchema: JSON.stringify(schema, null, 2) }
});
const agent = (name, pos, text, systemMessage) => add({
  name, type: '@n8n/n8n-nodes-langchain.agent', typeVersion: 1.7, position: pos,
  parameters: { promptType: 'define', text, hasOutputParser: true, options: { systemMessage } }
});
const code = (name, pos, jsCode) => add({
  name, type: 'n8n-nodes-base.code', typeVersion: 2, position: pos, parameters: { jsCode }
});
const sticky = (content, pos, width, height, color) => add({
  name: 'Note ' + nodes.length, type: 'n8n-nodes-base.stickyNote', typeVersion: 1, position: pos,
  parameters: { content, width, height, color }
});
const ifNode = (name, pos, leftValue, operator, rightValue) => add({
  name, type: 'n8n-nodes-base.if', typeVersion: 2.2, position: pos,
  parameters: {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
      conditions: [{ id: id(), leftValue, rightValue, operator }],
      combinator: 'and'
    },
    options: {}
  }
});

// ---------- STICKY NOTES (visual stages) ----------
sticky('## ① Campaign Intake\nA marketer submits a brief through a hosted form.', [-80, 120], 520, 400, 7);
sticky('## ② AI Strategy Brain\n**Strategy Agent** → plan · **Audience Agent** → persona', [460, 120], 760, 600, 4);
sticky('## ③ Create → Review → Improve loop\nContent is scored out of 100. Below 75 → feedback goes back to the Content Agent (max 3 drafts).', [1260, 120], 1600, 800, 5);
sticky('## ④ Human Approval & Launch\nApprover gets an email with Approve / Reject buttons. Approved → schedule, summary, Google Sheets, final report.', [2880, 0], 1700, 560, 6);

// ---------- MAIN NODES ----------
add({
  name: 'Campaign Brief Form', type: 'n8n-nodes-base.formTrigger', typeVersion: 2.2, position: [0, 300], webhookId: id(),
  parameters: {
    formTitle: 'AI Social Media Campaign Generator',
    formDescription: 'Describe your campaign. Four AI agents will plan it, write platform-native posts for LinkedIn, Instagram and X, score them, and send them to you for approval.',
    formFields: {
      values: [
        { fieldLabel: 'Campaign Brief', fieldType: 'textarea', placeholder: 'e.g. Launch an AI productivity tool for college students', requiredField: true },
        { fieldLabel: 'Product Name', placeholder: 'e.g. StudyPilot', requiredField: true },
        { fieldLabel: 'Campaign Goal', fieldType: 'dropdown', requiredField: true, fieldOptions: { values: [{ option: 'Waitlist / Sign-ups' }, { option: 'Product Launch Awareness' }, { option: 'App Downloads' }, { option: 'Event Registrations' }, { option: 'Sales' }] } },
        { fieldLabel: 'Brand Voice', fieldType: 'dropdown', requiredField: true, fieldOptions: { values: [{ option: 'Friendly & Helpful' }, { option: 'Bold & Energetic' }, { option: 'Witty & Playful' }, { option: 'Professional & Credible' }] } },
        { fieldLabel: 'Landing Page URL', placeholder: 'https://...' },
        { fieldLabel: 'Launch Date', fieldType: 'date', requiredField: true },
        { fieldLabel: 'Approver Email', fieldType: 'email', placeholder: 'you@example.com', requiredField: true }
      ]
    },
    options: {
      appendAttribution: false,
      respondWithOptions: { values: { respondWith: 'text', formSubmittedText: '✅ Brief received! The AI agents are working. Check your inbox for the approval email in about 1–2 minutes.' } }
    }
  }
});

add({
  name: 'Campaign Input', type: 'n8n-nodes-base.set', typeVersion: 3.4, position: [220, 300],
  parameters: {
    assignments: {
      assignments: [
        { id: id(), name: 'campaign_id', type: 'string', value: "=CMP-{{ $now.toFormat('yyyyMMdd-HHmmss') }}" },
        { id: id(), name: 'created_at', type: 'string', value: "={{ $now.toFormat('yyyy-MM-dd HH:mm') }}" },
        { id: id(), name: 'brief', type: 'string', value: "={{ $json['Campaign Brief'] }}" },
        { id: id(), name: 'brand_name', type: 'string', value: "={{ $json['Product Name'] }}" },
        { id: id(), name: 'campaign_goal', type: 'string', value: "={{ $json['Campaign Goal'] }}" },
        { id: id(), name: 'brand_voice', type: 'string', value: "={{ $json['Brand Voice'] }}" },
        { id: id(), name: 'landing_url', type: 'string', value: "={{ $json['Landing Page URL'] }}" },
        { id: id(), name: 'launch_date', type: 'string', value: "={{ $json['Launch Date'] }}" },
        { id: id(), name: 'approver_email', type: 'string', value: "={{ $json['Approver Email'] }}" },
        { id: id(), name: 'quality_threshold', type: 'number', value: 75 },
        { id: id(), name: 'max_attempts', type: 'number', value: 3 }
      ]
    },
    options: {}
  }
});

agent('Strategy Agent', [520, 300], strategyUser, strategySystem);
claude('Claude · Strategy', [480, 540], 0.4);
parser('Strategy Schema', [660, 540], strategySchema);

agent('Audience Agent', [880, 300], audienceUser, audienceSystem);
claude('Claude · Audience', [840, 540], 0.5);
parser('Audience Schema', [1020, 540], audienceSchema);

add({
  name: 'Start First Draft', type: 'n8n-nodes-base.set', typeVersion: 3.4, position: [1300, 300],
  parameters: {
    assignments: {
      assignments: [
        { id: id(), name: 'feedback', type: 'string', value: 'None. This is the first draft.' },
        { id: id(), name: 'previous_draft', type: 'string', value: 'N/A' }
      ]
    },
    options: {}
  }
});

agent('Content Agent', [1540, 300], contentUser, contentSystem);
claude('Claude · Content', [1500, 540], 0.8);
parser('Content Schema', [1680, 540], contentSchema);

agent('Review Agent', [1900, 300], reviewUser, reviewSystem);
claude('Claude · Review', [1860, 540], 0.2);
parser('Review Schema', [2040, 540], reviewSchema);

code('Evaluate Review', [2240, 300], evaluateCode);
ifNode('Score ≥ 75?', [2460, 300], '={{ $json.overall_score }}', { type: 'number', operation: 'gte' }, '={{ $json.threshold }}');
ifNode('Retries Left?', [2680, 460], '={{ $json.can_retry }}', { type: 'boolean', operation: 'true', singleValue: true }, '');
code('Prepare Revision', [2680, 700], revisionCode);

add({
  name: 'Human Approval', type: 'n8n-nodes-base.gmail', typeVersion: 2.1, position: [2960, 280], webhookId: id(),
  parameters: {
    operation: 'sendAndWait',
    sendTo: "={{ $('Campaign Input').first().json.approver_email }}",
    subject: "={{ $json.overall_score >= $json.threshold ? '✅' : '⚠️' }} Approve campaign: {{ $('Campaign Input').first().json.brand_name }} (score {{ $json.overall_score }}/100)",
    message: '={{ $json.approval_html }}',
    approvalOptions: { values: { approvalType: 'double', approveLabel: '✅ Approve & Schedule', disapproveLabel: '❌ Reject & Rewrite' } },
    options: {}
  }
});
ifNode('Approved?', [3180, 280], '={{ $json.data.approved }}', { type: 'boolean', operation: 'true', singleValue: true }, '');

code('Publishing Schedule', [3400, 180], scheduleCode);
add({
  name: 'Campaign Summary', type: '@n8n/n8n-nodes-langchain.chainLlm', typeVersion: 1.5, position: [3620, 180],
  parameters: { promptType: 'define', text: summaryUser }
});
claude('Claude · Summary', [3640, 400], 0.3);
code('Build Campaign Record', [3940, 180], recordCode);
add({
  name: 'Save to Google Sheets', type: 'n8n-nodes-base.googleSheets', typeVersion: 4.5, position: [4160, 180],
  parameters: {
    operation: 'append',
    documentId: { __rl: true, mode: 'url', value: '' },
    sheetName: { __rl: true, mode: 'name', value: 'Campaigns' },
    columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: [], schema: [] },
    options: {}
  }
});
add({
  name: 'Email Final Report', type: 'n8n-nodes-base.gmail', typeVersion: 2.1, position: [4380, 180], webhookId: id(),
  parameters: {
    sendTo: "={{ $('Campaign Input').first().json.approver_email }}",
    subject: "=🚀 Campaign approved & scheduled: {{ $('Build Campaign Record').first().json['Campaign Name'] }}",
    emailType: 'text',
    message: "={{ $('Build Campaign Record').first().json['Summary'] }}\n\n----\nFull content and schedule saved to Google Sheets (Campaign ID {{ $('Build Campaign Record').first().json['Campaign ID'] }}).",
    options: { appendAttribution: false }
  }
});

// ---------- CONNECTIONS ----------
const connections = {};
const main = (from, to, outIndex = 0) => {
  connections[from] ??= {};
  connections[from].main ??= [];
  while (connections[from].main.length <= outIndex) connections[from].main.push([]);
  connections[from].main[outIndex].push({ node: to, type: 'main', index: 0 });
};
const sub = (from, to, type) => {
  connections[from] ??= {};
  connections[from][type] = [[{ node: to, type, index: 0 }]];
};

main('Campaign Brief Form', 'Campaign Input');
main('Campaign Input', 'Strategy Agent');
main('Strategy Agent', 'Audience Agent');
main('Audience Agent', 'Start First Draft');
main('Start First Draft', 'Content Agent');
main('Content Agent', 'Review Agent');
main('Review Agent', 'Evaluate Review');
main('Evaluate Review', 'Score ≥ 75?');
main('Score ≥ 75?', 'Human Approval', 0);
main('Score ≥ 75?', 'Retries Left?', 1);
main('Retries Left?', 'Prepare Revision', 0);
main('Retries Left?', 'Human Approval', 1);
main('Prepare Revision', 'Content Agent');
main('Human Approval', 'Approved?');
main('Approved?', 'Publishing Schedule', 0);
main('Approved?', 'Prepare Revision', 1);
main('Publishing Schedule', 'Campaign Summary');
main('Campaign Summary', 'Build Campaign Record');
main('Build Campaign Record', 'Save to Google Sheets');
main('Save to Google Sheets', 'Email Final Report');

for (const [model, target] of [['Claude · Strategy', 'Strategy Agent'], ['Claude · Audience', 'Audience Agent'], ['Claude · Content', 'Content Agent'], ['Claude · Review', 'Review Agent'], ['Claude · Summary', 'Campaign Summary']]) {
  sub(model, target, 'ai_languageModel');
}
for (const [p, target] of [['Strategy Schema', 'Strategy Agent'], ['Audience Schema', 'Audience Agent'], ['Content Schema', 'Content Agent'], ['Review Schema', 'Review Agent']]) {
  sub(p, target, 'ai_outputParser');
}

const workflow = {
  name: 'AI-Powered Social Media Marketing Automation',
  nodes,
  connections,
  pinData: {},
  settings: { executionOrder: 'v1' },
  meta: { templateCredsSetupCompleted: false }
};
// `--docs-only` rewrites PROMPTS_AND_CODE.md but leaves the workflow JSON (and its node IDs) untouched.
if (process.argv[3] !== '--docs-only') fs.writeFileSync(OUT, JSON.stringify(workflow, null, 2));

// Also dump prompts/schemas so the guide can quote them verbatim.
const F = '```';
const SHEET_HEADERS = ['Campaign ID', 'Created At', 'Brand', 'Campaign Name', 'Brief', 'Goal', 'Target Audience', 'Campaign Angle', 'Tone', 'Primary CTA', 'LinkedIn Post', 'Instagram Caption', 'Instagram Visual', 'X Post', 'X Thread', 'Quality Score', 'Score Breakdown', 'Drafts Needed', 'Status', 'Publishing Schedule', 'Summary'];
const setup = `## Setup: from import to first run (≈25 min)

### What you need
| Credential | Used by | Where to get it |
|---|---|---|
| **Anthropic API key** (Claude) | 5 nodes: \`Claude · Strategy\`, \`Claude · Audience\`, \`Claude · Content\`, \`Claude · Review\`, \`Claude · Summary\` | console.anthropic.com → **Settings → API Keys → Create Key** (add billing credit first) |
| **Google Sheets OAuth2** | \`Save to Google Sheets\` | n8n → **Create → Credential → Google Sheets OAuth2 API → Sign in with Google** |
| **Gmail OAuth2** | \`Human Approval\`, \`Email Final Report\` | n8n → **Create → Credential → Gmail OAuth2 API → Sign in with Google** |

On **n8n Cloud**, "Sign in with Google" works directly. On **self-hosted** n8n you first create a Google OAuth client:
1. console.cloud.google.com → **New Project**.
2. **APIs & Services → Library**: enable **Google Sheets API**, **Google Drive API** and **Gmail API**.
3. **OAuth consent screen**: choose **External** and add your own Gmail address as a **Test user**.
4. **Credentials → Create Credentials → OAuth client ID → Web application**. Under **Authorized redirect URIs**, paste the *OAuth Redirect URL* shown in the n8n credential window.
5. Copy the **Client ID** and **Client Secret** into both n8n Google credentials, then click **Sign in with Google**.

> 🔐 Keys live only in n8n credentials. Never paste them into prompts, Code nodes or files. Exported workflow JSON contains no secrets.

### Step 1: Create the Google Sheet
1. Create a new Google Sheet and rename the first tab to **\`Campaigns\`**.
2. Paste this into cell **A1**. It is tab-separated, so each header lands in its own column. The names must match exactly.

${F}text
${SHEET_HEADERS.join('\t')}
${F}

### Step 2: Import the workflow
1. In n8n, go to **Overview → Create Workflow**.
2. Open the **⋯** menu (top right) → **Import from File…** → choose \`ai-social-media-marketing-automation.json\`.
3. You should see 27 nodes and 4 coloured sticky notes. The nodes with a red ⚠ just need credentials.

### Step 3: Configure these nodes
| Node | What to set |
|---|---|
| \`Claude · Strategy\` / \`· Audience\` / \`· Content\` / \`· Review\` / \`· Summary\` | **Credential**: your Anthropic credential. **Model**: *Claude Sonnet 5.5*, or switch to **By ID** and type \`${MODEL}\`. Keep the temperatures as they are: 0.4 / 0.5 / 0.8 / 0.2 / 0.3. |
| \`Human Approval\` | **Credential**: Gmail. Nothing else to change. |
| \`Email Final Report\` | **Credential**: Gmail. |
| \`Save to Google Sheets\` | **Credential**: Google Sheets. **Document**: *By URL*, paste your sheet's URL. **Sheet**: pick \`Campaigns\`. **Mapping Column Mode**: *Map Automatically*. |
| \`Campaign Input\` *(optional)* | \`quality_threshold\` (default 75) and \`max_attempts\` (default 3). |

Press **Ctrl+S** to save.

### Step 4: First test run
1. Click **Test workflow** at the bottom of the canvas. The form opens in a new tab.
2. Fill in the test campaign below, using **your own email** as the approver, and submit.
3. Watch the nodes turn green. After 1–2 minutes the **approval email** arrives (check spam).
4. Click **✅ Approve & Schedule**. You should then see:
   - a new row in the \`Campaigns\` sheet
   - a "🚀 Campaign approved" email with the summary.

> If you self-host on localhost, click the email buttons on the same computer that runs n8n.

### Step 5: Test the loop and the rejection path
- **Regeneration loop:** set \`quality_threshold\` to **95** and run again. *Content Agent*, *Review Agent* and *Evaluate Review* run 3 times. Then the approval email arrives with a ⚠️ in the subject. Set the threshold back to **75** afterwards.
- **Rejection:** click **❌ Reject & Rewrite**. A new draft is written and a new approval email arrives.
- **Loop safety:** automatic rewrites stop at \`max_attempts\` (3). Human rejections stop at \`max_attempts + 2\` (5 drafts): *Prepare Revision* then ends the run with a clear error.

### Step 6: Go live for the Loom
1. Toggle the workflow to **Active** (top right).
2. Open *Campaign Brief Form*, copy the **Production URL** and use it in the video.
3. Past runs are listed in the **Executions** tab.

### Test campaign
| Field | Value |
|---|---|
| Campaign Brief | Launch StudyPilot, an AI productivity app for college students. Students upload their syllabus PDFs and StudyPilot builds a day-by-day study plan, breaks big assignments into small tasks, and sends nudges 48 hours before every deadline. It syncs with Google Calendar. We are opening a waitlist ahead of public launch; the first 1,000 sign-ups get 3 months of Pro free. Competitors are generic to-do apps like Notion and Todoist that students abandon after a week. |
| Product Name | StudyPilot |
| Campaign Goal | Waitlist / Sign-ups |
| Brand Voice | Friendly & Helpful |
| Landing Page URL | https://studypilot.example.com |
| Launch Date | 2026-11-09 |
| Approver Email | your email |

### Troubleshooting
| Symptom | Fix |
|---|---|
| Agent error mentioning *tools* ("at least one tool") | Your n8n version is older. Update n8n, or open the agent and set **Agent** to *Conversational Agent*. |
| \`Failed to parse output\` | Check that **Maximum Number of Tokens** is 4096 on that Claude node, then re-run the step. Lowering the temperature also helps. |
| \`Cannot read properties of undefined\` | A node was renamed. Expressions look nodes up by name, so restore the original name. |
| Model not in the dropdown | Switch **Model** to **By ID** and type \`${MODEL}\`. |
| Sheet row has empty cells | A header in row 1 doesn't exactly match (watch for trailing spaces). |
| Approval email shows raw HTML | In \`Human Approval\`, replace **Message** with plain text such as \`{{ $json.content.linkedin.post }}\`. |
| Execution stays "Waiting" | It's waiting for the approval click. Check spam. |

---

`;
const flow = `## How data flows between nodes

| Node | Reads | Produces |
|---|---|---|
| Campaign Brief Form | — | form answers keyed by label |
| Campaign Input | \`$json['Campaign Brief']\` … | \`brief, brand_name, campaign_goal, brand_voice, landing_url, launch_date, approver_email, quality_threshold, max_attempts, campaign_id\` |
| Strategy Agent | \`$json.brief\` … | \`output\` → strategy JSON |
| Audience Agent | \`$json.output\` (strategy) | \`output\` → persona JSON |
| Start First Draft | — | \`feedback\`, \`previous_draft\` |
| Content Agent | \`$('Strategy Agent').first().json.output\`, \`$('Audience Agent').first().json.output\`, \`$json.feedback\`, \`$json.previous_draft\` | \`output\` → LinkedIn / Instagram / X JSON |
| Review Agent | \`$json.output\` (draft) | \`output\` → scores, problems, improvements, decision |
| Evaluate Review | \`$input\` (review), \`$('Content Agent').last()\` | \`overall_score, attempt, can_retry, threshold, content, approval_html\` |
| Score ≥ 75? | \`$json.overall_score >= $json.threshold\` | true → Human Approval · false → Retries Left? |
| Retries Left? | \`$json.can_retry\` | true → Prepare Revision · false → Human Approval (⚠️) |
| Prepare Revision | \`$('Evaluate Review').last()\` | \`feedback\`, \`previous_draft\` → **loops back to Content Agent** |
| Human Approval | \`$json.approval_html\` | \`data.approved\` |
| Approved? | \`$json.data.approved\` | true → Publishing Schedule · false → Prepare Revision |
| Publishing Schedule | \`$('Campaign Input')\`, \`$('Evaluate Review').last()\` | \`schedule[]\`, \`schedule_text\` |
| Campaign Summary | \`$json.schedule_text\` + earlier nodes | \`text\` |
| Build Campaign Record | all of the above | one row keyed by sheet headers |
| Save to Google Sheets | that row | appended row |
| Email Final Report | \`$('Build Campaign Record').first().json\` | sends the email |

\`.first()\` reads a node that runs once. \`.last()\` reads the latest run of a node inside the loop.

---

`;
const sec = (title, sys, user, schema) =>
  '## ' + title + '\n\n' +
  (sys ? '### System Message\n*(Agent node → Options → Add Option → System Message)*\n\n' + F + 'text\n' + sys + '\n' + F + '\n\n' : '') +
  '### Prompt (User Message)\n*(Agent node → Source for Prompt = **Define below** → Prompt field. Switch the field to **Expression** mode (hover the field → click **Expression**) before pasting.)*\n\n' + F + 'text\n' + user.slice(1) + '\n' + F + '\n\n' +
  (schema ? '### Output Schema\n*(Structured Output Parser → Schema Type = **Define using JSON Schema**)*\n\n' + F + 'json\n' + JSON.stringify(schema, null, 2) + '\n' + F + '\n\n' : '');
const codeSec = (title, js) => '## Code node: ' + title + '\n\n' + F + 'javascript\n' + js + '\n' + F + '\n\n';
// The hand-written LIVE TEST CHECKLIST block is kept as-is across regenerations.
const DOC = require('path').join(require('path').dirname(OUT), 'PROMPTS_AND_CODE.md');
const START = '<!-- LIVE-TEST-CHECKLIST:START -->', END = '<!-- LIVE-TEST-CHECKLIST:END -->';
const oldDoc = fs.existsSync(DOC) ? fs.readFileSync(DOC, 'utf8') : '';
const keep = oldDoc.includes(START) && oldDoc.includes(END)
  ? oldDoc.slice(oldDoc.indexOf(START), oldDoc.indexOf(END) + END.length) + '\n\n---\n\n'
  : '';
fs.writeFileSync(DOC,
  '# Prompts, Schemas, Code & Setup\n\nEverything here is already inside `ai-social-media-marketing-automation.json`. Import that file, then follow the **LIVE TEST CHECKLIST** below. The prompt, schema and code sections are a reference for when you build nodes by hand or want to tweak a prompt.\n\n' +
  '**Contents:** LIVE TEST CHECKLIST (incl. YFS LOOM DEMO) · Setup summary · How data flows · Agent 1 Strategy · Agent 2 Audience · Agent 3 Content · Agent 4 Review · Campaign Summary · Code nodes\n\n' +
  '> This file is generated by `build-workflow.js`. To regenerate only this file without touching the workflow, run `node build-workflow.js ai-social-media-marketing-automation.json --docs-only`. The LIVE TEST CHECKLIST block between its marker comments is preserved.\n\n---\n\n' +
  keep + setup + flow +
  sec('Agent 1: Marketing Strategy Agent', strategySystem, strategyUser, strategySchema) +
  sec('Agent 2: Audience Intelligence Agent', audienceSystem, audienceUser, audienceSchema) +
  sec('Agent 3: Content Creation Agent', contentSystem, contentUser, contentSchema) +
  sec('Agent 4: Content Review Agent', reviewSystem, reviewUser, reviewSchema) +
  sec('Campaign Summary (Basic LLM Chain, not an agent)', null, summaryUser, null) +
  codeSec('Evaluate Review', evaluateCode) + codeSec('Prepare Revision', revisionCode) +
  codeSec('Publishing Schedule', scheduleCode) + codeSec('Build Campaign Record', recordCode));
console.log('nodes:', nodes.length);
