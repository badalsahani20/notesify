"use client"

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { cn } from "@/lib/utils"
import { createContext, useContext } from "react"

const SourceContext = createContext<{
  href: string
  domain: string
} | null>(null)

function useSourceContext() {
  const ctx = useContext(SourceContext)
  if (!ctx) throw new Error("Source.* must be used inside <Source>")
  return ctx
}

export type SourceProps = {
  href: string
  children: React.ReactNode
}

export function Source({ href, children }: SourceProps) {
  let domain = ""
  try {
    domain = new URL(href).hostname
  } catch {
    domain = href.split("/").pop() || href
  }

  return (
    <SourceContext.Provider value={{ href, domain }}>
      <HoverCard openDelay={150} closeDelay={0}>
        {children}
      </HoverCard>
    </SourceContext.Provider>
  )
}

export type SourceTriggerProps = {
  label?: string | number
  showFavicon?: boolean
  className?: string
}

export function SourceTrigger({
  label,
  showFavicon = false,
  className,
}: SourceTriggerProps) {
  const { href, domain } = useSourceContext()
  const labelToShow = label ?? domain.replace("www.", "")

  return (
    <HoverCardTrigger asChild>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "inline-flex items-center gap-1 align-baseline mx-0.5 px-1.5 py-0.5 h-[19px] max-w-44 rounded-md bg-white/[0.08] hover:bg-white/[0.16] text-zinc-300 hover:text-white text-[11px] font-medium no-underline transition-all cursor-pointer select-none border border-white/5 shadow-xs",
          showFavicon ? "pl-1 pr-1.5" : "px-1.5",
          className
        )}
      >
        {showFavicon && (
          <img
            src={`https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(
              href
            )}`}
            alt=""
            width={12}
            height={12}
            className="size-3 rounded-full shrink-0 opacity-80"
          />
        )}
        <span className="truncate tabular-nums text-center font-normal">{labelToShow}</span>
      </a>
    </HoverCardTrigger>
  )
}

export type SourceContentProps = {
  title: string
  description?: string
  className?: string
}

export function SourceContent({
  title,
  description,
  className,
}: SourceContentProps) {
  const { href, domain } = useSourceContext()

  return (
    <HoverCardContent
      side="top"
      sideOffset={6}
      className={cn(
        "w-80 p-0 rounded-xl overflow-hidden shadow-2xl border border-white/10 bg-[#1b1b1e]/98 dark:bg-[#18181b]/98 backdrop-blur-xl text-zinc-100",
        className
      )}
    >
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-col gap-1.5 p-3 hover:bg-white/[0.04] transition-colors cursor-pointer group"
      >
        <div className="flex items-center gap-1.5">
          <img
            src={`https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(
              href
            )}`}
            alt=""
            className="size-4 rounded-full shrink-0"
            width={16}
            height={16}
          />
          <div className="text-zinc-400 group-hover:text-zinc-200 text-xs font-medium truncate transition-colors">
            {domain.replace("www.", "")}
          </div>
        </div>
        <div className="line-clamp-2 text-sm font-semibold text-white leading-snug group-hover:text-blue-400 transition-colors">
          {title}
        </div>
        {description && (
          <div className="text-zinc-400 line-clamp-3 text-xs leading-relaxed">
            {description}
          </div>
        )}
      </a>
    </HoverCardContent>
  )
}
