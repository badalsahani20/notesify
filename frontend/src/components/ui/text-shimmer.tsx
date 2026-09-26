import { cn } from "@/lib/utils";

export type TextShimmerProps = {
  as?: string;
  duration?: number;
  spread?: number;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>;

export function TextShimmer({
  as = "span",
  className,
  duration = 2.5,
  spread = 20,
  children,
  style,
  ...props
}: TextShimmerProps) {
  const dynamicSpread = Math.min(Math.max(spread, 5), 45);
  const Component = as as React.ElementType;

  return (
    <Component
      className={cn(
        "inline-block [background-size:200%_auto] bg-clip-text font-medium text-transparent",
        "animate-[shimmer_2.5s_infinite_linear]",
        className
      )}
      style={{
        backgroundImage: `linear-gradient(to right, rgba(255, 255, 255, 0.65) ${50 - dynamicSpread}%, #ffffff 50%, rgba(255, 255, 255, 0.65) ${50 + dynamicSpread}%)`,
        backgroundSize: "200% auto",
        animationDuration: `${duration}s`,
        ...style,
      }}
      {...props}
    >
      {children}
    </Component>
  );
}
