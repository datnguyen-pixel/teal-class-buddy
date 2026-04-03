import { cn } from '@/lib/utils';

interface ReactionGroup {
  emoji: string;
  count: number;
  hasReacted: boolean;
}

interface ReactionDisplayProps {
  reactions: ReactionGroup[];
  onToggle: (emoji: string) => void;
  className?: string;
}

const ReactionDisplay = ({ reactions, onToggle, className }: ReactionDisplayProps) => {
  if (reactions.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {reactions.map(r => (
        <button
          key={r.emoji}
          type="button"
          onClick={() => onToggle(r.emoji)}
          className={cn(
            'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-colors',
            r.hasReacted
              ? 'bg-primary/10 border-primary/30 text-primary'
              : 'bg-muted/50 border-border text-muted-foreground hover:bg-muted'
          )}
        >
          <span className="text-sm">{r.emoji}</span>
          <span className="font-medium">{r.count}</span>
        </button>
      ))}
    </div>
  );
};

export default ReactionDisplay;
