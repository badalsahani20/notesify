import crypto from "node:crypto";

export const normalizeForHash = (text = "") => text.replace(/\s+/g, " ").trim();

export const hashText = (text = "") =>
  crypto
    .createHash("sha256")
    .update(normalizeForHash(text), "utf8")
    .digest("hex");

export const cleanSessionTitle = (title = "") => {
  const cleaned = title
    .replace(/^title\s*:\s*/i, "")
    .replace(/^(user|assistant|system|iris)\s*:\s*/gi, "")
    .replace(/^["'`*_#\s]+|["'`*_#\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (
    !cleaned ||
    /^(here is|here's|untitled|task:|generate|descriptive|return only|no quotes|input content)/i.test(
      cleaned,
    )
  ) {
    return "New Chat";
  }

  return cleaned.slice(0, 54);
};
