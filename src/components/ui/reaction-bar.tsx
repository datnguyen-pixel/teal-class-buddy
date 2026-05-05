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
  onReact: (emoji: string) => void;
  className?: string;
}

const ReactionBar = ({ onReact, className }: ReactionBarProps) => {
  return (
    <div
      className={cn(
        'flex items-center gap-0.5 bg-background border border-border rounded-full px-1.5 py-1 shadow-lg whitespace-nowrap',
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
          }}
          className="w-7 h-7 flex items-center justify-center text-base rounded-full hover:bg-muted transition-transform duration-150 hover:scale-125"
        >
          {r.emoji}
        </button>
      ))}
    </div>
  );
};

export default ReactionBar;
