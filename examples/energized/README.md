# Energized Pro example

Check [configuration.json](configuration.json) for more details.

> Note, that the resulting filter list is too strict for daily use. For instance, it blocks `edgekey.net` which is a commonly used CDN. You need to exclude many rules to make this filter list useable.

```
deno install --allow-read --allow-write --allow-net -n adblock-compiler jsr:@jk-com/adblock-compiler/cli

adblock-compiler -c configuration.json -o filter.txt
```

28 MB blocklist --> 13 MB filter list.
