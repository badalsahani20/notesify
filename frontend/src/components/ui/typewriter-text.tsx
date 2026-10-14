import React, { memo } from "react";
import { useTypewriter, type UseTypewriterOptions } from "@/hooks/ui/useTypewriter";

interface TypewriterTextProps extends UseTypewriterOptions {
  text: string;
  className?: string;
  as?: React.ElementType;
}

export const TypewriterText = memo(({
  text,
  className,
  as: Component = "span",
  speed = 40,
  animateOnMount = false,
  shouldAnimate,
}: TypewriterTextProps) => {
  const displayText = useTypewriter(text, { speed, animateOnMount, shouldAnimate });

  return <Component className={className}>{displayText}</Component>;
});

TypewriterText.displayName = "TypewriterText";
