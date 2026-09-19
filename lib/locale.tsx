export interface Locale {
  NAV: {
    INDEX: string
    ME: string
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
  ME: {
    RECENT: string
    RECENT_KICKER: string
    GUESTBOOK: string
    POSTS: string
    DAYS: string
    VIEW_ALL: string
    WELCOME: string
    SUBSCRIBE: string
    SUBSCRIBE_HINT: string
    WRITING: string
    SEASON: {
      SPRING: string
      SUMMER: string
      AUTUMN: string
      WINTER: string
    }
  }
  [key: string]: unknown
}
