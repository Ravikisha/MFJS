# MOXJS Basic Example

This is a minimal runnable example workspace generated to prove the current MOXJS Module Federation wiring works end-to-end.

## What it contains

- `apps/shell` (host)
- `apps/dashboard` (remote)

Both apps use **Rspack**.

## How to run

From the repo root:

```sh
cd examples/basic
pnpm install

# Start both apps via the MOXJS CLI (recommended)
pnpm -C ../../packages/cli dev -- --dir . --proxy-remotes

# Optional: also enable remote rebuild -> host reload
# pnpm -C ../../packages/cli dev -- --dir . --proxy-remotes --hmr-remotes
```

Then open:

- http://localhost:3000

You should see the host page and the remote rendered inside it.

## Notes

- The host expects the remote entry at `http://localhost:3001/remoteEntry.js`.
- If you change ports, regenerate federation configs (or edit `apps/shell/moxjs.federation.json`).
