import defaultMdxComponents from "fumadocs-ui/mdx";
import { Card, Cards } from "fumadocs-ui/components/card";
import { Callout } from "fumadocs-ui/components/callout";
import type { MDXComponents } from "mdx/types";

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    Card,
    Cards,
    Callout,
    ...components,
  };
}
