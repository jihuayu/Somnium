# @jihuayu/notion-data

Server-oriented Notion data access and synchronization helpers.

## Responsibility

This package is the data layer.

It should contain:
- Notion API client creation and request helpers
- datasource querying and schema lookup
- page metadata derivation from Notion page properties
- webhook parsing, validation, and generic event resolution
- directory tree building and refresh logic
- plugin hooks for data-layer extensions

It should not contain:
- Next.js revalidation calls
- React rendering
- CSS or UI fallback behavior
- app-specific blog field naming conventions

## Intended Consumers

- server-side application code
- route handlers
- cache refresh orchestration in the app layer

## Public Surface

Main entry:
- Notion client
- document building
- datasource and search helpers
- webhook helpers
- directory tree helpers

## Dependency Direction

Keep the graph one-way:
- notion-data -> notion-type
- apps -> notion-data

notion-data must not depend on notion-react.
Framework-specific mapping, such as Next.js cache invalidation, belongs in the app layer.
