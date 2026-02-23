import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AuthForm } from "@/components/auth/AuthForm";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ResourcesPage } from "@/pages/ResourcesPage";
import { AIWorkPage } from "@/pages/AIWorkPage";
import { NotebookPage } from "@/pages/NotebookPage";
import { AdminPage } from "@/pages/AdminPage";
import { DynamicPage } from "@/pages/DynamicPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AuthenticatedApp() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  return <Navigate to="/app/resources" replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <HashRouter>
          <Routes>
            <Route path="/" element={<AuthenticatedApp />} />
            <Route
              path="/app/resources"
              element={
                <ProtectedRoute>
                  <AppLayout><ResourcesPage /></AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/ai-work"
              element={
                <ProtectedRoute>
                  <AppLayout><AIWorkPage /></AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/notebook"
              element={
                <ProtectedRoute>
                  <AppLayout><NotebookPage /></AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/admin"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AppLayout><AdminPage /></AppLayout>
                </ProtectedRoute>
              }
            />
            {/* Dynamic pages - catches any /app/:slug not matched above */}
            <Route
              path="/app/:slug"
              element={
                <ProtectedRoute>
                  <AppLayout><DynamicPage /></AppLayout>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </HashRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
