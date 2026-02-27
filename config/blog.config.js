const BLOG = {
  title: '\u6d6e\u751f\u7eaa\u68a6',
  author: '\u7eaa\u534e\u88d5',
  email: 'jihuayu123@gmail.com',
  link: 'https://jihuayu.com',
  description: '\u5927\u68a6\u4e00\u573a\uff0c\u6d6e\u751f\u4eca\u6b47',
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
    absoluteDateFormat: 'YYYY\u5e74M\u6708D\u65e5',
    absoluteDateTimeFormat: 'YYYY\u5e74M\u6708D\u65e5 HH:mm:ss',
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
