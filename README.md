# Hostlist Compiler

[![NPM][npm-badge]][npm]

## Description

Hostlist Compiler is a Node.js CLI tool and library for filter list maintainers and developers. It
compiles DNS hosts blocklists from multiple sources — `/etc/hosts` files and adblock-style filter
lists — into a single filter list compatible with AdGuard Home and other AdGuard products with DNS
filtering.

Compiling a blocklist by hand is error-prone: sources use different syntaxes, rules must be
deduplicated, dangerous or unsupported rules have to be removed, and lists need to be filtered
through exclusion and inclusion rules. Hostlist Compiler automates this pipeline — it downloads
or reads the configured sources, converts `/etc/hosts` rules to AdGuard syntax, resolves
`!#include` directives, applies a fixed-order pipeline of transformations, and writes the
resulting filter list.

> **Note on repositories:** Active development happens in the private
> [AdGuardSoftwareLimited/filters-hostlist-compiler][private-repo] repository;
> this public [AdguardTeam/HostlistCompiler][public-mirror] repository is a
> read-only mirror that is updated automatically from it.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage](#usage)
- [Configuration](#configuration)
- [Transformations](#transformations)
- [API](#api)
- [Documentation](#documentation)

---

## Installation

Requires Node.js 22.22.2 or newer.

Install the package globally to get the `hostlist-compiler` command:

```bash
npm i -g @adguard/hostlist-compiler
```

Or install it as a dependency to use the compiler as a library:

```bash
npm i @adguard/hostlist-compiler
```

yarn is also supported:

```bash
yarn add @adguard/hostlist-compiler
```

## Quick Start

Convert a `/etc/hosts`-syntax blocklist to an AdGuard-compatible filter list in one command:

```bash
hostlist-compiler -i hosts.txt -o output.txt
```

Or compile a configurable blocklist from multiple sources:

```bash
hostlist-compiler -c configuration.json -o output.txt
```

## Usage

### Command-Line Options

| Flag                        | Description                                                                                        |
| --------------------------- | -------------------------------------------------------------------------------------------------- |
| `--config, -c <path>`       | Path to the compiler configuration file                                                            |
| `--input, -i <url-or-path>` | URL (or path to a file) to convert to an AdGuard-syntax blocklist. Can be specified multiple times |
| `--input-type, -t <type>`   | Type of the input file: `hosts` or `adblock`                                                       |
| `--output, -o <path>`       | Path to the output file (required)                                                                 |
| `--verbose, -v`             | Run with verbose logging                                                                           |
| `--version`                 | Show the version number                                                                            |
| `-h, --help`                | Show help                                                                                          |

The compiler exits with code `0` on success and `1` on failure; errors are printed to stderr.

### Quick Hosts Conversion

Convert and compress one or more `/etc/hosts`-syntax blocklists to
[AdGuard syntax](https://adguard-dns.io/kb/general/dns-filtering-syntax/):

```bash
hostlist-compiler -i hosts.txt -i hosts2.txt -o output.txt
```

The quick conversion applies a default set of transformations to convert
`/etc/hosts` rules to AdGuard syntax: `RemoveComments`, `Deduplicate`,
`Compress`, `Validate`, `TrimLines`, `InsertFinalNewLine`. To control the
pipeline explicitly, use a [configuration file](#configuration) instead.

### Build a Configurable Blocklist from Multiple Sources

Prepare the list configuration (read more about that
[below](#configuration)) and run the compiler:

```bash
hostlist-compiler -c configuration.json -o output.txt
```

A configurable blocklist can also be built from a remote URL without a configuration file:

```bash
hostlist-compiler -i https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts -o output.txt
```

## Configuration

Configuration defines your filter list sources, and the transformations that are applied to the sources.

Here is an example of this configuration:

```json
{
  "name": "List name",
  "description": "List description",
  "homepage": "https://github.com/AdguardTeam/AdguardSDNSFilter",
  "license": "GPLv3",
  "version": "1.0.0.0",
  "sources": [
    {
      "name": "Local rules",
      "source": "rules.txt",
      "type": "adblock",
      "transformations": ["RemoveComments", "Compress"],
      "exclusions": ["excluded rule 1"],
      "exclusions_sources": ["exclusions.txt"],
      "inclusions": ["*"],
      "inclusions_sources": ["inclusions.txt"]
    },
    {
      "name": "Remote rules",
      "source": "https://adguardteam.github.io/AdGuardSDNSFilter/Filters/filter.txt",
      "type": "adblock",
      "exclusions": ["excluded rule 1"]
    }
  ],
  "transformations": ["Deduplicate", "Compress"],
  "exclusions": ["excluded rule 1", "excluded rule 2"],
  "exclusions_sources": ["global_exclusions.txt"],
  "inclusions": ["*"],
  "inclusions_sources": ["global_inclusions.txt"]
}
```

- `name` - (mandatory) the list name.
- `description` - (optional) the list description.
- `homepage` - (optional) URL to the list homepage.
- `license` - (optional) Filter list license.
- `version` - (optional) Filter list version.
- `sources` - (mandatory) array of the list sources.
    - `.source` - (mandatory) path or URL of the source. It can be a
      traditional filter list or a hosts file.
    - `.name` - (optional) name of the source.
    - `.type` - (optional) type of the source. It can be `adblock` for
      Adblock-style lists or `hosts` for /etc/hosts style lists. The value is
      validated against these two options; rule parsing auto-detects the
      format, so the type does not affect parsing.
    - `.transformations` - (optional) a list of transformations to apply to
      the source rules. By default, **no transformations** are applied. Learn
      more about the possible [transformations](#transformations).
    - `.exclusions` - (optional) a list of rules (or wildcards) to exclude
      from the source.
    - `.exclusions_sources` - (optional) a list of files with exclusions.
    - `.inclusions` - (optional) a list of wildcards to include from the
      source. All rules that don't match these wildcards won't be included.
    - `.inclusions_sources` - (optional) a list of files with inclusions.
- `transformations` - (optional) a list of transformations to apply to the
  final list of rules. By default, **no transformations** are applied. Learn
  more about the possible [transformations](#transformations).
- `exclusions` - (optional) a list of rules (or wildcards) to exclude from
  the final list.
- `exclusions_sources` - (optional) a list of files with exclusions.
- `inclusions` - (optional) a list of wildcards to include in the final
  list. All rules that don't match these wildcards won't be included.
- `inclusions_sources` - (optional) a list of files with inclusions.

Here is an example of a minimal configuration:

```json
{
  "name": "test list",
  "sources": [
    {
      "source": "rules.txt"
    }
  ]
}
```

### Exclusion and Inclusion Rules

Please note, that exclusion or inclusion rules may be a plain string,
wildcard, or a regular expression.

- `plainstring` - every rule that contains `plainstring` will match the rule
- `*.plainstring` - every rule that matches this wildcard will match the rule
- `/regex/` - every rule that matches this regular expression, will match the
  rule. By default, regular expressions are case-insensitive.
- `! comment` - comments will be ignored.

> [!IMPORTANT]
> Ensure that rules in the exclusion list match the format of the rules in the filter list.
> To maintain a consistent format, add the `Compress` transformation to convert `/etc/hosts` rules to adblock syntax.
> This is especially useful if you have multiple lists in different formats.

Here is an example:

Rules in HOSTS syntax: `/hosts.txt`

```text
0.0.0.0 ads.example.com
0.0.0.0 tracking.example1.com
0.0.0.0 example.com
```

Exclusion rules in adblock syntax: `/exclusions.txt`

```text
||example.com^
```

Configuration of the final list:

```json
{
  "name": "List name",
  "description": "List description",
  "sources": [
    {
      "name": "HOSTS rules",
      "source": "hosts.txt",
      "type": "hosts",
      "transformations": ["Compress"]
    }
  ],
  "transformations": ["Deduplicate", "Compress"],
  "exclusions_sources": ["exclusions.txt"]
}
```

Final filter output of `/hosts.txt` after applying the `Compress` transformation and exclusions:

```text
||ads.example.com^
||tracking.example1.com^
```

The last rule now `||example.com^` will correctly match the rule from the exclusion list and will be excluded.

## API

The library exports a single function: `compile(configuration)`. It compiles
the filter list and returns a `Promise` that resolves to an array of rule
strings. TypeScript declarations are included with the package.

### JavaScript Example

```javascript
const compile = require('@adguard/hostlist-compiler');
const { writeFileSync } = require('fs');

;(async () => {
    // Compile filters
    const result = await compile({
        name: 'My hostlist',
        sources: [
            {
                type: 'adblock',
                source: 'https://adguardteam.github.io/AdGuardSDNSFilter/Filters/filter.txt', // or local file
                transformations: ['RemoveComments', 'Validate'],
            },
        ],
        transformations: ['Deduplicate'],
    });

    // Write to file
    writeFileSync('output.txt', result.join('\n'));
})();
```

### TypeScript Example

```typescript
import compile from '@adguard/hostlist-compiler';
import { writeFileSync } from 'fs';

;(async () => {
    // Compile filters
    const result = await compile({
        name: 'My hostlist',
        sources: [
            {
                type: 'adblock',
                source: 'https://adguardteam.github.io/AdGuardSDNSFilter/Filters/filter.txt',
                transformations: ['RemoveComments', 'Validate'],
            },
        ],
        transformations: ['Deduplicate'],
    });

    // Write to file
    writeFileSync('output.txt', result.join('\n'));
})();
```

or:

```typescript
import HostlistCompiler, { IConfiguration as HostlistCompilerConfiguration } from '@adguard/hostlist-compiler';
import { writeFileSync } from 'fs';

;(async () => {
    // Configuration
    const config: HostlistCompilerConfiguration = {
        name: 'My hostlist',
        sources: [
            {
                type: 'adblock',
                source: 'https://adguardteam.github.io/AdGuardSDNSFilter/Filters/filter.txt',
                transformations: ['RemoveComments', 'Validate'],
            },
        ],
        transformations: ['Deduplicate'],
    };

    // Compile filters
    const result = await HostlistCompiler(config);

    // Write to file
    writeFileSync('output.txt', result.join('\n'));
})();
```

## Transformations

Here is the full list of transformations that are available:

1. `ConvertToAscii`
1. `TrimLines`
1. `RemoveComments`
1. `Compress`
1. `RemoveModifiers`
1. `InvertAllow`
1. `Validate`
1. `ValidateAllowIp`
1. `ValidateAllowPublicSuffix`
1. `ValidateAllowIpAndPublicSuffix`
1. `Deduplicate`
1. `RemoveEmptyLines`
1. `InsertFinalNewLine`

Please note that these transformations are always applied in the order specified here.

### <a name="convert-to-ascii"></a> ConvertToAscii

This transformation converts all non-ASCII characters to their ASCII equivalents. It is always performed first.

**Example:**

Original list:

```text
||*.рус^
||*.कॉम^
||*.セール^
```

Here's what we will have after applying this transformation:

```text
||*.xn--p1acf^
||*.xn--11b4c3d^
||*.xn--1qqw23a^
```

### <a name="trimlines"></a> TrimLines

This is a very simple transformation that removes leading and trailing spaces/tabs.

**Example:**

Original list:

```text
rule1
   rule2
rule3
    rule4
```

Here's what we will have after applying this transformation:

```text
rule1
rule2
rule3
rule4
```

### <a name="remove-comments"></a> RemoveComments

This is a very simple transformation that simply removes comments (e.g. all rules starting with `!` or `#`).

### <a name="compress"></a> Compress

> [!IMPORTANT]
> This transformation converts `hosts` lists into `adblock` lists.

Here's what it does:

1. It converts all rules to adblock-style rules. For instance,
   `0.0.0.0 example.org` will be converted to `||example.org^`.
2. It discards the rules that are now redundant because of other existing
   rules. For instance, `||example.org` blocks `example.org` and all it's
   subdomains, therefore additional rules for the subdomains are now
   redundant.

### <a name="remove-modifiers"></a> RemoveModifiers

By default, [AdGuard Home](https://github.com/AdguardTeam/AdGuardHome) will
ignore rules with unsupported modifiers, and all of the modifiers listed here
are unsupported. However, the rules with these modifiers are likely to be okay
for DNS-level blocking, that's why you might want to remove them when importing
rules from a traditional filter list.

Here is the list of modifiers that will be removed:

- `$third-party` and `$3p` modifiers
- `$document` and `$doc` modifiers
- `$all` modifier
- `$popup` modifier
- `$network` modifier

> [!CAUTION]
> Blindly removing `$third-party` from traditional ad blocking rules leads to lots of false-positives.
>> This is exactly why there is an option to exclude rules - you may need to use it.

### <a name="invertallow"></a> InvertAllow

This transformation converts blocking rules to "allow" rules. Note, that it
does nothing to /etc/hosts rules (unless they were previously converted to
adblock-style syntax by a different transformation, for example
[Compress](#compress)).

There are two important notes about this transformation:

1. It keeps the original rules order.
2. It ignores comments, empty lines, /etc/hosts rules and existing "allow" rules.

**Example:**

Original list:

```text
! comment 1
rule1

# comment 2
192.168.11.11   test.local
@@rule2
```

Here's what we will have after applying this transformation:

```text
! comment 1
@@rule1

# comment 2
192.168.11.11   test.local
@@rule2
```

### <a name="validate"></a> Validate

This transformation is really crucial if you're using a filter list for a
traditional ad blocker as a source.

It removes dangerous or incompatible rules from the list.

So here's what it does:

- Discards domain-specific rules (e.g. `||example.org^$domain=example.com`).
  You don't want to have domain-specific rules working globally.
- Discards rules with unsupported modifiers. Learn more about the
  [supported modifiers](https://github.com/AdguardTeam/AdGuardHome/wiki/Hosts-Blocklists#-adblock-style-syntax).
- Discards rules that are too short.
- Discards IP addresses. If you need to keep IP addresses, use [ValidateAllowIp](#validate-allow-ip) instead.

#### <a name="rejected-ip-patterns"></a>Rejected IP Patterns

The following IP patterns are rejected by all validation transformations
(`Validate`, `ValidateAllowIp`, `ValidateAllowPublicSuffix`,
`ValidateAllowIpAndPublicSuffix`) as they are either unsafe or ambiguous:

- `||192.168.1^` — 3-octet with `^` - does not work
- `192.168.1` — Ambiguous: would match `192.168.11`, `192.168.111`, etc.
- `1.2.` or `1.2.*` — Too wide (1-2 octets), use regex instead

- Removes rules that block entire top-level domains (TLDs) like `||*.org^`,
  unless they have specific limiting modifiers such as `$denyallow`,
  `$badfilter`, or `$client`. Examples:
    - `||*.org^` - this rule will be removed
    - `||*.org^$denyallow=example.com` - this rule will be kept because it
      has a limiting modifier
  If such rules must be saved, use
  [ValidateAllowPublicSuffix](#validate-allow-public-suffix) or
  [ValidateAllowIpAndPublicSuffix](#validate-allow-ip-and-public-suffix).

If there are comments preceding the invalid rule, they will be removed as well.

### <a name="validate-allow-ip"></a> ValidateAllowIp

This transformation extends [Validate](#validate) to allow IP addresses in
the lists. It also **normalizes IP rules** in Adblock-style to the safe format
`||ip^`.

#### IP Rule Normalization

- `1.2.3.4` → `||1.2.3.4^` (add both separators)
- `1.2.3.4^` → `||1.2.3.4^` (add left anchor)
- `|1.2.3.4` → `||1.2.3.4^` (replace `|` with `||`, add `^`)
- `|1.2.3.4^` → `||1.2.3.4^` (replace `|` with `||`)
- `||1.2.3.4` → `||1.2.3.4^` (add right separator)
- `||1.2.3.4^` → (no change, already canonical)
- `192.168.1.` → `||192.168.1.` (3-octet subnet wildcard)
- `192.168.1.*` → `||192.168.1.*` (3-octet subnet wildcard)

Modifiers like `$important`, `$client`, `$denyallow`, `$badfilter` are preserved during normalization.

> **Note:** Invalid IP patterns are rejected solely by the base
> [Validate](#validate) logic — normalization only converts valid patterns to
> canonical form and passes everything else through unchanged. See
> [Rejected IP Patterns](#rejected-ip-patterns) for details.

### <a name="validate-allow-public-suffix"></a> ValidateAllowPublicSuffix

This transformation exactly repeats the behavior of [Validate](#validate),
but leaves rules that match whole public suffixes (e.g. `||hl.cn^`, `||org^`)
in the list.

It still filters out invalid syntax rules and unsupported modifiers, but does
not reject public-suffix rules unless the rule itself is malformed.

> **Note:** Combining any `Validate`, `ValidateAllowIp`,
> `ValidateAllowPublicSuffix`, and `ValidateAllowIpAndPublicSuffix` in one
> transformation list is not allowed and will result in an error. Each runs
> its own validator on the already-filtered output of the previous one, so
> allow-modes become silently ineffective.

> **Important:** Validation transformations also cannot be used at both
> source-level and top-level simultaneously. For example, if a source uses
> `ValidateAllowPublicSuffix` and the top-level configuration uses `Validate`,
> the compiler will throw an error. This is because the top-level `Validate`
> would override the source-level validation, making
> `ValidateAllowPublicSuffix` ineffective. Use validation transformations at
> only one level.

### <a name="validate-allow-ip-and-public-suffix"></a> ValidateAllowIpAndPublicSuffix

This transformation combines the behavior of
[ValidateAllowIp](#validate-allow-ip) and
[ValidateAllowPublicSuffix](#validate-allow-public-suffix). It allows both IP
addresses and public suffix rules in the list.

Like `ValidateAllowIp`, it normalizes incomplete IP rules to the safe format
`||ip^` before validation. See [IP Rule Normalization](#ip-rule-normalization)
for details.

Like `ValidateAllowPublicSuffix`, it keeps rules that match whole public
suffixes (e.g. `||hl.cn^`, `||org^`).

### <a name="deduplicate"></a> Deduplicate

This transformation simply removes the duplicates from the specified source.

There are two important notes about this transformation:

1. It keeps the original rules order.
2. It ignores comments. However, if the comments precede the rule that is
   being removed, the comments will be also removed.

For instance:

```text
! rule1 comment 1
rule1
! rule1 comment 2
rule1
```

Here's what will be left after the transformation:

```text
! rule1 comment 2
rule1
```

### <a name="removeemptylines"></a> RemoveEmptyLines

This is a very simple transformation that removes empty lines.

**Example:**

Original list:

```text
rule1

rule2


rule3
```

Here's what we will have after applying this transformation:

```text
rule1
rule2
rule3
```

### <a name="insertfinalnewline"></a> InsertFinalNewLine

This is a very simple transformation that inserts a final newline.

**Example:**

Original list:

```text
rule1
rule2
rule3
```

Here's what we will have after applying this transformation:

```text
rule1
rule2
rule3

```

`RemoveEmptyLines` doesn't delete this empty row due to the execution order.

## Documentation

- [Development](DEVELOPMENT.md) — how to set up the environment, build, test, and contribute
- [Deployment and configuration](DEPLOYMENT.md) — release pipeline, CI/CD, and Docker build
- [LLM agent rules](AGENTS.md) — code guidelines and project conventions
- [Changelog](CHANGELOG.md) — release history

[npm-badge]: https://nodei.co/npm/@adguard/hostlist-compiler.png?compact=true
[npm]: https://www.npmjs.com/package/@adguard/hostlist-compiler/
[private-repo]: https://github.com/AdGuardSoftwareLimited/filters-hostlist-compiler
[public-mirror]: https://github.com/AdguardTeam/HostlistCompiler
