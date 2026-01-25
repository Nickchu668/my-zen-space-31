import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Clock, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: 'admin' | 'premium' | 'member';
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, role, loading, isAdmin, isPremium, isApproved, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">載入中...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Admin always has access
  if (isAdmin) {
    return <>{children}</>;
  }

  // Check if user is approved (non-admins must be approved)
  if (!isApproved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6 p-8 max-w-md mx-auto">
        <div className="w-20 h-20 rounded-full bg-warning/10 flex items-center justify-center mx-auto">
          <Clock className="w-10 h-10 text-warning" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-2">等待審核中</h1>
            <p className="text-muted-foreground">
              你的帳戶正在等待管理員審核批准。<br />
              審核通過後即可使用系統功能。
            </p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => signOut()}
            className="mt-4"
          >
            登出
          </Button>
        </div>
      </div>
    );
  }

  if (requiredRole) {
    const hasAccess = 
      requiredRole === 'member' ||
      (requiredRole === 'premium' && isPremium) ||
      (requiredRole === 'admin' && isAdmin);

    if (!hasAccess) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center space-y-6 p-8 max-w-md mx-auto">
            <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-10 h-10 text-destructive" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-2">權限不足</h1>
              <p className="text-muted-foreground">你沒有權限訪問此頁面</p>
            </div>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}
