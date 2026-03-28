import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Upload, X, Loader2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface VocabItemDraft {
  imageFile: File | null;
  imagePreview: string;
  mainAnswer: string;
  altAnswer: string;
}

const CreateVocabGameDialog = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [timePerQuestion, setTimePerQuestion] = useState(10);
  const [items, setItems] = useState<VocabItemDraft[]>([]);
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setTitle('');
    setTimePerQuestion(10);
    setItems([]);
  };

  const addItem = () => {
    setItems(prev => [...prev, { imageFile: null, imagePreview: '', mainAnswer: '', altAnswer: '' }]);
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
    const invalid = items.some(i => !i.imageFile || !i.mainAnswer.trim());
    if (invalid) { toast.error('Each item needs an image and a main answer'); return; }

    setSaving(true);
    try {
      // Create game
      const { data: game, error: gameErr } = await supabase
        .from('vocab_games')
        .insert({ title: title.trim(), time_per_question: timePerQuestion, created_by: user!.id })
        .select()
        .single();
      if (gameErr) throw gameErr;

      // Upload images and create items
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const ext = item.imageFile!.name.split('.').pop();
        const path = `${game.id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from('vocab-images').upload(path, item.imageFile!);
        if (uploadErr) throw uploadErr;

        const { data: { publicUrl } } = supabase.storage.from('vocab-images').getPublicUrl(path);

        const { error: itemErr } = await supabase.from('vocab_items').insert({
          game_id: game.id,
          image_url: publicUrl,
          main_answer: item.mainAnswer.trim(),
          alt_answer: item.altAnswer.trim() || null,
          sort_order: i,
        });
        if (itemErr) throw itemErr;
      }

      queryClient.invalidateQueries({ queryKey: ['vocab-games'] });
      toast.success('Vocabulary game created!');
      resetForm();
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create game');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button><Plus className="w-4 h-4 mr-2" />New Vocabulary Game</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Vocabulary Game</DialogTitle>
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
              <Button size="sm" variant="outline" onClick={addItem}><Plus className="w-4 h-4 mr-1" />Add Item</Button>
            </div>

            {items.map((item, idx) => (
              <div key={idx} className="border rounded-xl p-4 space-y-3 bg-muted/30 relative">
                <button onClick={() => removeItem(idx)} className="absolute top-2 right-2 text-muted-foreground hover:text-destructive">
                  <X className="w-4 h-4" />
                </button>
                <p className="text-xs font-medium text-muted-foreground">Item #{idx + 1}</p>

                <div className="flex gap-4">
                  <div className="w-24 h-24 border-2 border-dashed rounded-lg flex items-center justify-center overflow-hidden bg-background shrink-0">
                    {item.imagePreview ? (
                      <img src={item.imagePreview} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <label className="cursor-pointer flex flex-col items-center gap-1 text-muted-foreground">
                        <Upload className="w-5 h-5" />
                        <span className="text-[10px]">Upload</span>
                        <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleImageChange(idx, e.target.files[0])} />
                      </label>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <Input value={item.mainAnswer} onChange={e => updateItem(idx, { mainAnswer: e.target.value })} placeholder="Main answer (e.g. Erase)" />
                    <Input value={item.altAnswer} onChange={e => updateItem(idx, { altAnswer: e.target.value })} placeholder="Alternative answer (e.g. Rub Out) — optional" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Button className="w-full" onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</> : 'Create Game'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateVocabGameDialog;
