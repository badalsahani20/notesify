import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { X } from 'lucide-react';

export default function ImageNodeView(props: NodeViewProps) {
  return (
    <NodeViewWrapper className="relative flex group my-6 w-full max-w-full">
      <div className="relative inline-block max-w-full">
        <img 
          src={props.node.attrs.src} 
          alt={props.node.attrs.alt} 
          title={props.node.attrs.title}
          className="m-0"
        />
        <button
          contentEditable={false}
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            props.deleteNode();
          }}
          className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-destructive/90 text-white rounded-md opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center shadow-sm cursor-pointer z-10 backdrop-blur-sm"
          title="Delete image"
        >
          <X size={15} />
        </button>
      </div>
    </NodeViewWrapper>
  );
}
