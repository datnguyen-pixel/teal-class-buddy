import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Search, BookOpen, ExternalLink, Edit, CheckCircle2 } from 'lucide-react';
import { Lesson } from '@/lib/types';
import { generateLessons } from '@/lib/mock-data';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

const Lessons = () => {
  const { isTeacher } = useAuth();
  const [lessons, setLessons] = useState<Lesson[]>(generateLessons);
  const [search, setSearch] = useState('');
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editLink, setEditLink] = useState('');
  const [editOpen, setEditOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return lessons;
    const q = search.toLowerCase();
    return lessons.filter(l =>
      l.title.toLowerCase().includes(q) || l.id.toString().includes(q)
    );
  }, [lessons, search]);

  const startEdit = (lesson: Lesson) => {
    setEditingLesson(lesson);
    setEditTitle(lesson.title);
    setEditContent(lesson.content || '');
    setEditLink(lesson.googleDocsLink || '');
    setEditOpen(true);
  };

  const saveEdit = () => {
    if (!editingLesson || !editTitle.trim()) return;
    setLessons(prev =>
      prev.map(l =>
        l.id === editingLesson.id
          ? { ...l, title: editTitle, content: editContent, googleDocsLink: editLink || undefined, isEdited: true }
          : l
      )
    );
    setEditOpen(false);
    toast.success('Lesson updated!');
  };

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.02 } } };
  const item = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } };

  return (
    <AppLayout>
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Lessons</h1>
            <p className="text-muted-foreground mt-1">Browse all 100 lesson slots</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or number..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Edit Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Lesson {editingLesson?.id}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Content</Label>
                <Textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={4} placeholder="Lesson notes..." />
              </div>
              <div className="space-y-2">
                <Label>Google Docs Link</Label>
                <Input value={editLink} onChange={e => setEditLink(e.target.value)} placeholder="https://docs.google.com/..." />
              </div>
              <Button onClick={saveEdit} className="w-full gradient-primary border-0">Save Changes</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Lessons Grid */}
        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map(lesson => (
            <motion.div key={lesson.id} variants={item}>
              <Card className={`shadow-card hover:shadow-elevated transition-all duration-200 cursor-pointer ${
                lesson.isEdited ? 'border-primary/20' : 'opacity-70'
              }`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs font-mono text-muted-foreground">#{lesson.id}</span>
                    {lesson.isEdited && <CheckCircle2 className="w-4 h-4 text-primary" />}
                  </div>
                  <h3 className="font-medium text-sm truncate">{lesson.title}</h3>
                  {lesson.content && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{lesson.content}</p>
                  )}
                  <div className="flex items-center gap-2 mt-3">
                    {lesson.googleDocsLink && (
                      <a
                        href={lesson.googleDocsLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary flex items-center gap-1 hover:underline"
                        onClick={e => e.stopPropagation()}
                      >
                        <ExternalLink className="w-3 h-3" /> Docs
                      </a>
                    )}
                    {isTeacher && (
                      <button
                        onClick={() => startEdit(lesson)}
                        className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground ml-auto"
                      >
                        <Edit className="w-3 h-3" /> Edit
                      </button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>No lessons found matching "{search}"</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Lessons;
