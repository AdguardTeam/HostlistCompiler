# EasyList China

This example demonstrates how to use "negative lookahead" exclusions to
include only lines that match a specific regular expression.

Check [configuration.json](configuration.json) for more details.

```
npm i -g @adguard/hostlist-compiler

hostlist-compiler -c configuration.json -o filter.txt
```