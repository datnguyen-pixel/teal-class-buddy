import { useState, useRef, useCallback, useEffect } from 'react';
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

interface ReactionPickerProps {
  onReact: (emoji: string) => void;
  className?: string;
}

const ReactionPicker = ({ onReact, className }: ReactionPickerProps) => {
  const [visible, setVisible] = useState(false);
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);

  const cancelHide = useCallback(() => {
    if (hideTimeout.current) {
      clearTimeout(hideTimeout.current);
      hideTimeout.current = null;
    }
  }, []);

  const handleEnter = useCallback(() => {
    cancelHide();
    setVisible(true);
  }, [cancelHide]);

  const handleLeave = useCallback(() => {
    hideTimeout.current = setTimeout(() => setVisible(false), 200);
  }, []);

  // Calculate position when panel becomes visible
  useEffect(() => {
    if (visible && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const panelWidth = 280; // approximate width of 7 emojis
      let left = rect.left + rect.width / 2 - panelWidth / 2;
      // Clamp to viewport
      if (left < 8) left = 8;
      if (left + panelWidth > window.innerWidth - 8) left = window.innerWidth - 8 - panelWidth;
      setPanelPos({ top: rect.top - 44, left });
    }
  }, [visible]);

  return (
    <div
      className={cn('relative inline-flex', className)}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      ref={triggerRef}
    >
      {/* Like button */}
      <button
        type="button"
        className="w-6 h-6 flex items-center justify-center rounded-full bg-background border border-border shadow-sm hover:bg-muted transition-colors text-[11px] text-muted-foreground"
        onClick={() => onReact('👍')}
      >
        👍
      </button>

      {/* Reaction panel - portaled to body to avoid overflow clipping */}
      {visible && panelPos && createPortal(
        <div
          ref={panelRef}
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          style={{ position: 'fixed', top: panelPos.top, left: panelPos.left, zIndex: 9999 }}
          className="flex items-center gap-0.5 bg-background border border-border rounded-full px-2 py-1 shadow-xl animate-reaction-panel whitespace-nowrap"
        >
          {REACTIONS.map(r => (
            <button
              key={r.emoji}
              type="button"
              title={r.label}
              onClick={() => {
                onReact(r.emoji);
                setVisible(false);
              }}
              className="w-8 h-8 flex items-center justify-center text-lg rounded-full hover:bg-muted transition-all duration-150 hover:scale-[1.35] origin-bottom"
            >
              {r.emoji}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};

export default ReactionPicker;
