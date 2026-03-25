import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Calendar, FileText, MessageSquare, Trash2 } from 'lucide-react';
import { Assignment } from '@/lib/types';
import { mockAssignments } from '@/lib/mock-data';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

const Assignments = () => {
  const { isTeacher } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>(mockAssignments);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDue, setNewDue] = useState('');
  const [open, setOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [submissionText, setSubmissionText] = useState('');

  const handleCreate = () => {
    if (!newTitle || !newDue) {
      toast.error('Title and due date are required');
      return;
    }
    const assignment: Assignment = {
      id: `a${Date.now()}`,
      title: newTitle,
      description: newDesc,
      dueDate: newDue,
      createdAt: new Date().toISOString().split('T')[0],
      submissions: [],
    };
    setAssignments(prev => [assignment, ...prev]);
    setNewTitle('');
    setNewDesc('');
    setNewDue('');
    setOpen(false);
    toast.success('Assignment created!');
  };

  const handleDelete = (id: string) => {
    setAssignments(prev => prev.filter(a => a.id !== id));
    toast.success('Assignment deleted');
  };

  const handleSubmit = (assignmentId: string) => {
    if (!submissionText.trim()) {
      toast.error('Please enter your answer');
      return;
    }
    setAssignments(prev =>
      prev.map(a =>
        a.id === assignmentId
          ? {
              ...a,
              submissions: [
                ...(a.submissions || []),
                {
                  id: `sub${Date.now()}`,
                  assignmentId,
                  studentId: 's1',
                  studentName: 'Alex Chen',
                  content: submissionText,
                  submittedAt: new Date().toISOString().split('T')[0],
                },
              ],
            }
          : a
      )
    );
    setSubmissionText('');
    setSelectedAssignment(null);
    toast.success('Answer submitted!');
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
                <Button className="gradient-primary border-0 gap-2">
                  <Plus className="w-4 h-4" /> New Assignment
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Assignment</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Assignment title" />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Instructions for students..." rows={3} />
                  </div>
                  <div className="space-y-2">
                    <Label>Due Date</Label>
                    <Input type="date" value={newDue} onChange={e => setNewDue(e.target.value)} />
                  </div>
                  <Button onClick={handleCreate} className="w-full gradient-primary border-0">Create Assignment</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </motion.div>

        <div className="grid gap-4">
          {assignments.map(assignment => (
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
                          Due {new Date(assignment.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5" />
                          {assignment.submissions?.length || 0} submissions
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {!isTeacher && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setSelectedAssignment(assignment)}>
                              <MessageSquare className="w-3.5 h-3.5" /> Submit
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Submit Answer</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 mt-4">
                              <p className="text-sm text-muted-foreground">{assignment.title}</p>
                              <Textarea
                                value={submissionText}
                                onChange={e => setSubmissionText(e.target.value)}
                                placeholder="Type your answer here..."
                                rows={5}
                              />
                              <Button onClick={() => handleSubmit(assignment.id)} className="w-full gradient-primary border-0">
                                Submit Answer
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                      {isTeacher && (
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(assignment.id)} className="text-destructive hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Show submissions for teacher */}
                  {isTeacher && assignment.submissions && assignment.submissions.length > 0 && (
                    <div className="mt-4 pt-4 border-t space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Submissions</p>
                      {assignment.submissions.map(sub => (
                        <div key={sub.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 text-sm">
                          <div>
                            <span className="font-medium">{sub.studentName}</span>
                            <span className="text-muted-foreground ml-2">• {sub.submittedAt}</span>
                          </div>
                          {sub.grade ? (
                            <span className="text-sm font-semibold text-primary">{sub.grade}/100</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Not graded</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </AppLayout>
  );
};

export default Assignments;
