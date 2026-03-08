# Transformations

← [Back to README](../../README.md)

Here is the full list of transformations that are available:

1. `ConvertToAscii`
1. `TrimLines`
1. `RemoveComments`
1. `Compress`
1. `RemoveModifiers`
1. `InvertAllow`
1. `Validate`
1. `ValidateAllowIp`
1. `Deduplicate`
1. `RemoveEmptyLines`
1. `InsertFinalNewLine`

Please note that these transformations are always applied in the order specified here.

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
>
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
