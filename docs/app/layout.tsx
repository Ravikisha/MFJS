import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { NoFlashScript } from '@/components/theme-toggle';
import { SiteHeader } from '@/components/site/header';
import { SiteFooter } from '@/components/site/footer';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'MFJS — Production-grade micro-frontends',
    template: '%s | MFJS',
  },
  description:
    'Opinionated, zero-config micro-frontend framework built on Rspack Module Federation. Typed contracts, file-based routing, SSR, edge adapters, observability, and a CLI that just works.',
  metadataBase: new URL('https://mfjs.dev'),
  openGraph: {
    title: 'MFJS — Production-grade micro-frontends',
    description:
      'Zero-config federation, file-based routing, SSR, observability, and edge deploys. Next.js-level DX for micro-frontends.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MFJS — Production-grade micro-frontends',
    description:
      'Zero-config federation, file-based routing, SSR, observability, and edge deploys.',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <NoFlashScript />
      </head>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <ThemeProvider>
          <SiteHeader />
          <div className="flex-1">{children}</div>
          <SiteFooter />
        </ThemeProvider>
      </body>
    </html>
  );
}
