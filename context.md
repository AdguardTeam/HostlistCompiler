# IP Normalization in Hostlist Compiler - Context for LLM

## Project Overview
This is the AdGuard Hostlist Compiler (@adguard/hostlist-compiler), a Node.js CLI tool that compiles DNS hosts blocklists from multiple sources into a single filter list compatible with AdGuard Home.

## Task: IP Rule Normalization and Validation

### Problem
The project needed to handle IP rules safely:
- Normalize incomplete IP rules to safe format (`||ip^`)
- Reject dangerous/ambiguous IP patterns
- Ensure consistent behavior across all validation transformations

### Solution Architecture

#### 1. Base Validator (`src/transformations/validate.js`)
The core validation logic with three IP pattern detection functions:

```javascript
// Detects IP patterns with | or || prefix (subnets)
function isIpSubnetPattern(s) { ... }

// Detects IP patterns without | or || but with ^ (suffixes)
function isIpSuffixPattern(s) { ... }

// NEW: Detects unsafe IP patterns without ^ (too wide/ambiguous)
function isUnsafeIpPattern(s) { ... }
```

#### 2. IP Normalization (`src/transformations/ip-normalize.js`)
Handles IP rule normalization for ValidateAllowIp:

```javascript
// Main entry point
function normalizeIpRules(rules) { ... }

// Core processing logic
function processIpRule(ruleText) { ... }

// Pattern analysis
function parseIpPattern(pattern) { ... }
function check3OctetSubnet(pattern) { ... }
function checkTooWidePattern(pattern) { ... }
```

#### 3. ValidateAllowIp (`src/transformations/validate-allow-ip.js`)
Wrapper that combines normalization with validation:

```javascript
function validateAllowIp(rules) {
    // 1. Normalize IP rules
    const normalizedRules = normalizeIpRules(rules);
    
    // 2. Validate using base Validator with allowIp=true
    const validator = new Validator(true, false);
    return validator.validate(normalizedRules);
}
```

### Key Changes Made

#### 1. Added `isUnsafeIpPattern()` to Validator
- Rejects 1-2 octet patterns: `1.2.`, `1.2.*`, `192.168`
- Rejects 3-octet patterns without trailing dot/wildcard: `192.168.1`
- Applied to ALL validation transformations

#### 2. Updated IP Normalization
- Handles exception rules (@@) with normalization
- Preserves modifiers during normalization
- Rejects dangerous patterns before normalization

#### 3. Architecture Benefits
- **No code duplication** - ValidateAllowIp reuses Validator
- **Consistent behavior** - all validators reject dangerous patterns
- **Modular design** - normalization separate from validation

### Pattern Handling Matrix

| Pattern | Validate | ValidateAllowIp | ValidateAllowPublicSuffix |
|---------|----------|-----------------|---------------------------|
| `1.2.*` | ❌ Rejected | ❌ Rejected | ❌ Rejected |
| `192.168.1` | ❌ Rejected | ❌ Rejected | ❌ Rejected |
| `||192.168.1^` | ❌ Rejected | ❌ Rejected | ❌ Rejected |
| `||192.168.1.` | ❌ Rejected | ✅ Allowed | ❌ Rejected |
| `1.2.3.4` | ❌ Rejected | ✅ Normalized | ❌ Rejected |

### Normalization Rules (ValidateAllowIp only)

**Input → Output:**
- `1.2.3.4` → `||1.2.3.4^`
- `1.2.3.4^` → `||1.2.3.4^`
- `|1.2.3.4^` → `||1.2.3.4^`
- `||1.2.3.4` → `||1.2.3.4^`
- `192.168.1.` → `||192.168.1.`
- `192.168.1.*` → `||192.168.1.*`

**Rejected Patterns (all validators):**
- `||192.168.1^` - 3-octet with ^ doesn't work in AdGuard Home
- `192.168.1` - Ambiguous (matches 192.168.11, 192.168.111, etc.)
- `1.2.` or `1.2.*` - Too wide (1-2 octets)

### Files Modified

1. **`src/transformations/validate.js`**
   - Added `isUnsafeIpPattern()` function
   - Integrated unsafe pattern check in validation flow

2. **`src/transformations/ip-normalize.js`**
   - Created normalization logic for IP rules
   - Handles exception rules and modifiers

3. **`src/transformations/validate-allow-ip.js`**
   - Updated to use normalization + validation pipeline

4. **`test/transformations/validate.test.js`**
   - Added test for unsafe IP patterns

5. **`README.md`**
   - Moved "Rejected IP Patterns" to Validate section
   - Updated ValidateAllowIp to reference base validation

### Testing

All tests pass:
```bash
yarn lint    # ESLint passes
yarn test    # 157 tests pass
```

### Key Design Principles

1. **DRY (Don't Repeat Yourself)** - ValidateAllowIp reuses Validator
2. **Single Responsibility** - Normalization separate from validation
3. **Consistency** - All validators handle dangerous patterns uniformly
4. **Backward Compatibility** - Existing behavior preserved for valid rules

### Usage Example

```javascript
const { validateAllowIp } = require('./src/transformations/validate-allow-ip');

const rules = [
    '1.2.3.4',           // Normalized to ||1.2.3.4^
    '192.168.1.',        // Normalized to ||192.168.1.
    '1.2.*',             // Rejected (too wide)
    '||example.com^',     // Kept as-is
];

const result = validateAllowIp(rules);
// Result: ['||1.2.3.4^', '||192.168.1.', '||example.com^']
```

This context should help another LLM understand the IP normalization implementation and continue development work effectively.
