import { useState, useRef, useCallback } from 'react';
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

  return (
    <div
      className={cn('relative inline-flex', className)}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {/* Like button */}
      <button
        type="button"
        className="w-6 h-6 flex items-center justify-center rounded-full bg-background border border-border shadow-sm hover:bg-muted transition-colors text-[11px] text-muted-foreground"
        onClick={() => onReact('👍')}
      >
        👍
      </button>

      {/* Reaction panel */}
      {visible && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 flex items-center gap-0.5 bg-background border border-border rounded-full px-2 py-1 shadow-xl z-[100] animate-reaction-panel whitespace-nowrap">
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
        </div>
      )}
    </div>
  );
};

export default ReactionPicker;
