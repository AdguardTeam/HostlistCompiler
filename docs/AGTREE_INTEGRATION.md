# AGTree Integration

This document describes the integration of `@adguard/agtree` into the adblock-compiler project.

## Overview

[AGTree](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree) is AdGuard's official tool set for working with adblock filter lists. It provides:

- **Adblock rule parser** - Parses rules into Abstract Syntax Trees (AST)
- **Rule converter** - Converts rules between different adblock syntaxes
- **Rule validator** - Validates rules against known modifier definitions
- **Compatibility tables** - Maps modifiers/features across different ad blockers

## Why AGTree?

### Before AGTree

The compiler used custom regex-based parsing in `RuleUtils.ts`:
- Limited to basic pattern matching
- No formal grammar or AST representation
- Manual modifier validation
- No syntax detection for different ad blockers
- Prone to edge-case parsing errors

### After AGTree

| Feature | Before | After |
|---------|--------|-------|
| Rule Parsing | Custom regex | Full AST with location info |
| Syntax Support | Basic adblock | AdGuard, uBlock Origin, Adblock Plus |
| Modifier Validation | Hardcoded list | Compatibility tables |
| Error Handling | String matching | Structured errors with positions |
| Rule Types | Network + hosts | All cosmetic, network, comments |
| Maintainability | Manual updates | Upstream library updates |

## Architecture

### Module Structure

```
src/utils/
├── AGTreeParser.ts    # Wrapper module for AGTree
├── RuleUtils.ts       # Refactored to use AGTreeParser
└── index.ts           # Exports AGTreeParser types
```

### AGTreeParser Wrapper

The `AGTreeParser` class provides a simplified interface to AGTree:

```typescript
import { AGTreeParser } from '@/utils/AGTreeParser.ts';

// Parse a single rule
const result = AGTreeParser.parse('||example.com^$third-party');
if (result.success && AGTreeParser.isNetworkRule(result.ast!)) {
    const props = AGTreeParser.extractNetworkRuleProperties(result.ast);
    console.log(props.pattern);    // '||example.com^'
    console.log(props.modifiers);  // [{ name: 'third-party', value: null, exception: false }]
}

// Parse an entire filter list
const filterList = AGTreeParser.parseFilterList(rawFilterListText);
for (const rule of filterList.children) {
    if (AGTreeParser.isNetworkRule(rule)) {
        // Process network rule
    }
}

// Detect syntax
const syntax = AGTreeParser.detectSyntax('example.com##+js(aopr, ads)');
// Returns: AdblockSyntax.Ubo
```

## Key Features

### 1. Type Guards

AGTreeParser provides comprehensive type guards for all rule types:

```typescript
AGTreeParser.isEmpty(rule)           // Empty lines
AGTreeParser.isComment(rule)         // All comment types
AGTreeParser.isSimpleComment(rule)   // ! or # comments
AGTreeParser.isMetadataComment(rule) // ! Title: ...
AGTreeParser.isHintComment(rule)     // !+ NOT_OPTIMIZED
AGTreeParser.isPreProcessorComment(rule) // !#if, !#include
AGTreeParser.isNetworkRule(rule)     // ||domain^ style
AGTreeParser.isHostRule(rule)        // /etc/hosts style
AGTreeParser.isCosmeticRule(rule)    // ##, #@#, etc.
AGTreeParser.isElementHidingRule(rule)
AGTreeParser.isCssInjectionRule(rule)
AGTreeParser.isScriptletRule(rule)
AGTreeParser.isExceptionRule(rule)   // @@ or #@# rules
```

### 2. Property Extraction

Extract structured data from parsed rules:

```typescript
// Network rules
const props = AGTreeParser.extractNetworkRuleProperties(networkRule);
// Returns: { pattern, isException, modifiers, syntax, ruleText }

// Host rules
const hostProps = AGTreeParser.extractHostRuleProperties(hostRule);
// Returns: { ip, hostnames, comment, ruleText }

// Cosmetic rules
const cosmeticProps = AGTreeParser.extractCosmeticRuleProperties(cosmeticRule);
// Returns: { domains, separator, isException, body, type, syntax, ruleText }
```

### 3. Modifier Utilities

Work with network rule modifiers:

```typescript
// Find a specific modifier
const mod = AGTreeParser.findModifier(rule, 'domain');

// Check if modifier exists
const hasThirdParty = AGTreeParser.hasModifier(rule, 'third-party');

// Get modifier value
const domainValue = AGTreeParser.getModifierValue(rule, 'domain');
// Returns: 'example.com|~example.org' or null
```

### 4. Validation

Validate rules and modifiers:

```typescript
// Validate a single modifier
const result = AGTreeParser.validateModifier('important', undefined, AdblockSyntax.Adg);
// Returns: { valid: boolean, errors: string[] }

// Validate all modifiers in a network rule
const validation = AGTreeParser.validateNetworkRuleModifiers(rule);
if (!validation.valid) {
    console.log(validation.errors);
}
```

### 5. Syntax Detection

Automatically detect which ad blocker syntax a rule uses:

```typescript
const syntax = AGTreeParser.detectSyntax(ruleText);
// Returns: AdblockSyntax.Adg | Ubo | Abp | Common

// Check specific syntax
AGTreeParser.isAdGuardSyntax(rule)   // AdGuard-specific
AGTreeParser.isUBlockSyntax(rule)    // uBlock Origin-specific
AGTreeParser.isAbpSyntax(rule)       // Adblock Plus-specific
```

## Integration Points

### RuleUtils

`RuleUtils` now uses AGTree internally while maintaining the same public API:

```typescript
// These methods now use AGTree parsing internally:
RuleUtils.isComment(ruleText)
RuleUtils.isAllowRule(ruleText)
RuleUtils.isEtcHostsRule(ruleText)
RuleUtils.loadAdblockRuleProperties(ruleText)
RuleUtils.loadEtcHostsRuleProperties(ruleText)

// New AGTree-powered methods:
RuleUtils.parseToAST(ruleText)       // Get raw AST
RuleUtils.isValidRule(ruleText)      // Check parseability
RuleUtils.isNetworkRule(ruleText)    // Network rule check
RuleUtils.isCosmeticRule(ruleText)   // Cosmetic rule check
RuleUtils.detectSyntax(ruleText)     // Syntax detection
```

### ValidateTransformation

The validation transformation uses AGTree for robust rule validation:

- Parses rules once and reuses the AST
- Uses structured type checking instead of regex
- Validates modifiers against AGTree's compatibility tables
- Properly handles all rule categories (network, host, cosmetic, comment)
- Provides better error messages with context

```typescript
// Before: String-based validation
if (RuleUtils.isEtcHostsRule(ruleText)) {
    return this.validateEtcHostsRule(ruleText);
}

// After: AST-based validation  
if (AGTreeParser.isHostRule(ast)) {
    return this.validateHostRule(ast as HostRule, ruleText);
}
```

## Configuration

AGTree is configured in `deno.json`:

```json
{
    "imports": {
        "@adguard/agtree": "npm:@adguard/agtree@^3.4.3"
    }
}
```

## Performance Considerations

1. **Parsing Once**: Parse each rule once and pass the AST to multiple validation functions
2. **Tolerant Mode**: Use `tolerant: true` to get `InvalidRule` nodes instead of exceptions
3. **Include Raws**: Use `includeRaws: true` to preserve original rule text in AST

```typescript
const DEFAULT_PARSER_OPTIONS: ParserOptions = {
    parseHostRules: true,
    includeRaws: true,
    tolerant: true,
};
```

## Error Handling

AGTree provides structured error information:

```typescript
const result = AGTreeParser.parse(ruleText);

if (!result.success) {
    console.log(result.error);    // Error message
    console.log(result.ruleText); // Original rule
    
    // In tolerant mode, ast may be an InvalidRule
    if (result.ast?.category === RuleCategory.Invalid) {
        // Access error details from the InvalidRule node
    }
}
```

## Supported Rule Types

AGTree supports parsing all major adblock rule types:

### Network Rules
- Basic blocking: `||example.com^`
- Exception: `@@||example.com^`
- With modifiers: `||example.com^$third-party,script`

### Host Rules
- Standard: `127.0.0.1 example.com`
- Multiple hosts: `0.0.0.0 ad1.com ad2.com`
- With comments: `127.0.0.1 example.com # block ads`

### Cosmetic Rules
- Element hiding: `example.com##.ad-banner`
- Extended CSS: `example.com#?#.ad:has(> .text)`
- CSS injection: `example.com#$#.ad { display: none !important; }`
- Scriptlet injection: `example.com#%#//scriptlet('abort-on-property-read', 'ads')`

### Comment Rules
- Simple: `! This is a comment`
- Metadata: `! Title: My Filter List`
- Hints: `!+ NOT_OPTIMIZED PLATFORM(windows)`
- Preprocessor: `!#if (adguard)`

## Future Improvements

1. **Rule Conversion**: Use AGTree's converter to transform rules between syntaxes
2. **Batch Parsing**: Use `FilterListParser` for bulk operations
3. **Streaming**: Process large filter lists without loading all into memory
4. **Diagnostics**: Leverage AGTree's location info for better error reporting

## References

- [AGTree GitHub](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)
- [AGTree Parser Documentation](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree/src/parser)
- [AdGuard Filter Syntax](https://adguard.com/kb/general/ad-filtering/create-own-filters/)
- [uBlock Origin Syntax](https://github.com/gorhill/uBlock/wiki/Static-filter-syntax)
