/**
 * EN: Generic one-way adapter contract.
 * ZH: 通用的一元适配器契约。
 */
export interface ValueAdapter<TInput, TOutput> {
  adapt(input: TInput): TOutput
}

/**
 * EN: Generic render adapter contract that accepts input and optional render options.
 * ZH: 通用渲染适配器契约，接收输入与可选渲染参数。
 */
export interface RenderAdapter<TInput, TOptions, TOutput> {
  render(input: TInput, options?: TOptions): TOutput
}