/**
 * FilterParserWorker — Web Worker for offloading filter list parsing.
 *
 * Receives raw text content (from dropped/loaded files) and parses it
 * into structured filter rules off the main thread. This prevents UI
 * jank when processing large filter lists (EasyList is ~80K lines).
 *
 * Communication protocol:
 *   Main → Worker: { type: 'parse', payload: string }
 *   Worker → Main: { type: 'result', payload: ParsedResult }
 *                | { type: 'error', payload: string }
 *                | { type: 'progress', payload: number }
 */

interface ParseMessage {
    type: 'parse';
    payload: string;
}

interface ParsedRule {
    line: number;
    raw: string;
    type: 'url' | 'comment' | 'filter' | 'empty' | 'unknown';
}

interface ParsedResult {
    rules: ParsedRule[];
    totalLines: number;
    urlCount: number;
    filterCount: number;
    commentCount: number;
    duration: number;
}

addEventListener('message', (event: MessageEvent<ParseMessage>) => {
    if (event.data.type === 'parse') {
        try {
            const result = parseFilterList(event.data.payload);
            postMessage({ type: 'result', payload: result });
        } catch (error) {
            postMessage({ type: 'error', payload: (error as Error).message });
        }
    }
});

function parseFilterList(text: string): ParsedResult {
    const start = performance.now();
    const lines = text.split('\n');
    const rules: ParsedRule[] = [];
    let urlCount = 0;
    let filterCount = 0;
    let commentCount = 0;

    const totalLines = lines.length;
    let lastProgress = 0;

    for (let i = 0; i < totalLines; i++) {
        const raw = lines[i].trim();

        // Report progress every 10%
        const progress = Math.floor((i / totalLines) * 100);
        if (progress >= lastProgress + 10) {
            lastProgress = progress;
            postMessage({ type: 'progress', payload: progress });
        }

        if (raw.length === 0) {
            rules.push({ line: i + 1, raw, type: 'empty' });
            continue;
        }

        if (raw.startsWith('!') || raw.startsWith('#')) {
            rules.push({ line: i + 1, raw, type: 'comment' });
            commentCount++;
            continue;
        }

        if (/^https?:\/\//.test(raw)) {
            rules.push({ line: i + 1, raw, type: 'url' });
            urlCount++;
            continue;
        }

        if (raw.startsWith('||') || raw.startsWith('@@') || raw.includes('$') || raw.includes('^')) {
            rules.push({ line: i + 1, raw, type: 'filter' });
            filterCount++;
            continue;
        }

        rules.push({ line: i + 1, raw, type: 'unknown' });
    }

    return {
        rules,
        totalLines,
        urlCount,
        filterCount,
        commentCount,
        duration: Math.round(performance.now() - start),
    };
}
