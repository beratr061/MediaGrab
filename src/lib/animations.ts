import type { Variants, Transition } from "framer-motion";

/**
 * Base animation variants for MediaGrab
 * All animations complete within 300ms as per Requirements 5.4
 */

// Button hover and tap animations
export const buttonVariants: Variants = {
  initial: { scale: 1 },
  hover: { scale: 1.02 },
  tap: { scale: 0.98 },
};

// Fade in animation for content
export const fadeInVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

// Slide up animation for status changes
export const slideUpVariants: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

// Progress bar animation
export const progressVariants: Variants = {
  initial: { scaleX: 0 },
  animate: { scaleX: 1 },
};

// Container animation for staggered children
export const containerVariants: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

// Item animation for staggered lists
export const itemVariants: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

// Default transition settings (max 300ms)
export const defaultTransition: Transition = {
  duration: 0.2,
  ease: "easeOut" as const,
};

// Spring transition for interactive elements
export const springTransition: Transition = {
  type: "spring" as const,
  stiffness: 400,
  damping: 25,
};

// Scale animation for success states
export const scaleInVariants: Variants = {
  initial: { scale: 0.9, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  exit: { scale: 0.9, opacity: 0 },
};

// Shake animation for error states
export const shakeVariants: Variants = {
  initial: { x: 0 },
  shake: {
    x: [-4, 4, -4, 4, 0],
    transition: { duration: 0.3 },
  },
};

// Pulse animation for loading/active states
export const pulseVariants: Variants = {
  initial: { opacity: 1 },
  pulse: {
    opacity: [1, 0.7, 1],
    transition: { duration: 1.5, repeat: Infinity },
  },
};

// Card hover animation
export const cardHoverVariants: Variants = {
  initial: { y: 0, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" },
  hover: { y: -2, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" },
};

// Fast transition for quick feedback (under 200ms)
export const fastTransition: Transition = {
  duration: 0.15,
  ease: "easeOut" as const,
};
