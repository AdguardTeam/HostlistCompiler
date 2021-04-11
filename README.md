# Hostlist compiler

[![NPM](https://nodei.co/npm/@adguard/hostlist-compiler.png?compact=true)](https://www.npmjs.com/package/@adguard/hostlist-compiler/)

This is a simple tool that makes it easier to compile a [hosts blocklist](https://github.com/AdguardTeam/AdGuardHome/wiki/Hosts-Blocklists) compatible with AdGuard Home or any other AdGuard product with **DNS filtering**.

- [Usage](#usage)
  - [Configuration](#configuration)
  - [Command-line](#command-line)
  - [API](#api)
- [Transformations](#transformations)
  - [RemoveComments](#remove-comments)
  - [Compress](#compress)
  - [RemoveModifiers](#remove-modifiers)
  - [Validate](#validate)
  - [Deduplicate](#deduplicate)
  - [InvertAllow](#invertallow)
- [How to build](#how-to-build)

## <a id="usage"></a> Usage

First of all, install the `hostlist-compiler`:

```bash
npm i -g @adguard/hostlist-compiler
```

Prepare the list configuration (read more about that below) and run the compiler:

```bash
hostlist-compiler -c configuration.json -o output.txt
```

### <a id="configuration"></a> Configuration

Configuration defines your filter list sources, and the transformations that are applied to the sources.

Here is an example of this configuration:

```json
{
  "name": "List name",
  "description": "List description",
  "homepage": "https://example.org/",
  "license": "GPLv3",
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

### <a id="command-line"></a> Command-line

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

### <a id="api"></a> API

```
npm i @adguard/hostlist-compiler
```

```javascript
const compile = require("@adguard/hostlist-compiler");

const configuration = {
  name: "test list",
  sources: [
    {
      source:
        "https://adguardteam.github.io/AdGuardSDNSFilter/Filters/filter.txt",
    },
  ],
};

async function main() {
  const compiled = compile(configuration);
}

main();
```

## <a id="transformations"></a> Transformations

Here is the full list of transformations that are available:

1. `RemoveComments`
2. `Compress`
3. `RemoveModifiers`
4. `Validate`
5. `Deduplicate`
6. `InvertAllow`

Please note that these transformations are are always applied in the order specified here.

### <a id="remove-comments"></a> RemoveComments

This is a very simple transformation that simply removes comments (e.g. all rules starting with `!` or `#`).

### <a id="compress"></a> Compress

> **IMPORTANT:** this transformation converts `hosts` lists into `adblock` lists.

Here's what it does:

1. It converts all rules to adblock-style rules. For instance, `0.0.0.0 example.org` will be converted to `||example.org^`.
2. It discards the rules that are now redundant because of other existing rules. For instance, `||example.org` blocks `example.org` and all it's subdomains, therefore additional rules for the subdomains are now redundant.

### <a id="remove-modifiers"></a> RemoveModifiers

By default, [AdGuard Home](https://github.com/AdguardTeam/AdGuardHome) will ignore rules with unsupported modifiers, and all of the modifiers listed here are unsupported. However, the rules with these modifiers are likely to be okay for DNS-level blocking, that's why you might want to remove them when importing rules from a traditional filter list.

Here is the list of modifiers that will be removed:

- `$third-party` and `$3p` modifiers
- `$document` modifier
- `$all` modifier
- `$popup` modifier

**IMPORTANT:** please, be cautious with this. Blindly removing `$third-party` from traditional ad blocking rules leads to lots of false-positives. This is exactly why there is an option to exclude rules - you may need to use it.

### <a id="validate"></a> Validate

This transformation is really crucial if you're using a filter list for a traditional ad blocker as a source.

It removes dangerous or incompatible rules from the list.

So here's what it does:

- Discards domain-specific rules (e.g. `||example.org^$domain=example.com`). You don't want to have domain-specific rules working globally.
- Discards rules with unsupported modifiers. [Click here](https://github.com/AdguardTeam/AdGuardHome/wiki/Hosts-Blocklists#-adblock-style-syntax) to learn more about which modifiers are supported.
- Discards rules that are too short.

If there are comments preceding the invalid rule, they will be removed as well.

### <a id="deduplicate"></a> Deduplicate

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

### <a id="invertallow"></a> InvertAllow

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

## <a id="how-to-build"></a> How to build

- `yarn install` - installs dependencies
- `yarn lint` - runs eslint
- `yarn test` - runs tests
- `node src/cli.js -c examples/sdn/configuration.json -o filter.txt` - runs compiler with the example configuration
