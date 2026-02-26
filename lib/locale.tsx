export interface Locale {
  NAV: {
    INDEX: string
    ABOUT: string
    RSS: string
    SEARCH: string
  }
  PAGINATION: {
    PREV: string
    NEXT: string
  }
  POST: {
    BACK: string
    TOP: string
  }
  PAGE: {
    ERROR_404: {
      MESSAGE: string
    }
  }
  [key: string]: unknown
}
