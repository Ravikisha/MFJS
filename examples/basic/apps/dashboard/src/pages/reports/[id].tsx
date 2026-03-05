import React from 'react';

export default function ReportPage() {
  return (
    <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
      <h2 style={{ marginTop: 0 }}>report page</h2>
      <p>
        This is a file-based route: <code>/reports/:id</code>.
      </p>
      <p>
        (Next step: pass params into the component via a small MFJS page wrapper.)
      </p>
    </div>
  );
}
