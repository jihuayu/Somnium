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
  darkBackground: '#111315',
  path: '',
  since: 2024,
  postsPerPage: 7,
  sortByDate: true,
  showAbout: true,
  // 用文章 slug 指定 true 或 false，可覆盖默认的目录显示规则。
  tocOverrides: {},
  relatedPosts: {
    'personal-software-development': [
      { slug: 'personal-software-update-261014', label: '这次调整之后的软件开发进展' }
    ],
    'personal-software-update-261014': [
      { slug: 'personal-software-development', label: '此前对个人软件开发过程的思考' }
    ]
  },
  showArchive: true,
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
