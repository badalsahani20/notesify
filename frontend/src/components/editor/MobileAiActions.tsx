import { Wand2, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { actionMeta } from "@/components/ai/types";
import type { useAiChat } from "@/hooks/ai/useAiChat";

type Props = {
  aiChat: ReturnType<typeof useAiChat>;
  onOpenAiPanel: () => void;
  /** True while the reader is scrolling; the stack gets out of the way. */
  hidden?: boolean;
};

export const MobileAiActions = ({ aiChat, onOpenAiPanel, hidden = false }: Props) => {
  return (
    <div
      className={`mobile-ai-fab-stack${hidden ? " mobile-ai-fab-stack-hidden" : ""}`}
      aria-hidden={hidden}
    >
      {/* Actions dropdown — replaces single Summarize button */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="mobile-ai-fab mobile-ai-fab-sm mobile-ai-fab-secondary disabled:opacity-80 disabled:cursor-not-allowed"
            aria-label="AI Actions"
            disabled={aiChat.loadingAction !== null}
          >
            {aiChat.loadingAction ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Wand2 size={14} />
            )}
            <span>{aiChat.loadingAction ? "Thinking..." : "Actions"}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={8}
          className="assistant-actions-menu w-44 shadow-md z-[99999]"
        >
          {(Object.keys(actionMeta) as (keyof typeof actionMeta)[]).map((action) => (
            <DropdownMenuItem
              key={action}
              onClick={() => void aiChat.runAction(action)}
              className="assistant-actions-menu-item cursor-pointer text-sm py-1.5 transition-colors"
            >
              {actionMeta[action].label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Primary Ask AI button */}
      <button
        type="button"
        className="mobile-ai-fab mobile-ai-fab-secondary"
        onClick={onOpenAiPanel}
        aria-label="Ask AI"
      >
        <div
          className="iris-orb shrink-0"
          style={{ width: "12px", height: "12px", borderWidth: "1px", boxShadow: "none" }}
        />
        <span>Ask AI</span>
      </button>
    </div>
  );
};
