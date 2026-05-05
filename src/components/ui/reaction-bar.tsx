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
  align?: 'left' | 'right';
  onReact: (emoji: string) => void;
  onClose?: () => void;
  className?: string;
}

const PANEL_WIDTH = 270;
const PANEL_HEIGHT = 40;

const ReactionBar = ({ anchorRef, align = 'left', onReact, onClose, className }: ReactionBarProps) => {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const compute = () => {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      let top = rect.top - PANEL_HEIGHT - 6;
      // If not enough space above, drop below
      if (top < 8) top = rect.bottom + 6;
      let left = align === 'right' ? rect.right - PANEL_WIDTH : rect.left;
      // Clamp to viewport
      if (left < 8) left = 8;
      if (left + PANEL_WIDTH > window.innerWidth - 8) left = window.innerWidth - 8 - PANEL_WIDTH;
      setPos({ top, left });
    };
    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, true);
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('scroll', compute, true);
    };
  }, [anchorRef, align]);

  if (!pos) return null;

  return createPortal(
    <div
      ref={panelRef}
      data-reaction-zone
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
