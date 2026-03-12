#!/usr/bin/env -S deno run --allow-read --allow-write --allow-env

/**
 * Lighthouse CI Summary Generator
 *
 * Reads LHCI JSON report files from the output directory and writes a Markdown
 * score table to $GITHUB_STEP_SUMMARY (and stdout).
 *
 * Usage:
 *   deno run --allow-read --allow-write --allow-env scripts/lighthouse-summary.ts
 *
 * Environment variables:
 *   LHCI_OUTPUT_DIR  Directory containing *.json Lighthouse report files
 *                    (default: lhci-results)
 *   GITHUB_STEP_SUMMARY  Path to the GitHub step summary file (set by Actions)
 */

import { walk } from '@std/fs';
import { extname } from '@std/path';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

interface ILighthouseCategoryScore {
    readonly id: string;
    readonly title: string;
    readonly score: number | null;
}

interface ILighthouseReport {
    readonly requestedUrl?: string;
    readonly finalUrl?: string;
    readonly categories?: Readonly<Record<string, ILighthouseCategoryScore>>;
}

interface IReportRow {
    readonly url: string;
    readonly performance: number | null;
    readonly accessibility: number | null;
    readonly bestPractices: number | null;
    readonly seo: number | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scoreEmoji(score: number | null): string {
    if (score === null) {
        return 'N/A';
    }
    const pct = Math.round(score * 100);
    if (pct >= 90) {
        return `✅ ${pct}`;
    }
    if (pct >= 75) {
        return `⚠️ ${pct}`;
    }
    return `❌ ${pct}`;
}

function extractUrl(report: ILighthouseReport): string {
    return report.finalUrl ?? report.requestedUrl ?? 'unknown';
}

function extractScore(report: ILighthouseReport, categoryKey: string): number | null {
    return report.categories?.[categoryKey]?.score ?? null;
}

async function readReports(outputDir: string): Promise<readonly IReportRow[]> {
    const rows: IReportRow[] = [];

    for await (const entry of walk(outputDir, { maxDepth: 1, includeFiles: true, includeDirs: false })) {
        if (extname(entry.name) !== '.json') {
            continue;
        }
        // Skip LHCI manifest/links metadata files
        if (entry.name.includes('manifest') || entry.name.includes('links')) {
            continue;
        }

        let report: ILighthouseReport;
        try {
            const raw = await Deno.readTextFile(entry.path);
            report = JSON.parse(raw) as ILighthouseReport;
        } catch {
            console.warn(`⚠️  Could not parse ${entry.path} — skipping`);
            continue;
        }

        // Only process files that look like Lighthouse reports (have a categories key)
        if (!report.categories) {
            continue;
        }

        rows.push({
            url: extractUrl(report),
            performance: extractScore(report, 'performance'),
            accessibility: extractScore(report, 'accessibility'),
            bestPractices: extractScore(report, 'best-practices'),
            seo: extractScore(report, 'seo'),
        });
    }

    return rows;
}

function buildMarkdown(rows: readonly IReportRow[], targetUrl: string): string {
    const lines: string[] = [
        '## 🔦 Lighthouse CI Results',
        '',
        `**Target:** \`${targetUrl}\``,
        '',
        '| URL | Performance | Accessibility | Best Practices | SEO |',
        '| --- | ----------- | ------------- | -------------- | --- |',
    ];

    if (rows.length === 0) {
        lines.push('| _(no reports found)_ | — | — | — | — |');
    } else {
        for (const row of rows) {
            let shortUrl = row.url;
            if (targetUrl && shortUrl.startsWith(targetUrl)) {
                shortUrl = shortUrl.slice(targetUrl.length) || '/';
            }
            lines.push(
                `| \`${shortUrl}\` | ${scoreEmoji(row.performance)} | ${scoreEmoji(row.accessibility)} | ${scoreEmoji(row.bestPractices)} | ${scoreEmoji(row.seo)} |`,
            );
        }
    }

    lines.push('');
    lines.push('_Scores: ✅ ≥ 90 · ⚠️ ≥ 75 · ❌ < 75. Full reports uploaded as artifact `lighthouse-results`._');

    return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
    const outputDir = Deno.env.get('LHCI_OUTPUT_DIR') ?? 'lhci-results';
    const summaryFile = Deno.env.get('GITHUB_STEP_SUMMARY');
    const targetUrl = Deno.env.get('TARGET_URL') ?? '';

    let rows: readonly IReportRow[] = [];
    try {
        rows = await readReports(outputDir);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`⚠️  Could not read reports from "${outputDir}": ${msg}`);
    }

    const markdown = buildMarkdown(rows, targetUrl);

    // Always print to stdout
    console.log(markdown);

    // Write to GitHub step summary if available
    if (summaryFile) {
        try {
            await Deno.writeTextFile(summaryFile, markdown + '\n', { append: true });
            console.log(`\n✅ Summary written to ${summaryFile}`);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn(`⚠️  Could not write to GITHUB_STEP_SUMMARY: ${msg}`);
        }
    }
}

await main();
