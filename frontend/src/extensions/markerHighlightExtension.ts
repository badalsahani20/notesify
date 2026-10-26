import { Mark, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    markerHighlight: {
      toggleMarkerHighlight: (color?: string) => ReturnType;
      setMarkerHighlight: (color?: string) => ReturnType;
    };
  }
}

export const MarkerHighlightExtension = Mark.create({
  name: "markerHighlight",

  addOptions() {
    return {
      HTMLAttributes: {},
      defaultColor: "#fef08a",
    };
  },

  addAttributes() {
    return {
      color: {
        default: this.options.defaultColor,
        parseHTML: (element) => element.getAttribute("data-color") || this.options.defaultColor,
        renderHTML: (attributes) => ({
          "data-color": attributes.color,
          style: `--marker-color: ${attributes.color};`,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "mark[data-color]" }, { tag: "mark" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["mark", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },

  addCommands() {
    return {
      toggleMarkerHighlight:
        (color) =>
        ({ commands }) =>
          commands.toggleMark(this.name, {
            color: color || this.options.defaultColor,
          }),
      setMarkerHighlight:
        (color) =>
        ({ commands }) =>
          commands.setMark(this.name, {
            color: color || this.options.defaultColor,
        }),
    };
  },
});
