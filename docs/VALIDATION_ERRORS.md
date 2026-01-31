# Validation Error Tracking

This document describes how validation errors are tracked and displayed through the agtree integration.

## Overview

The compiler now tracks all validation errors encountered during the validation transformation. This provides detailed feedback about why specific rules were rejected, making it easier to debug filter lists and understand what's happening during compilation.

## Features

- **Comprehensive Error Tracking**: All validation errors are collected with detailed context
- **Error Types**: Different error types (parse errors, syntax errors, unsupported modifiers, etc.)
- **Severity Levels**: Errors, warnings, and info messages
- **Line Numbers**: Track which line in the source caused the error
- **Source Attribution**: Know which source file an error came from
- **UI Display**: User-friendly error display with filtering and export capabilities

## Error Types

The following validation error types are tracked:

| Error Type | Description |
|-----------|-------------|
| `parse_error` | Rule failed to parse via AGTree |
| `syntax_error` | Invalid syntax detected |
| `unsupported_modifier` | Modifier not supported for DNS blocking |
| `invalid_hostname` | Hostname format is invalid |
| `ip_not_allowed` | IP addresses not permitted |
| `pattern_too_short` | Pattern doesn't meet minimum length requirement |
| `public_suffix_match` | Matching entire public suffix (too broad) |
| `invalid_characters` | Pattern contains invalid characters |
| `cosmetic_not_supported` | Cosmetic rules not supported for DNS blocking |
| `modifier_validation_failed` | AGTree modifier validation warning |

## Severity Levels

- **Error**: Rule will be removed from the output
- **Warning**: Rule may have issues but is kept
- **Info**: Informational message

## Usage in Code

### TypeScript/JavaScript

```typescript
import { ValidateTransformation } from './transformations/ValidateTransformation.ts';
import { ValidationReport } from './types/validation.ts';

// Create validator
const validator = new ValidateTransformation(false /* allowIp */);

// Optionally set source name for error tracking
validator.setSourceName('AdGuard DNS Filter');

// Execute validation
const validRules = validator.executeSync(rules);

// Get validation report
const report: ValidationReport = validator.getValidationReport(
    rules.length,
    validRules.length
);

// Check results
console.log(`Errors: ${report.errorCount}`);
console.log(`Warnings: ${report.warningCount}`);
console.log(`Valid: ${report.validRules}/${report.totalRules}`);

// Iterate through errors
for (const error of report.errors) {
    console.log(`[${error.severity}] ${error.message}`);
    console.log(`  Rule: ${error.ruleText}`);
    if (error.lineNumber) {
        console.log(`  Line: ${error.lineNumber}`);
    }
}
```

### Web UI

To display validation reports in your web UI, include the validation UI component and manually integrate it:

```html
<!-- Include validation UI script -->
<script src="validation-ui.js"></script>

<script>
  // Show validation report
  const report = {
    totalRules: 1000,
    validRules: 950,
    invalidRules: 50,
    errorCount: 45,
    warningCount: 5,
    infoCount: 0,
    errors: [
      {
        type: 'unsupported_modifier',
        severity: 'error',
        ruleText: '||example.com^$popup',
        message: 'Unsupported modifier: popup',
        details: 'Supported modifiers: important, ~important, ctag, dnstype, dnsrewrite',
        lineNumber: 42,
        sourceName: 'Custom Filter'
      }
    ]
  };

  ValidationUI.showReport(report);
</script>
```

## Validation Report Structure

```typescript
interface ValidationReport {
    /** Total number of errors */
    errorCount: number;
    /** Total number of warnings */
    warningCount: number;
    /** Total number of info messages */
    infoCount: number;
    /** List of all validation errors */
    errors: ValidationError[];
    /** Total rules validated */
    totalRules: number;
    /** Valid rules count */
    validRules: number;
    /** Invalid rules count (removed) */
    invalidRules: number;
}

interface ValidationError {
    /** Type of validation error */
    type: ValidationErrorType;
    /** Severity level */
    severity: ValidationSeverity;
    /** The rule text that failed validation */
    ruleText: string;
    /** Line number in the original source */
    lineNumber?: number;
    /** Human-readable error message */
    message: string;
    /** Additional context or details */
    details?: string;
    /** The parsed AST node (if available) */
    ast?: AnyRule;
    /** Source name */
    sourceName?: string;
}
```

## UI Features

### Summary Cards

The validation report shows summary cards with:
- Total rules processed
- Valid rules count
- Invalid rules count
- Error count
- Warning count

### Error List

- **Filtering**: Filter by severity (All, Errors, Warnings)
- **Details**: Each error shows:
  - Severity badge
  - Error type
  - Line number
  - Source name
  - Message
  - Details/explanation
  - The actual rule text
- **Color Coding**: Errors, warnings, and info messages use different colors
- **Export**: Download the full validation report as JSON

### Dark Mode Support

The validation UI fully supports dark mode and will adapt to the current theme.

### Color Coding

The validation UI uses comprehensive color coding for better visual understanding:

#### Error Type Colors

Each error type has a unique color scheme:

- **Parse/Syntax Errors** - Red (#dc3545)
- **Unsupported Modifier** - Orange (#fd7e14)
- **Invalid Hostname** - Pink (#e83e8c)
- **IP Not Allowed** - Purple (#6610f2)
- **Pattern Too Short** - Yellow (#ffc107)
- **Public Suffix Match** - Light Red (#ff6b6b)
- **Invalid Characters** - Magenta (#d63384)
- **Cosmetic Not Supported** - Cyan (#0dcaf0)

#### Rule Syntax Highlighting

Rules are syntax-highlighted based on their type:

- **Network rules**: Domain in blue, modifiers in orange, separators in gray
- **Exception rules**: @@ prefix in green
- **Host rules**: IP address in purple, domain in blue
- **Cosmetic rules**: Selector in green, separator in magenta
- **Comments**: Gray and italic

Problematic parts are highlighted with a colored background matching the error type.

#### AST Node Colors

When viewing the parsed AST structure, nodes are color-coded by type:

- **Network Category** - Blue (#0d6efd)
- **Network Rule** - Light Blue (#0dcaf0)
- **Host Rule** - Purple (#6610f2)
- **Cosmetic Rule** - Pink (#d63384)
- **Modifier** - Orange (#fd7e14)
- **Comment** - Gray (#6c757d)
- **Invalid Rule** - Red (#dc3545)

#### Value Type Colors

In the AST visualization, values are colored by type:

- **Boolean true** - Green (#198754)
- **Boolean false** - Red (#dc3545)
- **Numbers** - Purple (#6610f2)
- **Strings** - Blue (#0d6efd)

## Integration with Compiler

The FilterCompiler and WorkerCompiler can be extended to return validation reports:

```typescript
interface CompilationResult {
    rules: string[];
    validation?: ValidationReport;
    // ... other properties
}
```

## Example Output

### Console Output

```
[ERROR] Unsupported modifier: popup
  Rule: ||example.com^$popup
  Line: 42
  Source: Custom Filter

[ERROR] Pattern too short
  Rule: ||ad^
  Line: 156
  Details: Minimum pattern length is 5 characters

[WARNING] Modifier validation warning
  Rule: ||ads.com^$important,dnstype=A
  Details: Modifier combination may have unexpected behavior
```

### JSON Export

```json
{
  "errorCount": 2,
  "warningCount": 1,
  "infoCount": 0,
  "totalRules": 1000,
  "validRules": 997,
  "invalidRules": 3,
  "errors": [
    {
      "type": "unsupported_modifier",
      "severity": "error",
      "ruleText": "||example.com^$popup",
      "message": "Unsupported modifier: popup",
      "details": "Supported modifiers: important, ~important, ctag, dnstype, dnsrewrite",
      "lineNumber": 42,
      "sourceName": "Custom Filter"
    }
  ]
}
```

## Best Practices

1. **Always check the validation report** after compilation to understand what was filtered out
2. **Use source names** when validating multiple sources to track which source has issues
3. **Export reports** for debugging and sharing with filter list maintainers
4. **Filter by severity** to focus on critical errors first
5. **Review warnings** as they may indicate potential issues even if rules are kept

## Future Enhancements

Potential improvements for validation error tracking:

- [ ] Suggestions for fixing common errors
- [ ] Rule rewriting suggestions
- [ ] Batch validation of multiple filter lists
- [ ] Historical tracking of validation issues
- [ ] Integration with external filter list validators
- [ ] Automatic issue reporting to filter list repositories

## Related Documentation

- [AGTree Integration](./AGTREE_INTEGRATION.md)
- [Validation Transformation](../src/transformations/ValidateTransformation.ts)
- [Validation Types](../src/types/validation.ts)
