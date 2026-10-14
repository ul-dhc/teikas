import { legends, type Localized } from './data';

type Section = { id: string; title: Localized; count: number };
type Theme = { id: string; volume: string; code: string; title: Localized; count: number; sections: Section[] };
const grouped = new Map<string, Theme>();
const sections = new Map<string, Section>();

// The source IDs encode volume (2 digits), chapter (2), subsection (2), record (3).
// Group by this hierarchy, never by titles: repeated titles may belong to different sections.
for (const legend of legends) {
  if (!/^\d{9}$/.test(legend.id)) throw new Error(`Unrecognized collection ID: ${legend.id}`);
  const chapterId = legend.id.slice(0, 4), sectionId = legend.id.slice(0, 6);
  let theme = grouped.get(chapterId);
  if (!theme) {
    theme = { id: chapterId, volume: legend.volume, code: `${legend.volume}.${chapterId.slice(2)}`, title: legend.chapter, count: 0, sections: [] };
    grouped.set(chapterId, theme);
  }
  if (theme.volume !== legend.volume || theme.title.lv !== legend.chapter.lv) throw new Error(`Inconsistent chapter: ${chapterId}`);
  let section = sections.get(sectionId);
  if (!section) {
    section = { id: sectionId, title: legend.title, count: 0 };
    sections.set(sectionId, section);
    theme.sections.push(section);
  }
  if (section.title.lv !== legend.title.lv) throw new Error(`Inconsistent subsection: ${sectionId}`);
  theme.count++;
  section.count++;
}
export const themes = [...grouped.values()].sort((a, b) => a.id.localeCompare(b.id));
for (const theme of themes) theme.sections.sort((a, b) => a.id.localeCompare(b.id));
export const subsectionCount = sections.size;
