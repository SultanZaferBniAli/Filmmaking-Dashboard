// Real trainer data only carries a free-text craft/field label (e.g. "الإخراج السينمائي",
// "المونتاج والرسوم المتحركة") — not a curated list of short skill tags. This maps that label's
// keywords to a small set of genuine, closely-related craft tags for compact pill display,
// rather than fabricating unrelated skills.
const CRAFT_TAGS: { pattern: RegExp; tags: string[] }[] = [
  { pattern: /مونتاج|تحرير|محرر/, tags: ['المونتاج', 'إيقاع السرد', 'بناء المشاهد'] },
  { pattern: /رسوم متحركة|أنيميشن/, tags: ['الرسوم المتحركة', 'التحريك'] },
  { pattern: /إخراج/, tags: ['الإخراج', 'بناء المشاهد', 'إدارة الممثلين'] },
  { pattern: /سيناريو|كتابة/, tags: ['كتابة السيناريو', 'بناء الحبكة', 'السرد السينمائي'] },
  { pattern: /تصوير/, tags: ['التصوير السينمائي', 'حركة الكاميرا'] },
  { pattern: /صوت/, tags: ['تصميم الصوت', 'المزج الصوتي'] },
  { pattern: /ألوان|تصحيح/, tags: ['تصحيح الألوان', 'الدرجة اللونية'] },
  { pattern: /مؤثرات بصرية|vfx/i, tags: ['المؤثرات البصرية', 'التصوير المركب'] },
  { pattern: /إضاءة/, tags: ['تصميم الإضاءة', 'الجو البصري'] },
  { pattern: /إنتاج/, tags: ['الإنتاج', 'إدارة الميزانية'] },
  { pattern: /أزياء/, tags: ['تصميم الأزياء', 'الهوية البصرية'] },
  { pattern: /مكياج/, tags: ['تصميم المكياج'] },
  { pattern: /ستوري بورد/, tags: ['الستوري بورد', 'التصور البصري'] },
  { pattern: /مواقع/, tags: ['إدارة المواقع'] },
];

export function deriveExpertiseTags(role: string): string[] {
  const matched = CRAFT_TAGS.filter((c) => c.pattern.test(role)).flatMap((c) => c.tags);
  const unique = Array.from(new Set(matched));
  return unique.length > 0 ? unique.slice(0, 4) : [role];
}
