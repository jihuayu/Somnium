# @jihuayu/notion-react

React renderer for the normalized Notion model.

## Responsibility

This package is the React render layer.

It should contain:
- React components for rendering the normalized Notion document
- render-model preparation helpers
- render-specific fallback logic
- render-only utilities such as CSS class naming and presentation fallbacks

It should not contain:
- Notion API fetching
- webhook handling
- datasource querying
- framework-specific server cache invalidation

## Intended Consumers

- React apps using the normalized Notion model
- server or client React components
- future app adapters that want to render documents prepared elsewhere

## Public Surface

Main entry:
- NotionRenderer
- RichText and leaf components
- render-model types

Subpath exports:
- ./prepare
- ./client
- ./styles.css

## Dependency Direction

Keep the graph one-way:
- notion-react -> notion-type
- apps -> notion-react

notion-react must not depend on notion-data.
Data should be prepared before it reaches the render layer.
