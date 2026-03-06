# Automatic Version Bumping

This document explains how automatic version bumping works in the adblock-compiler project using Conventional Commits.

## Overview

The project uses **Conventional Commits** to automatically determine version bumps following **Semantic Versioning** (SemVer).

## How It Works

### Automatic Trigger

The `version-bump.yml` workflow automatically runs when:
- Code is pushed to `main` or `master` branch
- A PR is merged to the main branch

It can also be triggered manually with a specific version bump type.

### Version Bump Rules

Version bumps are determined by analyzing commit messages:

| Commit Type | Version Bump | Example | Old → New |
|-------------|--------------|---------|-----------|
| `feat:` | **Minor** (0.x.0) | `feat: add new transformation` | 0.12.0 → 0.13.0 |
| `fix:` | **Patch** (0.0.x) | `fix: resolve parsing error` | 0.12.0 → 0.12.1 |
| `perf:` | **Patch** (0.0.x) | `perf: optimize rule matching` | 0.12.0 → 0.12.1 |
| `feat!:` or `BREAKING CHANGE:` | **Major** (x.0.0) | `feat!: change API interface` | 0.12.0 → 1.0.0 |
| `chore:`, `docs:`, `style:`, `refactor:`, `test:`, `ci:` | **None** | `docs: update README` | No bump |

### Conventional Commit Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Examples:**

```bash
# Minor version bump (new feature)
feat: add WebSocket support for real-time compilation

# Patch version bump (bug fix)
fix: correct version synchronization in worker

# Patch version bump (performance)
perf: improve rule deduplication speed

# Major version bump (breaking change)
feat!: change compiler API to async-only

# Alternative breaking change syntax
feat: migrate to new configuration format

BREAKING CHANGE: Configuration now requires 'version' field
```

## Workflow Behavior

### 1. Commit Analysis

The workflow analyzes all commits since the last version bump:

```bash
# Gets commits since last "chore: bump version" commit
git log --grep="chore: bump version" -n 1
git log <last-version>..HEAD
```

### 2. Version Bump Decision

- Scans commit messages for conventional commit types
- Determines the highest priority bump needed:
  - **Major** takes precedence over minor and patch
  - **Minor** takes precedence over patch
  - **Patch** is the lowest priority

### 3. File Updates

If a version bump is needed, the workflow updates:

1. `deno.json` - Package version
2. `package.json` - NPM package version
3. `src/version.ts` - VERSION constant
4. `wrangler.toml` - COMPILER_VERSION variable
5. `CHANGELOG.md` - Auto-generated changelog entry

### 4. Changelog Generation

The workflow automatically generates a changelog entry with:

- **Added** section - Features from `feat:` commits
- **Fixed** section - Bug fixes from `fix:` commits
- **Performance** section - Improvements from `perf:` commits
- **BREAKING CHANGES** section - Breaking changes from commit footers

### 5. Pull Request Creation

The workflow:
1. Creates a new branch: `auto-version-bump-X.Y.Z`
2. Commits changes with message: `chore: bump version to X.Y.Z`
3. Pushes the branch to the repository
4. Creates a pull request with the version bump changes

### 6. Tag Creation and Release

After the version bump PR is merged:
1. The `create-version-tag.yml` workflow is triggered
2. It creates a git tag: `vX.Y.Z`
3. The tag automatically triggers the `release.yml` workflow which:
   - Builds binaries for all platforms
   - Publishes to JSR (JavaScript Registry)
   - Creates a GitHub Release

## Skipping Version Bumps

To skip automatic version bumping, include one of these in your commit message:

```bash
git commit -m "docs: update README [skip ci]"
git commit -m "chore: update dependencies [skip version]"
```

## Manual Version Bump

If you need to manually bump the version:

### Option 1: Use the Workflow Dispatch

You can manually trigger the version bump workflow:

```bash
# Go to Actions → Version Bump → Run workflow
# Select bump type: patch, minor, or major (or leave empty for auto-detect)
# Optionally check "Create a release after bumping"
```

## Best Practices

### Writing Good Commit Messages

✅ **Good Examples:**

```bash
feat: add batch compilation endpoint
feat(worker): implement queue-based processing
fix: resolve memory leak in rule parser
fix(validation): handle edge case for IPv6 addresses
perf: optimize deduplication algorithm
docs: add API documentation for streaming
chore: update dependencies
```

❌ **Bad Examples:**

```bash
added feature              # Missing type prefix
Fix bug                    # Incorrect capitalization
feat add new feature       # Missing colon
update code                # Too vague, missing type
```

### Commit Message Structure

1. **Type**: Use appropriate type (`feat`, `fix`, `perf`, etc.)
2. **Scope** (optional): Component affected (`worker`, `compiler`, `api`)
3. **Description**: Clear, concise description in imperative mood
4. **Body** (optional): Detailed explanation of changes
5. **Footer** (optional): Breaking changes, issue references

### Breaking Changes

When introducing breaking changes:

```bash
# Option 1: Use ! after type
feat!: change API to async-only

# Option 2: Use footer
feat: migrate to new config format

BREAKING CHANGE: Configuration schema has changed.
Old format is no longer supported. See migration guide.
```

## Troubleshooting

### No Version Bump Occurred

**Cause**: No commits with `feat:`, `fix:`, or `perf:` since last bump

**Solution**:
- Check commit messages follow conventional format
- Ensure commits are pushed to main branch
- Verify workflow wasn't skipped with `[skip ci]` or `[skip version]`

### Wrong Version Bump Type

**Cause**: Incorrect commit message format

**Solution**:
- Review commit messages since last bump
- Use manual workflow to override if needed
- Update commit messages and force-push (if not yet released)

### Workflow Failed

**Cause**: Various (permissions, conflicts, etc.)

**Solution**:
1. Check workflow logs in GitHub Actions
2. Ensure `GITHUB_TOKEN` has write permissions
3. Verify no conflicts in version files
4. Check that all version files exist

### Multiple Bumps in One Push

**Cause**: Multiple commits requiring different bump types

**Solution**:
- The workflow automatically selects the highest priority bump
- Major > Minor > Patch
- Only one version bump per workflow run

## Integration with Other Workflows

### Version Bump Flow

```
Version Bump (auto or manual) → Creates PR → PR Merged → Create Version Tag → Triggers Release Workflow
```

The complete flow:
1. **Version Bump**: Analyzes commits (or uses manual input) and creates a PR with version changes
2. **PR Review**: Human or automated review/merge of the PR
3. **Create Version Tag**: Automatically creates tag after PR merge
4. **Release Workflow**: Builds, publishes, and creates GitHub release

### CI Workflow

The CI workflow runs on:
- Pull requests (before merge)
- Pushes to any branch

Version bump workflow runs:
- Automatically on pushes to main/master (analyzes commits)
- Manually via workflow dispatch (specify bump type)
- After PR is merged to main/master

## Configuration

### Workflow File

Location: `.github/workflows/version-bump.yml`

This consolidated workflow handles both automatic (conventional commits) and manual version bumping.

### Customization

To customize behavior, edit the workflow file:

```yaml
# Change branches that trigger auto-bump
on:
    push:
        branches:
            - main
            - production  # Add custom branches

# Modify skip conditions
if: |
    !contains(github.event.head_commit.message, '[skip ci]') &&
    !contains(github.event.head_commit.message, '[no bump]')  # Custom skip tag
```

### Commit Type Recognition

To add custom commit types:

```bash
# In the "Determine version bump type" step
# Add pattern matching for custom types

# Example: Add 'security' type for patch bumps
if echo "$commit" | grep -qiE "^security(\(.+\))?:"; then
  if [ "$BUMP_TYPE" != "major" ] && [ "$BUMP_TYPE" != "minor" ]; then
    BUMP_TYPE="patch"
  fi
fi
```

## Examples

### Example 1: Feature Addition

```bash
# Commit
git commit -m "feat: add WebSocket support for real-time compilation"
git push origin main

# Result
# A PR is created: "chore: bump version to 0.13.0"
# After PR is merged:
#   - Version: 0.12.0 → 0.13.0
#   - Changelog: Added "WebSocket support for real-time compilation"
#   - Tag: v0.13.0
#   - Release: Triggered automatically
```

### Example 2: Bug Fix

```bash
# Commit
git commit -m "fix: resolve race condition in queue processing"
git push origin main

# Result
# A PR is created: "chore: bump version to 0.13.1"
# After PR is merged:
#   - Version: 0.13.0 → 0.13.1
#   - Changelog: Fixed "race condition in queue processing"
#   - Tag: v0.13.1
#   - Release: Triggered automatically
```

### Example 3: Breaking Change

```bash
# Commit
git commit -m "feat!: migrate to async-only API

BREAKING CHANGE: All compilation methods are now async.
Sync methods have been removed. Update your code to use await."
git push origin main

# Result
# A PR is created: "chore: bump version to 1.0.0"
# After PR is merged:
#   - Version: 0.13.1 → 1.0.0
#   - Changelog: Breaking change documented with migration guide
#   - Tag: v1.0.0
#   - Release: Triggered automatically
```

### Example 4: No Version Bump

```bash
# Commit
git commit -m "docs: update API documentation"
git push origin main

# Result
# No version bump (docs don't require new version)
# No tag created
# No release triggered
```

## Migration from Manual Bumps

If you're used to manual version bumping:

1. **Stop manually editing version files** - Let the workflow handle it
2. **Use conventional commits** - Follow the format guidelines
3. **Review auto-generated changelog** - Ensure quality commit messages
4. **Use manual workflow for edge cases** - When automation isn't suitable

## Related Documentation

- [VERSION_MANAGEMENT.md](VERSION_MANAGEMENT.md) - Version synchronization details
- [Conventional Commits](https://www.conventionalcommits.org/) - Official specification
- [Semantic Versioning](https://semver.org/) - SemVer specification
- `.github/workflows/version-bump.yml` - Consolidated version bump workflow (automatic and manual)
- `.github/workflows/create-version-tag.yml` - Tag creation after PR merge
- `.github/workflows/release.yml` - Release workflow
