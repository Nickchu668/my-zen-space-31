import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { 
  FolderOpen, 
  Bot, 
  BookOpen, 
  LogOut, 
  Settings, 
  User,
  Sparkles,
  ChevronLeft,
  Menu
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Page {
  id: string;
  title: string;
  slug: string;
  icon: string;
  description: string | null;
}

const iconMap: Record<string, React.ElementType> = {
  'folder-open': FolderOpen,
  'bot': Bot,
  'book-open': BookOpen,
  'settings': Settings,
};

export function AppSidebar() {
  const [pages, setPages] = useState<Page[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const { profile, role, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    fetchPages();
    
    const handlePagesUpdated = () => {
      fetchPages();
    };
    
    window.addEventListener('pages-updated', handlePagesUpdated);
    return () => {
      window.removeEventListener('pages-updated', handlePagesUpdated);
    };
  }, []);

  const fetchPages = async () => {
    const { data } = await supabase
      .from('pages')
      .select('id, title, slug, icon, description')
      .eq('is_active', true)
      .order('sort_order');
    
    if (data) setPages(data);
  };

  const getRoleBadge = () => {
    switch (role) {
      case 'admin':
        return <Badge className="badge-admin text-xs">管理員</Badge>;
      case 'premium':
        return <Badge className="badge-premium text-xs">高級會員</Badge>;
      default:
        return <Badge className="badge-member text-xs">會員</Badge>;
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <aside 
      className={cn(
        "h-screen sidebar-fun flex flex-col transition-all duration-300 ease-in-out",
        collapsed ? "w-20" : "w-64"
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between">
          <div className={cn("flex items-center gap-3", collapsed && "justify-center w-full")}>
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-soft">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            {!collapsed && (
              <div>
                <h1 className="font-display font-bold text-lg text-sidebar-foreground">
                  我的空間
                </h1>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "text-sidebar-foreground hover:bg-sidebar-accent rounded-lg",
              collapsed && "hidden"
            )}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Toggle button when collapsed */}
      {collapsed && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(false)}
          className="mx-auto my-2 text-sidebar-foreground hover:bg-sidebar-accent rounded-lg"
        >
          <Menu className="w-4 h-4" />
        </Button>
      )}

      {/* User info */}
      <div className={cn("p-4 border-b border-sidebar-border", collapsed && "px-2")}>
        <div className={cn("flex items-center gap-3", collapsed && "flex-col")}>
          <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
            <User className="w-5 h-5 text-accent-foreground" />
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-sidebar-foreground truncate">
                {profile?.display_name || profile?.email?.split('@')[0] || '用戶'}
              </p>
              {getRoleBadge()}
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {pages.map((page) => {
          const IconComponent = iconMap[page.icon] || FolderOpen;
          const isActive = location.pathname === `/app/${page.slug}`;
          
          return (
            <button
              key={page.id}
              onClick={() => navigate(`/app/${page.slug}`)}
              className={cn(
                "w-full nav-item-fun flex items-center gap-3 text-left",
                isActive && "active",
                collapsed && "justify-center px-3"
              )}
              title={collapsed ? page.title : undefined}
            >
              <IconComponent className="w-5 h-5 flex-shrink-0" />
              {!collapsed && (
                <span className="truncate">{page.title}</span>
              )}
            </button>
          );
        })}

        {/* Admin settings */}
        {isAdmin && (
          <button
            onClick={() => navigate('/app/admin')}
            className={cn(
              "w-full nav-item-fun flex items-center gap-3 text-left",
              location.pathname === '/app/admin' && "active",
              collapsed && "justify-center px-3"
            )}
            title={collapsed ? "管理設定" : undefined}
          >
            <Settings className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>管理設定</span>}
          </button>
        )}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border">
        <Button
          variant="ghost"
          onClick={handleLogout}
          className={cn(
            "w-full nav-item-fun flex items-center gap-3 text-destructive hover:text-destructive hover:bg-destructive/10",
            collapsed && "justify-center px-3"
          )}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>登出</span>}
        </Button>
      </div>
    </aside>
  );
}
