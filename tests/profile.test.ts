import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildProfileMarkdown,
  countSiteDays,
  formatQuote,
  getMonthInTimeZone,
  getSeason,
  inferSocialIcon,
  isExternalHref,
  padIndex
} from '../lib/profile'

test('countSiteDays uses the site since year when it is earlier than the first post', () => {
  const days = countSiteDays({
    sinceYear: 2024,
    now: new Date('2026-01-01T00:00:00.000Z'),
    earliestPostDate: new Date('2025-06-01T00:00:00.000Z').valueOf()
  })

  assert.equal(days, 732)
})

test('countSiteDays uses the first post when it predates the since year', () => {
  const days = countSiteDays({
    sinceYear: 2026,
    now: new Date('2026-01-11T00:00:00.000Z'),
    earliestPostDate: new Date('2025-12-31T00:00:00.000Z').valueOf()
  })

  assert.equal(days, 12)
})

test('countSiteDays never returns less than one day', () => {
  const days = countSiteDays({
    sinceYear: 2030,
    now: new Date('2026-01-01T00:00:00.000Z')
  })

  assert.equal(days, 1)
})

test('getSeason maps months in the northern meteorological calendar', () => {
  assert.equal(getSeason(3), 'spring')
  assert.equal(getSeason(8), 'summer')
  assert.equal(getSeason(11), 'autumn')
  assert.equal(getSeason(1), 'winter')
})

test('getMonthInTimeZone reads the calendar month in the given zone', () => {
  const newYearInShanghai = new Date('2025-12-31T16:30:00.000Z')
  assert.equal(getMonthInTimeZone(newYearInShanghai, 'Asia/Shanghai'), 1)
  assert.equal(getMonthInTimeZone(newYearInShanghai, 'UTC'), 12)
})

test('padIndex zero-pads writing indices', () => {
  assert.equal(padIndex(1), '01')
  assert.equal(padIndex(12), '12')
})

test('formatQuote wraps plain text in corner brackets', () => {
  assert.equal(formatQuote('大梦一场，浮生今歇。'), '「大梦一场，浮生今歇。」')
  assert.equal(formatQuote('「已有引号」'), '「已有引号」')
})

test('inferSocialIcon maps common profile links', () => {
  assert.equal(inferSocialIcon('https://github.com/jihuayu'), 'github')
  assert.equal(inferSocialIcon('https://twitter.com/jihuayu123', 'X'), 'x')
  assert.equal(inferSocialIcon('mailto:hi@example.com'), 'mail')
  assert.equal(inferSocialIcon('/feed', 'RSS'), 'rss')
  assert.equal(inferSocialIcon('/about'), 'link')
})

test('isExternalHref detects http(s) and mailto links', () => {
  assert.equal(isExternalHref('https://github.com/jihuayu'), true)
  assert.equal(isExternalHref('mailto:hi@example.com'), true)
  assert.equal(isExternalHref('/about'), false)
})

test('buildProfileMarkdown renders a compact personal homepage', () => {
  const markdown = buildProfileMarkdown({
    name: '纪华裕',
    tagline: '写一点代码，记一点日子。',
    quote: '大梦一场，浮生今歇。',
    canonicalUrl: 'https://blog.jihuayu.com/me',
    postsHeading: 'Recent writing',
    posts: [
      {
        title: 'Hello',
        href: 'https://blog.jihuayu.com/hello',
        date: '2026年8月1日',
        summary: 'A note.'
      }
    ]
  })

  assert.match(markdown, /^# 纪华裕/m)
  assert.match(markdown, /> 大梦一场，浮生今歇。/)
  assert.match(markdown, /Canonical URL: https:\/\/blog\.jihuayu\.com\/me/)
  assert.match(markdown, /- \[Hello\]\(https:\/\/blog\.jihuayu\.com\/hello\) — 2026年8月1日/)
})
