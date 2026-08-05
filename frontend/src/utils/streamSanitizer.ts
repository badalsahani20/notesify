/**
 * Utility to auto-close and repair incomplete markup, code blocks, JSON/XML tags,
 * unmatched brackets, and LaTeX expressions during live streaming or incomplete generation.
 */

/**
 * Automatically closes any open markdown code blocks (```).
 */
export function closeIncompleteCodeBlocks(text: string): string {
  const lines = text.split("\n");
  let insideCodeBlock = false;

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      insideCodeBlock = !insideCodeBlock;
    }
  }

  if (insideCodeBlock) {
    return text + "\n```";
  }
  return text;
}

/**
 * Automatically closes unmatched opening brackets ([ ( {) outside of code blocks/inline code.
 */
export function closeUnmatchedBrackets(text: string): string {
  const stack: string[] = [];
  let insideCodeBlock = false;
  let insideInlineCode = false;

  let i = 0;
  while (i < text.length) {
    if (text.startsWith("```", i)) {
      insideCodeBlock = !insideCodeBlock;
      i += 3;
      continue;
    }

    if (text[i] === "`" && !insideCodeBlock) {
      insideInlineCode = !insideInlineCode;
      i++;
      continue;
    }

    if (insideCodeBlock || insideInlineCode) {
      i++;
      continue;
    }

    const char = text[i];
    if (char === "(" || char === "[" || char === "{") {
      stack.push(char);
    } else if (char === ")") {
      if (stack[stack.length - 1] === "(") stack.pop();
    } else if (char === "]") {
      if (stack[stack.length - 1] === "[") stack.pop();
    } else if (char === "}") {
      if (stack[stack.length - 1] === "{") stack.pop();
    }

    i++;
  }

  let closing = "";
  while (stack.length > 0) {
    const open = stack.pop();
    if (open === "(") closing += ")";
    if (open === "[") closing += "]";
    if (open === "{") closing += "}";
  }

  return text + closing;
}

/**
 * Automatically closes unclosed LaTeX $ or $$ blocks.
 */
export function closeLaTeX(text: string): string {
  let cleanText = "";
  let insideCodeBlock = false;
  const lines = text.split("\n");
  
  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      insideCodeBlock = !insideCodeBlock;
    }
    if (!insideCodeBlock) {
      cleanText += line + "\n";
    }
  }

  // Count $$ occurrences
  const doubleDollarCount = (cleanText.match(/\$\$/g) || []).length;
  if (doubleDollarCount % 2 !== 0) {
    return text + "\n$$";
  }

  // Count $ occurrences (excluding $$)
  const singleText = cleanText.replace(/\$\$/g, "");
  const singleDollarCount = (singleText.match(/\$/g) || []).length;
  if (singleDollarCount % 2 !== 0) {
    const lastDollarIndex = text.lastIndexOf("$");
    if (lastDollarIndex !== -1 && lastDollarIndex < text.length - 1) {
      const charAfter = text[lastDollarIndex + 1];
      if (/^[a-zA-Z\\{(_]/.test(charAfter)) {
        return text + "$";
      }
    }
  }
  return text;
}

/**
 * Automatically closes unclosed string quotes and curly/square braces in uncompleted json code blocks.
 */
export function closeUnfinishedJson(text: string): string {
  const jsonBlockRegex = /```(json|comparison)\s*\n([\s\S]*?)$/;
  const match = text.match(jsonBlockRegex);
  if (match) {
    const jsonContent = match[2];
    const stack: string[] = [];
    let insideString = false;
    let escape = false;

    for (let i = 0; i < jsonContent.length; i++) {
      const char = jsonContent[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (char === "\\") {
        escape = true;
        continue;
      }
      if (char === '"') {
        insideString = !insideString;
        continue;
      }
      if (insideString) {
        continue;
      }
      if (char === "{" || char === "[") {
        stack.push(char);
      } else if (char === "}") {
        if (stack[stack.length - 1] === "{") stack.pop();
      } else if (char === "]") {
        if (stack[stack.length - 1] === "[") stack.pop();
      }
    }

    let closing = "";
    if (insideString) {
      closing += '"';
    }
    while (stack.length > 0) {
      const open = stack.pop();
      if (open === "{") closing += "}";
      if (open === "[") closing += "]";
    }
    return text + closing;
  }
  return text;
}

/**
 * Escapes < and > outside of code blocks to prevent react-markdown from swallowing them as HTML tags.
 */
export function escapeHtmlTags(text: string): string {
  let cleanText = "";
  let insideCodeBlock = false;
  let insideInlineCode = false;

  let i = 0;
  while (i < text.length) {
    if (text.startsWith("```", i)) {
      insideCodeBlock = !insideCodeBlock;
      cleanText += "```";
      i += 3;
      continue;
    }

    if (text[i] === "`" && !insideCodeBlock) {
      insideInlineCode = !insideInlineCode;
      cleanText += "`";
      i++;
      continue;
    }

    if (!insideCodeBlock && !insideInlineCode) {
      if (text[i] === "<") cleanText += "&lt;";
      else if (text[i] === ">") cleanText += "&gt;";
      else cleanText += text[i];
    } else {
      cleanText += text[i];
    }
    i++;
  }

  return cleanText;
}

/**
 * Strips completed and in-flight <think> or <thought> tags from streamed content.
 */
export function stripThoughtTags(text: string): string {
  if (!text) return "";
  // Strip complete <think>...</think> or <thought>...</thought> tags
  let cleaned = text.replace(/<(think|thought)>[\s\S]*?<\/(think|thought)>/gi, "");
  // Strip in-flight opening <think> or <thought> tag up to end of text while streaming
  cleaned = cleaned.replace(/<(think|thought)>[\s\S]*$/gi, "");
  return cleaned.trimStart();
}

/**
 * Applies all streaming sanitizations in the correct sequence.
 */
export function sanitizeStream(text: string): string {
  if (!text) return "";
  
  let sanitized = stripThoughtTags(text);
  
  // 1. Escape `<` and `>` to prevent Markdown parser from stripping them
  sanitized = escapeHtmlTags(sanitized);

  // 2. Unfinished JSON inside json code blocks
  sanitized = closeUnfinishedJson(sanitized);

  // 3. LaTeX blocks
  sanitized = closeLaTeX(sanitized);

  // 4. Incomplete Markdown fences
  sanitized = closeIncompleteCodeBlocks(sanitized);

  // 5. Unmatched brackets (ignoring closed code blocks)
  sanitized = closeUnmatchedBrackets(sanitized);

  return sanitized;
}
