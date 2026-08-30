export const FOLDER_COLORS = [
  { value: "slate", label: "Slate", hex: "#94a3b8" },
  { value: "blue", label: "Blue", hex: "#60a5fa" },
  { value: "violet", label: "Violet", hex: "#a78bfa" },
  { value: "emerald", label: "Emerald", hex: "#34d399" },
  { value: "amber", label: "Amber", hex: "#fbbf24" },
  { value: "rose", label: "Rose", hex: "#fb7185" },
  { value: "orange", label: "Orange", hex: "#fb923c" },
  { value: "cyan", label: "Cyan", hex: "#22d3ee" },
] as const;

export type FolderColor = (typeof FOLDER_COLORS)[number]["value"];

export const getFolderColor = (value?: string) =>
  FOLDER_COLORS.find((color) => color.value === value)?.hex ??
  (value === "bg-gray-100" ? "#94a3b8" : value || "#94a3b8");
