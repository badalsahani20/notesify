import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const itemVariants = cva(
  "group/item relative flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 sm:gap-3 rounded-lg text-sm transition-colors",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        outline: "border border-[var(--divider)] bg-[var(--surface-muted)]/50 shadow-2xs hover:bg-[var(--surface-muted)]/80",
        muted: "bg-muted/50 text-muted-foreground",
      },
      size: {
        default: "p-3.5",
        sm: "p-2.5 text-xs",
        lg: "p-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ItemProps
  extends React.ComponentProps<"div">,
    VariantProps<typeof itemVariants> {}

export function Item({ className, variant, size, ...props }: ItemProps) {
  return (
    <div
      data-slot="item"
      className={cn(itemVariants({ variant, size, className }))}
      {...props}
    />
  )
}

const itemMediaVariants = cva(
  "flex shrink-0 items-center justify-center text-muted-foreground",
  {
    variants: {
      variant: {
        default: "",
        icon: "size-8 rounded-md bg-muted/70 text-foreground [&_svg]:size-4",
        avatar: "size-8 rounded-full overflow-hidden",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface ItemMediaProps
  extends React.ComponentProps<"div">,
    VariantProps<typeof itemMediaVariants> {}

export function ItemMedia({ className, variant, ...props }: ItemMediaProps) {
  return (
    <div
      data-slot="item-media"
      className={cn(itemMediaVariants({ variant, className }))}
      {...props}
    />
  )
}

export function ItemContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="item-content"
      className={cn("flex flex-1 flex-col gap-0.5 min-w-0", className)}
      {...props}
    />
  )
}

export function ItemTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="item-title"
      className={cn("font-semibold text-[var(--text-strong)] leading-snug truncate", className)}
      {...props}
    />
  )
}

export function ItemDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="item-description"
      className={cn("text-[11px] text-[var(--muted-text)] line-clamp-1 leading-normal", className)}
      {...props}
    />
  )
}

export function ItemActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="item-actions"
      className={cn("flex shrink-0 items-center gap-1.5 ml-auto w-full sm:w-auto justify-end pt-1 sm:pt-0", className)}
      {...props}
    />
  )
}

