# Adblock Compiler Benchmarks

This document describes the benchmark suite for the adblock-compiler project.

## Overview

The benchmark suite covers the following areas:

1. **Utility Functions** - Core utilities for rule parsing and manipulation
   - `RuleUtils` - Rule parsing, validation, and conversion
   - `StringUtils` - String manipulation operations
   - `Wildcard` - Pattern matching (plain, wildcard, regex)

2. **Transformations** - Filter list transformation operations
   - `DeduplicateTransformation` - Remove duplicate rules
   - `CompressTransformation` - Convert and compress rules
   - `RemoveCommentsTransformation` - Strip comments
   - `ValidateTransformation` - Validate rule syntax
   - `RemoveModifiersTransformation` - Remove unsupported modifiers
   - `TrimLinesTransformation` - Trim whitespace
   - `RemoveEmptyLinesTransformation` - Remove empty lines
   - Chained transformations (real-world pipelines)

## Running Benchmarks

### Run All Benchmarks

```bash
deno bench --allow-read --allow-write --allow-net --allow-env
```

### Run Specific Benchmark Files

```bash
# Utility benchmarks
deno bench src/utils/RuleUtils.bench.ts
deno bench src/utils/StringUtils.bench.ts
deno bench src/utils/Wildcard.bench.ts

# Transformation benchmarks
deno bench src/transformations/transformations.bench.ts
```

### Run Benchmarks by Group

Deno allows filtering benchmarks by group name:

```bash
# Run only RuleUtils isComment benchmarks
deno bench --filter "isComment"

# Run only Deduplicate transformation benchmarks
deno bench --filter "deduplicate"

# Run only chained transformation benchmarks
deno bench --filter "chained"
```

### Generate JSON Output

For CI/CD integration or further analysis:

```bash
deno bench --json > benchmark-results.json
```

## Benchmark Structure

Each benchmark file follows this structure:

- **Setup** - Sample data and configurations
- **Individual Operations** - Test single operations with various inputs
- **Batch Operations** - Test operations on multiple items
- **Real-world Scenarios** - Test common usage patterns

### Benchmark Groups

Benchmarks are organized into groups for easy filtering:

#### RuleUtils Groups

- `isComment` - Comment detection
- `isAllowRule` - Allow rule detection
- `isJustDomain` - Domain validation
- `isEtcHostsRule` - Hosts file detection
- `nonAscii` - Non-ASCII character handling
- `punycode` - Punycode conversion
- `parseTokens` - Token parsing
- `extractHostname` - Hostname extraction
- `loadEtcHosts` - Hosts file parsing
- `loadAdblock` - Adblock rule parsing
- `batch` - Batch processing

#### StringUtils Groups

- `substringBetween` - Substring extraction
- `split` - Delimiter splitting with escapes
- `escapeRegExp` - Regex escaping
- `isEmpty` - Empty string checks
- `trim` - Whitespace trimming
- `batch` - Batch operations
- `realworld` - Real-world usage

#### Wildcard Groups

- `creation` - Pattern creation
- `plainMatch` - Plain string matching
- `wildcardMatch` - Wildcard pattern matching
- `regexMatch` - Regex pattern matching
- `longStrings` - Long string performance
- `properties` - Property access
- `realworld` - Filter list patterns
- `comparison` - Pattern type comparison

#### Transformation Groups

- `deduplicate` - Deduplication
- `compress` - Compression
- `removeComments` - Comment removal
- `validate` - Validation
- `removeModifiers` - Modifier removal
- `trimLines` - Line trimming
- `removeEmptyLines` - Empty line removal
- `chained` - Chained transformations

## Performance Tips

When analyzing benchmark results:

1. **Look for Regressions** - Compare results across commits to catch performance regressions
2. **Focus on Hot Paths** - Prioritize optimizing frequently-called operations
3. **Consider Trade-offs** - Balance performance with code readability and maintainability
4. **Test with Real Data** - Supplement benchmarks with real-world filter list data

## CI/CD Integration

Add benchmarks to your CI pipeline:

```yaml
# Example GitHub Actions
- name: Run Benchmarks
  run: deno bench --allow-read --allow-write --allow-net --allow-env --json > benchmarks.json

- name: Upload Results
  uses: actions/upload-artifact@v3
  with:
      name: benchmark-results
      path: benchmarks.json
```

## Interpreting Results

Deno's benchmark output shows:

- **Time/iteration** - Average time per benchmark iteration
- **Iterations** - Number of iterations run
- **Standard deviation** - Consistency of results

Lower times and smaller standard deviations indicate better performance.

## Adding New Benchmarks

When adding new features, include benchmarks:

1. Create or update the relevant `.bench.ts` file
2. Follow existing naming conventions
3. Use descriptive benchmark names
4. Add to an appropriate group
5. Include various input sizes (small, medium, large)
6. Test edge cases

Example:

```typescript
Deno.bench('MyComponent - operation description', { group: 'myGroup' }, () => {
    // Setup
    const component = new MyComponent();
    const input = generateTestData();

    // Benchmark
    component.process(input);
});
```

## Baseline Expectations

Approximate performance baselines (your mileage may vary):

- **RuleUtils.isComment**: ~100-500ns per call
- **RuleUtils.parseRuleTokens**: ~1-5µs per call
- **Wildcard plain string match**: ~50-200ns per call
- **Deduplicate 1000 rules**: ~1-10ms
- **Compress 500 rules**: ~5-20ms
- **Full pipeline 1000 rules**: ~10-50ms

These are rough guidelines - actual performance depends on hardware, input data, and Deno version.
