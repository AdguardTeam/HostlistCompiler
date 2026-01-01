# Web UI Documentation

## Overview

The Hostlist Compiler Cloudflare Worker includes a fully-featured web interface for interactive filter list compilation. The UI provides both simple and advanced modes, real-time progress tracking, and easy export options.

## Features

### 1. Simple Mode

Quick compilation with minimal configuration:

- **Input Options**:
  - Paste filter list URLs (one per line)
  - Paste raw filter rules directly
  - Mix URLs and raw rules

- **Transformations**:
  - Deduplicate - Remove duplicate rules
  - Compress - Convert hosts format to AdGuard syntax
  - Validate - Remove invalid or dangerous rules
  - RemoveComments - Strip out comments
  - RemoveEmptyLines - Clean up empty lines

- **Output**:
  - Named filter list
  - Optional benchmarking metrics
  - Download as .txt file
  - Copy to clipboard

### 2. Advanced Mode

Full JSON configuration for maximum control:

- Complete access to all configuration options
- Per-source transformations
- Exclusions and inclusions
- Custom source types (adblock/hosts)
- All transformation options

### 3. Examples

Pre-built templates for common scenarios:

1. **Basic Compilation**: Simple URL-based compilation
2. **Hosts File Conversion**: Convert /etc/hosts to AdGuard syntax
3. **Raw Rules**: Compile from pasted filter rules
4. **Multiple Sources**: Combine multiple lists with different settings
5. **With Exclusions**: Filter out unwanted rules

### 4. Real-time Progress

- Server-Sent Events (SSE) streaming
- Live progress bar
- Detailed logs for each compilation step
- Source fetching status
- Transformation application tracking
- Error reporting

### 5. Results Display

- **Statistics**:
  - Total rule count
  - Compilation duration
  - Source count

- **Preview**: First 100 rules displayed
- **Export Options**:
  - Download as text file
  - Copy to clipboard
  - Named files based on list name

## Using the Web UI

### Simple Mode Example

1. Navigate to the worker URL (e.g., `http://localhost:8787`)
2. Click the "Simple Mode" tab
3. Paste filter list URLs or raw rules:
   ```
   https://adguardteam.github.io/AdGuardSDNSFilter/Filters/filter.txt
   ||ads.example.com^
   ||tracking.example.com^
   ```
4. Enter a list name (e.g., "My Custom Blocklist")
5. Select desired transformations (defaults are recommended)
6. Click "Compile Filter List"
7. Watch real-time progress
8. Download or copy results when complete

### Advanced Mode Example

1. Click the "Advanced Mode" tab
2. Enter JSON configuration:
   ```json
   {
     "name": "My Advanced Filter List",
     "description": "Custom compiled filter list",
     "sources": [
       {
         "name": "AdGuard DNS Filter",
         "source": "https://adguardteam.github.io/AdGuardSDNSFilter/Filters/filter.txt",
         "type": "adblock",
         "transformations": ["RemoveComments", "Validate"]
       },
       {
         "name": "Custom Rules",
         "source": "custom-rules",
         "transformations": ["Compress"]
       }
     ],
     "transformations": ["Deduplicate", "RemoveEmptyLines"],
     "exclusions": ["||example.com^"],
     "inclusions": ["*"]
   }
   ```
3. Enable benchmarking if desired
4. Click "Compile Filter List"
5. Monitor progress and export results

## API Integration

The web UI uses the same API endpoints available for programmatic access:

- `POST /compile` - JSON response
- `POST /compile/stream` - SSE streaming

Example fetch request from the UI:

```javascript
const response = await fetch('/compile/stream', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    configuration: {
      name: 'My List',
      sources: [{ source: 'https://example.com/filters.txt' }],
      transformations: ['Deduplicate']
    },
    preFetchedContent: {
      'raw-rules': '||ads.example.com^'
    },
    benchmark: true
  })
});
```

## Pre-fetched Content

The web UI automatically uses `preFetchedContent` for raw rules pasted directly. This bypasses CORS restrictions and allows compilation of any content without external fetching.

## Browser Compatibility

The web UI is compatible with modern browsers:

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Opera 76+

Required features:
- ES6 JavaScript
- Fetch API
- Server-Sent Events (EventSource)
- Clipboard API (for copy functionality)

## Customization

### Styling

The UI uses embedded CSS with:
- Gradient backgrounds
- Responsive design
- Mobile-friendly layout
- Dark-on-light color scheme

### Extending Examples

Add new examples by modifying the `examples` object in `index.html`:

```javascript
const examples = {
  'my-example': {
    mode: 'simple',
    input: 'your-content-here',
    name: 'Example Name'
  }
};
```

## Deployment

### Development

```bash
npm run dev
```

Access at: `http://localhost:8787`

### Production

```bash
npm run deploy
```

The web UI will be served from your worker's URL.

## Troubleshooting

### Static Assets Not Loading

Ensure `wrangler.toml` has the site configuration:

```toml
[site]
bucket = "./public"
```

### CORS Issues

The worker includes CORS headers for all responses. If you encounter CORS issues:

1. Check the `handleCors()` function in `worker.ts`
2. Ensure `Access-Control-Allow-Origin: *` is set
3. Use `preFetchedContent` to avoid external fetching

### SSE Connection Issues

If real-time progress doesn't work:

1. Check browser console for errors
2. Verify `/compile/stream` endpoint is accessible
3. Ensure browser supports EventSource
4. Check for network/firewall blocking SSE connections

### Large Rule Lists

For very large compilations:

1. Enable benchmarking to monitor performance
2. Consider splitting into multiple smaller lists
3. Use the JSON API instead of streaming for large datasets
4. Monitor worker CPU time limits (Cloudflare Workers have execution time limits)

## Security Considerations

### Input Validation

The worker validates all inputs:
- JSON schema validation for configurations
- URL validation for sources
- Transformation name validation

### Content Filtering

When accepting user-provided rules:
- Rules are validated before compilation
- Dangerous rules are filtered out (via `Validate` transformation)
- No arbitrary code execution

### Rate Limiting

Consider adding rate limiting for production deployments:

```javascript
// Example using Cloudflare Workers KV
const rateLimitKey = `ratelimit:${clientIP}`;
const requestCount = await env.RATE_LIMIT_KV.get(rateLimitKey);
if (requestCount > 100) {
  return new Response('Rate limit exceeded', { status: 429 });
}
```

## Performance Tips

1. **Use Benchmarking**: Enable to identify slow transformations
2. **Cache Results**: Use KV to cache compiled lists
3. **Limit Sources**: Fewer sources = faster compilation
4. **Pre-fetch Content**: Reduces network latency
5. **Optimize Transformations**: Only use needed transformations

## Future Enhancements

Potential improvements:

- [ ] Saved configurations (localStorage/KV)
- [ ] Scheduled compilations
- [ ] Diff viewer for list changes
- [ ] Rule search/filter in results
- [ ] Export to multiple formats
- [ ] Shareable compilation URLs
- [ ] User accounts and saved lists
- [ ] Compilation history
- [ ] Source preview before compilation
- [ ] Syntax highlighting for rules

## Support

For issues or questions:

1. Check the [main README](../../README.md)
2. Review [API documentation](./README.md)
3. File issues on GitHub

## License

MIT - Same as the main hostlist-compiler package
