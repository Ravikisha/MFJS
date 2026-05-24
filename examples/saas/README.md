# JORVEL SaaS example

This example focuses on **SSR/SSG** using `jorvel ssr export`.

## What it demonstrates

- `jorvel ssr export` producing a static HTML output directory (`dist-ssg/`)
- A small “marketing + app” route set

## Scripts

- `pnpm -C examples/saas ssr:export` — export static HTML to `dist-ssg/`
- `pnpm -C examples/saas test` — asserts the export output files exist and contain expected content
