import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Trash2, Type, Pencil } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import CreateSpellingGameDialog from './CreateSpellingGameDialog';
import SpellingGamePlay from './SpellingGamePlay';

const SpellingGameList = () => {
  const { isTeacher } = useAuth();
  const queryClient = useQueryClient();
  const [playingGameId, setPlayingGameId] = useState<string | null>(null);

  const { data: games = [], isLoading } = useQuery({
    queryKey: ['spelling-games'],
    queryFn: async () => {
      const { data: gamesData, error } = await supabase
        .from('spelling_games')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const { data: allItems } = await supabase.from('spelling_items').select('*').order('sort_order');
      const itemsByGame: Record<string, typeof allItems> = {};
      allItems?.forEach(i => {
        if (!itemsByGame[i.game_id]) itemsByGame[i.game_id] = [];
        itemsByGame[i.game_id]!.push(i);
      });

      return (gamesData || []).map(g => ({
        ...g,
        itemCount: itemsByGame[g.id]?.length || 0,
        items: itemsByGame[g.id] || [],
      }));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('spelling_games').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spelling-games'] });
      toast.success('Game deleted');
    },
  });

  if (playingGameId) {
    return <SpellingGamePlay gameId={playingGameId} onBack={() => setPlayingGameId(null)} />;
  }

  return (
    <div className="space-y-4">
      {isTeacher && <CreateSpellingGameDialog />}

      {isLoading ? (
        <p className="text-muted-foreground text-center py-8">Loading games...</p>
      ) : games.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          No spelling games yet.{isTeacher ? ' Create one to get started!' : ''}
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {games.map((game, i) => (
            <motion.div key={game.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-5 space-y-3">
                  <h3 className="font-semibold text-foreground text-lg">{game.title}</h3>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Type className="w-4 h-4" />{game.itemCount} words</span>
                  </div>
                  <div className="flex gap-2 pt-1">
                    {game.itemCount > 0 && (
                      <Button size="sm" onClick={() => setPlayingGameId(game.id)} className="flex-1">
                        <Play className="w-4 h-4 mr-1" /> Play
                      </Button>
                    )}
                    {isTeacher && (
                      <>
                        <CreateSpellingGameDialog
                          editGame={{ id: game.id, title: game.title, items: game.items }}
                          trigger={<Button size="sm" variant="outline"><Pencil className="w-4 h-4" /></Button>}
                        />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="destructive"><Trash2 className="w-4 h-4" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete this spelling game?</AlertDialogTitle>
                              <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(game.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
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

export default SpellingGameList;
