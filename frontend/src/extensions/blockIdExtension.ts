import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "prosemirror-state";

export const generateBlockId = () => "b_" + Math.random().toString(36).slice(2, 9);

export const BlockIdExtension = Extension.create({
    name: "blockId",

    addGlobalAttributes() {
        return [
            {
                types: [
                    "paragraph",
                    "heading",
                    "codeBlock",
                    "blockquote",
                    "listItem",
                    "taskItem",
                ],
                attributes: {
                    blockId: {
                        default: null,
                        rendered: true,
                        parseHTML: (element) => element.getAttribute("data-block-id"),
                        renderHTML: (attribute) => {
                            if (!attribute.blockId) return {};
                            return { "data-block-id": attribute.blockId };
                        },
                    },
                },
            },
        ]
    },

    addProseMirrorPlugins() {
        return [
            new Plugin({
                key: new PluginKey("blockIdPlugin"),
                appendTransaction: (transactions, oldState, newState) => {
                    // Only process when document content actually changed
                    const docChanged = transactions.some((tr) => tr.docChanged);
                    if(!docChanged && oldState.doc.eq(newState.doc)) return null; 
                    
                    const tr = newState.tr;
                    let modified = false;
                    const seenIds = new Set<string>();
                    newState.doc.descendants((node, pos) => {
                        if(["paragraph", "heading", "codeBlock", "blockquote", "listItem", "taskItem"].includes(node.type.name)) {
                            const currentId = node.attrs.blockId;
                             // If block has no ID, or shares a duplicate ID (e.g. when split via Enter key)
                             if(!currentId || seenIds.has(currentId)) {
                                const newId = generateBlockId();
                                tr.setNodeMarkup(pos, undefined, {
                                    ...node.attrs,
                                    blockId: newId,
                                });
                                seenIds.add(newId);
                                modified = true;
                             } else {
                                seenIds.add(currentId);
                             }
                        }
                    });

                    return modified ? tr : null;
                },
            }),
        ];
    },
});