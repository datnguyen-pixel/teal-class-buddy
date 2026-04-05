import { useState, ReactNode, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, Type } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SpellingItemDraft {
  id?: string;
  vietnameseText: string;
  englishWord: string;
}

interface EditGameData {
  id: string;
  title: string;
  items: { id: string; vietnamese_text: string; english_word: string; sort_order: number }[];
}

interface Props {
  editGame?: EditGameData;
  trigger?: ReactNode;
}

const CreateSpellingGameDialog = ({ editGame, trigger }: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [items, setItems] = useState<SpellingItemDraft[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && editGame) {
      setTitle(editGame.title);
      setItems(editGame.items.map(i => ({ id: i.id, vietnameseText: i.vietnamese_text, englishWord: i.english_word })));
    } else if (open) {
      setTitle('');
      setItems([]);
    }
  }, [open, editGame]);

  const addItem = () => {
    setItems(prev => [...prev, { vietnameseText: '', englishWord: '' }]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const updateItem = (index: number, updates: Partial<SpellingItemDraft>) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, ...updates } : item));
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!title.trim()) { toast.error('Please enter a title'); return; }
    if (items.length === 0) { toast.error('Please add at least one question'); return; }
    const invalid = items.some(i => !i.vietnameseText.trim() || !i.englishWord.trim());
    if (invalid) { toast.error('Please fill in all question fields'); return; }

    setSaving(true);
    try {
      let gameId = editGame?.id;

      if (editGame) {
        const { error } = await supabase.from('spelling_games').update({ title: title.trim() }).eq('id', editGame.id);
        if (error) throw error;
        await supabase.from('spelling_items').delete().eq('game_id', editGame.id);
      } else {
        const { data, error } = await supabase.from('spelling_games').insert({ title: title.trim(), created_by: user!.id }).select('id').single();
        if (error) throw error;
        gameId = data.id;
      }

      const itemsToInsert = items.map((item, i) => ({
        game_id: gameId!,
        vietnamese_text: item.vietnameseText.trim(),
        english_word: item.englishWord.trim(),
        sort_order: i,
      }));

      const { error: itemsError } = await supabase.from('spelling_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;

      queryClient.invalidateQueries({ queryKey: ['spelling-games'] });
      toast.success(editGame ? 'Game updated!' : 'Game created!');
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button><Plus className="w-4 h-4 mr-2" /> New Spelling Challenge</Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{editGame ? 'Edit' : 'Create'} Spelling Challenge</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 flex-1 flex flex-col min-h-0">
          <div>
            <Label>Game Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Unit 5 Spelling" />
          </div>

          <ScrollArea className="flex-1 min-h-0 max-h-[50vh] pr-2">
            <div className="space-y-3">
              {items.map((item, i) => (
                <div key={i} className="border border-border rounded-lg p-3 space-y-2 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Question {i + 1}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeItem(i)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                  <Input
                    placeholder="Vietnamese meaning"
                    value={item.vietnameseText}
                    onChange={e => updateItem(i, { vietnameseText: e.target.value })}
                  />
                  <Input
                    placeholder="English word (answer)"
                    value={item.englishWord}
                    onChange={e => updateItem(i, { englishWord: e.target.value })}
                  />
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          <Button variant="outline" onClick={addItem} className="w-full">
            <Type className="w-4 h-4 mr-2" /> Add Text
          </Button>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? 'Saving...' : editGame ? 'Update Game' : 'Create Game'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateSpellingGameDialog;
