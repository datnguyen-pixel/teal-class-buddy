import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Play, Pause, RotateCcw } from 'lucide-react';

interface VoiceRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
  disabled?: boolean;
}

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

const VoiceRecorder = ({ onRecordingComplete, disabled }: VoiceRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [hasSegments, setHasSegments] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const segmentsRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    timerRef.current = setInterval(() => setElapsed(p => p + 1), 1000);
  }, [clearTimer]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const buildFinalBlob = useCallback(() => {
    const blob = new Blob(segmentsRef.current, { type: 'audio/webm' });
    const url = URL.createObjectURL(blob);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(url);
    onRecordingComplete(blob);
  }, [audioUrl, onRecordingComplete]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      segmentsRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        if (chunksRef.current.length > 0) {
          segmentsRef.current.push(...chunksRef.current);
          chunksRef.current = [];
        }
        setHasSegments(segmentsRef.current.length > 0);
        buildFinalBlob();
      };

      mr.start(100);
      setIsRecording(true);
      setIsPaused(false);
      setElapsed(0);
      setAudioUrl(null);
      startTimer();
    } catch {
      alert('Microphone access denied. Please allow microphone access.');
    }
  }, [buildFinalBlob, startTimer]);

  const pauseRecording = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (!mr) return;

    if (mr.state === 'recording') {
      mr.pause();
      setIsPaused(true);
      clearTimer();
    } else if (mr.state === 'paused') {
      mr.resume();
      setIsPaused(false);
      startTimer();
    }
  }, [clearTimer, startTimer]);

  const stopRecording = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== 'inactive') mr.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setIsRecording(false);
    setIsPaused(false);
    clearTimer();
  }, [clearTimer]);

  const togglePlayback = useCallback(() => {
    if (!audioUrl) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl);
      audioRef.current.onended = () => setIsPlaying(false);
    }
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
      setIsPlaying(true);
    }
  }, [audioUrl, isPlaying]);

  const reset = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    segmentsRef.current = [];
    setAudioUrl(null);
    setIsPlaying(false);
    setIsRecording(false);
    setIsPaused(false);
    setHasSegments(false);
    setElapsed(0);
    clearTimer();
  }, [audioUrl, clearTimer]);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Start recording */}
      {!isRecording && !hasSegments && (
        <Button type="button" variant="outline" size="sm" onClick={startRecording} disabled={disabled} className="gap-1.5">
          <Mic className="w-4 h-4 text-destructive" /> Record
        </Button>
      )}

      {/* Active recording controls */}
      {isRecording && (
        <>
          <span className="text-sm font-mono tabular-nums text-muted-foreground min-w-[3rem]">
            {formatTime(elapsed)}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={pauseRecording} className="gap-1.5">
            {isPaused ? <><Mic className="w-3.5 h-3.5 text-destructive" /> Resume</> : <><Pause className="w-3.5 h-3.5" /> Pause</>}
          </Button>
          <Button type="button" variant="destructive" size="sm" onClick={stopRecording} className="gap-1.5">
            <Square className="w-3.5 h-3.5" /> Stop
          </Button>
        </>
      )}

      {/* Post-recording controls */}
      {!isRecording && hasSegments && audioUrl && (
        <>
          <span className="text-sm font-mono tabular-nums text-muted-foreground min-w-[3rem]">
            {formatTime(elapsed)}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={togglePlayback} className="gap-1.5">
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {isPlaying ? 'Pause' : 'Play'}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={reset} className="gap-1">
            <RotateCcw className="w-3.5 h-3.5" /> Re-record
          </Button>
        </>
      )}
    </div>
  );
};

export default VoiceRecorder;
