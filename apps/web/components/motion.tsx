"use client";
import { MotionConfig, motion, useReducedMotion } from "motion/react";

/** Honors prefers-reduced-motion globally for every Motion component. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

const EASE = [0.23, 1, 0.32, 1] as const;

/** Scroll-reveal for a section: fades up once, short and decisive (motivated: draws the eye as new content arrives). */
export function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={className} initial={reduce ? false : { opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.5, delay, ease: EASE }}>
      {children}
    </motion.div>
  );
}
