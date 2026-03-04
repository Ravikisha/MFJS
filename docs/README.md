# MFJS Documentation Site

This folder contains the MFJS docs site built with **Astro + Starlight**.

## Local development

Run these from the repo root:

1) Install docs deps

- `pnpm -C docs install`

2) Start the docs dev server

- `pnpm -C docs dev`

## Where the docs live

Starlight content pages live under:

- `docs/src/content/docs/`

## Writing guidelines

- Keep docs aligned with the output of `mfjs generate`.
- Use `examples/basic` as the source-of-truth runnable example.

## Build/preview

- `pnpm -C docs build`
- `pnpm -C docs preview`
