/**
 * Motion language — single source of truth.
 * No component may define its own durations or easings outside this file.
 *
 * The design brief this serves: calm, fast and physical, in the spirit of Linear
 * and Apple. Motion explains what changed and where things went; it is never
 * decoration. See `app/dev/motion` for a replayable showcase.
 *
 * Rules any component that imports these tokens must keep:
 *   - UI feedback under 150 ms, transitions 200–320 ms, hero moments up to 600 ms.
 *   - Enter slower than exit; exits are ~70% of the enter duration.
 *   - Springs for user-driven things (sheets, drag, toggles); eased tweens for
 *     system-driven ones (pages, lists, steps).
 *   - Animate only `transform` and `opacity` (+ `clip-path`/`filter` sparingly).
 */

export type Cubic = [number, number, number, number];
/** Durations in seconds. */
export const dur = {
  instant: 0.1,
  fast: 0.15,
  base: 0.22,
  slow: 0.32,
  hero: 0.5,
  count: 0.6,
} as const;

export const ease: { out: Cubic; in: Cubic; inOut: Cubic } = {
  /** Default for entering and moving things into place. */
  out: [0.22, 1, 0.36, 1],
  /** Exits. */
  in: [0.4, 0, 1, 1],
  /** Continuous or looping movement. */
  inOut: [0.65, 0, 0.35, 1],
};

/** Springs for things that move with the user's finger or need a physical settle. */
export const spring = {
  /** Sheets, indicators, toggles — follow the finger, settle quickly. */
  snappy: { type: "spring", stiffness: 320, damping: 30 } as const,
  /** Cards and list reorders. */
  soft: { type: "spring", stiffness: 200, damping: 26 } as const,
  /** Success moments only. */
  pop: { type: "spring", stiffness: 420, damping: 18 } as const,
};

export const stagger = {
  list: 0.04,
  tiles: 0.06,
  /** Never stagger more than this many items. */
  max: 8,
} as const;

export const distance = {
  /** Same-section page change: a small lift, no movement. */
  page: 8,
  /** Into a deeper page or flow step. */
  step: 24,
  /** Sheet entering. */
  sheet: 16,
  /** Toast entering. */
  toast: 12,
} as const;

export const scale = {
  /** Button tap. */
  tap: 0.97,
  /** Desktop modal enter. */
  modalIn: 0.96,
  /** Hover lift. */
  hover: 1.015,
} as const;

/**
 * Eased tweens, named.
 *
 * The rule at the top of this file says no component defines its own durations
 * or easings — and a `transition={{ duration: …, ease: … }}` object in a
 * component is defining them, however carefully it quotes the tokens. Naming the
 * presets here means a component can only *choose* a motion, and
 * `scripts/check-motion.mjs` enforces it by failing on any inline transition
 * object outside this file and `components/motion/`.
 *
 * Springs are the other half of the vocabulary and are used the same way:
 * `transition={spring.snappy}`.
 */
export const tween = {
  /** Press and release — the fastest thing in the app. */
  tap: { duration: dur.fast },
  /** Feedback: icon swaps, error text, status changes. */
  tick: { duration: dur.fast, ease: ease.out },
  /** What reduced motion gets instead of a real tween. */
  instant: { duration: dur.instant, ease: ease.out },
  /** Enter: the default for anything appearing. */
  enter: { duration: dur.base, ease: ease.out },
  /** Exit: ~70% of `enter`, per the rule above. */
  exit: { duration: dur.fast, ease: ease.in },
  /** Slower enter, for hero moments. */
  slow: { duration: dur.slow, ease: ease.out },
  /** Count-ups and ring fills, which run for the length of the value change. */
  count: { duration: dur.count, ease: ease.out },
  /** Nothing moves at all: a state that must not animate. */
  none: { duration: 0 },
} as const;

/**
 * `tween`, held back by a delay.
 *
 * Delay cannot be a preset — every stagger delays by a different amount — so it
 * is composed onto one instead of the component writing an object of its own.
 * Delay is not scaled by reduced motion; `dur.base` is already a token, and a
 * stagger that waits longer is not motion, it is waiting.
 */
export function after(t: { duration: number; ease?: Cubic }, delaySeconds: number) {
  return delaySeconds > 0 ? { ...t, delay: delaySeconds } : t;
}
