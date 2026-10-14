import { useState, useEffect, useRef } from "react";

export interface UseTypewriterOptions {
  /** Milliseconds per character, default 40ms */
  speed?: number;
  /** Whether to animate on initial mount, default false */
  animateOnMount?: boolean;
  /** Custom predicate to determine whether a change should trigger the animation */
  shouldAnimate?: (oldText: string, newText: string) => boolean;
}

/**
 * Reusable hook that creates a smooth character-by-character typewriter effect
 * when a string transitions (e.g. from an initial/optimistic title to an AI-generated title).
 */
export function useTypewriter(
  targetText: string,
  options: UseTypewriterOptions = {}
): string {
  const { speed = 40, animateOnMount = false, shouldAnimate } = options;
  const [displayText, setDisplayText] = useState(() => (animateOnMount ? "" : targetText));
  const prevTextRef = useRef(animateOnMount ? "" : targetText);

  const shouldAnimateRef = useRef(shouldAnimate);

  useEffect(() => {
    shouldAnimateRef.current = shouldAnimate;
  }, [shouldAnimate]);

  useEffect(() => {
    const oldText = prevTextRef.current;
    prevTextRef.current = targetText;

    const trigger = shouldAnimateRef.current
      ? shouldAnimateRef.current(oldText, targetText)
      : Boolean(oldText) && oldText !== targetText;

    if (trigger) {
      let currentIndex = 0;
      setDisplayText("");
      const timer = setInterval(() => {
        currentIndex++;
        setDisplayText(targetText.slice(0, currentIndex));
        if (currentIndex >= targetText.length) {
          clearInterval(timer);
        }
      }, speed);
      return () => clearInterval(timer);
    } else {
      setDisplayText(targetText);
    }
  }, [targetText, speed]);

  return displayText;
}
