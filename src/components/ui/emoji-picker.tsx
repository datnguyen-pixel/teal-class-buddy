import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Smile } from 'lucide-react';

const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  {
    label: 'Smileys',
    emojis: ['😀','😃','😄','😁','😅','😂','🤣','😊','😇','🙂','😉','😍','🥰','😘','😋','😛','😜','🤪','😎','🤩','🥳','😏','😒','😞','😔','😟','😕','😢','😭','😤','😠','🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😲','😳','🥺','😱','😨','😰','😥','😓'],
  },
  {
    label: 'Gestures',
    emojis: ['👍','👎','👏','🙌','🤝','🙏','💪','✌️','🤞','🤟','🤘','👌','🤙','👋','🤚','✋','👆','👇','👈','👉','☝️','🫶','❤️','🧡','💛','💚','💙','💜','🖤','🤍','💯','💢','💥','💫','💦','🔥','⭐','🌟','✨','🎉','🎊'],
  },
  {
    label: 'Objects',
    emojis: ['📚','📖','📝','✏️','📌','📎','📋','📁','🗂️','📊','📈','🎓','🏆','🥇','🥈','🥉','🔔','🔕','📢','💡','🔍','🔑','🗝️','⏰','📅','✅','❌','⚠️','❓','❗','💬','💭','🗨️','👀','🧠','💻','📱','🎯','🎶','🎵'],
  },
];

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
}

const EmojiPicker = ({ onEmojiSelect }: EmojiPickerProps) => {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
          <Smile className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" side="top" align="end">
        <div className="flex gap-1 mb-2 border-b border-border pb-2">
          {EMOJI_CATEGORIES.map((cat, i) => (
            <button
              key={cat.label}
              onClick={() => setActiveTab(i)}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                activeTab === i
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-8 gap-0.5 max-h-40 overflow-y-auto">
          {EMOJI_CATEGORIES[activeTab].emojis.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onEmojiSelect(emoji);
                setOpen(false);
              }}
              className="h-8 w-8 flex items-center justify-center text-lg hover:bg-muted rounded transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default EmojiPicker;
