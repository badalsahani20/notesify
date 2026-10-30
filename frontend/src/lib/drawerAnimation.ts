import type { Variants, Transition } from "framer-motion";

/**
 * Standard iOS/Android native sheet curve: snappy responsive launch, smooth deceleration.
 */
export const DRAWER_SPRING_EASE = [0.22, 1, 0.36, 1] as const;

export const mobileDrawerTransition: Transition = {
  duration: 0.28,
  ease: DRAWER_SPRING_EASE,
};

export const mobileBackdropTransition: Transition = {
  duration: 0.22,
  ease: "easeOut",
};

/**
 * Reusable slide-in/slide-out animation variants for mobile drawers (Folders & AI Chat Sessions).
 */
export const mobileDrawerVariants: Variants = {
  closed: {
    x: "-100%",
    transition: {
      duration: 0.25,
      ease: DRAWER_SPRING_EASE,
    },
  },
  open: {
    x: 0,
    transition: {
      duration: 0.28,
      ease: DRAWER_SPRING_EASE,
    },
  },
};

/**
 * Reusable backdrop fade animation variants for mobile drawers.
 */
export const mobileBackdropVariants: Variants = {
  closed: {
    opacity: 0,
    transition: {
      duration: 0.2,
      ease: "easeIn",
    },
  },
  open: {
    opacity: 1,
    transition: {
      duration: 0.22,
      ease: "easeOut",
    },
  },
};
