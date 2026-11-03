// Server-side twin of the frontend's markdownToHtml / ensureBlockHtml pipeline
// (frontend/src/utils/markdownToHtml.ts + services/ai/clientToolExecutor.ts).
// Notes are stored as TipTap-compatible HTML, so AI-created notes must run the
// exact same conversion or server-created and client-edited notes diverge in
// formatting. Keep this file in sync with the frontend source.

const escapeHtml = (text) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const inlineFormat = (text) =>
  escapeHtml(text)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\b_([^_]+)_\b/g, "<em>$1</em>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");

const parseTableRow = (row) =>
  row
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());

export const markdownToHtml = (md) => {
  // Pre-process to split combined inline code block fences into clean separate lines
  let processedMd = String(md || "").replace(/\r\n/g, "\n");

  // 1. If there's text before a code fence, put the fence on a new line
  processedMd = processedMd.replace(/([^\s`]+)\s*(```)/g, "$1\n$2");

  // 2. If there's code on the same line as the opening fence (e.g. ```javascript const x = 5;), put the code on a new line
  processedMd = processedMd.replace(/(```\w*)\s+([^\s].*)/g, "$1\n$2");

  // 3. If there's text on the same line after a closing fence (e.g. ``` other text), put the text on a new line
  processedMd = processedMd.replace(/(```)\s+([^\s`].*)/g, "$1\n$2");

  const lines = processedMd.split("\n");
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^---+$/.test(line.trim())) {
      out.push("<hr>");
      i++;
      continue;
    }

    // Fenced code blocks
    const fenceMatch = line.match(/^\s*```(.*)/);
    if (fenceMatch) {
      const lang = fenceMatch[1].trim();
      i++;
      const codeLines = [];
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
      const rows = [];
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
        const tableHtml = ["<table>"];
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
          const tableHtml = ["<table>"];
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
      const listItems = [];
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
      const listItems = [];
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

/**
 * Ensures that all top-level elements are wrapped in valid HTML block elements
 * so TipTap and ProseMirror treat them as discrete document blocks. Mirrors
 * ensureBlockHtml in frontend/src/services/ai/clientToolExecutor.ts.
 */
export const ensureBlockHtml = (content) => {
  if (!content || !content.trim()) return "";
  let trimmed = content.trim();

  // If content is Markdown (no HTML block tags detected), convert to HTML
  const hasHtmlBlock = /<\/?(p|div|h[1-6]|ul|ol|li|table|tr|td|th|pre|code|blockquote|hr)[^>]*>/i.test(trimmed);
  if (!hasHtmlBlock) {
    trimmed = markdownToHtml(trimmed).trim();
  }

  // Ensure the top-level element is enclosed in a block tag
  const isBlockStart = /^<(p|h[1-6]|ul|ol|pre|blockquote|table|hr|div)\b/i.test(trimmed);
  if (!isBlockStart) {
    trimmed = `<p>${trimmed}</p>`;
  }

  return trimmed;
};
