import type { ReactNode, HTMLAttributes } from 'react';

interface PageContainerProps extends HTMLAttributes<HTMLDivElement> {
  /** true = scrollable (Mode B), false = fill viewport (Mode A). Default: false */
  scroll?: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * Page layout container.
 *
 * Mode A (scroll=false): fills viewport minus TopNav (56px), no page-level scroll.
 * Mode B (scroll=true): min-height viewport, allows vertical scroll.
 */
export function PageContainer({ scroll = false, children, className = '', ...rest }: PageContainerProps) {
  return (
    <div
      className={`${
        scroll
          ? 'h-full overflow-y-auto scrollbar-thin'
          : 'h-full overflow-hidden'
      } p-4 lg:p-5 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
