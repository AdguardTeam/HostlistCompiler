# Configuration

← [Back to README](../../README.md)

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
  - `.transformations` - (optional) a list of transformations to apply to the source rules. By default, **no transformations** are applied. Learn more about possible transformations [here](TRANSFORMATIONS.md).
  - `.exclusions` - (optional) a list of rules (or wildcards) to exclude from the source.
  - `.exclusions_sources` - (optional) a list of files with exclusions.
  - `.inclusions` - (optional) a list of wildcards to include from the source. All rules that don't match these wildcards won't be included.
  - `.inclusions_sources` - (optional) a list of files with inclusions.
- `transformations` - (optional) a list of transformations to apply to the final list of rules. By default, **no transformations** are applied. Learn more about possible transformations [here](TRANSFORMATIONS.md).
- `exclusions` - (optional) a list of rules (or wildcards) to exclude from the source.
- `exclusions_sources` - (optional) a list of files with exclusions.
- `inclusions` - (optional) a list of wildcards to include from the source. All rules that don't match these wildcards won't be included.
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

The last rule `||example.com^` will correctly match the rule from the exclusion list and will be excluded.
