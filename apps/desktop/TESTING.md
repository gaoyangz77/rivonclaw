# Desktop Testing

## Running a single test file

Use `test:file` (not `test --`) to run a single file:

```bash
# Correct — runs only the specified file
pnpm --filter @rivonclaw/desktop run test:file src/openclaw/__tests__/openclaw-connector.test.ts

# Also correct — direct invocation
cd apps/desktop && pnpm vitest run src/openclaw/__tests__/openclaw-connector.test.ts
```

**Do NOT use `test -- <file>`:**

```bash
# WRONG — runs the entire test suite, not just the specified file
pnpm --filter @rivonclaw/desktop test -- src/openclaw/__tests__/openclaw-connector.test.ts
```

Why: pnpm preserves the `--` separator, producing `vitest run -- <file>`. Vitest's CLI parser (CAC) does not treat arguments after `--` as filename filters, so it ignores the path and runs all tests. This causes misleading `EPERM`, `EMFILE`, and hook timeout errors from 40+ test files competing for sockets and file descriptors.

## Running all tests

```bash
pnpm --filter @rivonclaw/desktop test
```
