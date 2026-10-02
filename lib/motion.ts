/**
 * Motion vocabulary. Every animation here has a job: entering, leaving,
 * updating or confirming. Nothing decorates.
 */

export type Cubic = [number, number, number, number];

export const dur = { fast: 0.15, base: 0.22, slow: 0.32 };

export const ease: Cubic = [0.22, 1, 0.36, 1];

export const spring = { type: "spring", stiffness: 320, damping: 30 } as const;

export const springSoft = { type: "spring", stiffness: 260, damping: 32 } as const;

/** Page-level entrance: fade plus an 8 px lift. */
export const page = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: dur.base, ease },
};

/** Staggered list entrance — capped so long lists never feel slow. */
export const listItem = (i: number) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: Math.min(i, 8) * 0.04, duration: dur.base, ease },
});

export const tap = {
  whileTap: { scale: 0.97 },
  transition: { duration: dur.fast },
} as const;

/** Sheet / modal: scale in from 0.96. */
export const modalIn = {
  initial: { opacity: 0, scale: 0.96, y: 6 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.97, y: 4 },
  transition: { duration: dur.base, ease },
};

/** Horizontal step transition used by the register stepper. */
export const stepIn = (dir: 1 | -1) => ({
  initial: { opacity: 0, x: dir * 24 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: dir * -24 },
  transition: { duration: dur.base, ease },
});

export const countTransition = { duration: 0.6, ease };
