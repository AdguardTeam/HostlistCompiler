# Hostlist compiler

[![NPM](https://nodei.co/npm/@adguard/hostlist-compiler.png?compact=true)](https://www.npmjs.com/package/@adguard/hostlist-compiler/)

This is a simple tool that makes it easier to compile a [hosts blocklist](https://adguard-dns.io/kb/general/dns-filtering-syntax/) compatible with AdGuard Home or any other AdGuard product with **DNS filtering**.

- [Usage](#usage)
  - [Configuration](#configuration)
  - [Command-line](#command-line)
  - [API](#api)
- [Transformations](#transformations)
  - [RemoveComments](#remove-comments)
  - [Compress](#compress)
  - [RemoveModifiers](#remove-modifiers)
  - [Validate](#validate)
  - [ValidateAllowIp](#validate-allow-ip)
  - [Deduplicate](#deduplicate)
  - [InvertAllow](#invertallow)
  - [RemoveEmptyLines](#removeemptylines)
  - [TrimLines](#trimlines)
  - [InsertFinalNewLine](#insertfinalnewline)
  - [ConvertToAscii](#convert-to-ascii)
- [How to build](#how-to-build)

## <a name="usage"></a> Usage

First of all, install the `hostlist-compiler`:

```bash
npm i -g @adguard/hostlist-compiler
```

After that you have two options.

**Quick hosts conversion**

Convert and compress a `/etc/hosts`-syntax blocklist to [AdGuard syntax](https://adguard-dns.io/kb/general/dns-filtering-syntax/).

```
hostlist-compiler -i hosts.txt -i hosts2.txt -o output.txt
```

**Build a configurable blocklist from multiple sources**

Prepare the list configuration (read more about that [below](#configuration)) and run the compiler:

```bash
hostlist-compiler -c configuration.json -o output.txt
```

**All command line options**

```
Usage: hostlist-compiler [options]

Options:
  --config, -c      Path to the compiler configuration file             [string]
  --input, -i       URL (or path to a file) to convert to an AdGuard-syntax
                    blocklist. Can be specified multiple times.          [array]
  --input-type, -t  Type of the input file (/etc/hosts, adguard)        [string]
  --output, -o      Path to the output file                  [string] [required]
  --verbose, -v     Run with verbose logging                           [boolean]
  --version         Show version number                                [boolean]
  -h, --help        Show help                                          [boolean]

Examples:
  hostlist-compiler -c config.json -o       compile a blocklist and write the
  output.txt                                output to output.txt
  hostlist-compiler -i                      compile a blocklist from the URL and
  https://example.org/hosts.txt -o          write the output to output.txt
  output.txt
```

### <a name="configuration"></a> Configuration

Configuration defines your filter list sources, and the transformations that are applied to the sources.

Here is an example of this configuration:

```json
{
  "name": "List name",
  "description": "List description",
  "homepage": "https://example.org/",
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
      "source": "https://example.org/rules",
      "type": "hosts",
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
  - `.source` - (mandatory) path or URL of the source. It can be a traditional filter list or a hosts file.
  - `.name` - (optional) name of the source.
  - `.type` - (optional) type of the source. It could be `adblock` for Adblock-style lists or `hosts` for /etc/hosts style lists. If not specified, `adblock` is assumed.
  - `.transformations` - (optional) a list of transformations to apply to the source rules. By default, **no transformations** are applied. Learn more about possible transformations [here](#transformations).
  - `.exclusions` - (optional) a list of rules (or wildcards) to exclude from the source.
  - `.exclusions_sources` - (optional) a list of files with exclusions.
  - `.inclusions` - (optional) a list of wildcards to include from the source. All rules that don't match these wildcards won't be included.
  - `.inclusions_sources` - (optional) a list of files with inclusions.
- `transformations` - (optional) a list of transformations to apply to the final list of rules. By default, **no transformations** are applied. Learn more about possible transformations [here](#transformations).
- `exclusions` - (optional) a list of rules (or wildcards) to exclude from the source.
- `exclusions_sources` - (optional) a list of files with exclusions.
- `.inclusions` - (optional) a list of wildcards to include from the source. All rules that don't match these wildcards won't be included.
- `.inclusions_sources` - (optional) a list of files with inclusions.

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

**Exclusion and inclusion rules**

Please note, that exclusion or inclusion rules may be a plain string, wildcard, or a regular expression.

- `plainstring` - every rule that contains `plainstring` will match the rule
- `*.plainstring` - every rule that matches this wildcard will match the rule
- `/regex/` - every rule that matches this regular expression, will match the rule. By default, regular expressions are case-insensitive.
- `! comment` - comments will be ignored.

> [!IMPORTANT]
> Ensure that rules in the exclusion list match the format of the rules in the filter list.
> To maintain a consistent format, add the `Compress` transformation to convert `/etc/hosts` rules to adblock syntax.
> This is especially useful if you have multiple lists in different formats.

Here is an example:

Rules in HOSTS syntax: `/hosts.txt`

```txt
0.0.0.0 ads.example.com  
0.0.0.0 tracking.example1.com  
0.0.0.0 example.com
```

Exclusion rules in adblock syntax: `/exclusions.txt`

```txt
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

```txt
||ads.example.com^  
||tracking.example1.com^
```

The last rule now `||example.com^` will correctly match the rule from the exclusion list and will be excluded.

### <a name="command-line"></a> Command-line

Command-line arguments.

```
Usage: hostlist-compiler [options]

Options:
  --version      Show version number                                   [boolean]
  --config, -c   Path to the compiler configuration file     [string] [required]
  --output, -o   Path to the output file                     [string] [required]
  --verbose, -v  Run with verbose logging                              [boolean]
  -h, --help     Show help                                             [boolean]

Examples:
  hostlist-compiler -c config.json -o       compile a blocklist and write the
  output.txt                                output to output.txt
```

### <a name="api"></a> API

Install: `npm i @adguard/hostlist-compiler` or `yarn add @adguard/hostlist-compiler`

#### JavaScript example:

```javascript
const compile = require("@adguard/hostlist-compiler");

;(async () => {
    // Compile filters
    const result = await compile({
        name: 'Your Hostlist',
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
    writeFileSync('your-hostlist.txt', result.join('\n'));
})();
```

#### TypeScript example:

```typescript
import compile from '@adguard/hostlist-compiler';
import { writeFileSync } from 'fs';

;(async () => {
    // Compile filters
    const result = await compile({
        name: 'Your Hostlist',
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
    writeFileSync('your-hostlist.txt', result.join('\n'));
})();
```

or:

```typescript
import HostlistCompiler, { IConfiguration as HostlistCompilerConfiguration } from '@adguard/hostlist-compiler';
import { writeFileSync } from 'fs';

;(async () => {
    // Configuration
    const config: HostlistCompilerConfiguration = {
        name: 'Your Hostlist',
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
    writeFileSync('your-hostlist.txt', result.join('\n'));
})();
```

## <a name="transformations"></a> Transformations

Here is the full list of transformations that are available:

1. `RemoveComments`
1. `Compress`
1. `RemoveModifiers`
1. `Validate`
1. `ValidateAllowIp`
1. `Deduplicate`
1. `InvertAllow`
1. `RemoveEmptyLines`
1. `TrimLines`
1. `InsertFinalNewLine`

Please note that these transformations are are always applied in the order specified here.

### <a name="remove-comments"></a> RemoveComments

This is a very simple transformation that simply removes comments (e.g. all rules starting with `!` or `#`).

### <a name="compress"></a> Compress

> [!IMPORTANT]
> This transformation converts `hosts` lists into `adblock` lists.

Here's what it does:

1. It converts all rules to adblock-style rules. For instance, `0.0.0.0 example.org` will be converted to `||example.org^`.
2. It discards the rules that are now redundant because of other existing rules. For instance, `||example.org` blocks `example.org` and all it's subdomains, therefore additional rules for the subdomains are now redundant.

### <a name="remove-modifiers"></a> RemoveModifiers

By default, [AdGuard Home](https://github.com/AdguardTeam/AdGuardHome) will ignore rules with unsupported modifiers, and all of the modifiers listed here are unsupported. However, the rules with these modifiers are likely to be okay for DNS-level blocking, that's why you might want to remove them when importing rules from a traditional filter list.

Here is the list of modifiers that will be removed:

- `$third-party` and `$3p` modifiers
- `$document` and `$doc` modifiers
- `$all` modifier
- `$popup` modifier
- `$network` modifier

> [!CAUTION]
> Blindly removing `$third-party` from traditional ad blocking rules leads to lots of false-positives.
>> This is exactly why there is an option to exclude rules - you may need to use it.

### <a name="validate"></a> Validate

This transformation is really crucial if you're using a filter list for a traditional ad blocker as a source.

It removes dangerous or incompatible rules from the list.

So here's what it does:

- Discards domain-specific rules (e.g. `||example.org^$domain=example.com`). You don't want to have domain-specific rules working globally.
- Discards rules with unsupported modifiers. [Click here](https://github.com/AdguardTeam/AdGuardHome/wiki/Hosts-Blocklists#-adblock-style-syntax) to learn more about which modifiers are supported.
- Discards rules that are too short.
- Discards IP addresses. If you need to keep IP addresses, use [ValidateAllowIp](#validate-allow-ip) instead.
- Removes rules that block entire top-level domains (TLDs) like `||*.org^`, unless they have specific limiting modifiers such as `$denyallow`, `$badfilter`, or `$client`.
  Examples:
  - `||*.org^` - this rule will be removed
  - `||*.org^$denyallow=example.com` - this rule will be kept because it has a limiting modifier

If there are comments preceding the invalid rule, they will be removed as well.

### <a name="validate-allow-ip"></a> ValidateAllowIp

This transformation exactly repeats the behavior of [Validate](#validate), but leaves the IP addresses in the lists.

### <a name="deduplicate"></a> Deduplicate

This transformation simply removes the duplicates from the specified source.

There are two important notes about this transformation:

1. It keeps the original rules order.
2. It ignores comments. However, if the comments precede the rule that is being removed, the comments will be also removed.

For instance:

```
! rule1 comment 1
rule1
! rule1 comment 2
rule1
```

Here's what will be left after the transformation:

```
! rule1 comment 2
rule1
```

### <a name="invertallow"></a> InvertAllow

This transformation converts blocking rules to "allow" rules. Note, that it does nothing to /etc/hosts rules (unless they were previously converted to adblock-style syntax by a different transformation, for example [Compress](#compress)).

There are two important notes about this transformation:

1. It keeps the original rules order.
2. It ignores comments, empty lines, /etc/hosts rules and existing "allow" rules.

**Example:**

Original list:

```
! comment 1
rule1

# comment 2
192.168.11.11   test.local
@@rule2
```

Here's what we will have after applying this transformation:

```
! comment 1
@@rule1

# comment 2
192.168.11.11   test.local
@@rule2
```

### <a name="removeemptylines"></a> RemoveEmptyLines

This is a very simple transformation that removes empty lines.

**Example:**

Original list:

```
rule1

rule2


rule3
```

Here's what we will have after applying this transformation:

```
rule1
rule2
rule3
```

### <a name="trimlines"></a> TrimLines

This is a very simple transformation that removes leading and trailing spaces/tabs.

**Example:**

Original list:

```
rule1
   rule2
rule3
		rule4
```

Here's what we will have after applying this transformation:

```
rule1
rule2
rule3
rule4
```

### <a name="insertfinalnewline"></a> InsertFinalNewLine

This is a very simple transformation that inserts a final newline.

**Example:**

Original list:

```
rule1
rule2
rule3
```

Here's what we will have after applying this transformation:

```
rule1
rule2
rule3

```

`RemoveEmptyLines` doesn't delete this empty row due to the execution order.

### <a name="convert-to-ascii"></a> ConvertToAscii

This transformation converts all non-ASCII characters to their ASCII equivalents. It is always performed first.

**Example:**

Original list:

```
||*.рус^
||*.कॉम^
||*.セール^
```

Here's what we will have after applying this transformation:

```
||*.xn--p1acf^
||*.xn--11b4c3d^
||*.xn--1qqw23a^
```

## <a name="how-to-build"></a> How to build

- `yarn install` - installs dependencies
- `yarn lint` - runs eslint
- `yarn test` - runs tests
- `node src/cli.js -c examples/sdn/configuration.json -o filter.txt` - runs compiler with the example configuration
