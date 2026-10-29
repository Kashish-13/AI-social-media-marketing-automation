// Builds the feedback package that is sent back to the Content Agent.
const r = $('Evaluate Review').last().json;
const humanRejected = $input.first().json.data?.approved === false;

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
    feedback: lines.join('\n'),
    previous_draft: JSON.stringify(r.content, null, 2)
  }
}];
