export interface ValueAdapter<TInput, TOutput> {
  adapt(input: TInput): TOutput
}

export interface RenderAdapter<TInput, TOptions, TOutput> {
  render(input: TInput, options?: TOptions): TOutput
}