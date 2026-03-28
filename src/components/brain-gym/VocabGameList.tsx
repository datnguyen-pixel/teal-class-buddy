import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Play, Trash2, Clock, Image as ImageIcon, Pencil } from 'lucide-react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import CreateVocabGameDialog from './CreateVocabGameDialog';
import VocabGamePlay from './VocabGamePlay';

const VocabGameList = () => {
  const { user, isTeacher } = useAuth();
  const queryClient = useQueryClient();
  const [playingGameId, setPlayingGameId] = useState<string | null>(null);

  const { data: games = [], isLoading } = useQuery({
    queryKey: ['vocab-games'],
    queryFn: async () => {
      const { data: gamesData, error } = await supabase
        .from('vocab_games')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Get item counts
      const { data: items } = await supabase.from('vocab_items').select('game_id');
      const counts: Record<string, number> = {};
      items?.forEach(i => { counts[i.game_id] = (counts[i.game_id] || 0) + 1; });

      return (gamesData || []).map(g => ({ ...g, itemCount: counts[g.id] || 0 }));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('vocab_games').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vocab-games'] });
      toast.success('Game deleted');
    },
  });

  if (playingGameId) {
    return <VocabGamePlay gameId={playingGameId} onBack={() => setPlayingGameId(null)} />;
  }

  return (
    <div className="space-y-4">
      {isTeacher && <CreateVocabGameDialog />}

      {isLoading ? (
        <p className="text-muted-foreground text-center py-8">Loading games...</p>
      ) : games.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          No vocabulary games yet.{isTeacher ? ' Create one to get started!' : ''}
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {games.map((game, i) => (
            <motion.div key={game.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-5 space-y-3">
                  <h3 className="font-semibold text-foreground text-lg">{game.title}</h3>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><ImageIcon className="w-4 h-4" />{game.itemCount} items</span>
                    <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{game.time_per_question}s</span>
                  </div>
                  <div className="flex gap-2 pt-1">
                    {game.itemCount > 0 && (
                      <Button size="sm" onClick={() => setPlayingGameId(game.id)} className="flex-1">
                        <Play className="w-4 h-4 mr-1" /> Play
                      </Button>
                    )}
                    {isTeacher && (
                      <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(game.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VocabGameList;
