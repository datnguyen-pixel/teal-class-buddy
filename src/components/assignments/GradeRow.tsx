import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Play, Pause } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface GradeRowProps {
  sub: any;
  studentName: string;
  assignmentType: string;
  onGrade: (args: { id: string; grade: number; feedback: string }) => void;
}

const GradeRow = ({ sub, studentName, assignmentType, onGrade }: GradeRowProps) => {
  const [gradeVal, setGradeVal] = useState(sub.grade?.toString() || '');
  const [feedbackVal, setFeedbackVal] = useState(sub.feedback || '');
  const [editing, setEditing] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (assignmentType === 'speaking' && sub.file_url) {
      supabase.storage.from('submissions').createSignedUrl(sub.file_url, 3600)
        .then(({ data }) => {
          if (data?.signedUrl) setAudioUrl(data.signedUrl);
        });
    }
  }, [assignmentType, sub.file_url]);

  const toggleAudio = () => {
    if (!audioUrl) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl);
      audioRef.current.onended = () => setIsPlaying(false);
    }
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const isAutoGraded = assignmentType === 'multiple_choice';

  return (
    <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-medium">{studentName}</span>
          <span className="text-muted-foreground ml-2">• {new Date(sub.submitted_at).toLocaleDateString()}</span>
        </div>
        {sub.grade !== null ? (
          <span className="text-sm font-semibold text-primary">{sub.grade}/100</span>
        ) : !isAutoGraded ? (
          <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>Grade</Button>
        ) : null}
      </div>

      {/* Content display */}
      {assignmentType === 'speaking' && audioUrl ? (
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={toggleAudio} className="gap-1.5">
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {isPlaying ? 'Pause' : 'Play Recording'}
          </Button>
        </div>
      ) : assignmentType === 'multiple_choice' ? (
        <p className="text-xs text-muted-foreground">Answer: {sub.content}</p>
      ) : (
        <p className="text-xs text-muted-foreground">{sub.content}</p>
      )}

      {sub.feedback && (
        <p className="text-xs italic text-muted-foreground">Feedback: {sub.feedback}</p>
      )}

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

export default GradeRow;
