# AdGuard Scriptlets Integration Ideas

Integration ideas for [`AdguardTeam/Scriptlets`](https://github.com/AdguardTeam/Scriptlets) and `adblock-compiler`.

---

## 1. 🧩 Scriptlet Validation via Validators API

Your compiler already has Zod validation. You could augment it by wiring in AdGuard's **Validators API** at the rule-parsing layer:

- Use `isValidScriptletRule(rule)` to validate scriptlet rules before compilation
- Use `isValidAdgRedirectRule(rule)` for redirect rule validation
- Surface validation errors through your existing Zod schemas for a unified error model
- Bonus: `isAdgScriptletRule()`, `isUboScriptletRule()`, `isAbpSnippetRule()` could power a **rule type detection** step in your pipeline

```typescript
import { isValidScriptletRule, isValidAdgRedirectRule } from '@adguard/scriptlets/validators';

// In your Zod schema or validation layer
const scriptletRuleSchema = z.string().refine(isValidScriptletRule, {
  message: 'Invalid scriptlet rule',
});
```

---

## 2. 🔄 Cross-Blocker Rule Conversion via Converters API

Your compiler targets multiple platforms. The **Converters API** maps perfectly to that:

- `convertUboToAdg()` / `convertAbpToAdg()` → normalize input rules to ADG format during ingestion
- `convertAdgToUbo()` / `convertAdgRedirectToUbo()` → emit platform-specific output at compile time
- This could be a dedicated **transform stage** in your batch processing pipeline

```typescript
import { convertUboToAdg, convertAdgToUbo } from '@adguard/scriptlets/converters';

// Normalize during ingestion
const adgRules = inputRules.flatMap(convertUboToAdg);

// Emit platform-specific output
const uboRules = adgRules.map(convertAdgToUbo).filter(Boolean);
```

---

## 3. 🌊 Scriptlet Code Generation in Streaming Pipeline

Your streaming compilation model could integrate:

- `scriptlets.invoke(source)` to **generate scriptlet code on-the-fly** as rules are streamed through the pipeline
- Stream output directly to `dist/scriptlets.corelibs.json` format for CoreLibs consumers
- Use `SCRIPTLETS_VERSION` to stamp the generated output with a version reference

```typescript
import { scriptlets, SCRIPTLETS_VERSION } from '@adguard/scriptlets';

const code = scriptlets.invoke({
  name: 'abort-on-property-read',
  args: ['alert'],
  engine: 'extension',
  version: SCRIPTLETS_VERSION,
  verbose: false,
});
```

---

## 4. 🌿 AGTree + Scriptlets as a Unified Parse/Validate Stack

Your existing `@adguard/agtree` integration can be extended since `@adguard/scriptlets` depends on `@adguard/agtree` too. Build a **shared parse → validate → compile** pipeline:

1. **AGTree** parses raw filter rules into an AST
2. **Scriptlets** validates and resolves scriptlet/redirect names
3. **adblock-compiler** emits the final output per platform

---

## 5. 📋 OpenAPI Endpoint: Rule Conversion & Validation

Expose scriptlet functionality through your existing OpenAPI surface:

| Endpoint | Scriptlets API Used |
|---|---|
| `POST /validate/scriptlet` | `isValidScriptletRule()` |
| `POST /convert/ubo-to-adg` | `convertUboToAdg()` |
| `POST /convert/adg-to-ubo` | `convertAdgToUbo()` |
| `POST /compile/scriptlet` | `scriptlets.invoke()` |
| `GET /redirects/{name}` | `getRedirect()` |

---

## 6. 🏷️ Trusted Scriptlet Gating

Since trusted scriptlets require restricted sources, enforce this at build time:

- Reject `trusted-*` scriptlets unless the filter source is marked as `trusted` in your config/schema
- Integrate with your Zod validation layer to enforce source trust levels
- Allowed trusted sources:
  - Filters created by AdGuard Team
  - Custom filters installed as `trusted`
  - User rules

---

## References

- [`AdguardTeam/Scriptlets` README](https://github.com/AdguardTeam/Scriptlets/blob/master/README.md)
- [`@adguard/scriptlets` on npm](https://www.npmjs.com/package/@adguard/scriptlets)
- [adblock-compiler AGTree Integration](../docs/api/AGTREE_INTEGRATION.md)
- [adblock-compiler Batch API Guide](../docs/api/BATCH_API_GUIDE.md)
- [adblock-compiler Zod Validation](../docs/api/ZOD_VALIDATION.md)
- [adblock-compiler Platform Support](../docs/api/PLATFORM_SUPPORT.md)
- [adblock-compiler OpenAPI Support](../docs/api/OPENAPI_SUPPORT.md)
- [adblock-compiler Streaming API](../docs/api/STREAMING_API.md)