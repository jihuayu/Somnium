// https://developers.google.com/analytics/devguides/collection/gtagjs/pages
export const pageview = (gTag: string, url: string): void => {
  const win = window as any
  win.dataLayer = win.dataLayer || []
  if (typeof win.gtag !== 'function') {
    win.gtag = function gtag(...args: any[]) {
      win.dataLayer.push(args)
    }
  }

  win.gtag('config', gTag, {
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
  const win = window as any
  win.dataLayer = win.dataLayer || []
  if (typeof win.gtag !== 'function') return

  win.gtag('event', action, {
    event_category: category,
    event_label: label,
    value: value
  })
}
