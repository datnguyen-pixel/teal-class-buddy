import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Check, X, Trophy, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const playSound = (type: 'correct' | 'wrong' | 'complete') => {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.value = 0.1;
    if (type === 'correct') { osc.frequency.value = 880; osc.type = 'sine'; }
    else if (type === 'wrong') { osc.frequency.value = 220; osc.type = 'sawtooth'; }
    else { osc.frequency.value = 660; osc.type = 'sine'; }
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {}
};

interface SpellingItem {
  id: string;
  vietnamese_text: string;
  english_word: string;
  sort_order: number;
}

interface Props {
  gameId: string;
  onBack: () => void;
}

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';

function getLetterOptions(correctLetter: string): string[] {
  const lower = correctLetter.toLowerCase();
  const options = new Set<string>([lower]);
  while (options.size < 4) {
    options.add(ALPHABET[Math.floor(Math.random() * 26)]);
  }
  return shuffle([...options]);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const SpellingGamePlay = ({ gameId, onBack }: Props) => {
  const [started, setStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [letterIndex, setLetterIndex] = useState(0);
  const [filledLetters, setFilledLetters] = useState<string[]>([]);
  const [madeMistake, setMadeMistake] = useState(false);
  const [wrongLetter, setWrongLetter] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [letterOptions, setLetterOptions] = useState<string[]>([]);
  const [wordComplete, setWordComplete] = useState(false);

  const { data: game } = useQuery({
    queryKey: ['spelling-game', gameId],
    queryFn: async () => {
      const { data, error } = await supabase.from('spelling_games').select('*').eq('id', gameId).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ['spelling-items', gameId],
    queryFn: async () => {
      const { data, error } = await supabase.from('spelling_items').select('*').eq('game_id', gameId).order('sort_order');
      if (error) throw error;
      return (data || []) as SpellingItem[];
    },
  });

  const currentItem = items[currentIndex];
  const word = currentItem?.english_word.toLowerCase() || '';

  useEffect(() => {
    if (started && currentItem && letterIndex < word.length) {
      setLetterOptions(getLetterOptions(word[letterIndex]));
    }
  }, [started, currentIndex, letterIndex, currentItem, word]);

  const handleLetterClick = useCallback((letter: string) => {
    if (wordComplete) return;
    const correct = word[letterIndex];
    if (letter === correct) {
      playSound('correct');
      const newFilled = [...filledLetters, letter];
      setFilledLetters(newFilled);
      setWrongLetter(null);

      if (newFilled.length === word.length) {
        // Word complete
        setWordComplete(true);
        if (!madeMistake) {
          setScore(s => s + 1);
        }
        setTimeout(() => {
          if (currentIndex + 1 < items.length) {
            setCurrentIndex(i => i + 1);
            setLetterIndex(0);
            setFilledLetters([]);
            setMadeMistake(false);
            setWordComplete(false);
          } else {
            playSound('complete');
            setFinished(true);
          }
        }, 1000);
      } else {
        setLetterIndex(letterIndex + 1);
      }
    } else {
      playSound('wrong');
      setMadeMistake(true);
      setWrongLetter(letter);
    }
  }, [word, letterIndex, filledLetters, madeMistake, currentIndex, items.length, wordComplete]);

  const startGame = () => {
    setStarted(true);
    setCurrentIndex(0);
    setLetterIndex(0);
    setFilledLetters([]);
    setMadeMistake(false);
    setWrongLetter(null);
    setScore(0);
    setFinished(false);
    setWordComplete(false);
  };

  if (!game || items.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (finished) {
    const pct = Math.round((score / items.length) * 100);
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-6">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <Trophy className="w-10 h-10 text-primary" />
          </div>
        </motion.div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-foreground">Game Complete!</h2>
          <p className="text-lg text-muted-foreground">{score} / {items.length} words spelled correctly ({pct}%)</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
          <Button onClick={startGame}><RotateCcw className="w-4 h-4 mr-1" /> Play Again</Button>
        </div>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-6">
        <h2 className="text-2xl font-bold text-foreground">{game.title}</h2>
        <p className="text-muted-foreground">{items.length} words to spell</p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
          <Button onClick={startGame}>Start Game</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-5 h-5" /></Button>
        <span className="text-sm text-muted-foreground font-medium">{currentIndex + 1} / {items.length}</span>
        <span className="text-sm font-semibold text-primary">Score: {score}</span>
      </div>

      <Progress value={((currentIndex) / items.length) * 100} className="h-2" />

      <AnimatePresence mode="wait">
        <motion.div key={currentIndex} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.25 }}>
          <Card>
            <CardContent className="p-6 space-y-6 text-center">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Vietnamese</p>
                <p className="text-xl font-semibold text-foreground">{currentItem.vietnamese_text}</p>
              </div>

              {/* Letter slots */}
              <div className="flex justify-center gap-2 flex-wrap">
                {word.split('').map((char, i) => (
                  <div
                    key={i}
                    className={`w-10 h-12 rounded-lg border-2 flex items-center justify-center text-lg font-bold transition-all ${
                      i < filledLetters.length
                        ? 'border-primary bg-primary/10 text-primary'
                        : i === letterIndex && !wordComplete
                        ? 'border-primary/50 bg-primary/5'
                        : 'border-border bg-muted/30 text-muted-foreground'
                    }`}
                  >
                    {i < filledLetters.length ? filledLetters[i] : ''}
                  </div>
                ))}
              </div>

              {/* Letter options */}
              {!wordComplete && (
                <div className="flex justify-center gap-3">
                  {letterOptions.map((letter) => {
                    const isWrong = wrongLetter === letter;
                    const isCorrectHighlight = wrongLetter && letter === word[letterIndex];
                    return (
                      <motion.button
                        key={letter}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleLetterClick(letter)}
                        className={`w-14 h-14 rounded-xl text-xl font-bold transition-all uppercase ${
                          isWrong
                            ? 'bg-destructive/20 text-destructive border-2 border-destructive'
                            : isCorrectHighlight
                            ? 'bg-pink-100 text-pink-600 border-2 border-pink-400 animate-pulse'
                            : 'bg-secondary text-secondary-foreground border-2 border-border hover:border-primary hover:bg-primary/10'
                        }`}
                      >
                        {letter}
                      </motion.button>
                    );
                  })}
                </div>
              )}

              {wordComplete && (
                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center justify-center gap-2">
                  {madeMistake ? (
                    <span className="text-orange-500 font-medium flex items-center gap-1"><X className="w-5 h-5" /> No points</span>
                  ) : (
                    <span className="text-primary font-medium flex items-center gap-1"><Check className="w-5 h-5" /> +1 point!</span>
                  )}
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default SpellingGamePlay;
