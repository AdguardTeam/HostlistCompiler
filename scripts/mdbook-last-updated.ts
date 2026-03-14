#!/usr/bin/env -S deno run --allow-read --allow-run --allow-write

/**
 * MDBook preprocessor: injects per-page "Last updated" date stamps.
 *
 * For each chapter that has a corresponding source file, this preprocessor
 * appends a small HTML stamp at the bottom of the page content:
 *
 *   <div class="last-updated">Last updated: YYYY-MM-DD</div>
 *
 * The date is taken from `git log -1 --format="%ad"` for that specific file,
 * so it reflects the actual last-edit date rather than the build date.
 *
 * Additionally, this preprocessor writes `docs/theme/build-info.js` with the
 * current build timestamp so that custom.js can display it in the nav bar.
 *
 * Register in book.toml:
 *   [preprocessor.last-updated]
 *   command = "deno run --allow-read --allow-run --allow-write scripts/mdbook-last-updated.ts"
 */

// MDBook calls preprocessors with "supports <renderer>" to probe compatibility.
// Exit 0 means we support all renderers.
if (Deno.args[0] === 'supports') {
    Deno.exit(0);
}

// ── Types (mirrors mdBook's Rust structs) ─────────────────────────────────────

interface Chapter {
    name: string;
    content: string;
    number: number[] | null;
    sub_items: BookItem[];
    path: string | null;
    source_path: string | null;
    parent_names: string[];
}

type BookItem =
    | { Chapter: Chapter }
    | 'Separator'
    | { PartTitle: string };

interface Book {
    sections: BookItem[];
}

interface PreprocessorContext {
    root: string;
    config: {
        book?: {
            src?: string;
        };
    };
    renderer: string;
    mdbook_version: string;
}

// ── Read stdin ────────────────────────────────────────────────────────────────

const chunks: Uint8Array[] = [];
for await (const chunk of Deno.stdin.readable) {
    chunks.push(chunk);
}
const totalLen = chunks.reduce((n, c) => n + c.length, 0);
const buf = new Uint8Array(totalLen);
let offset = 0;
for (const chunk of chunks) {
    buf.set(chunk, offset);
    offset += chunk.length;
}
const input = new TextDecoder().decode(buf);
const [context, book]: [PreprocessorContext, Book] = JSON.parse(input);

const bookRoot: string = context.root ?? '.';
const srcDir: string = context.config?.book?.src ?? 'src';

// ── Build timestamp ───────────────────────────────────────────────────────────

const buildTimestamp = new Date().toISOString();
const buildDate = buildTimestamp.split('T')[0];

const buildInfoPath = `${bookRoot}/docs/theme/build-info.js`;
const buildInfoContent = `// Auto-generated at build time by scripts/mdbook-last-updated.ts — do not edit\n` +
    `window.__DOCS_BUILD_TIMESTAMP__ = ${JSON.stringify(buildTimestamp)};\n` +
    `window.__DOCS_BUILD_DATE__ = ${JSON.stringify(buildDate)};\n`;

try {
    await Deno.writeTextFile(buildInfoPath, buildInfoContent);
} catch (err) {
    console.error(
        `[last-updated] Warning: could not write ${buildInfoPath}: ${err}`,
    );
}

// ── Git helper ────────────────────────────────────────────────────────────────

async function getLastCommitDate(relPath: string): Promise<string> {
    try {
        const cmd = new Deno.Command('git', {
            args: [
                'log',
                '-1',
                '--format=%ad',
                '--date=format:%Y-%m-%d',
                '--',
                relPath,
            ],
            cwd: bookRoot,
            stdout: 'piped',
            stderr: 'null', // "null" routes stderr to /dev/null (Deno.CommandOptions literal)
        });
        const result = await cmd.output();
        return new TextDecoder().decode(result.stdout).trim();
    } catch {
        return '';
    }
}

// ── Chapter processing ────────────────────────────────────────────────────────

async function processItems(items: BookItem[]): Promise<void> {
    for (const item of items) {
        if (typeof item !== 'object' || !('Chapter' in item)) continue;

        const chapter = item.Chapter;

        if (chapter.source_path) {
            // source_path is relative to the book's src directory
            const relPath = `${srcDir}/${chapter.source_path}`;
            const lastUpdated = await getLastCommitDate(relPath);

            if (lastUpdated) {
                chapter.content += `\n\n<div class="last-updated">Last updated: ${lastUpdated}</div>\n`;
            }
        }

        if (chapter.sub_items.length > 0) {
            await processItems(chapter.sub_items);
        }
    }
}

await processItems(book.sections);

// ── Emit modified book ────────────────────────────────────────────────────────

console.log(JSON.stringify(book));
