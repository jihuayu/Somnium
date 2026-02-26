const BLOG = {
  title: '浮生纪梦',
  author: '纪华裕',
  email: 'jihuayu123@gmail.com',
  link: 'https://jihuayu.com',
  description: '大梦一场，浮生尽歇',
  lang: 'zh-CN', // 站点语言，可选：en-US / zh-CN / zh-HK / zh-TW / ja-JP / es-ES
  timezone: 'Asia/Shanghai', // Notion 日期解析时区
  appearance: 'auto', // 主题模式：light / dark / auto
  font: 'sans-serif', // 字体：sans-serif / serif
  lightBackground: '#ffffff', // 浅色主题背景色（十六进制）
  darkBackground: '#18181B', // 深色主题背景色（十六进制）
  path: '', // 子路径部署时填写，例如 '/blog'
  since: 2024, // 站点起始年份
  postsPerPage: 7,
  sortByDate: true, // 是否按日期倒序
  showAbout: true, // 是否显示 About 导航
  autoCollapsedNavBar: false, // 是否关闭吸顶折叠导航（true 为不吸顶）
  ogImageGenerateURL: 'https://og-image-craigary.vercel.app', // OG 图片生成服务地址（末尾不要加 /）
  socialLink: 'https://twitter.com/jihuayu123',
  seo: {
    keywords: ['Blog', 'Website', 'Notion'],
    googleSiteVerification: '' // Google Search Console 验证码（不用可留空）
  },
  analytics: {
    provider: '', // 统计服务：'ga' / 'ackee' / ''
    ackeeConfig: {
      tracker: '', // Ackee tracker.js 地址
      dataAckeeServer: '', // Ackee 服务地址（末尾不要加 /）
      domainId: '' // Ackee domainId
    },
    gaConfig: {
      measurementId: 'G-PJ4FGZGEY3' // GA4 Measurement ID（例如：G-XXXXXXXXXX）
    }
  },
  comment: {
    provider: 'utterances', // 评论系统：'utterances' / ''
    utterancesConfig: {
      repo: 'jihuayu/blog-gitalk' // utterances 对应的 GitHub 仓库
    }
  }
}
module.exports = BLOG
