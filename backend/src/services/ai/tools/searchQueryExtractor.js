/**
 * Extracts and sanitizes a concise, keyword-focused search query from conversational user input.
 * Strips conversational greetings, filler, question wrappers, and trailing punctuation.
 */
export function extractCleanSearchQuery(message) {
  if (!message || typeof message !== "string") return "";

  let q = message.trim();

  // 1. Strip conversational filler words / greetings at the beginning
  // e.g. "umm...", "uhh", "hey iris", "hello!", "yo", "please", "can you"
  q = q.replace(
    /^(?:(?:hey+|hi+|hello+|yo+|umm+|uh+|er+|ah+|please|kindly)\b[,\s]*)*(?:iris|ai|assistant|bot)?\b[,\s.:;!?-]*/i,
    ""
  );

  // 2. Strip conversational query prefixes / intent wrappers
  const prefixPatterns = [
    /^(?:can|could|would|will)\s+you\s+(?:please\s+|kindly\s+)?(?:search(?:\s+the\s+web)?(?:\s+for)?|look\s+up|find(?:\s+out)?|check(?:\s+out)?|google|tell\s+me(?:\s+about)?|give\s+me)\s+/i,
    /^(?:please\s+|kindly\s+)?(?:search(?:\s+the\s+web)?(?:\s+for)?|look\s+up|find(?:\s+out)?|check(?:\s+out)?|google)\s+/i,
    /^(?:tell\s+me\s+about|tell\s+me|give\s+me|do\s+you\s+know(?:\s+about)?)\s+/i,
    /^(?:any\s+(?:updates?|news|info(?:rmation)?)\s+on|latest\s+(?:updates?|news|info(?:rmation)?)\s+on)\s+/i,
    /^(?:what(?:'s|\s+is|\s+are)\s+(?:the\s+)?(?:latest\s+)?(?:news|updates?)\s+on)\s+/i,
    /^(?:what(?:'s|\s+is|\s+are)|who(?:'s|\s+is|\s+are)|where(?:'s|\s+is|\s+are)|when(?:'s|\s+is|\s+are)|how(?:'s|\s+is|\s+are))\s+(?:the\s+)?/i,
    /^(?:the\s+)/i,
  ];

  let changed = true;
  let iterations = 0;
  while (changed && iterations < 4) {
    changed = false;
    iterations++;
    for (const pat of prefixPatterns) {
      if (pat.test(q)) {
        q = q.replace(pat, "").trim();
        changed = true;
      }
    }
  }

  // 3. Strip trailing conversational fluff / punctuation
  q = q.replace(/[,.]?\s*(?:for\s+me)?\s*(?:please|kindly)\s*[.?!]*$/i, "");
  q = q.replace(/[,.]?\s*(?:right\s+now|at\s+the\s+moment)\s*[.?!]*$/i, "");
  q = q.replace(/[?!.:;,]+$/g, "").trim();

  // If query became too short or empty, fallback to message without trailing punctuation
  if (!q || q.length < 3) {
    q = message.replace(/[?!.:;]+$/g, "").trim();
  }

  // Cap query length for clean display
  if (q.length > 80) {
    q = q.slice(0, 80).trim();
  }

  return q;
}
