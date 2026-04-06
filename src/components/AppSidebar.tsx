import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, BookOpen, ClipboardList, User, LogOut, GraduationCap, Brain, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import NotificationBell from '@/components/NotificationBell';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface AppSidebarProps {
  onNavigate?: () => void;
}

const AppSidebar = ({ onNavigate }: AppSidebarProps) => {
  const { user, signOut, isTeacher } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const { data: unreadChatCount = 0 } = useQuery({
    queryKey: ['unread-chat-total'],
    queryFn: async () => {
      if (!user) return 0;
      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .eq('read', false);
      if (error) return 0;
      return count || 0;
    },
    enabled: !!user,
    refetchInterval: 5000,
  });

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: ClipboardList, label: 'Assignments', path: '/assignments' },
    { icon: BookOpen, label: 'Lessons', path: '/lessons' },
    { icon: Brain, label: 'Brain Gym', path: '/brain-gym' },
    { icon: Users, label: 'People', path: '/people' },
    { icon: User, label: 'Profile', path: '/profile' },
  ];

  const handleNav = (path: string) => {
    navigate(path);
    onNavigate?.();
  };

  return (
    <aside className={cn(
      "h-screen gradient-hero flex flex-col",
      onNavigate ? "w-full" : "fixed left-0 top-0 w-64 z-50"
    )}>
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-sidebar-foreground">EnglishLMS</h1>
            <p className="text-xs text-sidebar-foreground/60">Learning Platform</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(item => {
          const isActive = location.pathname === item.path;
          const showBadge = item.path === '/people' && unreadChatCount > 0;
          return (
            <button
              key={item.path}
              onClick={() => handleNav(item.path)}
              className={cn(
                'relative w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
              {showBadge && (
                <span className="absolute top-2 left-7 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold">
                  {unreadChatCount > 9 ? '9+' : unreadChatCount}
                </span>
              )}
            </button>
          );
        })}
        <NotificationBell onNavigate={onNavigate} />
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 mb-3">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
          ) : (
            <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-sm font-bold">
              {user?.fullName?.charAt(0) || 'U'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.fullName}</p>
            <p className="text-xs text-sidebar-foreground/60 capitalize">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={async () => { await signOut(); navigate('/'); onNavigate?.(); }}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
};

export default AppSidebar;
