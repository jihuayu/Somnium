type CacheValue = unknown

interface CacheEntry {
  value?: CacheValue
  promise?: Promise<CacheValue>
  expiresAt: number
  tags: string[]
}

interface UnstableCacheOptions {
  revalidate?: number | false
  tags?: string[]
}

const cacheEntries = new Map<string, CacheEntry>()
const tagIndex = new Map<string, Set<string>>()

function now(): number {
  return Date.now()
}

function getExpiresAt(revalidate?: number | false): number {
  if (revalidate === false) return Number.POSITIVE_INFINITY
  if (typeof revalidate !== 'number' || !Number.isFinite(revalidate) || revalidate <= 0) {
    return Number.POSITIVE_INFINITY
  }
  return now() + revalidate * 1000
}

function buildCacheKey(keyParts: string[], args: unknown[]): string {
  return JSON.stringify([keyParts, args])
}

function setTagIndex(key: string, tags: string[]) {
  for (const tag of tags) {
    const normalizedTag = `${tag || ''}`.trim()
    if (!normalizedTag) continue
    const keys = tagIndex.get(normalizedTag) || new Set<string>()
    keys.add(key)
    tagIndex.set(normalizedTag, keys)
  }
}

function removeEntry(key: string) {
  const entry = cacheEntries.get(key)
  if (!entry) return

  for (const tag of entry.tags) {
    const keys = tagIndex.get(tag)
    if (!keys) continue
    keys.delete(key)
    if (!keys.size) {
      tagIndex.delete(tag)
    }
  }

  cacheEntries.delete(key)
}

function getFreshEntry(key: string): CacheEntry | null {
  const entry = cacheEntries.get(key)
  if (!entry) return null
  if (entry.expiresAt <= now()) {
    removeEntry(key)
    return null
  }
  return entry
}

export function unstable_cache<Args extends unknown[], Result>(
  callback: (...args: Args) => Promise<Result>,
  keyParts: string[],
  options: UnstableCacheOptions = {}
): (...args: Args) => Promise<Result> {
  return async (...args: Args): Promise<Result> => {
    const key = buildCacheKey(keyParts, args)
    const existing = getFreshEntry(key)

    if (existing?.promise) {
      return existing.promise as Promise<Result>
    }

    if (existing && 'value' in existing) {
      return existing.value as Result
    }

    const tags = (options.tags || []).map(tag => `${tag || ''}`.trim()).filter(Boolean)
    const promise = callback(...args)
      .then((value) => {
        cacheEntries.set(key, {
          value,
          expiresAt: getExpiresAt(options.revalidate),
          tags
        })
        setTagIndex(key, tags)
        return value
      })
      .catch((error) => {
        removeEntry(key)
        throw error
      })

    cacheEntries.set(key, {
      promise,
      expiresAt: getExpiresAt(options.revalidate),
      tags
    })
    setTagIndex(key, tags)

    return promise
  }
}

export function revalidateTag(tag: string) {
  const normalizedTag = `${tag || ''}`.trim()
  if (!normalizedTag) return

  const keys = Array.from(tagIndex.get(normalizedTag) || [])
  for (const key of keys) {
    removeEntry(key)
  }
}

export function revalidatePath(_path: string) {
  // Astro SSR pages render fresh on each request in this migration, so path-level
  // invalidation does not need framework support beyond cache-tag eviction.
}
