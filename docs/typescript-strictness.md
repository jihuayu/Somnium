# TypeScript Strictness Migration

## Current batch

- Removed the unused legacy Notion renderer implementation in `components/`
- Enabled `useUnknownInCatchVariables`
- Enabled `noImplicitReturns`
- Enabled `noFallthroughCasesInSwitch`
- Replaced a first batch of high-churn `any` usage in API routes and Notion mapping helpers
- Added shared browser idle-callback typings so client code no longer needs `window as any`

## Remaining phases

1. Type `lib/server/notion-api.ts` with explicit response shapes and a typed error object
2. Remove `any` from `packages/notion-react/src/prepare.ts`, `packages/notion-react/src/components/NotionRenderer.tsx`, and `packages/notion-react/src/rss.ts`
3. Enable `noUncheckedIndexedAccess` after the Notion block/property access layer is wrapped in typed helpers
4. Enable `exactOptionalPropertyTypes` after API payload adapters stop relying on loose optional writes
5. Evaluate `strictNullChecks` and `noImplicitAny` together as the final cutover instead of enabling them independently

## Guardrails

- Keep runtime-facing Notion payload parsing behind adapter helpers instead of spreading type assertions across route handlers
- Prefer `unknown` plus narrow helper functions over `Record<string, any>`
- Add tests before tightening flags around the Notion package, because most of the remaining loose typing sits on rendering edge cases
