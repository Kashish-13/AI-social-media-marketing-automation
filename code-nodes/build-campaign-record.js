// One flat row for Google Sheets. The keys must match the sheet's header row exactly.
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
    'X Thread': c.x.thread.join('\n\n'),
    'Quality Score': final.overall_score,
    'Score Breakdown': Object.entries(final.scores).map(([k, v]) => k + ': ' + v).join(', '),
    'Drafts Needed': final.attempt,
    'Status': 'Approved',
    'Publishing Schedule': sched.schedule_text,
    'Summary': $input.first().json.text
  }
}];
