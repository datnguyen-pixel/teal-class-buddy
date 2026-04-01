import { useState, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar, Clock, FileText, MessageSquare, Trash2, Mic, CheckCircle2, PenLine, BadgeCheck, Pencil } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import CreateAssignmentDialog from '@/components/assignments/CreateAssignmentDialog';
import GradeRow from '@/components/assignments/GradeRow';
import VoiceRecorder from '@/components/assignments/VoiceRecorder';

const TYPE_BADGES: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  essay: { label: 'Essay', icon: PenLine, className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  multiple_choice: { label: 'Multiple Choice', icon: CheckCircle2, className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  speaking: { label: 'Speaking', icon: Mic, className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
};

const Assignments = () => {
  const { user, isTeacher } = useAuth();
  const queryClient = useQueryClient();
  const [submissionText, setSubmissionText] = useState('');
  const [submitDialogId, setSubmitDialogId] = useState<string | null>(null);
  const [selectedMcAnswer, setSelectedMcAnswer] = useState('');
  const [editingAssignment, setEditingAssignment] = useState<any>(null);
  const audioBlobRef = useRef<Blob | null>(null);

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

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name');
      return data || [];
    },
    enabled: isTeacher,
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

  // Essay submission
  const submitEssayMutation = useMutation({
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

  // MC submission with auto-grading
  const submitMcMutation = useMutation({
    mutationFn: async ({ assignmentId, answer, correctAnswer }: { assignmentId: string; answer: string; correctAnswer: string }) => {
      const isCorrect = answer === correctAnswer;
      const { error } = await supabase.from('submissions').insert({
        assignment_id: assignmentId,
        student_id: user!.id,
        content: answer,
        grade: isCorrect ? 100 : 0,
        feedback: isCorrect ? 'Correct!' : `Incorrect. The correct answer is: ${correctAnswer}`,
        graded_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submissions'] });
      setSelectedMcAnswer(''); setSubmitDialogId(null);
      toast.success('Answer submitted and graded!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Speaking submission
  const submitSpeakingMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const blob = audioBlobRef.current;
      if (!blob) throw new Error('No recording found');
      const filePath = `${user!.id}/${assignmentId}/${Date.now()}.webm`;
      const { error: uploadErr } = await supabase.storage.from('submissions').upload(filePath, blob, { contentType: 'audio/webm' });
      if (uploadErr) throw uploadErr;
      const { error } = await supabase.from('submissions').insert({
        assignment_id: assignmentId,
        student_id: user!.id,
        content: 'Voice recording submitted',
        file_url: filePath,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submissions'] });
      audioBlobRef.current = null;
      setSubmitDialogId(null);
      toast.success('Recording submitted!');
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

  const handleRecordingComplete = useCallback((blob: Blob) => {
    audioBlobRef.current = blob;
  }, []);

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
          {isTeacher && <CreateAssignmentDialog userId={user!.id} />}
        </motion.div>

        <div className="grid gap-4">
          {assignments.map((assignment: any) => {
            const assignmentType = assignment.type || 'essay';
            const assignmentSubs = submissions.filter(s => s.assignment_id === assignment.id);
            const mySubmission = assignmentSubs.find(s => s.student_id === user?.id);
            const badge = TYPE_BADGES[assignmentType] || TYPE_BADGES.essay;
            const BadgeIcon = badge.icon;

            // Build deadline from due_date + due_time
            const deadlineStr = assignment.due_time
              ? `${assignment.due_date}T${assignment.due_time}`
              : `${assignment.due_date}T23:59`;
            const deadline = new Date(deadlineStr);
            const isPastDue = new Date() > deadline;

            return (
              <motion.div key={assignment.id} variants={item}>
                <Card className="shadow-card hover:shadow-elevated transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-lg">{assignment.title}</h3>
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${badge.className}`}>
                            <BadgeIcon className="w-3 h-3" /> {badge.label}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{assignment.description}</p>
                        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            Due {new Date(assignment.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                          {assignment.due_time && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {new Date(`2000-01-01T${assignment.due_time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                            </span>
                          )}
                          {isPastDue && (
                            <span className="text-destructive font-medium">Past due</span>
                          )}
                          <span className="flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5" />
                            {assignmentSubs.length} submissions
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        {/* Student submit button */}
                        {!isTeacher && !mySubmission && !isPastDue && (
                          <Dialog open={submitDialogId === assignment.id} onOpenChange={(o) => {
                            setSubmitDialogId(o ? assignment.id : null);
                            if (!o) { setSubmissionText(''); setSelectedMcAnswer(''); audioBlobRef.current = null; }
                          }}>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" className="gap-1.5">
                                <MessageSquare className="w-3.5 h-3.5" /> Submit
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader><DialogTitle>Submit Answer</DialogTitle></DialogHeader>
                              <div className="space-y-4 mt-4">
                                <p className="text-sm text-muted-foreground">{assignment.title}</p>

                                {/* Essay submission */}
                                {assignmentType === 'essay' && (
                                  <>
                                    <Textarea value={submissionText} onChange={e => setSubmissionText(e.target.value)} placeholder="Type your answer..." rows={5} />
                                    <Button onClick={() => submitEssayMutation.mutate(assignment.id)} className="w-full gradient-primary border-0" disabled={submitEssayMutation.isPending}>
                                      {submitEssayMutation.isPending ? 'Submitting...' : 'Submit Answer'}
                                    </Button>
                                  </>
                                )}

                                {/* Multiple choice submission */}
                                {assignmentType === 'multiple_choice' && (
                                  <>
                                    <p className="text-sm font-medium">{assignment.description}</p>
                                    <div className="space-y-2">
                                      {(assignment.options as string[] || []).map((opt: string, i: number) => (
                                        <label key={i} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedMcAnswer === opt ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                                          <input
                                            type="radio"
                                            name={`mc-${assignment.id}`}
                                            value={opt}
                                            checked={selectedMcAnswer === opt}
                                            onChange={() => setSelectedMcAnswer(opt)}
                                            className="accent-primary"
                                          />
                                          <span className="text-sm">{opt}</span>
                                        </label>
                                      ))}
                                    </div>
                                    <Button
                                      onClick={() => submitMcMutation.mutate({ assignmentId: assignment.id, answer: selectedMcAnswer, correctAnswer: assignment.correct_answer || '' })}
                                      className="w-full gradient-primary border-0"
                                      disabled={!selectedMcAnswer || submitMcMutation.isPending}
                                    >
                                      {submitMcMutation.isPending ? 'Submitting...' : 'Submit Answer'}
                                    </Button>
                                  </>
                                )}

                                {/* Speaking submission */}
                                {assignmentType === 'speaking' && (
                                  <>
                                    <div className="p-4 rounded-lg bg-muted/50 border">
                                      <p className="text-xs font-medium text-muted-foreground mb-1">Read this passage aloud:</p>
                                      <p className="text-sm leading-relaxed">{assignment.description}</p>
                                    </div>
                                    <VoiceRecorder onRecordingComplete={handleRecordingComplete} />
                                    <Button
                                      onClick={() => submitSpeakingMutation.mutate(assignment.id)}
                                      className="w-full gradient-primary border-0"
                                      disabled={!audioBlobRef.current || submitSpeakingMutation.isPending}
                                    >
                                      {submitSpeakingMutation.isPending ? 'Uploading...' : 'Submit Recording'}
                                    </Button>
                                  </>
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}

                        {/* Past due message for students */}
                        {!isTeacher && !mySubmission && isPastDue && (
                          <span className="text-xs font-medium px-3 py-1 rounded-full bg-destructive/10 text-destructive">
                            Past due — can no longer submit
                          </span>
                        )}

                        {/* Student result badge */}
                        {!isTeacher && mySubmission && (
                          <span className="text-xs font-medium px-3 py-1 rounded-full bg-secondary text-secondary-foreground">
                            {mySubmission.grade !== null ? `${mySubmission.grade}/100` : 'Submitted ✓'}
                          </span>
                        )}
                        {!isTeacher && mySubmission && mySubmission.feedback && (
                          <span className="text-xs text-muted-foreground max-w-[200px] truncate" title={mySubmission.feedback}>
                            {mySubmission.feedback}
                          </span>
                        )}

                        {isTeacher && (
                          <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(assignment.id)} className="text-destructive hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Teacher submissions view */}
                    {isTeacher && assignmentSubs.length > 0 && (
                      <div className="mt-4 pt-4 border-t space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Submissions</p>
                        {assignmentSubs.map(sub => {
                          const studentProfile = profiles.find(p => p.user_id === sub.student_id);
                          return (
                            <GradeRow
                              key={sub.id}
                              sub={sub}
                              studentName={studentProfile?.full_name || 'Student'}
                              assignmentType={assignmentType}
                              onGrade={gradeMutation.mutate}
                            />
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

export default Assignments;
