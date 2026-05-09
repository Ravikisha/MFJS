import { DocsSidebar } from '@/components/site/sidebar';
import { DocsToc } from '@/components/site/toc';

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)_14rem]">
        <DocsSidebar />
        <article className="prose-mfjs min-w-0 py-8 lg:py-12">{children}</article>
        <DocsToc />
      </div>
    </div>
  );
}
