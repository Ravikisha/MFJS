/**
 * Inline SVG icon set — minimal lucide-style strokes. No external icon dep
 * (registry SSL flaky in this env). Each icon is a small forwarded React node.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

type IconProps = React.SVGProps<SVGSVGElement> & { className?: string };

function makeIcon(path: React.ReactNode) {
  const Comp = React.forwardRef<SVGSVGElement, IconProps>(({ className, ...rest }, ref) => (
    <svg
      ref={ref}
      viewBox="0 0 24 24"
      width={18}
      height={18}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('shrink-0', className)}
      aria-hidden
      {...rest}
    >
      {path}
    </svg>
  ));
  Comp.displayName = 'Icon';
  return Comp;
}

export const SearchIcon = makeIcon(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </>,
);
export const SunIcon = makeIcon(
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </>,
);
export const MoonIcon = makeIcon(<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />);
export const GitHubIcon = makeIcon(
  <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />,
);
export const ChevronRight = makeIcon(<path d="m9 18 6-6-6-6" />);
export const ChevronDown = makeIcon(<path d="m6 9 6 6 6-6" />);
export const ArrowRight = makeIcon(
  <>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </>,
);
export const SparkleIcon = makeIcon(
  <>
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    <circle cx="12" cy="12" r="2" />
  </>,
);
export const RocketIcon = makeIcon(
  <>
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09Z" />
    <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2Z" />
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
  </>,
);
export const BoxIcon = makeIcon(
  <>
    <path d="m21 8-9-5-9 5" />
    <path d="M21 8v8l-9 5-9-5V8" />
    <path d="m12 13-9-5" />
    <path d="m21 8-9 5" />
    <path d="M12 13v10" />
  </>,
);
export const ShieldIcon = makeIcon(
  <>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
  </>,
);
export const ChartIcon = makeIcon(
  <>
    <path d="M3 3v18h18" />
    <path d="m7 14 4-4 4 4 5-5" />
  </>,
);
export const CodeIcon = makeIcon(
  <>
    <path d="m16 18 6-6-6-6" />
    <path d="m8 6-6 6 6 6" />
  </>,
);
export const TerminalIcon = makeIcon(
  <>
    <path d="m4 17 6-6-6-6" />
    <path d="M12 19h8" />
  </>,
);
export const LayersIcon = makeIcon(
  <>
    <path d="m12 2 9 4-9 4-9-4 9-4Z" />
    <path d="m3 12 9 4 9-4" />
    <path d="m3 18 9 4 9-4" />
  </>,
);
export const PuzzleIcon = makeIcon(
  <path d="M19.5 13.5h-2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5h2v-3a2 2 0 0 0-2-2h-3v-2c0-.83-.67-1.5-1.5-1.5S11.5 2.67 11.5 3.5v2h-3a2 2 0 0 0-2 2v3.5h-2C3.67 11 3 11.67 3 12.5S3.67 14 4.5 14h2V17a2 2 0 0 0 2 2h3.5v-2c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v2H17a2 2 0 0 0 2-2v-3.5Z" />,
);
export const GlobeIcon = makeIcon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
  </>,
);
export const BoltIcon = makeIcon(<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />);
export const PaletteIcon = makeIcon(
  <>
    <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
    <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
    <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
    <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
    <path d="M12 2a10 10 0 1 0 0 20 4 4 0 0 0 4-4 2 2 0 0 1 2-2h2a4 4 0 0 0 4-4 10 10 0 0 0-12-10Z" />
  </>,
);
export const CompassIcon = makeIcon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="m16 8-2 6-6 2 2-6 6-2z" />
  </>,
);
export const ServerIcon = makeIcon(
  <>
    <rect x="3" y="3" width="18" height="6" rx="1.5" />
    <rect x="3" y="15" width="18" height="6" rx="1.5" />
    <path d="M7 6h.01M7 18h.01" />
  </>,
);
export const BookIcon = makeIcon(
  <>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14Z" />
    <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20" />
  </>,
);
export const NetworkIcon = makeIcon(
  <>
    <rect x="9" y="2" width="6" height="6" rx="1" />
    <rect x="3" y="16" width="6" height="6" rx="1" />
    <rect x="15" y="16" width="6" height="6" rx="1" />
    <path d="M12 8v4M12 12H6v4M12 12h6v4" />
  </>,
);
export const MenuIcon = makeIcon(<path d="M4 6h16M4 12h16M4 18h16" />);
export const XIcon = makeIcon(<path d="M18 6 6 18M6 6l12 12" />);
export const ExternalIcon = makeIcon(
  <>
    <path d="M15 3h6v6" />
    <path d="M10 14 21 3" />
    <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
  </>,
);
export const CheckIcon = makeIcon(<path d="m5 13 4 4L19 7" />);
export const CopyIcon = makeIcon(
  <>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </>,
);
