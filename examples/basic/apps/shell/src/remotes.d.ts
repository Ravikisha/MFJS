// Type declarations for Module Federation remote modules.
// These are resolved at runtime by Rspack's federation plugin.
declare module 'dashboard/App' {
  import type React from 'react';
  const RemoteApp: React.ComponentType<{ subpath?: string }>;
  export default RemoteApp;
}
