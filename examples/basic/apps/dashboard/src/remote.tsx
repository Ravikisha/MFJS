import { RemoteApp } from '@moxjs/runtime';
import { pages } from './moxjs.routes.js';

export default function RemoteRoot({ subpath = '/' }: { subpath?: string }) {
  return <RemoteApp subpath={subpath} pages={pages} />;
}
