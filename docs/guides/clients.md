# Client Libraries & Examples

Official and community client libraries for the Adblock Compiler API.

## Official Clients

### Python

```python
import requests
from typing import List, Dict, Optional

class AdblockCompiler:
    """Python client for Adblock Compiler API"""
    
    def __init__(self, base_url: str = "https://adblock-compiler.jayson-knight.workers.dev"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def compile(
        self,
        sources: List[Dict[str, any]],
        name: str = "Compiled List",
        transformations: Optional[List[str]] = None,
        benchmark: bool = False
    ) -> Dict:
        """
        Compile filter lists and return results.
        
        Args:
            sources: List of source configurations
            name: Name of the compiled list
            transformations: List of transformations to apply
            benchmark: Enable performance metrics
            
        Returns:
            Dict with rules, ruleCount, and optional metrics
            
        Raises:
            requests.HTTPError: If the request fails
        """
        if transformations is None:
            transformations = ["Deduplicate", "RemoveEmptyLines"]
        
        payload = {
            "configuration": {
                "name": name,
                "sources": sources,
                "transformations": transformations
            },
            "benchmark": benchmark
        }
        
        response = self.session.post(f"{self.base_url}/compile", json=payload)
        response.raise_for_status()
        
        data = response.json()
        if not data.get("success", False):
            raise Exception(f"Compilation failed: {data.get('error')}")
            
        return data
    
    def compile_stream(
        self,
        sources: List[Dict[str, any]],
        name: str = "Compiled List",
        transformations: Optional[List[str]] = None,
        on_event: Optional[callable] = None
    ):
        """
        Compile with real-time Server-Sent Events.
        
        Args:
            sources: List of source configurations
            name: Name of the compiled list
            transformations: List of transformations to apply
            on_event: Callback function for events (event_type, data)
            
        Yields:
            Tuples of (event_type, data)
        """
        if transformations is None:
            transformations = ["Deduplicate", "RemoveEmptyLines"]
        
        payload = {
            "configuration": {
                "name": name,
                "sources": sources,
                "transformations": transformations
            }
        }
        
        response = self.session.post(
            f"{self.base_url}/compile/stream",
            json=payload,
            stream=True
        )
        response.raise_for_status()
        
        for line in response.iter_lines():
            if not line:
                continue
                
            line = line.decode('utf-8')
            
            if line.startswith('event: '):
                event_type = line[7:].strip()
            elif line.startswith('data: '):
                data = line[6:].strip()
                try:
                    import json
                    data = json.loads(data)
                except:
                    pass
                
                if on_event:
                    on_event(event_type, data)
                    
                yield (event_type, data)

# Example usage
if __name__ == "__main__":
    client = AdblockCompiler()
    
    # Simple compilation
    result = client.compile(
        sources=[
            {"source": "https://example.com/filters.txt"}
        ],
        name="My Filter List",
        benchmark=True
    )
    
    print(f"Compiled {result['ruleCount']} rules")
    print(f"Duration: {result['metrics']['totalDurationMs']}ms")
    
    # Streaming compilation
    def on_event(event_type, data):
        if event_type == 'progress':
            print(f"Progress: {data.get('message')}")
        elif event_type == 'result':
            print(f"Complete! {data['ruleCount']} rules")
    
    for event_type, data in client.compile_stream(
        sources=[{"source": "https://example.com/filters.txt"}],
        on_event=on_event
    ):
        pass  # Event handler already called
```

### JavaScript/TypeScript

```typescript
interface CompileConfig {
    name: string;
    sources: Array<{
        name?: string;
        source: string;
        type?: 'adblock' | 'hosts';
        transformations?: string[];
    }>;
    transformations?: string[];
    exclusions?: string[];
    inclusions?: string[];
}

interface CompileResult {
    success: boolean;
    rules: string[];
    ruleCount: number;
    metrics?: {
        totalDurationMs: number;
        sourceCount: number;
        ruleCount: number;
    };
    cached?: boolean;
}

class AdblockCompiler {
    constructor(
        private baseUrl: string = 'https://adblock-compiler.jayson-knight.workers.dev',
    ) {}

    async compile(
        sources: CompileConfig['sources'],
        options: {
            name?: string;
            transformations?: string[];
            benchmark?: boolean;
        } = {},
    ): Promise<CompileResult> {
        const config: CompileConfig = {
            name: options.name || 'Compiled List',
            sources,
            transformations: options.transformations || ['Deduplicate', 'RemoveEmptyLines'],
        };

        const response = await fetch(`${this.baseUrl}/compile`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                configuration: config,
                benchmark: options.benchmark || false,
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (!result.success) {
            throw new Error(`Compilation failed: ${result.error}`);
        }

        return result;
    }

    async *compileStream(
        sources: CompileConfig['sources'],
        options: {
            name?: string;
            transformations?: string[];
        } = {},
    ): AsyncGenerator<{ event: string; data: any }> {
        const config: CompileConfig = {
            name: options.name || 'Compiled List',
            sources,
            transformations: options.transformations || ['Deduplicate', 'RemoveEmptyLines'],
        };

        const response = await fetch(`${this.baseUrl}/compile/stream`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                configuration: config,
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let currentEvent = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('event: ')) {
                    currentEvent = line.slice(7);
                } else if (line.startsWith('data: ')) {
                    const data = JSON.parse(line.slice(6));
                    yield { event: currentEvent, data };
                }
            }
        }
    }
}

// Example usage
const client = new AdblockCompiler();

// Simple compilation
const result = await client.compile([
    { source: 'https://example.com/filters.txt' },
], {
    name: 'My Filter List',
    benchmark: true,
});

console.log(`Compiled ${result.ruleCount} rules in ${result.metrics?.totalDurationMs}ms`);

// Streaming compilation
for await (
    const { event, data } of client.compileStream([
        { source: 'https://example.com/filters.txt' },
    ])
) {
    if (event === 'progress') {
        console.log(`Progress: ${data.message}`);
    } else if (event === 'result') {
        console.log(`Complete! ${data.ruleCount} rules`);
    }
}
```

### Go

```go
package adblock

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "bufio"
    "strings"
)

type Compiler struct {
    BaseURL string
    Client  *http.Client
}

type Source struct {
    Name            string   `json:"name,omitempty"`
    Source          string   `json:"source"`
    Type            string   `json:"type,omitempty"`
    Transformations []string `json:"transformations,omitempty"`
}

type Configuration struct {
    Name            string   `json:"name"`
    Sources         []Source `json:"sources"`
    Transformations []string `json:"transformations,omitempty"`
}

type CompileRequest struct {
    Configuration Configuration      `json:"configuration"`
    PreFetched    map[string]string  `json:"preFetchedContent,omitempty"`
    Benchmark     bool               `json:"benchmark,omitempty"`
}

type CompileResult struct {
    Success   bool              `json:"success"`
    Rules     []string          `json:"rules"`
    RuleCount int               `json:"ruleCount"`
    Metrics   *Metrics          `json:"metrics,omitempty"`
    Cached    bool              `json:"cached,omitempty"`
    Error     string            `json:"error,omitempty"`
}

type Metrics struct {
    TotalDurationMs int `json:"totalDurationMs"`
    SourceCount     int `json:"sourceCount"`
    RuleCount       int `json:"ruleCount"`
}

type Event struct {
    Type string
    Data map[string]interface{}
}

func NewCompiler(baseURL string) *Compiler {
    if baseURL == "" {
        baseURL = "https://adblock-compiler.jayson-knight.workers.dev"
    }
    
    return &Compiler{
        BaseURL: baseURL,
        Client:  &http.Client{},
    }
}

func (c *Compiler) Compile(sources []Source, name string, transformations []string, benchmark bool) (*CompileResult, error) {
    if name == "" {
        name = "Compiled List"
    }
    
    if transformations == nil {
        transformations = []string{"Deduplicate", "RemoveEmptyLines"}
    }
    
    req := CompileRequest{
        Configuration: Configuration{
            Name:            name,
            Sources:         sources,
            Transformations: transformations,
        },
        Benchmark: benchmark,
    }
    
    body, err := json.Marshal(req)
    if err != nil {
        return nil, fmt.Errorf("marshal request: %w", err)
    }
    
    resp, err := c.Client.Post(c.BaseURL+"/compile", "application/json", bytes.NewReader(body))
    if err != nil {
        return nil, fmt.Errorf("post request: %w", err)
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != http.StatusOK {
        return nil, fmt.Errorf("http %d: %s", resp.StatusCode, resp.Status)
    }
    
    var result CompileResult
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return nil, fmt.Errorf("decode response: %w", err)
    }
    
    if !result.Success {
        return nil, fmt.Errorf("compilation failed: %s", result.Error)
    }
    
    return &result, nil
}

func (c *Compiler) CompileStream(sources []Source, name string, transformations []string) (<-chan Event, error) {
    if name == "" {
        name = "Compiled List"
    }
    
    if transformations == nil {
        transformations = []string{"Deduplicate", "RemoveEmptyLines"}
    }
    
    req := CompileRequest{
        Configuration: Configuration{
            Name:            name,
            Sources:         sources,
            Transformations: transformations,
        },
    }
    
    body, err := json.Marshal(req)
    if err != nil {
        return nil, fmt.Errorf("marshal request: %w", err)
    }
    
    resp, err := c.Client.Post(c.BaseURL+"/compile/stream", "application/json", bytes.NewReader(body))
    if err != nil {
        return nil, fmt.Errorf("post request: %w", err)
    }
    
    if resp.StatusCode != http.StatusOK {
        resp.Body.Close()
        return nil, fmt.Errorf("http %d: %s", resp.StatusCode, resp.Status)
    }
    
    events := make(chan Event)
    
    go func() {
        defer close(events)
        defer resp.Body.Close()
        
        scanner := bufio.NewScanner(resp.Body)
        var eventType string
        
        for scanner.Scan() {
            line := scanner.Text()
            
            if strings.HasPrefix(line, "event: ") {
                eventType = strings.TrimPrefix(line, "event: ")
            } else if strings.HasPrefix(line, "data: ") {
                dataStr := strings.TrimPrefix(line, "data: ")
                var data map[string]interface{}
                if err := json.Unmarshal([]byte(dataStr), &data); err == nil {
                    events <- Event{Type: eventType, Data: data}
                }
            }
        }
    }()
    
    return events, nil
}

// Example usage
func main() {
    client := NewCompiler("")
    
    // Simple compilation
    result, err := client.Compile(
        []Source{{Source: "https://example.com/filters.txt"}},
        "My Filter List",
        nil,
        true,
    )
    if err != nil {
        panic(err)
    }
    
    fmt.Printf("Compiled %d rules in %dms\n", 
        result.RuleCount, 
        result.Metrics.TotalDurationMs)
    
    // Streaming compilation
    events, err := client.CompileStream(
        []Source{{Source: "https://example.com/filters.txt"}},
        "My Filter List",
        nil,
    )
    if err != nil {
        panic(err)
    }
    
    for event := range events {
        if event.Type == "progress" {
            fmt.Printf("Progress: %v\n", event.Data["message"])
        } else if event.Type == "result" {
            fmt.Printf("Complete! %v rules\n", event.Data["ruleCount"])
        }
    }
}
```

## Community Clients

Coming soon! Contributions welcome for:

- Rust
- Ruby
- PHP
- Java
- C#/.NET

## Installation

### Python

```bash
pip install requests  # Only dependency
# Save the client code as adblock_compiler.py
```

### JavaScript/TypeScript

```bash
npm install node-fetch  # For Node.js
# Built-in fetch works in browsers and modern Node.js
```

### Go

```bash
go get  # No external dependencies
# Save as adblock/compiler.go
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
