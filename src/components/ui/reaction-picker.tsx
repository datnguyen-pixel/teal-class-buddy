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

      {/* Reaction panel - uses fixed positioning to avoid clipping by overflow:hidden parents */}
      {visible && (
        <ReactionPanel
          reactions={REACTIONS}
          onReact={(emoji) => {
            onReact(emoji);
            setVisible(false);
          }}
          triggerRef={triggerRef}
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
        />
      )}
    </div>
  );
};

export default ReactionPicker;
