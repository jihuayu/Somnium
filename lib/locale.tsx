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
    TOC: string
    TOC_CLOSE: string
  }
  PAGE: {
    ERROR_404: {
      MESSAGE: string
    }
  }
  SEARCH: {
    PLACEHOLDER: string
    PLACEHOLDER_TAG: string
    LABEL: string
    LABEL_TAG: string
    HINT: string
    HINT_SHORT: string
    SEARCHING: string
    EMPTY: string
    FAILED: string
    TAGS: string
    CLEAR_TAG: string
  }
  [key: string]: unknown
}
