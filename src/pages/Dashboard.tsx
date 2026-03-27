import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClipboardList, BookOpen, Users, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const Dashboard = () => {
  const { user, isTeacher } = useAuth();
  const navigate = useNavigate();

  const { data: assignments = [] } = useQuery({
    queryKey: ['assignments'],
    queryFn: async () => {
      const { data } = await supabase.from('assignments').select('*').order('created_at', { ascending: false });
      return data || [];
    },
  });

  const { data: lessons = [] } = useQuery({
    queryKey: ['lessons-edited-count'],
    queryFn: async () => {
      const { data } = await supabase.from('lessons').select('id').eq('is_edited', true);
      return data || [];
    },
  });

  const { data: submissions = [] } = useQuery({
    queryKey: ['all-submissions'],
    queryFn: async () => {
      const { data } = await supabase.from('submissions').select('grade');
      return data || [];
    },
    enabled: isTeacher,
  });

  const avgGrade = submissions.length > 0
    ? Math.round(submissions.filter(s => s.grade !== null).reduce((sum, s) => sum + (s.grade || 0), 0) / Math.max(submissions.filter(s => s.grade !== null).length, 1))
    : 0;

  const stats = [
    { icon: ClipboardList, label: 'Assignments', value: assignments.length, color: 'text-primary' },
    { icon: BookOpen, label: 'Lessons Taught', value: lessons.length, color: 'text-info' },
    { icon: Users, label: 'Students', value: '\n', color: 'text-success' },
    { icon: TrendingUp, label: 'Avg. Grade', value: avgGrade ? `${avgGrade}%` : 'N/A', color: 'text-warning' },
  ];

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } };
  const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

  return (
    <AppLayout>
      <motion.div variants={container} initial="hidden" animate="show">
        <motion.div variants={item} className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">
            Welcome back, {user?.fullName?.split(' ')[0]} 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            {isTeacher ? "Here's your class overview" : "Here's what's happening in your class"}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map(stat => (
            <motion.div key={stat.label} variants={item}>
              <Card className="shadow-card hover:shadow-elevated transition-shadow duration-300">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                      <p className="text-2xl font-bold mt-1">{stat.value}</p>
                    </div>
                    <div className={`w-11 h-11 rounded-xl bg-secondary flex items-center justify-center ${stat.color}`}>
                      <stat.icon className="w-5 h-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <motion.div variants={item}>
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-lg">Recent Assignments</CardTitle>
              <button onClick={() => navigate('/assignments')} className="text-sm text-primary font-medium hover:underline">
                View all →
              </button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {assignments.slice(0, 5).map(assignment => (
                  <div key={assignment.id} className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                    <div>
                      <p className="font-medium text-sm">{assignment.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Due: {new Date(assignment.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                ))}
                {assignments.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No assignments yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AppLayout>
  );
};

export default Dashboard;
