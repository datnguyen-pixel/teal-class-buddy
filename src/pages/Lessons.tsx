import { useState, useMemo, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, BookOpen, ExternalLink, Edit, CheckCircle2, Plus, Trash2, Upload, Image, FileText, Video, Link, X, Eye, MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import LessonComments from '@/components/lessons/LessonComments';

type Attachment = {
  type: 'link' | 'pdf' | 'image' | 'video';
  url: string;
  name: string;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const getStorageUrl = (path: string) =>
  `${SUPABASE_URL}/storage/v1/object/public/lesson-files/${path}`;

const Lessons = () => {
  const { isTeacher } = useAuth();
  const queryClient = useQueryClient();
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [editingLesson, setEditingLesson] = useState<any>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editLink, setEditLink] = useState('');
  const [editAttachments, setEditAttachments] = useState<Attachment[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLesson, setPreviewLesson] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [commentLessonId, setCommentLessonId] = useState<number | null>(null);
  const [commentLessonTitle, setCommentLessonTitle] = useState('');

  // New link form
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkName, setNewLinkName] = useState('');

  const thumbnailRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [editThumbnailUrl, setEditThumbnailUrl] = useState('');

  const { data: lessons = [] } = useQuery({
    queryKey: ['lessons'],
    queryFn: async () => {
      const { data } = await supabase.from('lessons').select('*').order('id', { ascending: true });
      return data || [];
    },
  });

  // Comment counts per lesson
  const { data: commentCounts = {} } = useQuery({
    queryKey: ['comment-counts'],
    queryFn: async () => {
      const { data } = await supabase.from('lesson_comments').select('lesson_id');
      const counts: Record<number, number> = {};
      (data || []).forEach(c => { counts[c.lesson_id] = (counts[c.lesson_id] || 0) + 1; });
      return counts;
    },
  });

  // Handle navigation from notification click
  useEffect(() => {
    const state = location.state as any;
    if (state?.openCommentLessonId) {
      const lesson = lessons.find((l: any) => l.id === state.openCommentLessonId);
      if (lesson) {
        setCommentLessonId(lesson.id);
        setCommentLessonTitle(lesson.title);
      }
      window.history.replaceState({}, document.title);
    }
  }, [location.state, lessons]);

  const filtered = useMemo(() => {
    if (!search.trim()) return lessons;
    const q = search.toLowerCase();
    return lessons.filter((l: any) => l.title.toLowerCase().includes(q) || l.id.toString().includes(q));
  }, [lessons, search]);

  const uploadFile = async (file: File, folder: string): Promise<string> => {
    const ext = file.name.split('.').pop();
    const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('lesson-files').upload(path, file, {
      contentType: file.type,
    });
    if (error) throw error;
    return path;
  };

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Vui lòng chọn file ảnh'); return; }
    setUploading(true);
    try {
      const path = await uploadFile(file, `thumbnails/${editingLesson.id}`);
      setEditThumbnailUrl(getStorageUrl(path));
      toast.success('Đã tải ảnh đại diện!');
    } catch (err: any) { toast.error(err.message); }
    setUploading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        let type: Attachment['type'] = 'pdf';
        if (file.type.startsWith('image/')) type = 'image';
        else if (file.type.startsWith('video/')) type = 'video';
        else if (file.type === 'application/pdf') type = 'pdf';
        else { toast.error(`Không hỗ trợ định dạng: ${file.name}`); continue; }

        const path = await uploadFile(file, `attachments/${editingLesson.id}`);
        setEditAttachments(prev => [...prev, { type, url: getStorageUrl(path), name: file.name }]);
      }
      toast.success('Đã tải file!');
    } catch (err: any) { toast.error(err.message); }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const addLink = () => {
    if (!newLinkUrl.trim()) return;
    setEditAttachments(prev => [...prev, { type: 'link', url: newLinkUrl.trim(), name: newLinkName.trim() || newLinkUrl.trim() }]);
    setNewLinkUrl('');
    setNewLinkName('');
  };

  const removeAttachment = (idx: number) => {
    setEditAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('lessons').update({
        title: editTitle,
        content: editContent || null,
        google_docs_link: editLink || null,
        thumbnail_url: editThumbnailUrl || null,
        attachments: editAttachments as any,
        is_edited: true,
      }).eq('id', editingLesson.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lessons'] });
      setEditOpen(false);
      toast.success('Đã cập nhật bài giảng!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startEdit = (lesson: any) => {
    setEditingLesson(lesson);
    setEditTitle(lesson.title);
    setEditContent(lesson.content || '');
    setEditLink(lesson.google_docs_link || '');
    setEditThumbnailUrl(lesson.thumbnail_url || '');
    setEditAttachments(Array.isArray(lesson.attachments) ? lesson.attachments : []);
    setEditOpen(true);
  };

  const openPreview = (lesson: any) => {
    setPreviewLesson(lesson);
    setPreviewOpen(true);
  };

  const getAttachments = (lesson: any): Attachment[] => {
    if (!lesson || !lesson.attachments || !Array.isArray(lesson.attachments)) return [];
    return lesson.attachments;
  };

  const getAttachmentIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="w-3 h-3" />;
      case 'video': return <Video className="w-3 h-3" />;
      case 'pdf': return <FileText className="w-3 h-3" />;
      default: return <Link className="w-3 h-3" />;
    }
  };

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.02 } } };
  const item = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } };

  return (
    <AppLayout>
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Bài giảng</h1>
            <p className="text-muted-foreground mt-1">Duyệt tất cả 100 bài giảng</p>
          </div>
        </div>

        <div className="relative mb-6 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Tìm theo tên hoặc số..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>

        {/* Edit Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh]">
            <DialogHeader><DialogTitle>Chỉnh sửa Bài giảng #{editingLesson?.id}</DialogTitle></DialogHeader>
            <ScrollArea className="max-h-[70vh] pr-4">
              <div className="space-y-5 mt-4">
                {/* Thumbnail */}
                <div className="space-y-2">
                  <Label>Ảnh đại diện</Label>
                  <div className="flex items-center gap-4">
                    {editThumbnailUrl ? (
                      <div className="relative w-24 h-16 rounded-md overflow-hidden border">
                        <img src={editThumbnailUrl} alt="Thumbnail" className="w-full h-full object-cover" />
                        <button onClick={() => setEditThumbnailUrl('')} className="absolute top-0.5 right-0.5 bg-background/80 rounded-full p-0.5">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-24 h-16 rounded-md border border-dashed flex items-center justify-center text-muted-foreground">
                        <Image className="w-5 h-5" />
                      </div>
                    )}
                    <Button type="button" variant="outline" size="sm" onClick={() => thumbnailRef.current?.click()} disabled={uploading}>
                      <Upload className="w-4 h-4 mr-1" /> Tải ảnh
                    </Button>
                    <input ref={thumbnailRef} type="file" accept="image/*" className="hidden" onChange={handleThumbnailUpload} />
                  </div>
                </div>

                {/* Title */}
                <div className="space-y-2">
                  <Label>Tiêu đề</Label>
                  <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} />
                </div>

                {/* Content */}
                <div className="space-y-2">
                  <Label>Nội dung mô tả</Label>
                  <Textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={3} placeholder="Ghi chú bài giảng..." />
                </div>

                {/* Google Docs Link (legacy) */}
                <div className="space-y-2">
                  <Label>Link Google Docs</Label>
                  <Input value={editLink} onChange={e => setEditLink(e.target.value)} placeholder="https://docs.google.com/..." />
                </div>

                {/* Attachments */}
                <div className="space-y-3">
                  <Label>Tài liệu đính kèm</Label>

                  {/* Current attachments */}
                  {editAttachments.length > 0 && (
                    <div className="space-y-2">
                      {editAttachments.map((att, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-sm">
                          {getAttachmentIcon(att.type)}
                          <span className="truncate flex-1">{att.name}</span>
                          <span className="text-xs text-muted-foreground uppercase">{att.type}</span>
                          <button onClick={() => removeAttachment(i)} className="text-destructive hover:text-destructive/80">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upload files */}
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                      <Upload className="w-4 h-4 mr-1" /> {uploading ? 'Đang tải...' : 'Tải file (PDF, ảnh, video)'}
                    </Button>
                    <input ref={fileRef} type="file" accept="image/*,video/*,application/pdf" multiple className="hidden" onChange={handleFileUpload} />
                  </div>

                  {/* Add link */}
                  <div className="flex gap-2 items-end">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Tên link</Label>
                      <Input value={newLinkName} onChange={e => setNewLinkName(e.target.value)} placeholder="YouTube, Canva..." className="h-8 text-sm" />
                    </div>
                    <div className="flex-[2] space-y-1">
                      <Label className="text-xs">URL</Label>
                      <Input value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)} placeholder="https://..." className="h-8 text-sm" />
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={addLink} className="h-8">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <Button onClick={() => updateMutation.mutate()} className="w-full gradient-primary border-0" disabled={updateMutation.isPending || uploading}>
                  {updateMutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
                </Button>
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>

        {/* Preview Dialog */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh]">
            <DialogHeader><DialogTitle>{previewLesson?.title}</DialogTitle></DialogHeader>
            <ScrollArea className="max-h-[75vh] pr-4">
              <div className="space-y-4 mt-2">
                {previewLesson?.thumbnail_url && (
                  <img src={previewLesson.thumbnail_url} alt={previewLesson.title} className="w-full max-h-64 object-cover rounded-lg" />
                )}
                {previewLesson?.content && (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{previewLesson.content}</p>
                )}
                {previewLesson?.google_docs_link && (
                  <a href={previewLesson.google_docs_link} target="_blank" rel="noopener noreferrer" className="text-sm text-primary flex items-center gap-1 hover:underline">
                    <ExternalLink className="w-4 h-4" /> Google Docs
                  </a>
                )}

                {/* Render attachments inline */}
                {getAttachments(previewLesson).map((att, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {getAttachmentIcon(att.type)}
                      <span>{att.name}</span>
                    </div>
                    {att.type === 'image' && (
                      <img src={att.url} alt={att.name} className="max-w-full max-h-96 rounded-lg border" />
                    )}
                    {att.type === 'video' && (
                      att.url.includes('youtube.com') || att.url.includes('youtu.be') ? (
                        <iframe
                          src={att.url.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')}
                          className="w-full aspect-video rounded-lg"
                          allowFullScreen
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        />
                      ) : (
                        <video src={att.url} controls className="w-full max-h-96 rounded-lg" />
                      )
                    )}
                    {att.type === 'pdf' && (
                      <div className="space-y-2">
                        <iframe
                          src={`https://docs.google.com/gview?url=${encodeURIComponent(att.url)}&embedded=true`}
                          className="w-full h-[500px] rounded-lg border"
                          sandbox="allow-scripts allow-same-origin"
                        />
                        <div className="flex gap-3">
                          <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1 hover:underline">
                            <ExternalLink className="w-3 h-3" /> Mở PDF trong tab mới
                          </a>
                          <a href={att.url} download className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground">
                            <FileText className="w-3 h-3" /> Tải xuống
                          </a>
                        </div>
                      </div>
                    )}
                    {att.type === 'link' && (
                      <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary flex items-center gap-1 hover:underline">
                        <ExternalLink className="w-4 h-4" /> {att.name}
                      </a>
                    )}
                  </div>
                ))}

                {!previewLesson?.content && !previewLesson?.google_docs_link && getAttachments(previewLesson).length === 0 && (
                  <p className="text-sm text-muted-foreground italic">Bài giảng chưa có nội dung.</p>
                )}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>

        {/* Lesson Grid */}
        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((lesson: any) => {
            const atts = getAttachments(lesson);
            const hasContent = lesson.is_edited || lesson.content || lesson.google_docs_link || atts.length > 0;
            return (
              <motion.div key={lesson.id} variants={item}>
                <Card
                  className={`shadow-card hover:shadow-elevated transition-all duration-200 cursor-pointer group ${hasContent ? 'border-primary/20' : 'opacity-70'}`}
                  onClick={() => openPreview(lesson)}
                >
                  {/* Thumbnail */}
                  {lesson.thumbnail_url ? (
                    <div className="relative h-32 overflow-hidden rounded-t-lg">
                      <img src={lesson.thumbnail_url} alt={lesson.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent" />
                      <span className="absolute bottom-2 left-2 text-xs font-mono text-primary-foreground bg-primary/80 px-1.5 py-0.5 rounded">#{lesson.id}</span>
                    </div>
                  ) : null}
                  <CardContent className="p-4">
                    {!lesson.thumbnail_url && (
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-xs font-mono text-muted-foreground">#{lesson.id}</span>
                        {lesson.is_edited && <CheckCircle2 className="w-4 h-4 text-primary" />}
                      </div>
                    )}
                    <h3 className="font-medium text-sm truncate">{lesson.title}</h3>
                    {lesson.content && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{lesson.content}</p>}

                    {/* Attachment badges */}
                    {atts.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {atts.map((att, i) => (
                          <span key={i} className="inline-flex items-center gap-0.5 text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">
                            {getAttachmentIcon(att.type)} {att.type}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2 mt-3">
                      {lesson.google_docs_link && (
                        <a href={lesson.google_docs_link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1 hover:underline" onClick={e => e.stopPropagation()}>
                          <ExternalLink className="w-3 h-3" /> Docs
                        </a>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); openPreview(lesson); }} className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground">
                        <Eye className="w-3 h-3" /> Xem
                      </button>
                      {isTeacher && (
                        <button onClick={(e) => { e.stopPropagation(); startEdit(lesson); }} className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground ml-auto">
                          <Edit className="w-3 h-3" /> Sửa
                        </button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>Không tìm thấy bài giảng phù hợp "{search}"</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Lessons;
