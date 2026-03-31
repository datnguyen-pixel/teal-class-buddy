import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Trophy, Flame, CheckCircle, XCircle, SkipForward } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';

// Simple beep sounds using Web Audio API
const playSound = (type: 'correct' | 'wrong' | 'complete') => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.value = 0.15;

    if (type === 'correct') {
      osc.frequency.value = 880;
      osc.type = 'sine';
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else if (type === 'wrong') {
      osc.frequency.value = 280;
      osc.type = 'square';
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else {
      osc.frequency.value = 523;
      osc.type = 'sine';
      osc.start();
      setTimeout(() => { osc.frequency.value = 659; }, 150);
      setTimeout(() => { osc.frequency.value = 784; }, 300);
      osc.stop(ctx.currentTime + 0.5);
    }
  } catch {}
};

interface VocabItem {
  id: string;
  image_url: string;
  question_text: string | null;
  main_answer: string;
  alt_answer: string | null;
  sort_order: number;
}

interface Props {
  gameId: string;
  onBack: () => void;
}

const VocabGamePlay = ({ gameId, onBack }: Props) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameFinished, setGameFinished] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: game } = useQuery({
    queryKey: ['vocab-game', gameId],
    queryFn: async () => {
      const { data, error } = await supabase.from('vocab_games').select('*').eq('id', gameId).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ['vocab-items', gameId],
    queryFn: async () => {
      const { data, error } = await supabase.from('vocab_items').select('*').eq('game_id', gameId).order('sort_order');
      if (error) throw error;
      return (data || []) as VocabItem[];
    },
  });

  const timePerQ = game?.time_per_question || 10;
  const currentItem = items[currentIndex];
  const totalQuestions = items.length;

  const moveToNext = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (currentIndex + 1 >= totalQuestions) {
      setGameFinished(true);
      playSound('complete');
      return;
    }
    setTimeout(() => {
      setCurrentIndex(prev => prev + 1);
      setAnswer('');
      setFeedback(null);
      setTimeLeft(timePerQ);
    }, 800);
  }, [currentIndex, totalQuestions, timePerQ]);

  const checkAnswer = useCallback(() => {
    if (!currentItem || feedback) return;
    const normalize = (s: string) => s.trim().toLowerCase();
    const userAns = normalize(answer);
    const correct = normalize(currentItem.main_answer);
    const alt = currentItem.alt_answer ? normalize(currentItem.alt_answer) : null;

    if (userAns === correct || (alt && userAns === alt)) {
      setFeedback('correct');
      setScore(prev => prev + 1);
      setStreak(prev => {
        const next = prev + 1;
        setBestStreak(b => Math.max(b, next));
        return next;
      });
      playSound('correct');
    } else {
      setFeedback('wrong');
      setStreak(0);
      playSound('wrong');
    }
    moveToNext();
  }, [answer, currentItem, feedback, moveToNext]);

  // Timer
  useEffect(() => {
    if (!gameStarted || gameFinished || feedback) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setFeedback('wrong');
          setStreak(0);
          playSound('wrong');
          moveToNext();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [gameStarted, gameFinished, currentIndex, feedback, moveToNext]);

  // Focus input on new question
  useEffect(() => {
    if (gameStarted && !gameFinished && !feedback) {
      inputRef.current?.focus();
    }
  }, [currentIndex, gameStarted, gameFinished, feedback]);

  const startGame = () => {
    setGameStarted(true);
    setTimeLeft(timePerQ);
    setCurrentIndex(0);
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setFeedback(null);
    setGameFinished(false);
    setAnswer('');
  };

  // Pre-game screen
  if (!gameStarted) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
        <Card className="max-w-md mx-auto">
          <CardContent className="p-8 text-center space-y-4">
            <h2 className="text-2xl font-bold text-foreground">{game?.title || 'Loading...'}</h2>
            <p className="text-muted-foreground">{totalQuestions} questions · {timePerQ}s per question</p>
            <Button size="lg" onClick={startGame} disabled={items.length === 0} className="w-full">
              Start Game
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Finished screen
  if (gameFinished) {
    const pct = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <Card className="max-w-md mx-auto">
            <CardContent className="p-8 text-center space-y-5">
              <Trophy className="w-16 h-16 text-warning mx-auto" />
              <h2 className="text-2xl font-bold text-foreground">Game Complete!</h2>
              <div className="space-y-2 text-lg">
                <p className="text-foreground">Score: <span className="font-bold text-primary">{score}/{totalQuestions}</span> ({pct}%)</p>
                <p className="text-foreground flex items-center justify-center gap-1">
                  <Flame className="w-5 h-5 text-destructive" /> Best Streak: <span className="font-bold">{bestStreak}</span>
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={onBack} className="flex-1">Back to Games</Button>
                <Button onClick={startGame} className="flex-1">Play Again</Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Gameplay
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-2" />Quit</Button>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1 text-destructive font-medium"><Flame className="w-4 h-4" />{streak}</span>
          <span className="text-muted-foreground font-medium">{currentIndex + 1}/{totalQuestions}</span>
        </div>
      </div>

      {/* Timer bar */}
      <Progress value={(timeLeft / timePerQ) * 100} className="h-2" />

      <AnimatePresence mode="wait">
        <motion.div key={currentIndex} initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} transition={{ duration: 0.2 }}>
          <Card className="max-w-lg mx-auto">
            <CardContent className="p-6 space-y-4">
              {/* Image */}
              <div className="w-full aspect-square max-h-64 rounded-xl overflow-hidden bg-muted flex items-center justify-center mx-auto">
                {currentItem && (
                  <img src={currentItem.image_url} alt="Vocabulary" className="w-full h-full object-contain" />
                )}
              </div>

              {/* Timer display */}
              <p className="text-center text-2xl font-bold text-foreground">{timeLeft}s</p>

              {/* Answer input */}
              <form onSubmit={(e) => { e.preventDefault(); checkAnswer(); }} className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={answer}
                  onChange={e => setAnswer(e.target.value)}
                  placeholder="Type your answer..."
                  disabled={!!feedback}
                  className="flex-1 text-lg"
                  autoComplete="off"
                />
                <Button type="submit" disabled={!answer.trim() || !!feedback}>Submit</Button>
              </form>

              {/* Feedback */}
              <AnimatePresence>
                {feedback && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl text-lg font-semibold ${
                      feedback === 'correct'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-destructive/10 text-destructive'
                    }`}
                  >
                    {feedback === 'correct' ? (
                      <><CheckCircle className="w-6 h-6" />Correct!</>
                    ) : (
                      <><XCircle className="w-6 h-6" />Incorrect — {currentItem?.main_answer}</>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default VocabGamePlay;
