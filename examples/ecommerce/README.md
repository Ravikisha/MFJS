# JORVEL E-commerce example

This example focuses on **SSR/SSG** using `jorvel ssr export`.

## What it demonstrates

- `jorvel ssr export` producing a static HTML output directory (`dist-ssg/`)
- Basic route list + params (`/products/:sku`)

## Scripts

- `pnpm -C examples/ecommerce ssr:export` — export static HTML to `dist-ssg/`
- `pnpm -C examples/ecommerce test` — asserts the export output files exist and contain expected content
