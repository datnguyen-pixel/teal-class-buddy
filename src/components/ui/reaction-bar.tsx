import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

const REACTIONS = [
  { emoji: '👍', label: 'Like' },
  { emoji: '❤️', label: 'Love' },
  { emoji: '😂', label: 'Haha' },
  { emoji: '😮', label: 'Wow' },
  { emoji: '😢', label: 'Sad' },
  { emoji: '😡', label: 'Angry' },
  { emoji: '🙌', label: 'Celebrate' },
];

interface ReactionBarProps {
  anchorRef: React.RefObject<HTMLElement>;
  boundaryRef?: React.RefObject<HTMLElement>;
  align?: 'left' | 'right';
  onReact: (emoji: string) => void;
  onClose?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  className?: string;
}

const PANEL_WIDTH = 270;
const PANEL_HEIGHT = 40;

const ReactionBar = ({
  anchorRef,
  boundaryRef,
  align = 'left',
  onReact,
  onClose,
  onMouseEnter,
  onMouseLeave,
  className,
}: ReactionBarProps) => {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const compute = () => {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const bounds = boundaryRef?.current?.getBoundingClientRect();
      const minLeft = bounds ? bounds.left + 6 : 8;
      const maxRight = bounds ? bounds.right - 6 : window.innerWidth - 8;
      const minTop = bounds ? bounds.top + 6 : 8;
      const maxBottom = bounds ? bounds.bottom - 6 : window.innerHeight - 8;

      let top = rect.top - PANEL_HEIGHT - 6;
      if (top < minTop) top = rect.bottom + 6;
      if (top + PANEL_HEIGHT > maxBottom) top = Math.max(minTop, maxBottom - PANEL_HEIGHT);

      let left = align === 'right' ? rect.right - PANEL_WIDTH : rect.left;
      if (left < minLeft) left = minLeft;
      if (left + PANEL_WIDTH > maxRight) left = maxRight - PANEL_WIDTH;

      setPos({ top, left });
    };
    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, true);
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('scroll', compute, true);
    };
  }, [anchorRef, boundaryRef, align]);

  if (!pos) return null;

  return createPortal(
    <div
      ref={panelRef}
      data-reaction-zone
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, width: PANEL_WIDTH }}
      className={cn(
        'flex items-center gap-0.5 bg-background border border-border rounded-full px-1.5 py-1 shadow-xl animate-reaction-panel',
        className
      )}
    >
      {REACTIONS.map(r => (
        <button
          key={r.emoji}
          type="button"
          title={r.label}
          onClick={(e) => {
            e.stopPropagation();
            onReact(r.emoji);
            onClose?.();
          }}
          className="w-7 h-7 flex items-center justify-center text-base rounded-full hover:bg-muted transition-transform duration-150 hover:scale-125"
        >
          {r.emoji}
        </button>
      ))}
    </div>,
    document.body
  );
};

export default ReactionBar;
