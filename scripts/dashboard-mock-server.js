// DEV ONLY: a stand-in for the two n8n dashboard webhooks so the dashboard layout can be
// checked without running n8n. The rows use obvious placeholder text. Never use this in a demo.
//   node scripts/dashboard-mock-server.js      → http://localhost:5679
//   open dashboard/index.html?n8n=http://localhost:5679
const http = require('http');

const placeholder = (what) => '[Placeholder ' + what + ' for layout testing only. Real text comes from the Content Creation Agent.]';
const strategy = { campaign_name: '[Placeholder campaign name]', objective: placeholder('objective'), campaign_angle: placeholder('angle'), key_message: placeholder('key message'), tone: 'placeholder tone', primary_cta: 'placeholder CTA', value_propositions: ['placeholder value 1', 'placeholder value 2'], kpis: ['placeholder KPI 1', 'placeholder KPI 2'] };
const audience = { persona: { name: '[Placeholder persona]', age_range: '18-24', description: placeholder('persona description') }, pain_points: ['placeholder pain 1', 'placeholder pain 2'], motivations: ['placeholder motivation'], best_hook_angles: ['placeholder hook angle'], messaging_style: { words_they_use: ['word1', 'word2', 'word3'] } };
const content = { campaign_tagline: 'placeholder tagline', linkedin: { post: placeholder('LinkedIn post') + '\n\nSecond paragraph.' }, instagram: { caption: placeholder('Instagram caption'), hashtags: ['#placeholder', '#test'], visual_concept: placeholder('visual concept') }, x: { post: placeholder('X post'), thread: ['placeholder tweet 1', 'placeholder tweet 2'] } };
const row = (id, draft, score, next, decision) => ({
  'Timestamp': '2026-11-03 14:1' + draft + ':00', 'Campaign ID': id, 'Event': 'Draft Reviewed', 'Draft': draft, 'Score': score, 'Threshold': 75, 'Decision': decision, 'Next Step': next,
  'Brand': 'MockProduct', 'Goal': 'Product Launch Awareness', 'Brand Voice': 'Friendly & Helpful',
  'Scores': JSON.stringify({ hook: score + 3, clarity: score + 1, engagement: score - 2, brand_alignment: score + 4, cta: score - 6, grammar: 95, platform_fit: score - 1 }),
  'Problems': '[]', 'Recommendations': JSON.stringify(['placeholder suggestion 1', 'placeholder suggestion 2']),
  'Strategy': JSON.stringify(strategy), 'Audience': JSON.stringify(audience), 'Content': JSON.stringify(content)
});
const data = {
  campaigns: [{ 'Campaign ID': 'CMP-MOCK-APPROVED', 'Created At': '2026-11-03 14:20', 'Brand': 'MockProduct', 'Campaign Name': '[Placeholder campaign name]', 'Drafts Needed': 2, 'Status': 'Approved', 'Quality Score': 81, 'Summary': 'CAMPAIGN\n- ' + placeholder('summary'), 'Publishing Schedule': '- Mon 09 Nov 2026, 09:00 | LinkedIn | placeholder' }],
  log: [
    row('CMP-MOCK-PENDING', 1, 68, 'Regenerating draft 2', 'REGENERATE'), row('CMP-MOCK-PENDING', 2, 79, 'Awaiting human approval', 'APPROVE'),
    row('CMP-MOCK-APPROVED', 1, 70, 'Regenerating draft 2', 'REGENERATE'), row('CMP-MOCK-APPROVED', 2, 81, 'Awaiting human approval', 'APPROVE')
  ]
};

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.url.startsWith('/webhook/campaign-dashboard-data')) { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify(data)); }
  if (req.url.startsWith('/webhook/campaign-dashboard-submit') && req.method === 'POST') { return res.end('{"message":"Workflow was started"}'); }
  res.statusCode = 404; res.end();
}).listen(5679, () => console.log('mock n8n on http://localhost:5679'));
