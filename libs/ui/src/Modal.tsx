import { useEffect, useRef, type ReactNode } from 'react';

export interface ModalProps {
  /** Whether the modal is mounted + visible. */
  open: boolean;
  /** Close handler — fires on ESC, overlay click, or close button. */
  onClose: () => void;
  /** Accessible label for screen readers. */
  ariaLabel?: string;
  /** Optional `aria-labelledby` id. */
  ariaLabelledBy?: string;
  /** Suppress overlay click → close. */
  blockingOverlay?: boolean;
  children?: ReactNode;
}

export function Modal(props: ModalProps): JSX.Element | null {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose();
    };
    document.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [props.open, props.onClose]);

  if (!props.open) return null;

  const overlayProps = props.blockingOverlay
    ? {}
    : { onClick: (e: React.MouseEvent) => e.target === e.currentTarget && props.onClose() };

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      {...overlayProps}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={props.ariaLabel}
        aria-labelledby={props.ariaLabelledBy}
        tabIndex={-1}
        style={{
          background: 'var(--jorvel-color-surface, #fff)',
          color: 'var(--jorvel-color-on-surface, #111)',
          borderRadius: 'var(--jorvel-radius-md, 6px)',
          padding: '16px',
          minWidth: 320,
          maxWidth: '90vw',
          maxHeight: '90vh',
          overflow: 'auto',
          outline: 'none',
        }}
      >
        {props.children}
      </div>
    </div>
  );
}
