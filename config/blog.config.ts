import type { BlogConfig } from '@/lib/config'

const BLOG = {
  title: '浮生纪梦',
  author: '纪华裕',
  email: 'jihuayu123@gmail.com',
  link: 'https://blog.jihuayu.com',
  description: '大梦一场，浮生今歇',
  lang: 'zh-CN',
  timezone: 'Asia/Shanghai',
  appearance: 'auto',
  font: 'sans-serif',
  lightBackground: '#ffffff',
  darkBackground: '#0c0a09',
  path: '',
  since: 2024,
  postsPerPage: 7,
  sortByDate: true,
  showAbout: true,
  showMe: true,
  showArchive: true,
  profile: {
    greeting: '你好，我是',
    name: '纪华裕',
    tagline: '写一点代码，记一点日子。',
    quote: '大梦一场，浮生今歇。',
    avatar: 'https://avatars.githubusercontent.com/u/32858525?v=4',
    recentPostCount: 5,
    showGuestbook: true,
    socials: [
      { label: 'GitHub', href: 'https://github.com/jihuayu' },
      { label: 'X', href: 'https://twitter.com/jihuayu123' },
      { label: '邮件', href: 'mailto:jihuayu123@gmail.com' },
      { label: 'RSS', href: '/feed' }
    ]
  },
  autoCollapsedNavBar: false,
  ogImageGenerateURL: 'https://og-image-craigary.vercel.app',
  socialLink: 'https://twitter.com/jihuayu123',
  linkPreview: {
    useOgProxy: true,
    ogProxyBaseUrl: 'https://og-proxy.raw2.cc'
  },
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
    provider: 'atrium',
    atriumConfig: {
      endpoint: 'https://atrium.jihuayu.com/'
    }
  },
  isProd: process.env.NODE_ENV === 'production'
} satisfies BlogConfig

export default BLOG
