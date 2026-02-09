# Whitelist example

Check [configuration.json](configuration.json) for more details.

```
deno install --allow-read --allow-write --allow-net -n adblock-compiler jsr:@jk-com/adblock-compiler/cli

adblock-compiler -c configuration.json -o filter.txt
```