import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Brain, Gamepad2, ArrowLeft, SpellCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import VocabGameList from '@/components/brain-gym/VocabGameList';
import SpellingGameList from '@/components/brain-gym/SpellingGameList';

const BrainGym = () => {
  const { isTeacher } = useAuth();
  const [activeModule, setActiveModule] = useState<string | null>(null);

  if (!isTeacher) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-24 space-y-6">
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
            <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto">
              <Brain className="w-12 h-12 text-primary" />
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4 }} className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-foreground">Coming Soon</h1>
            <p className="text-muted-foreground max-w-md">This feature is currently under development and will be available soon.</p>
          </motion.div>
        </div>
      </AppLayout>
    );
  }

  if (activeModule === 'vocabulary') {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setActiveModule(null)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Vocabulary Games</h1>
              <p className="text-muted-foreground text-sm">Learn new words through interactive games</p>
            </div>
          </div>
          <VocabGameList />
        </div>
      </AppLayout>
    );
  }

  if (activeModule === 'spelling') {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setActiveModule(null)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Spelling Challenge</h1>
              <p className="text-muted-foreground text-sm">Practice spelling English words from Vietnamese meanings</p>
            </div>
          </div>
          <SpellingGameList />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Brain className="w-7 h-7 text-primary" />
            Brain Gym
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Mini games to sharpen your English skills</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <Card
              className="cursor-pointer hover:shadow-lg transition-all duration-200 border-2 hover:border-primary/40"
              onClick={() => setActiveModule('vocabulary')}
            >
              <CardContent className="p-6 text-center space-y-3">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Gamepad2 className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">Vocabulary</h3>
                <p className="text-sm text-muted-foreground">Match images with the correct English words</p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
};

export default BrainGym;
