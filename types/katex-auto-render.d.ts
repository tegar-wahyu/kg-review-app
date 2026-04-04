declare module "katex/contrib/auto-render" {
  type Delimiter = {
    left: string;
    right: string;
    display: boolean;
  };

  type RenderMathInElementOptions = {
    delimiters?: Delimiter[];
    throwOnError?: boolean;
    strict?: "ignore" | boolean | string;
  };

  export default function renderMathInElement(
    element: HTMLElement,
    options?: RenderMathInElementOptions,
  ): void;
}
