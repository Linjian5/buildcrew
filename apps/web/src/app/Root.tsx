import { useState, useEffect } from 'react';
import { Outlet, Navigate } from 'react-router';
import { Toaster } from 'sonner';
import { TopNav } from './components/TopNav';
import { CommandPalette } from './components/common/CommandPalette';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ChatPanel } from './components/chat/ChatPanel';
import { useAuth } from '../contexts/AuthContext';
import { useChat } from '../contexts/ChatContext';

export default function Root() {
  const { isAuthenticated, isLoading } = useAuth();
  const { chatOpen, closeChat, chatAgentId, chatAgentName, chatAgentDepartment } = useChat();
  const [commandOpen, setCommandOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Watch for dark class changes on <html>
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Show nothing while checking auth state
  if (isLoading) {
    return (
      <div className="dark flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <TopNav onSearchClick={() => setCommandOpen(true)} />
      <main className="flex-1 min-h-0">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
      <ChatPanel
        open={chatOpen}
        onOpenChange={(open) => { if (!open) closeChat(); }}
        agentId={chatAgentId ?? undefined}
        agentName={chatAgentName ?? undefined}
        agentDepartment={chatAgentDepartment ?? undefined}
      />
      <Toaster
        theme={isDark ? 'dark' : 'light'}
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--card)',
            border: '1px solid var(--border)',
            color: 'var(--foreground)',
          },
        }}
      />
    </div>
  );
}
