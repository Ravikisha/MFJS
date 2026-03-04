// Rspack uses @module-federation/runtime which exposes __federation_init_sharing__ / __federation_shared__.
// Some loaders (and some tooling) still look for webpack-style __webpack_init_sharing__ / __webpack_share_scopes__.
// This shim bridges the two so runtime loaders work reliably.

(function mfjsFederationShim() {
	const g = (typeof globalThis !== 'undefined'
		? globalThis
		: typeof window !== 'undefined'
			? window
			: typeof self !== 'undefined'
				? self
				: {});

	try {

		// If webpack-like globals already exist, don't touch them.
		if (typeof g.__webpack_init_sharing__ === 'function' && g.__webpack_share_scopes__) return;

		if (typeof g.__federation_init_sharing__ === 'function') {
			g.__webpack_init_sharing__ = async (scope) => g.__federation_init_sharing__(scope);
		}

		if (g.__federation_shared__ && !g.__webpack_share_scopes__) {
			// Align the shape to what container.init expects in webpack land.
			g.__webpack_share_scopes__ = g.__federation_shared__;
		}
	} catch {
		// best-effort shim; ignore
	}
})();
