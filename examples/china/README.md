# EasyList China

This example demonstrates how to use "negative lookahead" exclusions to
include only lines that match a specific regular expression.

Check [configuration.json](configuration.json) for more details.

```
deno install --allow-read --allow-write --allow-net -n adblock-compiler jsr:@jk-com/adblock-compiler/cli

adblock-compiler -c configuration.json -o filter.txt
```