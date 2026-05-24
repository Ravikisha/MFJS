export interface VersionCheckOptions {
  /** Host's own versions of shared deps. Example: `{ react: '18.3.1' }` */
  host: Record<string, string>;
  /** Remote-reported versions. */
  remote: Record<string, string>;
  /** Which deps must be singleton — mismatches become errors instead of warnings. */
  singletons?: string[];
  /** Logger. Defaults to console.warn/console.error. */
  log?: (level: 'warn' | 'error', message: string) => void;
}

export interface VersionMismatch {
  dep: string;
  host: string;
  remote: string;
  severity: 'warn' | 'error';
}

export function checkVersions(opts: VersionCheckOptions): VersionMismatch[] {
  const singletons = new Set(opts.singletons ?? []);
  const mismatches: VersionMismatch[] = [];
  const log = opts.log ?? ((lvl, msg) => (lvl === 'error' ? console.error(msg) : console.warn(msg)));

  for (const [dep, hostVer] of Object.entries(opts.host)) {
    const remoteVer = opts.remote[dep];
    if (!remoteVer) continue;
    if (!majorMatches(hostVer, remoteVer)) {
      const severity: 'warn' | 'error' = singletons.has(dep) ? 'error' : 'warn';
      mismatches.push({ dep, host: hostVer, remote: remoteVer, severity });
      log(severity, `[jorvel] version mismatch for "${dep}": host ${hostVer} vs remote ${remoteVer}`);
    }
  }

  return mismatches;
}

function majorMatches(a: string, b: string): boolean {
  const [am] = a.replace(/^[\^~]/, '').split('.');
  const [bm] = b.replace(/^[\^~]/, '').split('.');
  return am === bm;
}
