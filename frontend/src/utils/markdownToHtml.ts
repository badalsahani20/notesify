// Lightweight Markdown -> HTML converter for editor paste and AI insertion.
// TipTap parses HTML/JSON content, not raw markdown strings.
export const DOCUMENT_PATTERNS = [
  /^#{1,6}\s/m,
  /^\s*[-*+]\s/m,
  /^\s*\d+\.\s/m,
  /^\|.+\|/m,
  /^\s*>/m,
  /^\s*- \[[ x]\]/m,
  /^---+$/m,
  /^\s*`{3,}/m,
  /\[.+\]\([^\s]+\)/,
  /\*\*.+\*\*/,
  /`.+`/,
];

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const inlineFormat = (text: string): string =>
  escapeHtml(text)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\b_([^_]+)_\b/g, "<em>$1</em>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");

const parseTableRow = (row: string): string[] =>
  row
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());

export const markdownToHtml = (md: string): string => {
  // Pre-process to split combined inline code block fences into clean separate lines
  let processedMd = md.replace(/\r\n/g, "\n");

  // 1. If there's text before a code fence, put the fence on a new line
  processedMd = processedMd.replace(/([^\s`]+)\s*(```)/g, "$1\n$2");

  // 2. If there's code on the same line as the opening fence (e.g. ```javascript const x = 5;), put the code on a new line
  processedMd = processedMd.replace(/(```\w*)\s+([^\s].*)/g, "$1\n$2");

  // 3. If there's text on the same line after a closing fence (e.g. ``` other text), put the other text on a new line
  processedMd = processedMd.replace(/(```)\s+([^\s`].*)/g, "$1\n$2");

  const lines = processedMd.split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^---+$/.test(line.trim())) {
      out.push("<hr>");
      i++;
      continue;
    }

    // ── Fenced code blocks ─────────────────────────────────────────────────
    const fenceMatch = line.match(/^\s*```(.*)/);
    if (fenceMatch) {
      const lang = fenceMatch[1].trim();
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      const codeContent = codeLines
        .join("\n")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
        
      if (!lang || lang === "text" || lang === "plaintext") {
        out.push(`<pre><code>${codeContent}</code></pre>`);
      } else {
        out.push(`<pre><code class="language-${lang}">${codeContent}</code></pre>`);
      }
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      out.push(`<h${level}>${inlineFormat(headingMatch[2])}</h${level}>`);
      i++;
      continue;
    }

    if (
      i + 1 < lines.length &&
      line.includes("|") &&
      lines[i + 1].includes("|") &&
      /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/.test(lines[i + 1].trim())
    ) {
      const headers = parseTableRow(line);
      const rows: string[][] = [];
      i += 2;

      while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") {
        const cells = parseTableRow(lines[i]);
        rows.push(cells);
        i++;
      }

      // Guard: Discard completely empty tables (e.g. placeholder | | rows with no text)
      const hasHeaderContent = headers.some((h) => h.trim().length > 0);
      const hasRowContent = rows.some((row) => row.some((c) => c.trim().length > 0));

      if (hasHeaderContent || hasRowContent) {
        const tableHtml: string[] = ["<table>"];
        tableHtml.push("<tr>");
        headers.forEach((header) => tableHtml.push(`<th>${inlineFormat(header)}</th>`));
        tableHtml.push("</tr>");

        rows.forEach((row) => {
          tableHtml.push("<tr>");
          row.forEach((cell) => tableHtml.push(`<td>${inlineFormat(cell)}</td>`));
          tableHtml.push("</tr>");
        });

        tableHtml.push("</table>");
        out.push(tableHtml.join(""));
      }
      continue;
    }

    if (line.includes("\t")) {
      const tabsCount = line.split("\t").length - 1;
      if (tabsCount > 0) {
        let isTabTable = false;
        let j = i + 1;
        while (j < lines.length && lines[j].includes("\t") && lines[j].split("\t").length - 1 === tabsCount) {
          isTabTable = true;
          j++;
        }

        if (isTabTable) {
          const tableHtml: string[] = ["<table>"];
          const headers = lines[i].split("\t").map((cell) => cell.trim());
          tableHtml.push("<tr>");
          headers.forEach((header) => tableHtml.push(`<th>${inlineFormat(header)}</th>`));
          tableHtml.push("</tr>");
          i++;

          while (i < j) {
            const cells = lines[i].split("\t").map((cell) => cell.trim());
            tableHtml.push("<tr>");
            cells.forEach((cell) => tableHtml.push(`<td>${inlineFormat(cell)}</td>`));
            tableHtml.push("</tr>");
            i++;
          }

          tableHtml.push("</table>");
          out.push(tableHtml.join(""));
          continue;
        }
      }
    }

    if (/^\s*>\s?/.test(line)) {
      const content = line.replace(/^\s*>\s?/, "");
      out.push(`<blockquote><p>${inlineFormat(content)}</p></blockquote>`);
      i++;
      continue;
    }

    if (/^\s*[-*+]\s/.test(line)) {
      const listItems: string[] = [];
      while (i < lines.length) {
        const cur = lines[i];
        // blank line — skip but keep collecting if next line is still a bullet
        if (cur.trim() === "") {
          const next = lines[i + 1];
          if (next === undefined || !/^\s*[-*+]\s/.test(next)) break;
          i++;
          continue;
        }
        // new bullet item
        if (/^\s*[-*+]\s/.test(cur)) {
          const taskMatch = cur.match(/^\s*[-*+]\s+\[([ x])\]\s+(.*)/);
          if (taskMatch) {
            const checked = taskMatch[1] === "x" ? ' data-checked="true"' : "";
            listItems.push(`<li data-type="taskItem"${checked}><p>${inlineFormat(taskMatch[2])}</p></li>`);
          } else {
            listItems.push(`<li><p>${inlineFormat(cur.replace(/^\s*[-*+]\s+/, ""))}</p></li>`);
          }
          i++;
          continue;
        }

        // If the continuation line is the start of another block element, break out of the list
        if (/^\s*```/.test(cur) || /^(#{1,6})\s+/.test(cur) || /^\s*\d+\.\s/.test(cur) || /^\s*>\s?/.test(cur) || /^---+$/.test(cur)) {
          break;
        }

        // continuation line — belongs to the previous <li>
        if (listItems.length > 0 && cur.trim() !== "") {
          // Append to the text inside the last <li>'s <p>
          listItems[listItems.length - 1] = listItems[listItems.length - 1].replace(
            /<\/p><\/li>$/,
            ` ${inlineFormat(cur.trim())}</p></li>`
          );
          i++;
          continue;
        }
        break;
      }
      out.push(`<ul>${listItems.join("")}</ul>`);
      continue;
    }

    if (/^\s*\d+\.\s/.test(line)) {
      const listItems: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s/.test(lines[i])) {
        listItems.push(`<li><p>${inlineFormat(lines[i].replace(/^\s*\d+\.\s+/, ""))}</p></li>`);
        i++;
      }
      out.push(`<ol>${listItems.join("")}</ol>`);
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    if (lines.length === 1) {
      out.push(inlineFormat(line));
    } else {
      out.push(`<p>${inlineFormat(line)}</p>`);
    }
    i++;
  }

  return out.join("");
};
