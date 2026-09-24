import type { WebCitation } from "@/components/ai/types";

/**
 * Automatically converts raw bracket citations like [1], [2], or [1, 2]
 * into markdown links [1](url) using the provided citations list,
 * leaving existing markdown links untouched.
 */
export function linkifyCitations(text: string, citations?: WebCitation[]): string {
  if (!text || !citations || citations.length === 0) return text;

  // Replace multi-citations like [1, 2] or [1, 2, 3]
  let result = text.replace(/\[(\d+(?:\s*,\s*\d+)+)\](?!\()/g, (_match, numsStr) => {
    const nums = numsStr.split(",").map((s: string) => parseInt(s.trim(), 10));
    const replaced = nums
      .map((num: number) => {
        const c = citations[num - 1];
        return c?.url ? `[${num}](${c.url})` : `[${num}]`;
      })
      .join(" ");
    return replaced;
  });

  // Replace single [1]
  result = result.replace(/\[(\d+)\](?!\()/g, (fullMatch, numStr) => {
    const num = parseInt(numStr, 10);
    const c = citations[num - 1];
    return c?.url ? `[${num}](${c.url})` : fullMatch;
  });

  return result;
}
