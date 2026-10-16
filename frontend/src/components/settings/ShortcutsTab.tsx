import React from "react";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform);
const MOD = isMac ? "⌘" : "Ctrl";
const ALT = isMac ? "⌥" : "Alt";

type Row = { keys: string[][]; label: string };
type Section = { title: string; rows: Row[] };

const SECTIONS: Section[] = [
  {
    title: "Text Formatting",
    rows: [
      { keys: [[MOD, "B"]], label: "Bold" },
      { keys: [[MOD, "I"]], label: "Italic" },
      { keys: [[MOD, "U"]], label: "Underline" },
      { keys: [[MOD, "⇧", "S"]], label: "Strikethrough" },
      { keys: [[MOD, "E"]], label: "Inline code" },
      { keys: [[MOD, "⇧", "H"]], label: "Highlight" },
      { keys: [[MOD, "K"]], label: "Insert / remove link" },
      { keys: [[MOD, "\\"]], label: "Clear all formatting" },
    ],
  },
  {
    title: "Structure & Blocks",
    rows: [
      { keys: [[MOD, ALT, "1"]], label: "Heading 1" },
      { keys: [[MOD, ALT, "2"]], label: "Heading 2" },
      { keys: [[MOD, ALT, "3"]], label: "Heading 3" },
      { keys: [[MOD, "⇧", "7"]], label: "Ordered list" },
      { keys: [[MOD, "⇧", "8"]], label: "Bullet list" },
      { keys: [[MOD, "⇧", "9"]], label: "Blockquote" },
      { keys: [[MOD, "⇧", "C"]], label: "Code block (no selection)" },
      { keys: [["Tab"]], label: "Indent list item" },
      { keys: [["⇧", "Tab"]], label: "Outdent list item" },
    ],
  },
  {
    title: "Markdown as You Type",
    rows: [
      { keys: [["#", "Space"]], label: "Heading 1" },
      { keys: [["##", "Space"]], label: "Heading 2" },
      { keys: [["###", "Space"]], label: "Heading 3" },
      { keys: [["-", "Space"]], label: "Bullet list" },
      { keys: [["1.", "Space"]], label: "Numbered list" },
      { keys: [[">", "Space"]], label: "Blockquote" },
      { keys: [["[ ]", "Space"]], label: "Task item" },
      { keys: [["---", "↵"]], label: "Horizontal rule" },
      { keys: [["```", "↵"]], label: "Code block" },
      { keys: [["**text**"]], label: "Bold" },
      { keys: [["*text*"]], label: "Italic" },
      { keys: [["`code`"]], label: "Inline code" },
      { keys: [["~~text~~"]], label: "Strikethrough" },
    ],
  },
  {
    title: "Iris AI Assistant",
    rows: [
      { keys: [[MOD, "J"]], label: "Toggle contextual Iris panel (with selection context)" },
      { keys: [[MOD, "⇧", "J"]], label: "Toggle full Global Iris Chat" },
      { keys: [["Esc"]], label: "Close Iris panel & return focus" },
    ],
  },
  {
    title: "Editor Actions",
    rows: [
      { keys: [[MOD, "/"]], label: "Open this shortcuts guide" },
      { keys: [[MOD, ALT, "F"]], label: "Auto-format raw markdown" },
      { keys: [["Esc"]], label: "Exit focus mode" },
    ],
  },
];

const Key = ({ children }: { children: React.ReactNode }) => (
  <kbd
    style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "0.15rem 0.45rem",
      borderRadius: "0.35rem",
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.1)",
      fontSize: "0.72rem",
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      color: "#d4d4d8",
      lineHeight: 1.4,
      whiteSpace: "nowrap",
      userSelect: "none",
    }}
  >
    {children}
  </kbd>
);

const Combo = ({ keys }: { keys: string[] }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
    {keys.map((k, i) => (
      <React.Fragment key={i}>
        <Key>{k}</Key>
        {i < keys.length - 1 && (
          <span style={{ color: "#52525b", fontSize: "0.7rem", margin: "0 1px" }}>+</span>
        )}
      </React.Fragment>
    ))}
  </span>
);

export const ShortcutsTab = () => (
  <div>
    <div style={{ marginBottom: "1.5rem" }}>
      <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "#f4f4f5", marginBottom: "0.25rem" }}>
        Keyboard Shortcuts
      </h2>
      <p style={{ fontSize: "0.8rem", color: "#71717a" }}>
        All shortcuts available in the note editor. Press{" "}
        <Key>{MOD}</Key>{" "}
        <span style={{ color: "#52525b", fontSize: "0.7rem" }}>+</span>{" "}
        <Key>/</Key>{" "}
        to open this reference anytime while editing.
      </p>
    </div>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: "1.25rem",
      }}
    >
      {SECTIONS.map((section) => (
        <div
          key={section.title}
          style={{
            borderRadius: "0.75rem",
            border: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(255,255,255,0.02)",
            padding: "1rem",
          }}
        >
          <h3
            style={{
              fontSize: "0.7rem",
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#6366f1",
              marginBottom: "0.75rem",
            }}
          >
            {section.title}
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
            {section.rows.map((row) => (
              <div
                key={row.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.5rem",
                }}
              >
                <span style={{ fontSize: "0.8rem", color: "#a1a1aa", flexShrink: 0 }}>
                  {row.label}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {row.keys.map((combo, ci) => (
                    <React.Fragment key={ci}>
                      {ci > 0 && (
                        <span style={{ fontSize: "0.68rem", color: "#52525b" }}>or</span>
                      )}
                      <Combo keys={combo} />
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);
