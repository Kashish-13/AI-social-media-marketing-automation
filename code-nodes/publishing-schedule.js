// Builds a 6-post launch schedule from the launch date using platform best-practice times.
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
  .join('\n');

return [{ json: { campaign_id: cfg.campaign_id, final_score: final.overall_score, schedule, schedule_text } }];
