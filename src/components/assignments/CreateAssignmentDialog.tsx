import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

type AssignmentType = 'essay' | 'multiple_choice' | 'speaking';

interface CreateAssignmentDialogProps {
  userId: string;
}

const TYPE_LABELS: Record<AssignmentType, string> = {
  essay: 'Essay',
  multiple_choice: 'Multiple Choice',
  speaking: 'Speaking',
};

const CreateAssignmentDialog = ({ userId }: CreateAssignmentDialogProps) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<AssignmentType>('essay');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  // MC-specific state
  const [options, setOptions] = useState<string[]>(['', '']);
  const [correctAnswer, setCorrectAnswer] = useState('');

  const resetForm = () => {
    setType('essay');
    setTitle('');
    setDescription('');
    setDueDate('');
    setDueTime('');
    setOptions(['', '']);
    setCorrectAnswer('');
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const insertData: any = {
        title,
        description,
        due_date: dueDate,
        due_time: dueTime || null,
        created_by: userId,
        type,
      };

      if (type === 'multiple_choice') {
        const filledOptions = options.filter(o => o.trim());
        if (filledOptions.length < 2) throw new Error('At least 2 options required');
        if (!correctAnswer) throw new Error('Select a correct answer');
        insertData.options = filledOptions;
        insertData.correct_answer = correctAnswer;
      }

      const { error } = await supabase.from('assignments').insert(insertData);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      resetForm();
      setOpen(false);
      toast.success('Assignment created!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleCreate = () => {
    if (!title || !dueDate) { toast.error('Title and due date are required'); return; }
    createMutation.mutate();
  };

  const addOption = () => {
    if (options.length >= 4) return;
    setOptions([...options, '']);
  };

  const removeOption = (index: number) => {
    if (options.length <= 2) return;
    const newOptions = options.filter((_, i) => i !== index);
    setOptions(newOptions);
    if (correctAnswer === options[index]) setCorrectAnswer('');
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    const oldVal = newOptions[index];
    newOptions[index] = value;
    setOptions(newOptions);
    if (correctAnswer === oldVal) setCorrectAnswer(value);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gradient-primary border-0 gap-2"><Plus className="w-4 h-4" /> New Assignment</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Create Assignment</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-4">
          {/* Type selector */}
          <div className="space-y-2">
            <Label>Assignment Type</Label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(TYPE_LABELS) as AssignmentType[]).map(t => (
                <Button
                  key={t}
                  type="button"
                  variant={type === t ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setType(t)}
                  className={type === t ? 'gradient-primary border-0' : ''}
                >
                  {TYPE_LABELS[t]}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Assignment title" />
          </div>

          <div className="space-y-2">
            <Label>{type === 'speaking' ? 'Passage / Text to Read' : type === 'multiple_choice' ? 'Question' : 'Description'}</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={type === 'speaking' ? 'Enter the text passage students will read aloud...' : type === 'multiple_choice' ? 'Enter the question...' : 'Instructions...'}
              rows={3}
            />
          </div>

          {/* MC options */}
          {type === 'multiple_choice' && (
            <div className="space-y-3">
              <Label>Answer Options</Label>
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correct-answer"
                    checked={correctAnswer === opt && opt.trim() !== ''}
                    onChange={() => setCorrectAnswer(opt)}
                    className="accent-primary"
                    disabled={opt.trim() === ''}
                  />
                  <Input
                    value={opt}
                    onChange={e => updateOption(i, e.target.value)}
                    placeholder={`Option ${i + 1}`}
                    className="flex-1"
                  />
                  {options.length > 2 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeOption(i)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
              <div className="flex items-center gap-2">
                {options.length < 4 && (
                  <Button type="button" variant="outline" size="sm" onClick={addOption}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Option
                  </Button>
                )}
                <span className="text-xs text-muted-foreground">Select the radio button next to the correct answer</span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Due Date</Label>
            <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>

          <Button onClick={handleCreate} className="w-full gradient-primary border-0" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create Assignment'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateAssignmentDialog;
