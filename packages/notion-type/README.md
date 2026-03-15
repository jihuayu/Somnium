# @jihuayu/notion-type

Stable, renderer-agnostic Notion document types and format helpers.

## Responsibility

This package is the contract layer.

It should contain:
- normalized Notion document and block types
- normalize helpers that convert raw Notion block payloads into the stable model
- renderer-agnostic URL and rich-text utilities
- output adapter contracts and default adapters that only depend on the neutral model, such as RSS or Open Graph payload helpers

It should not contain:
- Notion API fetching
- webhook processing tied to a runtime framework
- React, Vue, or DOM rendering logic
- renderer-specific CSS class decisions

## Intended Consumers

- @jihuayu/notion-data
- @jihuayu/notion-react
- future renderer packages such as notion-vue
- app code that only needs the neutral model or output adapters

## Public Surface

Main entry:
- types for the normalized model
- page href and URL helpers
- table-of-contents helper

Subpath exports:
- ./adapters
- ./output-adapters
- ./normalize
- ./rss
- ./og

## Adapter Contracts

Output modules should expose two layers:
- adapter interfaces that describe the stable contract
- a default adapter object used by compatibility helper functions

Examples:
- ./og exports `NotionOgAdapter` and `ogAdapter`
- ./rss exports `NotionRssAdapter` and `rssAdapter`
- ./output-adapters exports `defaultNotionOutputAdapters` and `createNotionOutputAdapters`

This keeps the core model stable while allowing apps to swap or wrap the default output behavior without coupling to React, Next.js, or Notion fetching.

## Dependency Direction

Keep the graph one-way:
- notion-data -> notion-type
- notion-react -> notion-type
- apps -> any of the above, depending on need

notion-type must not depend on notion-data or notion-react.
