# Client Libraries & Examples

Official and community client libraries for the Adblock Compiler API.

## Official Clients

### Python

Modern async client using `httpx` with full type annotations.

```python
from __future__ import annotations

import httpx
from dataclasses import dataclass
from typing import AsyncIterator, Iterator
from collections.abc import Callable

@dataclass
class Source:
    """Filter list source configuration."""
    source: str
    name: str | None = None
    type: str | None = None  # 'adblock' or 'hosts'
    transformations: list[str] | None = None

@dataclass
class CompileResult:
    """Compilation result with metrics."""
    success: bool
    rules: list[str]
    rule_count: int
    cached: bool = False
    metrics: dict | None = None
    error: str | None = None

class AdblockCompilerError(Exception):
    """Raised when compilation fails."""
    pass

class AdblockCompiler:
    """Modern async/sync Python client for Adblock Compiler API."""

    DEFAULT_URL = "https://adblock-compiler.jayson-knight.workers.dev"
    DEFAULT_TRANSFORMS = ["Deduplicate", "RemoveEmptyLines"]

    def __init__(
        self,
        base_url: str = DEFAULT_URL,
        timeout: float = 30.0,
        max_retries: int = 3,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.max_retries = max_retries

    def _build_payload(
        self,
        sources: list[Source | dict],
        name: str,
        transformations: list[str] | None,
        benchmark: bool,
    ) -> dict:
        source_list = [
            s if isinstance(s, dict) else {
                "source": s.source,
                "name": s.name,
                "type": s.type,
                "transformations": s.transformations,
            }
            for s in sources
        ]
        return {
            "configuration": {
                "name": name,
                "sources": source_list,
                "transformations": transformations or self.DEFAULT_TRANSFORMS,
            },
            "benchmark": benchmark,
        }

    def _parse_result(self, data: dict) -> CompileResult:
        if not data.get("success", False):
            raise AdblockCompilerError(data.get("error", "Unknown error"))
        return CompileResult(
            success=True,
            rules=data.get("rules", []),
            rule_count=data.get("ruleCount", 0),
            cached=data.get("cached", False),
            metrics=data.get("metrics"),
        )

    def compile(
        self,
        sources: list[Source | dict],
        name: str = "Compiled List",
        transformations: list[str] | None = None,
        benchmark: bool = False,
    ) -> CompileResult:
        """Synchronous compilation."""
        payload = self._build_payload(sources, name, transformations, benchmark)

        transport = httpx.HTTPTransport(retries=self.max_retries)
        with httpx.Client(transport=transport, timeout=self.timeout) as client:
            response = client.post(
                f"{self.base_url}/compile",
                json=payload,
                headers={"Content-Type": "application/json"},
            )
            response.raise_for_status()
            return self._parse_result(response.json())

    async def compile_async(
        self,
        sources: list[Source | dict],
        name: str = "Compiled List",
        transformations: list[str] | None = None,
        benchmark: bool = False,
    ) -> CompileResult:
        """Asynchronous compilation."""
        payload = self._build_payload(sources, name, transformations, benchmark)

        transport = httpx.AsyncHTTPTransport(retries=self.max_retries)
        async with httpx.AsyncClient(transport=transport, timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/compile",
                json=payload,
                headers={"Content-Type": "application/json"},
            )
            response.raise_for_status()
            return self._parse_result(response.json())

    def compile_stream(
        self,
        sources: list[Source | dict],
        name: str = "Compiled List",
        transformations: list[str] | None = None,
        on_event: Callable[[str, dict], None] | None = None,
    ) -> Iterator[tuple[str, dict]]:
        """Stream compilation events using SSE."""
        payload = self._build_payload(sources, name, transformations, benchmark=False)

        with httpx.Client(timeout=None) as client:
            with client.stream(
                "POST",
                f"{self.base_url}/compile/stream",
                json=payload,
                headers={"Content-Type": "application/json"},
            ) as response:
                response.raise_for_status()
                event_type = ""

                for line in response.iter_lines():
                    if line.startswith("event: "):
                        event_type = line[7:]
                    elif line.startswith("data: "):
                        import json
                        data = json.loads(line[6:])
                        if on_event:
                            on_event(event_type, data)
                        yield event_type, data

    async def compile_stream_async(
        self,
        sources: list[Source | dict],
        name: str = "Compiled List",
        transformations: list[str] | None = None,
    ) -> AsyncIterator[tuple[str, dict]]:
        """Async stream compilation events using SSE."""
        payload = self._build_payload(sources, name, transformations, benchmark=False)

        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/compile/stream",
                json=payload,
                headers={"Content-Type": "application/json"},
            ) as response:
                response.raise_for_status()
                event_type = ""

                async for line in response.aiter_lines():
                    if line.startswith("event: "):
                        event_type = line[7:]
                    elif line.startswith("data: "):
                        import json
                        data = json.loads(line[6:])
                        yield event_type, data


# Example usage
if __name__ == "__main__":
    import asyncio

    client = AdblockCompiler()

    # Synchronous compilation
    result = client.compile(
        sources=[Source(source="https://easylist.to/easylist/easylist.txt")],
        name="My Filter List",
        benchmark=True,
    )
    print(f"Compiled {result.rule_count} rules")
    if result.metrics:
        print(f"Duration: {result.metrics['totalDurationMs']}ms")

    # Async compilation
    async def main():
        result = await client.compile_async(
            sources=[{"source": "https://easylist.to/easylist/easylist.txt"}],
            benchmark=True,
        )
        print(f"Async compiled {result.rule_count} rules")

        # Async streaming
        async for event_type, data in client.compile_stream_async(
            sources=[{"source": "https://easylist.to/easylist/easylist.txt"}],
        ):
            if event_type == "progress":
                print(f"Progress: {data.get('message')}")
            elif event_type == "result":
                print(f"Complete! {data['ruleCount']} rules")

    asyncio.run(main())
```

### JavaScript/TypeScript

Modern TypeScript client with retry logic, AbortController support, and custom error handling.

```typescript
// Types
interface Source {
    source: string;
    name?: string;
    type?: 'adblock' | 'hosts';
    transformations?: string[];
}

interface CompileOptions {
    name?: string;
    transformations?: string[];
    benchmark?: boolean;
    signal?: AbortSignal;
}

interface CompileResult {
    success: boolean;
    rules: string[];
    ruleCount: number;
    cached: boolean;
    metrics?: {
        totalDurationMs: number;
        sourceCount: number;
        ruleCount: number;
    };
}

interface StreamEvent {
    event: 'progress' | 'result' | 'error';
    data: Record<string, unknown>;
}

// Custom errors
class AdblockCompilerError extends Error {
    constructor(
        message: string,
        public readonly statusCode?: number,
        public readonly retryAfter?: number,
    ) {
        super(message);
        this.name = 'AdblockCompilerError';
    }
}

class RateLimitError extends AdblockCompilerError {
    constructor(retryAfter: number) {
        super(`Rate limited. Retry after ${retryAfter}s`, 429, retryAfter);
        this.name = 'RateLimitError';
    }
}

// Client
class AdblockCompiler {
    private readonly baseUrl: string;
    private readonly maxRetries: number;
    private readonly retryDelayMs: number;

    static readonly DEFAULT_URL = 'https://adblock-compiler.jayson-knight.workers.dev';
    static readonly DEFAULT_TRANSFORMS = ['Deduplicate', 'RemoveEmptyLines'];

    constructor(options: {
        baseUrl?: string;
        maxRetries?: number;
        retryDelayMs?: number;
    } = {}) {
        this.baseUrl = options.baseUrl?.replace(/\/$/, '') ?? AdblockCompiler.DEFAULT_URL;
        this.maxRetries = options.maxRetries ?? 3;
        this.retryDelayMs = options.retryDelayMs ?? 1000;
    }

    private async fetchWithRetry(
        url: string,
        init: RequestInit,
        retries = this.maxRetries,
    ): Promise<Response> {
        let lastError: Error | undefined;

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const response = await fetch(url, init);

                if (response.status === 429) {
                    const retryAfter = parseInt(response.headers.get('Retry-After') ?? '60', 10);
                    throw new RateLimitError(retryAfter);
                }

                if (!response.ok) {
                    throw new AdblockCompilerError(
                        `HTTP ${response.status}: ${response.statusText}`,
                        response.status,
                    );
                }

                return response;
            } catch (error) {
                lastError = error as Error;

                // Don't retry on rate limits or abort
                if (error instanceof RateLimitError) throw error;
                if (init.signal?.aborted) throw error;

                // Retry on network errors
                if (attempt < retries) {
                    await new Promise(r => setTimeout(r, this.retryDelayMs * (attempt + 1)));
                }
            }
        }

        throw lastError;
    }

    async compile(sources: Source[], options: CompileOptions = {}): Promise<CompileResult> {
        const payload = {
            configuration: {
                name: options.name ?? 'Compiled List',
                sources,
                transformations: options.transformations ?? AdblockCompiler.DEFAULT_TRANSFORMS,
            },
            benchmark: options.benchmark ?? false,
        };

        const response = await this.fetchWithRetry(
            `${this.baseUrl}/compile`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: options.signal,
            },
        );

        const result = await response.json();

        if (!result.success) {
            throw new AdblockCompilerError(`Compilation failed: ${result.error}`);
        }

        return result;
    }

    async *compileStream(
        sources: Source[],
        options: Omit<CompileOptions, 'benchmark'> = {},
    ): AsyncGenerator<StreamEvent> {
        const payload = {
            configuration: {
                name: options.name ?? 'Compiled List',
                sources,
                transformations: options.transformations ?? AdblockCompiler.DEFAULT_TRANSFORMS,
            },
        };

        const response = await this.fetchWithRetry(
            `${this.baseUrl}/compile/stream`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: options.signal,
            },
        );

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let currentEvent = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';

                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        currentEvent = line.slice(7);
                    } else if (line.startsWith('data: ')) {
                        yield {
                            event: currentEvent as StreamEvent['event'],
                            data: JSON.parse(line.slice(6)),
                        };
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }
}

// Example usage
const client = new AdblockCompiler({ maxRetries: 3 });

// With AbortController for cancellation
const controller = new AbortController();
setTimeout(() => controller.abort(), 30000); // 30s timeout

try {
    const result = await client.compile(
        [{ source: 'https://easylist.to/easylist/easylist.txt' }],
        {
            name: 'My Filter List',
            benchmark: true,
            signal: controller.signal,
        },
    );

    console.log(`Compiled ${result.ruleCount} rules`);
    console.log(`Duration: ${result.metrics?.totalDurationMs}ms`);
    console.log(`Cached: ${result.cached}`);
} catch (error) {
    if (error instanceof RateLimitError) {
        console.log(`Rate limited. Retry after ${error.retryAfter}s`);
    } else {
        throw error;
    }
}

// Streaming with progress updates
for await (const { event, data } of client.compileStream([
    { source: 'https://easylist.to/easylist/easylist.txt' },
])) {
    switch (event) {
        case 'progress':
            console.log(`Progress: ${data.message}`);
            break;
        case 'result':
            console.log(`Complete! ${data.ruleCount} rules`);
            break;
        case 'error':
            console.error(`Error: ${data.message}`);
            break;
    }
}
```

### Go

Modern Go client with context support, retry logic, and proper error handling.

```go
package adblock

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const (
	DefaultBaseURL    = "https://adblock-compiler.jayson-knight.workers.dev"
	DefaultTimeout    = 30 * time.Second
	DefaultMaxRetries = 3
)

var (
	ErrRateLimited      = errors.New("rate limited")
	ErrCompilationFailed = errors.New("compilation failed")
)

// Source represents a filter list source.
type Source struct {
	Source          string   `json:"source"`
	Name            string   `json:"name,omitempty"`
	Type            string   `json:"type,omitempty"`
	Transformations []string `json:"transformations,omitempty"`
}

// Metrics contains compilation performance metrics.
type Metrics struct {
	TotalDurationMs int `json:"totalDurationMs"`
	SourceCount     int `json:"sourceCount"`
	RuleCount       int `json:"ruleCount"`
}

// CompileResult represents the compilation response.
type CompileResult struct {
	Success   bool     `json:"success"`
	Rules     []string `json:"rules"`
	RuleCount int      `json:"ruleCount"`
	Cached    bool     `json:"cached"`
	Metrics   *Metrics `json:"metrics,omitempty"`
	Error     string   `json:"error,omitempty"`
}

// Event represents a Server-Sent Event from streaming compilation.
type Event struct {
	Type string
	Data map[string]any
}

// CompileOptions configures a compilation request.
type CompileOptions struct {
	Name            string
	Transformations []string
	Benchmark       bool
}

// Compiler is the Adblock Compiler API client.
type Compiler struct {
	baseURL    string
	client     *http.Client
	maxRetries int
}

// Option configures a Compiler.
type Option func(*Compiler)

// WithBaseURL sets a custom API base URL.
func WithBaseURL(url string) Option {
	return func(c *Compiler) { c.baseURL = strings.TrimRight(url, "/") }
}

// WithTimeout sets the HTTP client timeout.
func WithTimeout(d time.Duration) Option {
	return func(c *Compiler) { c.client.Timeout = d }
}

// WithMaxRetries sets the maximum retry attempts.
func WithMaxRetries(n int) Option {
	return func(c *Compiler) { c.maxRetries = n }
}

// NewCompiler creates a new Adblock Compiler client.
func NewCompiler(opts ...Option) *Compiler {
	c := &Compiler{
		baseURL:    DefaultBaseURL,
		client:     &http.Client{Timeout: DefaultTimeout},
		maxRetries: DefaultMaxRetries,
	}
	for _, opt := range opts {
		opt(c)
	}
	return c
}

func (c *Compiler) doWithRetry(ctx context.Context, req *http.Request) (*http.Response, error) {
	var lastErr error

	for attempt := 0; attempt <= c.maxRetries; attempt++ {
		if attempt > 0 {
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(time.Duration(attempt) * time.Second):
			}
		}

		resp, err := c.client.Do(req.WithContext(ctx))
		if err != nil {
			lastErr = err
			continue
		}

		if resp.StatusCode == http.StatusTooManyRequests {
			resp.Body.Close()
			retryAfter, _ := strconv.Atoi(resp.Header.Get("Retry-After"))
			lastErr = fmt.Errorf("%w: retry after %ds", ErrRateLimited, retryAfter)
			continue
		}

		if resp.StatusCode >= 500 {
			resp.Body.Close()
			lastErr = fmt.Errorf("server error: %s", resp.Status)
			continue
		}

		return resp, nil
	}

	return nil, lastErr
}

// Compile compiles filter lists and returns the result.
func (c *Compiler) Compile(ctx context.Context, sources []Source, opts *CompileOptions) (*CompileResult, error) {
	if opts == nil {
		opts = &CompileOptions{}
	}
	if opts.Name == "" {
		opts.Name = "Compiled List"
	}
	if opts.Transformations == nil {
		opts.Transformations = []string{"Deduplicate", "RemoveEmptyLines"}
	}

	payload := map[string]any{
		"configuration": map[string]any{
			"name":            opts.Name,
			"sources":         sources,
			"transformations": opts.Transformations,
		},
		"benchmark": opts.Benchmark,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, c.baseURL+"/compile", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.doWithRetry(ctx, req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status: %s", resp.Status)
	}

	var result CompileResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	if !result.Success {
		return nil, fmt.Errorf("%w: %s", ErrCompilationFailed, result.Error)
	}

	return &result, nil
}

// CompileStream compiles filter lists and streams events via a channel.
// The returned channel is closed when the stream ends or context is canceled.
func (c *Compiler) CompileStream(ctx context.Context, sources []Source, opts *CompileOptions) (<-chan Event, <-chan error) {
	events := make(chan Event)
	errc := make(chan error, 1)

	go func() {
		defer close(events)
		defer close(errc)

		if opts == nil {
			opts = &CompileOptions{}
		}
		if opts.Name == "" {
			opts.Name = "Compiled List"
		}
		if opts.Transformations == nil {
			opts.Transformations = []string{"Deduplicate", "RemoveEmptyLines"}
		}

		payload := map[string]any{
			"configuration": map[string]any{
				"name":            opts.Name,
				"sources":         sources,
				"transformations": opts.Transformations,
			},
		}

		body, err := json.Marshal(payload)
		if err != nil {
			errc <- fmt.Errorf("marshal request: %w", err)
			return
		}

		req, err := http.NewRequest(http.MethodPost, c.baseURL+"/compile/stream", bytes.NewReader(body))
		if err != nil {
			errc <- fmt.Errorf("create request: %w", err)
			return
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := c.client.Do(req.WithContext(ctx))
		if err != nil {
			errc <- err
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			errc <- fmt.Errorf("unexpected status: %s", resp.Status)
			return
		}

		scanner := bufio.NewScanner(resp.Body)
		var eventType string

		for scanner.Scan() {
			select {
			case <-ctx.Done():
				errc <- ctx.Err()
				return
			default:
			}

			line := scanner.Text()
			switch {
			case strings.HasPrefix(line, "event: "):
				eventType = strings.TrimPrefix(line, "event: ")
			case strings.HasPrefix(line, "data: "):
				var data map[string]any
				if err := json.Unmarshal([]byte(strings.TrimPrefix(line, "data: ")), &data); err == nil {
					events <- Event{Type: eventType, Data: data}
				}
			}
		}

		if err := scanner.Err(); err != nil {
			errc <- err
		}
	}()

	return events, errc
}

// Example usage
func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	client := NewCompiler(
		WithMaxRetries(3),
		WithTimeout(30*time.Second),
	)

	// Simple compilation
	result, err := client.Compile(ctx, []Source{
		{Source: "https://easylist.to/easylist/easylist.txt"},
	}, &CompileOptions{
		Name:      "My Filter List",
		Benchmark: true,
	})
	if err != nil {
		if errors.Is(err, ErrRateLimited) {
			fmt.Println("Rate limited, try again later")
			return
		}
		panic(err)
	}

	fmt.Printf("Compiled %d rules", result.RuleCount)
	if result.Metrics != nil {
		fmt.Printf(" in %dms", result.Metrics.TotalDurationMs)
	}
	fmt.Printf(" (cached: %v)\n", result.Cached)

	// Streaming compilation
	events, errc := client.CompileStream(ctx, []Source{
		{Source: "https://easylist.to/easylist/easylist.txt"},
	}, nil)

	for event := range events {
		switch event.Type {
		case "progress":
			fmt.Printf("Progress: %v\n", event.Data["message"])
		case "result":
			fmt.Printf("Complete! %v rules\n", event.Data["ruleCount"])
		case "error":
			fmt.Printf("Error: %v\n", event.Data["message"])
		}
	}

	if err := <-errc; err != nil {
		fmt.Printf("Stream error: %v\n", err)
	}
}
```

### Rust

Async Rust client using `reqwest` and `tokio`.

```rust
use reqwest::{Client, StatusCode};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use thiserror::Error;

const DEFAULT_BASE_URL: &str = "https://adblock-compiler.jayson-knight.workers.dev";

#[derive(Error, Debug)]
pub enum AdblockError {
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),
    #[error("Rate limited, retry after {0}s")]
    RateLimited(u64),
    #[error("Compilation failed: {0}")]
    CompilationFailed(String),
    #[error("Parse error: {0}")]
    Parse(#[from] serde_json::Error),
}

#[derive(Debug, Clone, Serialize)]
pub struct Source {
    pub source: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub r#type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transformations: Option<Vec<String>>,
}

impl Source {
    pub fn new(source: impl Into<String>) -> Self {
        Self {
            source: source.into(),
            name: None,
            r#type: None,
            transformations: None,
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Metrics {
    pub total_duration_ms: u64,
    pub source_count: usize,
    pub rule_count: usize,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompileResult {
    pub success: bool,
    pub rules: Vec<String>,
    pub rule_count: usize,
    #[serde(default)]
    pub cached: bool,
    pub metrics: Option<Metrics>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
struct CompileRequest {
    configuration: Configuration,
    benchmark: bool,
}

#[derive(Debug, Clone, Serialize)]
struct Configuration {
    name: String,
    sources: Vec<Source>,
    transformations: Vec<String>,
}

pub struct AdblockCompiler {
    client: Client,
    base_url: String,
    max_retries: u32,
}

impl Default for AdblockCompiler {
    fn default() -> Self {
        Self::new()
    }
}

impl AdblockCompiler {
    pub fn new() -> Self {
        Self {
            client: Client::builder()
                .timeout(Duration::from_secs(30))
                .build()
                .expect("Failed to create HTTP client"),
            base_url: DEFAULT_BASE_URL.to_string(),
            max_retries: 3,
        }
    }

    pub fn with_base_url(mut self, url: impl Into<String>) -> Self {
        self.base_url = url.into().trim_end_matches('/').to_string();
        self
    }

    pub fn with_timeout(mut self, timeout: Duration) -> Self {
        self.client = Client::builder()
            .timeout(timeout)
            .build()
            .expect("Failed to create HTTP client");
        self
    }

    pub fn with_max_retries(mut self, retries: u32) -> Self {
        self.max_retries = retries;
        self
    }

    pub async fn compile(
        &self,
        sources: Vec<Source>,
        name: Option<&str>,
        transformations: Option<Vec<String>>,
        benchmark: bool,
    ) -> Result<CompileResult, AdblockError> {
        let request = CompileRequest {
            configuration: Configuration {
                name: name.unwrap_or("Compiled List").to_string(),
                sources,
                transformations: transformations
                    .unwrap_or_else(|| vec!["Deduplicate".into(), "RemoveEmptyLines".into()]),
            },
            benchmark,
        };

        let mut last_error = None;

        for attempt in 0..=self.max_retries {
            if attempt > 0 {
                tokio::time::sleep(Duration::from_secs(attempt as u64)).await;
            }

            let response = match self
                .client
                .post(format!("{}/compile", self.base_url))
                .json(&request)
                .send()
                .await
            {
                Ok(resp) => resp,
                Err(e) => {
                    last_error = Some(AdblockError::Http(e));
                    continue;
                }
            };

            match response.status() {
                StatusCode::TOO_MANY_REQUESTS => {
                    let retry_after = response
                        .headers()
                        .get("Retry-After")
                        .and_then(|v| v.to_str().ok())
                        .and_then(|v| v.parse().ok())
                        .unwrap_or(60);
                    last_error = Some(AdblockError::RateLimited(retry_after));
                    continue;
                }
                status if status.is_server_error() => {
                    last_error = Some(AdblockError::CompilationFailed(format!(
                        "Server error: {}",
                        status
                    )));
                    continue;
                }
                _ => {}
            }

            let result: CompileResult = response.json().await?;

            if !result.success {
                return Err(AdblockError::CompilationFailed(
                    result.error.unwrap_or_else(|| "Unknown error".to_string()),
                ));
            }

            return Ok(result);
        }

        Err(last_error.unwrap_or_else(|| AdblockError::CompilationFailed("Max retries exceeded".to_string())))
    }
}

// Example usage
#[tokio::main]
async fn main() -> Result<(), AdblockError> {
    let client = AdblockCompiler::new()
        .with_max_retries(3)
        .with_timeout(Duration::from_secs(60));

    let result = client
        .compile(
            vec![Source::new("https://easylist.to/easylist/easylist.txt")],
            Some("My Filter List"),
            None,
            true,
        )
        .await?;

    println!("Compiled {} rules", result.rule_count);
    if let Some(metrics) = &result.metrics {
        println!("Duration: {}ms", metrics.total_duration_ms);
    }
    println!("Cached: {}", result.cached);

    Ok(())
}
```

### C# / .NET

Modern C# client using `HttpClient` and async/await patterns.

```csharp
using System.Net;
using System.Net.Http.Json;
using System.Runtime.CompilerServices;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace AdblockCompiler;

public record Source(
    [property: JsonPropertyName("source")] string Url,
    [property: JsonPropertyName("name")] string? Name = null,
    [property: JsonPropertyName("type")] string? Type = null,
    [property: JsonPropertyName("transformations")] List<string>? Transformations = null
);

public record Metrics(
    [property: JsonPropertyName("totalDurationMs")] int TotalDurationMs,
    [property: JsonPropertyName("sourceCount")] int SourceCount,
    [property: JsonPropertyName("ruleCount")] int RuleCount
);

public record CompileResult(
    [property: JsonPropertyName("success")] bool Success,
    [property: JsonPropertyName("rules")] List<string> Rules,
    [property: JsonPropertyName("ruleCount")] int RuleCount,
    [property: JsonPropertyName("cached")] bool Cached = false,
    [property: JsonPropertyName("metrics")] Metrics? Metrics = null,
    [property: JsonPropertyName("error")] string? Error = null
);

public record StreamEvent(string EventType, JsonElement Data);

public class AdblockCompilerException : Exception
{
    public HttpStatusCode? StatusCode { get; }
    public int? RetryAfter { get; }

    public AdblockCompilerException(string message, HttpStatusCode? statusCode = null, int? retryAfter = null)
        : base(message)
    {
        StatusCode = statusCode;
        RetryAfter = retryAfter;
    }
}

public class RateLimitException : AdblockCompilerException
{
    public RateLimitException(int retryAfter)
        : base($"Rate limited. Retry after {retryAfter}s", HttpStatusCode.TooManyRequests, retryAfter) { }
}

public sealed class AdblockCompilerClient : IDisposable
{
    private const string DefaultBaseUrl = "https://adblock-compiler.jayson-knight.workers.dev";
    private static readonly string[] DefaultTransformations = ["Deduplicate", "RemoveEmptyLines"];

    private readonly HttpClient _httpClient;
    private readonly string _baseUrl;
    private readonly int _maxRetries;

    public AdblockCompilerClient(
        string? baseUrl = null,
        TimeSpan? timeout = null,
        int maxRetries = 3)
    {
        _baseUrl = (baseUrl ?? DefaultBaseUrl).TrimEnd('/');
        _maxRetries = maxRetries;
        _httpClient = new HttpClient { Timeout = timeout ?? TimeSpan.FromSeconds(30) };
    }

    public async Task<CompileResult> CompileAsync(
        IEnumerable<Source> sources,
        string? name = null,
        IEnumerable<string>? transformations = null,
        bool benchmark = false,
        CancellationToken cancellationToken = default)
    {
        var request = new
        {
            configuration = new
            {
                name = name ?? "Compiled List",
                sources = sources.ToList(),
                transformations = transformations?.ToList() ?? DefaultTransformations.ToList()
            },
            benchmark
        };

        Exception? lastException = null;

        for (var attempt = 0; attempt <= _maxRetries; attempt++)
        {
            if (attempt > 0)
            {
                await Task.Delay(TimeSpan.FromSeconds(attempt), cancellationToken);
            }

            try
            {
                var response = await _httpClient.PostAsJsonAsync(
                    $"{_baseUrl}/compile",
                    request,
                    cancellationToken);

                if (response.StatusCode == HttpStatusCode.TooManyRequests)
                {
                    var retryAfter = int.TryParse(
                        response.Headers.GetValues("Retry-After").FirstOrDefault(),
                        out var ra) ? ra : 60;
                    throw new RateLimitException(retryAfter);
                }

                response.EnsureSuccessStatusCode();

                var result = await response.Content.ReadFromJsonAsync<CompileResult>(cancellationToken)
                    ?? throw new AdblockCompilerException("Failed to deserialize response");

                if (!result.Success)
                {
                    throw new AdblockCompilerException($"Compilation failed: {result.Error}");
                }

                return result;
            }
            catch (RateLimitException)
            {
                throw;
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                lastException = ex;
            }
        }

        throw lastException ?? new AdblockCompilerException("Max retries exceeded");
    }

    public async IAsyncEnumerable<StreamEvent> CompileStreamAsync(
        IEnumerable<Source> sources,
        string? name = null,
        IEnumerable<string>? transformations = null,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var request = new
        {
            configuration = new
            {
                name = name ?? "Compiled List",
                sources = sources.ToList(),
                transformations = transformations?.ToList() ?? DefaultTransformations.ToList()
            }
        };

        var response = await _httpClient.PostAsJsonAsync(
            $"{_baseUrl}/compile/stream",
            request,
            cancellationToken);

        response.EnsureSuccessStatusCode();

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var reader = new StreamReader(stream);

        var currentEvent = "";

        while (!reader.EndOfStream)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var line = await reader.ReadLineAsync(cancellationToken);
            if (string.IsNullOrEmpty(line)) continue;

            if (line.StartsWith("event: "))
            {
                currentEvent = line[7..];
            }
            else if (line.StartsWith("data: "))
            {
                var data = JsonSerializer.Deserialize<JsonElement>(line[6..]);
                yield return new StreamEvent(currentEvent, data);
            }
        }
    }

    public void Dispose() => _httpClient.Dispose();
}

// Example usage
public static class Program
{
    public static async Task Main()
    {
        using var client = new AdblockCompilerClient(
            timeout: TimeSpan.FromSeconds(60),
            maxRetries: 3);

        try
        {
            // Simple compilation
            var result = await client.CompileAsync(
                sources: [new Source("https://easylist.to/easylist/easylist.txt")],
                name: "My Filter List",
                benchmark: true);

            Console.WriteLine($"Compiled {result.RuleCount} rules");
            if (result.Metrics is not null)
            {
                Console.WriteLine($"Duration: {result.Metrics.TotalDurationMs}ms");
            }
            Console.WriteLine($"Cached: {result.Cached}");

            // Streaming compilation
            await foreach (var evt in client.CompileStreamAsync(
                sources: [new Source("https://easylist.to/easylist/easylist.txt")]))
            {
                switch (evt.EventType)
                {
                    case "progress":
                        Console.WriteLine($"Progress: {evt.Data.GetProperty("message")}");
                        break;
                    case "result":
                        Console.WriteLine($"Complete! {evt.Data.GetProperty("ruleCount")} rules");
                        break;
                    case "error":
                        Console.WriteLine($"Error: {evt.Data.GetProperty("message")}");
                        break;
                }
            }
        }
        catch (RateLimitException ex)
        {
            Console.WriteLine($"Rate limited. Retry after {ex.RetryAfter}s");
        }
    }
}
```

## Community Clients

Contributions welcome for additional language support:

- Ruby
- PHP
- Java
- Swift
- Kotlin

## Installation

### Python

```bash
pip install httpx  # Modern async HTTP client
# Save the client code as adblock_compiler.py
```

### JavaScript/TypeScript

```bash
# No dependencies required - uses native fetch
# Works in Node.js 18+, Deno, Bun, and all modern browsers
```

### Go

```bash
go get  # No external dependencies - uses standard library
# Save as adblock/compiler.go
```

### Rust

```toml
# Add to Cargo.toml
[dependencies]
reqwest = { version = "0.12", features = ["json"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
thiserror = "2.0"
tokio = { version = "1", features = ["full"] }
```

### C# / .NET

```bash
# .NET 8+ required (uses native JSON and HTTP support)
dotnet new console
# No additional packages needed
```

## Error Handling

All clients handle the following errors:

- **429 Too Many Requests**: Rate limit exceeded (max 10 req/min)
- **400 Bad Request**: Invalid configuration
- **500 Internal Server Error**: Compilation failed

## Caching

The API automatically caches compilation results for 1 hour. Check the `X-Cache` header:

- `HIT`: Result served from cache
- `MISS`: Fresh compilation

## Rate Limiting

- **Limit**: 10 requests per minute per IP
- **Window**: 60 seconds (sliding)
- **Response**: HTTP 429 with `Retry-After` header

## Support

- **GitHub**: [jaypatrick/hostlistcompiler](https://github.com/jaypatrick/hostlistcompiler)
- **Issues**: [Submit a bug report](https://github.com/jaypatrick/hostlistcompiler/issues)
- **API Docs**: [docs/api/README.md](../api/README.md)
