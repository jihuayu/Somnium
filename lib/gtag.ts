// https://developers.google.com/analytics/devguides/collection/gtagjs/pages
export const pageview = (gTag: string, url: string): void => {
  (window as any).gtag('config', gTag, {
    page_path: url
  })
}

// https://developers.google.com/analytics/devguides/collection/gtagjs/events
export const event = ({ action, category, label, value }: {
  action: string
  category: string
  label: string
  value: number
}): void => {
  (window as any).gtag('event', action, {
    event_category: category,
    event_label: label,
    value: value
  })
}
