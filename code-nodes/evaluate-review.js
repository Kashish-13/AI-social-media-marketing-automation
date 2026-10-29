// Combines the draft + the review, recalculates the score deterministically,
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
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
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
  '<p><b>Reviewer\'s favourite part:</b> ' + esc(review.strongest_element) + '</p>' +
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
}];
