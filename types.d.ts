declare module 'gitalk/dist/gitalk-component' {
  import { Component } from 'react'
  interface GitalkProps {
    options: {
      id?: string
      title?: string
      clientID: string
      clientSecret: string
      repo: string
      owner: string
      admin: string[]
      distractionFreeMode?: boolean
      [key: string]: any
    }
  }
  export default class Gitalk extends Component<GitalkProps> {}
}

declare module 'react-cusdis' {
  import { Component } from 'react'
  interface ReactCusdisProps {
    lang?: string
    attrs: {
      host: string
      appId: string
      pageId: string
      pageTitle: string
      pageUrl: string
      theme?: string
      [key: string]: any
    }
  }
  export class ReactCusdis extends Component<ReactCusdisProps> {}
}
