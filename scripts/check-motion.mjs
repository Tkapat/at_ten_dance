#!/usr/bin/env node
/**
 * Motion gate: no inline `transition={{ … }}` objects outside the two files
 * allowed to define motion.
 *
 * `lib/motion.ts` holds the durations, easings and springs; `components/motion/`
 * holds the composed behaviours. Everywhere else a component may only *choose*
 * one — `transition={tween.enter}`, `transition={spring.snappy}` — because an
 * object literal in a component is a duration someone will tune in one place and
 * forget in the next.
 *
 * Run with `pnpm check:motion`, and as part of `pnpm lint` so it fails the gate.
 *
 * Comments are skipped: the doc examples in `hooks/useMotionPref.ts` describe
 * the very pattern this forbids, and describing it is not writing it.
 */

import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** Directories whose files are scanned. */
const SCAN_DIRS = ["app", "components", "lib", "hooks"];

/** Files allowed to contain an inline transition object. */
const ALLOWED = new Set([join("lib", "motion.ts")]);
const ALLOWED_DIRS = [join("components", "motion")];

const EXTENSIONS = new Set([".ts", ".tsx"]);
const LITERAL = "transition={{";

/**
 * Any `transition=` whose value contains a nested `{` is building an object, even
 * when the braces are not adjacent: `transition={reduced ? { duration: … } : …}`
 * is the same thing the rule forbids, and a plain `{{` search misses it.
 *
 * Returns the column of the offending `{`, or -1.
 */
function nestedLiteral(line) {
  const re = /transition\s*=\s*\{/g;
  let match;
  while ((match = re.exec(line)) !== null) {
    // One past the brace that opens the JSX expression: `depth` is what we owe.
    let depth = 1;
    for (let i = line.indexOf("{", match.index) + 1; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === "{") {
        // We are directly inside the transition value, so this starts an object.
        if (depth === 1) return i;
        depth += 1;
      } else if (ch === "}") {
        depth -= 1;
        if (depth === 0) break;
      } else if (ch === "[") {
        depth += 1;
      } else if (ch === "]") {
        depth -= 1;
      }
    }
  }
  return -1;
}

async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      out.push(...(await walk(full)));
    } else if (EXTENSIONS.has(extOf(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

function extOf(name) {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i);
}

function isAllowed(relPath) {
  if (ALLOWED.has(relPath)) return true;
  return ALLOWED_DIRS.some((dir) => relPath === dir || relPath.startsWith(dir + sep));
}

function isComment(line) {
  const trimmed = line.trimStart();
  return trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*");
}

const files = [];
for (const dir of SCAN_DIRS) files.push(...(await walk(join(ROOT, dir))));

const violations = [];
for (const file of files) {
  const relPath = relative(ROOT, file);
  if (isAllowed(relPath)) continue;
  const lines = (await readFile(file, "utf8")).split("\n");
  lines.forEach((line, index) => {
    if (isComment(line)) return;
    if (nestedLiteral(line) !== -1) {
      violations.push({ file: relPath, line: index + 1, text: line.trim() });
    }
  });
}

if (violations.length > 0) {
  console.error("motion gate: inline `transition={{ … }}` outside the allowed files\n");
  for (const v of violations) console.error(`  ${v.file}:${v.line}\n    ${v.text}`);
  console.error(
    `\nAllowed: ${[...ALLOWED, ...ALLOWED_DIRS].join(", ")}\n` +
      `Pick a preset instead: transition={tween.enter}, transition={spring.snappy} — ` +
      `see lib/motion.ts.`,
  );
  process.exit(1);
}

console.log(`motion gate: ok (${files.length} files, ${LITERAL} only in the allowed files)`);