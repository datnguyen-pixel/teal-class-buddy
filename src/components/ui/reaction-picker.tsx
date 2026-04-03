import { useState } from 'react';
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

  return (
    <div
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <button
        type="button"
        className="w-6 h-6 flex items-center justify-center rounded-full bg-background border border-border shadow-sm hover:bg-muted transition-colors text-xs"
        onClick={() => setVisible(v => !v)}
      >
        👍
      </button>
      {visible && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 flex items-center gap-0.5 bg-background border border-border rounded-full px-1.5 py-1 shadow-lg z-50 animate-in fade-in-0 zoom-in-95 duration-150">
          {REACTIONS.map(r => (
            <button
              key={r.emoji}
              type="button"
              title={r.label}
              onClick={() => {
                onReact(r.emoji);
                setVisible(false);
              }}
              className="w-7 h-7 flex items-center justify-center text-base hover:scale-125 transition-transform rounded-full hover:bg-muted"
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
