// Rspack uses @module-federation/runtime which exposes __federation_init_sharing__ / __federation_shared__.
// Some loaders (and some tooling) still look for webpack-style __webpack_init_sharing__ / __webpack_share_scopes__.
// This shim bridges the two so runtime loaders work reliably in both the host and in remotes.

(function jorvelFederationShim() {
  const g =
    typeof globalThis !== 'undefined'
      ? globalThis
      : typeof window !== 'undefined'
        ? window
        : typeof self !== 'undefined'
          ? self
          : {};

  try {
    // Always prefer Rspack federation runtime when present.
    // Some plugins/tools may create a partial __webpack_share_scopes__ object that breaks sharing.
    // We overwrite to match webpack's expected shape: { default: <shareScope> }.
    if (typeof g.__federation_init_sharing__ === 'function') {
      g.__webpack_init_sharing__ = async (scope) => g.__federation_init_sharing__(scope);
    }

    if (g.__federation_shared__) {
      const expected = g.__federation_shared__;
      const currentDefault = g.__webpack_share_scopes__?.default;
      if (currentDefault !== expected) {
        g.__webpack_share_scopes__ = { default: expected };
      }
    }
  } catch {
    // best-effort shim; ignore
  }
})();
