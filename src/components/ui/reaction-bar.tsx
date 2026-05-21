import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

const REACTIONS = [
  { emoji: '😡', label: 'Angry' },
  { emoji: '😢', label: 'Sad' },
  { emoji: '😮', label: 'Wow' },
  { emoji: '😂', label: 'Haha' },
  { emoji: '👍', label: 'Like' },
  { emoji: '🙌', label: 'Celebrate' },
  { emoji: '❤️', label: 'Love' },
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

const PANEL_WIDTH = 268;
const PANEL_HEIGHT = 42;
const SAFE_GAP = 8;
const ANCHOR_OFFSET = 8;

const clamp = (value: number, min: number, max: number) => {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
};

const getSafeBoundary = (boundary?: DOMRect) => {
  const viewport = window.visualViewport;
  const viewportLeft = viewport?.offsetLeft ?? 0;
  const viewportTop = viewport?.offsetTop ?? 0;
  const viewportRight = viewportLeft + (viewport?.width ?? window.innerWidth);
  const viewportBottom = viewportTop + (viewport?.height ?? window.innerHeight);

  const safe = {
    left: viewportLeft + SAFE_GAP,
    top: viewportTop + SAFE_GAP,
    right: viewportRight - SAFE_GAP,
    bottom: viewportBottom - SAFE_GAP,
  };

  if (!boundary) return safe;

  const constrained = {
    left: Math.max(safe.left, boundary.left + SAFE_GAP),
    top: Math.max(safe.top, boundary.top + SAFE_GAP),
    right: Math.min(safe.right, boundary.right - SAFE_GAP),
    bottom: Math.min(safe.bottom, boundary.bottom - SAFE_GAP),
  };

  if (constrained.right <= constrained.left || constrained.bottom <= constrained.top) return safe;
  return constrained;
};

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
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    width: number;
    placement: 'top' | 'bottom';
  } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    let frame = 0;
    const compute = () => {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const bounds = getSafeBoundary(boundaryRef?.current?.getBoundingClientRect());
      const availableWidth = bounds.right - bounds.left;
      const availableHeight = bounds.bottom - bounds.top;
      const width = Math.max(0, Math.min(PANEL_WIDTH, availableWidth));
      const height = Math.min(PANEL_HEIGHT, availableHeight);

      // Simplified: always center horizontally inside the chat container.
      const left = bounds.left + (availableWidth - width) / 2;

      const isTouch = window.matchMedia?.('(pointer: coarse)').matches ?? false;
      // Vertical placement: prefer floating just above the message, but always
      // clamped fully inside the chat container. On touch (mobile), center
      // vertically inside the chat for a stable, modal-like feel.
      const preferredTop = isTouch
        ? bounds.top + (availableHeight - height) / 2
        : rect.top - height - ANCHOR_OFFSET;
      const top = clamp(preferredTop, bounds.top, bounds.bottom - height);
      const placement: 'top' | 'bottom' = 'top';

      setPos({ top, left, width, placement });
    };

    const scheduleCompute = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(compute);
    };

    scheduleCompute();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(scheduleCompute) : null;
    if (anchorRef.current) observer?.observe(anchorRef.current);
    if (boundaryRef?.current) observer?.observe(boundaryRef.current);

    window.addEventListener('resize', scheduleCompute);
    window.addEventListener('scroll', scheduleCompute, true);
    window.visualViewport?.addEventListener('resize', scheduleCompute);
    window.visualViewport?.addEventListener('scroll', scheduleCompute);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', scheduleCompute);
      window.removeEventListener('scroll', scheduleCompute, true);
      window.visualViewport?.removeEventListener('resize', scheduleCompute);
      window.visualViewport?.removeEventListener('scroll', scheduleCompute);
    };
  }, [anchorRef, boundaryRef, align]);

  if (!pos) return null;

  return createPortal(
    <div
      ref={panelRef}
      data-reaction-zone
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, width: pos.width }}
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
