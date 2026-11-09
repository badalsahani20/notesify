export interface LegalSection {
  id: string;
  number: string;
  title: string;
  body: string;
}

export interface LegalDocument {
  title: string;
  lastUpdated: string;
  intro: string;
  sections: LegalSection[];
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * Splits a legal markdown document into its introduction and numbered sections.
 * The page chrome owns the title, last-updated date, and section numbering, so
 * those are removed from the rendered markdown.
 */
export function parseLegalDocument(markdown: string): LegalDocument {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let index = 0;
  let title = "";
  let lastUpdated = "";

  while (index < lines.length && lines[index].trim() === "") index++;

  // Drop the document title and its last-updated line.
  if (index < lines.length && /^#\s+/.test(lines[index])) {
    title = lines[index].replace(/^#\s+/, "").trim();
    index++;
  }
  while (index < lines.length && lines[index].trim() === "") index++;

  const updatedLine = lines[index]?.trim() ?? "";
  const updatedMatch =
    updatedLine.match(/^\*\*last updated:\s*(.+?)\*\*$/i) ??
    updatedLine.match(/^\*\*last updated:?\*\*\s*(.+)$/i);
  if (updatedMatch) {
    lastUpdated = updatedMatch[1].trim();
    index++;
  }

  const introLines: string[] = [];
  const chunks: Array<{ heading: string; body: string[] }> = [];
  let current: { heading: string; body: string[] } | null = null;
  let inCodeFence = false;

  for (; index < lines.length; index++) {
    const line = lines[index];

    if (/^```/.test(line.trim())) inCodeFence = !inCodeFence;

    if (!inCodeFence && /^##\s+/.test(line)) {
      if (current) chunks.push(current);
      current = {
        heading: line.replace(/^##\s+/, "").trim(),
        body: [],
      };
      continue;
    }

    if (current) current.body.push(line);
    else introLines.push(line);
  }

  if (current) chunks.push(current);

  const clean = (value: string) =>
    value
      .replace(/^\s*---\s*$/gm, "")
      .trim();

  const usedIds = new Map<string, number>();

  const sections = chunks.map(({ heading, body }, sectionIndex) => {
    const numbered = heading.match(/^(\d+)\.\s+(.+)$/);
    const rawNumber = numbered?.[1] ?? "";
    const title = (numbered?.[2] ?? heading).trim();
    const baseId = slugify(title) || `section-${sectionIndex + 1}`;
    const idCount = usedIds.get(baseId) ?? 0;

    usedIds.set(baseId, idCount + 1);

    return {
      id: idCount === 0 ? baseId : `${baseId}-${idCount + 1}`,
      number: (rawNumber || String(sectionIndex + 1)).padStart(2, "0"),
      title,
      body: clean(body.join("\n")),
    };
  });

  return {
    title,
    lastUpdated,
    intro: clean(introLines.join("\n")),
    sections,
  };
}

export function estimateReadTime(document: LegalDocument): string {
  const wordCount = `${document.intro} ${document.sections
    .map((section) => section.body)
    .join(" ")}`
    .replace(/[#>*_`|]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;

  const low = Math.max(1, Math.round(wordCount / 260));
  const high = Math.max(low + 1, Math.round(wordCount / 220));

  return `${low}–${high} min read`;
}
