import { defaultSchema } from "rehype-sanitize";
import type { Schema } from "hast-util-sanitize";

/**
 * GitHub's default schema, extended only for the private Iris directive
 * elements and the small set of formatting tags the assistant emits.
 *
 * Keep this allowlist tight: raw AI HTML flows through here before
 * react-markdown renders it.
 */
export const irisSanitizeSchema: Schema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "figcaption",
    "figure",
    "iris-callout",
    "iris-comparison",
    "iris-takeaway",
    "mark",
    "u",
  ],
  attributes: {
    ...defaultSchema.attributes,
    "iris-callout": ["dataTitle", "dataVariant"],
    "iris-comparison": [],
    "iris-takeaway": ["dataTitle"],
  },
  protocols: {
    ...defaultSchema.protocols,
    // Let note images use inline data URLs; scripts cannot execute inside img.
    src: [...(defaultSchema.protocols?.src ?? []), "data"],
  },
};
