import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Upload, X, Loader2, Pencil, Type } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface VocabItemDraft {
  id?: string;
  type: 'image' | 'text';
  imageFile: File | null;
  imagePreview: string;
  questionText: string;
  mainAnswer: string;
  altAnswer: string;
}

interface EditGameData {
  id: string;
  title: string;
  time_per_question: number;
  items: { id: string; image_url: string; question_text: string | null; main_answer: string; alt_answer: string | null; sort_order: number }[];
}

interface Props {
  editGame?: EditGameData;
  trigger?: React.ReactNode;
}

const CreateVocabGameDialog = ({ editGame, trigger }: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [timePerQuestion, setTimePerQuestion] = useState(10);
  const [items, setItems] = useState<VocabItemDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const isEdit = !!editGame;

  const resetForm = () => {
    setTitle('');
    setTimePerQuestion(10);
    setItems([]);
  };

  // Pre-fill when editing
  useEffect(() => {
    if (open && editGame) {
      setTitle(editGame.title);
      setTimePerQuestion(editGame.time_per_question);
      setItems(editGame.items.map(item => ({
        id: item.id,
        type: item.question_text ? 'text' as const : 'image' as const,
        imageFile: null,
        imagePreview: item.image_url || '',
        questionText: item.question_text || '',
        mainAnswer: item.main_answer,
        altAnswer: item.alt_answer || '',
      })));
    }
  }, [open, editGame]);

  const addItem = () => {
    setItems(prev => [...prev, { type: 'image', imageFile: null, imagePreview: '', questionText: '', mainAnswer: '', altAnswer: '' }]);
  };

  const addTextItem = () => {
    setItems(prev => [...prev, { type: 'text', imageFile: null, imagePreview: '', questionText: '', mainAnswer: '', altAnswer: '' }]);
  };

  const updateItem = (index: number, updates: Partial<VocabItemDraft>) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, ...updates } : item));
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleImageChange = (index: number, file: File) => {
    const preview = URL.createObjectURL(file);
    updateItem(index, { imageFile: file, imagePreview: preview });
  };

  const handleSave = async () => {
    if (!title.trim()) { toast.error('Please enter a game title'); return; }
    if (items.length === 0) { toast.error('Add at least one vocabulary item'); return; }
    const invalid = items.some(i => {
      if (i.type === 'text') return !i.questionText.trim() || !i.mainAnswer.trim();
      return !i.imagePreview || !i.mainAnswer.trim();
    });
    if (invalid) { toast.error('Each item needs an image/question and a main answer'); return; }

    setSaving(true);
    try {
      if (isEdit) {
        // Update game metadata
        const { error: gameErr } = await supabase
          .from('vocab_games')
          .update({ title: title.trim(), time_per_question: timePerQuestion })
          .eq('id', editGame.id);
        if (gameErr) throw gameErr;

        // Delete old items
        const { error: delErr } = await supabase.from('vocab_items').delete().eq('game_id', editGame.id);
        if (delErr) throw delErr;

        // Re-insert items
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          let imageUrl = item.imagePreview || null;

          if (item.type === 'image' && item.imageFile) {
            const ext = item.imageFile.name.split('.').pop();
            const path = `${editGame.id}/${crypto.randomUUID()}.${ext}`;
            const { error: uploadErr } = await supabase.storage.from('vocab-images').upload(path, item.imageFile);
            if (uploadErr) throw uploadErr;
            const { data: { publicUrl } } = supabase.storage.from('vocab-images').getPublicUrl(path);
            imageUrl = publicUrl;
          }

          const { error: itemErr } = await supabase.from('vocab_items').insert({
            game_id: editGame.id,
            image_url: imageUrl || '',
            question_text: item.type === 'text' ? item.questionText.trim() : null,
            main_answer: item.mainAnswer.trim(),
            alt_answer: item.altAnswer.trim() || null,
            sort_order: i,
          });
          if (itemErr) throw itemErr;
        }

        toast.success('Vocabulary game updated!');
      } else {
        // Create game
        const { data: game, error: gameErr } = await supabase
          .from('vocab_games')
          .insert({ title: title.trim(), time_per_question: timePerQuestion, created_by: user!.id })
          .select()
          .single();
        if (gameErr) throw gameErr;

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          let imageUrl = '';

          if (item.type === 'image' && item.imageFile) {
            const ext = item.imageFile.name.split('.').pop();
            const path = `${game.id}/${crypto.randomUUID()}.${ext}`;
            const { error: uploadErr } = await supabase.storage.from('vocab-images').upload(path, item.imageFile);
            if (uploadErr) throw uploadErr;
            const { data: { publicUrl } } = supabase.storage.from('vocab-images').getPublicUrl(path);
            imageUrl = publicUrl;
          }

          const { error: itemErr } = await supabase.from('vocab_items').insert({
            game_id: game.id,
            image_url: imageUrl,
            question_text: item.type === 'text' ? item.questionText.trim() : null,
            main_answer: item.mainAnswer.trim(),
            alt_answer: item.altAnswer.trim() || null,
            sort_order: i,
          });
          if (itemErr) throw itemErr;
        }

        toast.success('Vocabulary game created!');
      }

      queryClient.invalidateQueries({ queryKey: ['vocab-games'] });
      resetForm();
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || `Failed to ${isEdit ? 'update' : 'create'} game`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        {trigger || <Button><Plus className="w-4 h-4 mr-2" />New Vocabulary Game</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Vocabulary Game' : 'Create Vocabulary Game'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Game Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. EDUCATION" />
          </div>

          <div className="space-y-2">
            <Label>Time per Question (seconds)</Label>
            <Input type="number" min={5} max={60} value={timePerQuestion} onChange={e => setTimePerQuestion(Number(e.target.value))} />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Vocabulary Items ({items.length})</Label>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={addItem}><Plus className="w-4 h-4 mr-1" />Add Item</Button>
                <Button size="sm" variant="outline" onClick={addTextItem}><Type className="w-4 h-4 mr-1" />Add Text</Button>
              </div>
            </div>

            {items.map((item, idx) => (
              <div key={idx} className="border rounded-xl p-4 space-y-3 bg-muted/30 relative">
                <button onClick={() => removeItem(idx)} className="absolute top-2 right-2 text-muted-foreground hover:text-destructive">
                  <X className="w-4 h-4" />
                </button>
                <p className="text-xs font-medium text-muted-foreground">Item #{idx + 1}</p>

                <div className="flex gap-4">
                  {item.type === 'image' ? (
                    <div className="w-24 h-24 border-2 border-dashed rounded-lg flex items-center justify-center overflow-hidden bg-background shrink-0">
                      {item.imagePreview ? (
                        <label className="cursor-pointer w-full h-full relative group">
                          <img src={item.imagePreview} alt="" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Upload className="w-5 h-5 text-white" />
                          </div>
                          <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleImageChange(idx, e.target.files[0])} />
                        </label>
                      ) : (
                        <label className="cursor-pointer flex flex-col items-center gap-1 text-muted-foreground">
                          <Upload className="w-5 h-5" />
                          <span className="text-[10px]">Upload</span>
                          <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleImageChange(idx, e.target.files[0])} />
                        </label>
                      )}
                    </div>
                  ) : (
                    <div className="flex-1">
                      <Textarea
                        value={item.questionText}
                        onChange={e => updateItem(idx, { questionText: e.target.value })}
                        placeholder="Enter your question text..."
                        className="min-h-[80px]"
                      />
                    </div>
                  )}
                  <div className="flex-1 space-y-2">
                    <Input value={item.mainAnswer} onChange={e => updateItem(idx, { mainAnswer: e.target.value })} placeholder="Main answer (e.g. Erase)" />
                    <Input value={item.altAnswer} onChange={e => updateItem(idx, { altAnswer: e.target.value })} placeholder="Alternative answer (e.g. Rub Out) — optional" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Button className="w-full" onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{isEdit ? 'Updating...' : 'Creating...'}</> : (isEdit ? 'Update Game' : 'Create Game')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateVocabGameDialog;
