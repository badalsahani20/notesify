import React, { useState, useCallback, useContext, createContext, type ComponentProps } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, PaperclipIcon, Check, Minus } from "lucide-react";

export interface QueueMessagePart {
  type: string;
  text?: string;
  url?: string;
  filename?: string;
  mediaType?: string;
}

export interface QueueMessage {
  id: string;
  parts: QueueMessagePart[];
}

export interface QueueTodo {
  id: string;
  title: string;
  description?: string;
  status?: "pending" | "in_progress" | "completed" | "skipped";
}

export type QueueItemProps = ComponentProps<"li">;

export const QueueItem = ({ className, ...props }: QueueItemProps) => (
  <li
    className={cn(
      "group flex flex-col gap-0.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors hover:bg-white/[0.03] select-none",
      className
    )}
    {...props}
  />
);

export type QueueItemIndicatorProps = ComponentProps<"span"> & {
  completed?: boolean;
  status?: "pending" | "in_progress" | "completed" | "skipped" | "archived" | string;
  disabled?: boolean;
};

export const QueueItemIndicator = ({
  completed = false,
  status,
  disabled = true,
  className,
  ...props
}: QueueItemIndicatorProps) => {
  const currentStatus = status || (completed ? "completed" : "pending");

  let statusStyles = "border-zinc-600 bg-zinc-900/50 text-transparent";
  let content = null;

  if (currentStatus === "completed") {
    statusStyles = "border-emerald-500 bg-emerald-500/20 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.2)]";
    content = <Check className="size-2.5 stroke-[3] text-emerald-400" />;
  } else if (currentStatus === "skipped") {
    statusStyles = "border-amber-500/80 bg-amber-500/20 text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.2)]";
    content = <Minus className="size-2.5 stroke-[3] text-amber-400" />;
  } else if (currentStatus === "in_progress") {
    statusStyles = "border-sky-400 bg-sky-500/20 text-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.2)] animate-pulse";
    content = <span className="size-1.5 rounded-full bg-sky-400" />;
  }

  return (
    <span
      className={cn(
        "mt-0.5 inline-flex items-center justify-center size-3.5 shrink-0 rounded-full border transition-all",
        statusStyles,
        disabled ? "cursor-default" : "cursor-pointer",
        className
      )}
      {...props}
    >
      {content}
    </span>
  );
};

export type QueueItemContentProps = ComponentProps<"span"> & {
  completed?: boolean;
  status?: "pending" | "in_progress" | "completed" | "skipped" | "archived" | string;
};

export const QueueItemContent = ({
  completed = false,
  status,
  className,
  ...props
}: QueueItemContentProps) => {
  const currentStatus = status || (completed ? "completed" : "pending");

  return (
    <span
      className={cn(
        "grow break-words text-sm font-normal transition-colors",
        currentStatus === "completed" && "text-zinc-500 line-through",
        currentStatus === "skipped" && "text-zinc-500 italic line-through",
        currentStatus === "in_progress" && "text-sky-200 font-medium",
        currentStatus === "pending" && "text-zinc-200",
        className
      )}
      {...props}
    />
  );
};

export type QueueItemDescriptionProps = ComponentProps<"div"> & {
  completed?: boolean;
  status?: "pending" | "in_progress" | "completed" | "skipped" | "archived" | string;
};

export const QueueItemDescription = ({
  completed = false,
  status,
  className,
  ...props
}: QueueItemDescriptionProps) => {
  const currentStatus = status || (completed ? "completed" : "pending");

  return (
    <div
      className={cn(
        "ml-5 text-xs font-normal leading-relaxed transition-colors",
        (currentStatus === "completed" || currentStatus === "skipped")
          ? "text-zinc-600 line-through"
          : currentStatus === "in_progress"
          ? "text-sky-300/80"
          : "text-zinc-400",
        className
      )}
      {...props}
    />
  );
};

export type QueueItemActionsProps = ComponentProps<"div">;

export const QueueItemActions = ({
  className,
  ...props
}: QueueItemActionsProps) => (
  <div className={cn("ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100", className)} {...props} />
);

export type QueueItemActionProps = Omit<
  ComponentProps<typeof Button>,
  "variant" | "size"
>;

export const QueueItemAction = ({
  className,
  ...props
}: QueueItemActionProps) => (
  <Button
    className={cn(
      "size-auto rounded p-1 text-zinc-500 transition-colors hover:bg-white/10 hover:text-zinc-200",
      className
    )}
    size="icon"
    type="button"
    variant="ghost"
    {...props}
  />
);

export type QueueItemAttachmentProps = ComponentProps<"div">;

export const QueueItemAttachment = ({
  className,
  ...props
}: QueueItemAttachmentProps) => (
  <div className={cn("mt-1 flex flex-wrap gap-2", className)} {...props} />
);

export type QueueItemImageProps = ComponentProps<"img">;

export const QueueItemImage = ({
  className,
  ...props
}: QueueItemImageProps) => (
  <img
    alt=""
    className={cn("h-8 w-8 rounded border border-white/10 object-cover", className)}
    height={32}
    width={32}
    {...props}
  />
);

export type QueueItemFileProps = ComponentProps<"span">;

export const QueueItemFile = ({
  children,
  className,
  ...props
}: QueueItemFileProps) => (
  <span
    className={cn(
      "flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-300",
      className
    )}
    {...props}
  >
    <PaperclipIcon size={12} />
    <span className="max-w-[120px] truncate">{children}</span>
  </span>
);

export type QueueListProps = ComponentProps<"div">;

export const QueueList = ({
  children,
  className,
  ...props
}: QueueListProps) => (
  <div
    className={cn(
      "mt-1 max-h-52 overflow-y-auto custom-scrollbar pr-1",
      className
    )}
    {...props}
  >
    <ul className="space-y-0.5">{children}</ul>
  </div>
);

interface QueueSectionContextType {
  isOpen: boolean;
  toggle: () => void;
}

const QueueSectionContext = createContext<QueueSectionContextType>({
  isOpen: true,
  toggle: () => {},
});

export interface QueueSectionProps extends ComponentProps<"div"> {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const QueueSection = ({
  children,
  className,
  defaultOpen = true,
  open: controlledOpen,
  onOpenChange,
  ...props
}: QueueSectionProps) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isOpen = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen;

  const toggle = useCallback(() => {
    const next = !isOpen;
    if (controlledOpen === undefined) {
      setUncontrolledOpen(next);
    }
    onOpenChange?.(next);
  }, [isOpen, controlledOpen, onOpenChange]);

  return (
    <QueueSectionContext.Provider value={{ isOpen, toggle }}>
      <div className={cn("w-full transition-all", className)} {...props}>
        {children}
      </div>
    </QueueSectionContext.Provider>
  );
};

// QueueSectionTrigger - section header/trigger
export type QueueSectionTriggerProps = ComponentProps<"button">;

export const QueueSectionTrigger = ({
  children,
  className,
  onClick,
  ...props
}: QueueSectionTriggerProps) => {
  const { toggle, isOpen } = useContext(QueueSectionContext);

  return (
    <button
      className={cn(
        "group flex w-full items-center justify-between rounded-lg bg-zinc-900/60 hover:bg-zinc-800/60 px-3 py-2 text-left font-medium text-zinc-300 text-sm transition-colors duration-200",
        className
      )}
      type="button"
      data-state={isOpen ? "open" : "closed"}
      onClick={(e) => {
        onClick?.(e);
        toggle();
      }}
      {...props}
    >
      {children}
    </button>
  );
};

// QueueSectionLabel - label content with smoothly rotating chevron and count
export type QueueSectionLabelProps = ComponentProps<"span"> & {
  count?: number;
  label: string;
  icon?: React.ReactNode;
};

export const QueueSectionLabel = ({
  count,
  label,
  icon,
  className,
  ...props
}: QueueSectionLabelProps) => {
  const { isOpen } = useContext(QueueSectionContext);

  return (
    <span className={cn("flex items-center gap-2 text-zinc-300 font-medium text-sm select-none", className)} {...props}>
      <ChevronDownIcon
        className={cn(
          "size-4 text-zinc-400 transition-transform duration-350 ease-out",
          !isOpen && "-rotate-90 text-zinc-500"
        )}
      />
      {icon}
      <span>
        {typeof count === "number" ? `${count} ` : ""}{label}
      </span>
    </span>
  );
};

// QueueSectionContent - smoothly animated collapsible content area
export interface QueueSectionContentProps extends ComponentProps<"div"> {
  children?: React.ReactNode;
}

export const QueueSectionContent = ({
  children,
  className,
  ...props
}: QueueSectionContentProps) => {
  const { isOpen } = useContext(QueueSectionContext);

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{
            height: "auto",
            opacity: 1,
            transition: {
              height: { duration: 0.38, ease: [0.25, 1, 0.5, 1] },
              opacity: { duration: 0.28, delay: 0.04, ease: "easeOut" },
            },
          }}
          exit={{
            height: 0,
            opacity: 0,
            transition: {
              height: { duration: 0.32, ease: [0.25, 1, 0.5, 1] },
              opacity: { duration: 0.2, ease: "easeIn" },
            },
          }}
          className="overflow-hidden"
        >
          <div className={cn("pt-1", className)} {...props}>
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export type QueueProps = ComponentProps<"div">;

export const Queue = ({ className, ...props }: QueueProps) => (
  <div
    className={cn(
      "flex flex-col gap-1.5 rounded-2xl border border-white/10 bg-[#0c0d12]/95 backdrop-blur-xl p-2 shadow-2xl transition-all",
      className
    )}
    {...props}
  />
);
