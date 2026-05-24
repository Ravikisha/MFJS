import { RemoteApp } from '@jorvel/runtime';
import { pages } from './jorvel.routes.js';

export default function RemoteRoot({ subpath = '/' }: { subpath?: string }) {
  return <RemoteApp subpath={subpath} pages={pages} />;
}
