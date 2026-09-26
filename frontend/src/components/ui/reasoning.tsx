import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

type ReasoningContextType = {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

const ReasoningContext = createContext<ReasoningContextType | undefined>(
  undefined
)

function useReasoningContext() {
  const context = useContext(ReasoningContext)
  if (!context) {
    throw new Error(
      "useReasoningContext must be used within a Reasoning provider"
    )
  }
  return context
}

export type ReasoningProps = {
  children: React.ReactNode
  className?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  isStreaming?: boolean
}

function Reasoning({
  children,
  className,
  open,
  onOpenChange,
  isStreaming,
}: ReasoningProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [wasAutoOpened, setWasAutoOpened] = useState(false)

  const isControlled = open !== undefined
  const isOpen = isControlled ? open : internalOpen

  const handleOpenChange = (newOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(newOpen)
    }
    onOpenChange?.(newOpen)
  }

  useEffect(() => {
    if (isStreaming && !wasAutoOpened) {
      if (!isControlled) setInternalOpen(true)
      setWasAutoOpened(true)
    }

    if (!isStreaming && wasAutoOpened) {
      if (!isControlled) setInternalOpen(false)
      setWasAutoOpened(false)
    }
  }, [isStreaming, wasAutoOpened, isControlled])

  return (
    <ReasoningContext.Provider
      value={{
        isOpen,
        onOpenChange: handleOpenChange,
      }}
    >
      <div className={cn("my-1", className)}>{children}</div>
    </ReasoningContext.Provider>
  )
}

export type ReasoningTriggerProps = {
  children: React.ReactNode
  className?: string
} & React.HTMLAttributes<HTMLButtonElement>

function ReasoningTrigger({
  children,
  className,
  ...props
}: ReasoningTriggerProps) {
  const { isOpen, onOpenChange } = useReasoningContext()

  return (
    <button
      type="button"
      className={cn(
        "flex cursor-pointer items-center gap-1.5 text-xs font-medium text-white/90 hover:text-white transition-colors py-1 select-none",
        className
      )}
      onClick={() => onOpenChange(!isOpen)}
      {...props}
    >
      <span>{children}</span>
      <div
        className={cn(
          "transform transition-transform duration-200 text-white/70",
          isOpen ? "rotate-180" : ""
        )}
      >
        <ChevronDown className="size-3.5" />
      </div>
    </button>
  )
}

export type ReasoningContentProps = {
  children: React.ReactNode
  className?: string
  markdown?: boolean
  contentClassName?: string
} & React.HTMLAttributes<HTMLDivElement>

function ReasoningContent({
  children,
  className,
  contentClassName,
  markdown = false,
  ...props
}: ReasoningContentProps) {
  const { isOpen } = useReasoningContext()

  const content = markdown && typeof children === "string" ? (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        blockquote: ({ children }) => <div className="my-1">{children}</div>,
      }}
    >
      {children}
    </ReactMarkdown>
  ) : (
    children
  )

  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
        isOpen ? "grid-rows-[1fr] opacity-100 mb-2.5" : "grid-rows-[0fr] opacity-0 mb-0 pointer-events-none",
        className
      )}
      {...props}
    >
      <div className="overflow-hidden">
        <div
          className={cn(
            "text-white/90 text-xs leading-relaxed py-1.5 whitespace-pre-wrap font-sans [&>p]:my-1 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0",
            contentClassName
          )}
        >
          {content}
        </div>
      </div>
    </div>
  )
}

export { Reasoning, ReasoningTrigger, ReasoningContent }
