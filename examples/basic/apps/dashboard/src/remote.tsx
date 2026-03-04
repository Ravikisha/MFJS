import React from 'react';

export default function RemoteApp() {
  return (
    <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
      <h2 style={{ marginTop: 0 }}>dashboard (remote)</h2>
      <p>Exposed as <code>./App</code> via Module Federation.</p>
    </div>
  );
}
