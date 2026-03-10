# AdGuard Filters Registry — Integration Ideas

> Generated: 2026-03-10
> Context: Analysis of [`AdguardTeam/FiltersRegistry`](https://github.com/AdguardTeam/FiltersRegistry) and its relevance to `jaypatrick/adblock-compiler`

---

## Summary

**[`AdguardTeam/FiltersRegistry`](https://github.com/AdguardTeam/FiltersRegistry)** is the canonical repository of known filter subscriptions available to AdGuard users, re-hosted at `filters.adtidy.org`. This is a **data repository + build toolchain**, not an npm/JSR package — but it is deeply relevant to `adblock-compiler` in several meaningful ways.

---

## What It Actually Is

| Aspect | Detail |
|--------|--------|
| **Type** | Data + build scripts repo (Node.js/Yarn) |
| **Purpose** | Manages, compiles, and re-hosts all AdGuard filter subscriptions |
| **Contents** | `filters/`, `platforms/`, `groups/`, `tags/`, `locales/`, `metadata.json` per filter |
| **Build tool** | Uses `@adguard/filters-compiler` (a separate package) internally |
| **License** | Open source (GPLv3) |
| **Not** | An importable package or library |

---

## Where It Connects to `adblock-compiler`

### 1. 🎯 It's a Prime Source Repository

The project's examples already reference AdGuard-hosted filter URLs directly:

```json
{
  "source": "https://adguardteam.github.io/AdGuardSDNSFilter/Filters/filter.txt",
  "type": "adblock",
  "transformations": ["RemoveComments", "Validate"]
}
```

The `FiltersRegistry` is the upstream origin of *all* filter URLs hosted at `filters.adtidy.org`. Users are already consuming its output.

---

### 2. 📋 The `metadata.json` Schema Is Worth Mirroring

FiltersRegistry defines a rich filter metadata format per filter entry:

| Field | Description |
|-------|-------------|
| `filterId` | Unique numeric filter identifier |
| `name` | Human-readable filter name |
| `description` | Filter description |
| `expires` | Default expiration/update interval |
| `groupId` | Group the filter belongs to |
| `tags` | Array of tags (`lang:*`, `purpose:*`, `recommended`, `obsolete`) |
| `trustLevel` | Permission level: `low`, `high`, or `full` |
| `platformsIncluded` | Platforms to compile for (e.g. `[\