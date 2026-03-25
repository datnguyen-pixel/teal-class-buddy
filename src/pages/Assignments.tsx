import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Calendar, FileText, MessageSquare, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const Assignments = () => {
  const { user, isTeacher } = useAuth();
  const queryClient = useQueryClient();
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDue, setNewDue] = useState('');
  const [open, setOpen] = useState(false);
  const [submissionText, setSubmissionText] = useState('');
  const [submitDialogId, setSubmitDialogId] = useState<string | null>(null);

  const { data: assignments = [] } = useQuery({
    queryKey: ['assignments'],
    queryFn: async () => {
      const { data } = await supabase.from('assignments').select('*').order('created_at', { ascending: false });
      return data || [];
    },
  });

  const { data: submissions = [] } = useQuery({
    queryKey: ['submissions'],
    queryFn: async () => {
      const { data } = await supabase.from('submissions').select('*');
      return data || [];
    },
  });

  // Fetch profiles for student names
  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name');
      return data || [];
    },
    enabled: isTeacher,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('assignments').insert({
        title: newTitle,
        description: newDesc,
        due_date: newDue,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      setNewTitle(''); setNewDesc(''); setNewDue(''); setOpen(false);
      toast.success('Assignment created!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('assignments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      toast.success('Assignment deleted');
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase.from('submissions').insert({
        assignment_id: assignmentId,
        student_id: user!.id,
        content: submissionText,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submissions'] });
      setSubmissionText(''); setSubmitDialogId(null);
      toast.success('Answer submitted!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const gradeMutation = useMutation({
    mutationFn: async ({ id, grade, feedback }: { id: string; grade: number; feedback: string }) => {
      const { error } = await supabase.from('submissions').update({ grade, feedback, graded_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submissions'] });
      toast.success('Grade saved!');
    },
  });

  const handleCreate = () => {
    if (!newTitle || !newDue) { toast.error('Title and due date are required'); return; }
    createMutation.mutate();
  };

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
  const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

  return (
    <AppLayout>
      <motion.div variants={container} initial="hidden" animate="show">
        <motion.div variants={item} className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Assignments</h1>
            <p className="text-muted-foreground mt-1">
              {isTeacher ? 'Create and manage class assignments' : 'View and submit assignments'}
            </p>
          </div>
          {isTeacher && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="gradient-primary border-0 gap-2"><Plus className="w-4 h-4" /> New Assignment</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create Assignment</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Assignment title" />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Instructions..." rows={3} />
                  </div>
                  <div className="space-y-2">
                    <Label>Due Date</Label>
                    <Input type="date" value={newDue} onChange={e => setNewDue(e.target.value)} />
                  </div>
                  <Button onClick={handleCreate} className="w-full gradient-primary border-0" disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Creating...' : 'Create Assignment'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </motion.div>

        <div className="grid gap-4">
          {assignments.map(assignment => {
            const assignmentSubs = submissions.filter(s => s.assignment_id === assignment.id);
            const mySubmission = assignmentSubs.find(s => s.student_id === user?.id);

            return (
              <motion.div key={assignment.id} variants={item}>
                <Card className="shadow-card hover:shadow-elevated transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{assignment.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{assignment.description}</p>
                        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            Due {new Date(assignment.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                          <span className="flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5" />
                            {assignmentSubs.length} submissions
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        {!isTeacher && !mySubmission && (
                          <Dialog open={submitDialogId === assignment.id} onOpenChange={(o) => setSubmitDialogId(o ? assignment.id : null)}>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" className="gap-1.5">
                                <MessageSquare className="w-3.5 h-3.5" /> Submit
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader><DialogTitle>Submit Answer</DialogTitle></DialogHeader>
                              <div className="space-y-4 mt-4">
                                <p className="text-sm text-muted-foreground">{assignment.title}</p>
                                <Textarea value={submissionText} onChange={e => setSubmissionText(e.target.value)} placeholder="Type your answer..." rows={5} />
                                <Button onClick={() => submitMutation.mutate(assignment.id)} className="w-full gradient-primary border-0" disabled={submitMutation.isPending}>
                                  Submit Answer
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                        {!isTeacher && mySubmission && (
                          <span className="text-xs font-medium px-3 py-1 rounded-full bg-secondary text-secondary-foreground">
                            {mySubmission.grade !== null ? `${mySubmission.grade}/100` : 'Submitted ✓'}
                          </span>
                        )}
                        {isTeacher && (
                          <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(assignment.id)} className="text-destructive hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {isTeacher && assignmentSubs.length > 0 && (
                      <div className="mt-4 pt-4 border-t space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Submissions</p>
                        {assignmentSubs.map(sub => {
                          const studentProfile = profiles.find(p => p.user_id === sub.student_id);
                          return (
                            <GradeRow key={sub.id} sub={sub} studentName={studentProfile?.full_name || 'Student'} onGrade={gradeMutation.mutate} />
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
          {assignments.length === 0 && (
            <p className="text-center py-12 text-muted-foreground">No assignments yet</p>
          )}
        </div>
      </motion.div>
    </AppLayout>
  );
};

const GradeRow = ({ sub, studentName, onGrade }: { sub: any; studentName: string; onGrade: (args: { id: string; grade: number; feedback: string }) => void }) => {
  const [gradeVal, setGradeVal] = useState(sub.grade?.toString() || '');
  const [feedbackVal, setFeedbackVal] = useState(sub.feedback || '');
  const [editing, setEditing] = useState(false);

  return (
    <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-medium">{studentName}</span>
          <span className="text-muted-foreground ml-2">• {new Date(sub.submitted_at).toLocaleDateString()}</span>
        </div>
        {sub.grade !== null ? (
          <span className="text-sm font-semibold text-primary">{sub.grade}/100</span>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>Grade</Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{sub.content}</p>
      {editing && (
        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-1">
            <Input placeholder="Grade (0-100)" value={gradeVal} onChange={e => setGradeVal(e.target.value)} type="number" min={0} max={100} />
          </div>
          <div className="flex-1 space-y-1">
            <Input placeholder="Feedback" value={feedbackVal} onChange={e => setFeedbackVal(e.target.value)} />
          </div>
          <Button size="sm" onClick={() => {
            const g = parseInt(gradeVal);
            if (isNaN(g) || g < 0 || g > 100) return;
            onGrade({ id: sub.id, grade: g, feedback: feedbackVal });
            setEditing(false);
          }}>Save</Button>
        </div>
      )}
    </div>
  );
};

export default Assignments;
