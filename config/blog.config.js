const BLOG = {
  title: '浮生纪梦',
  author: '纪华裕',
  email: 'jihuayu123@gmail.com',
  link: 'https://jihuayu.com',
  description: '大梦一场，浮生今歇',
  lang: 'zh-CN',
  timezone: 'Asia/Shanghai',
  appearance: 'auto',
  font: 'sans-serif',
  lightBackground: '#ffffff',
  darkBackground: '#18181B',
  path: '',
  since: 2024,
  postsPerPage: 7,
  sortByDate: true,
  showAbout: true,
  autoCollapsedNavBar: false,
  ogImageGenerateURL: 'https://og-image-craigary.vercel.app',
  socialLink: 'https://twitter.com/jihuayu123',
  notionDateMention: {
    display: 'relative',
    includeTime: 'always',
    absoluteDateFormat: 'YYYY年M月D日',
    absoluteDateTimeFormat: 'YYYY年M月D日 HH:mm:ss',
    relativeStyle: 'short'
  },
  seo: {
    keywords: ['Blog', 'Website', 'Notion'],
    googleSiteVerification: ''
  },
  comment: {
    provider: 'utterances',
    utterancesConfig: {
      repo: 'jihuayu/blog-gitalk'
    }
  }
}

module.exports = BLOG
