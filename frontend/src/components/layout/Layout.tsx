import { useState, type ReactNode } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { ErrorBoundary } from '../common/ErrorBoundary';

interface LayoutProps {
  children: ReactNode;
  fullWidth?: boolean;
}

export function Layout({ children, fullWidth = false }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Header
        showSidebarToggle
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
      />
      <div className="flex flex-1">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="min-w-0 flex-1">
          <ErrorBoundary sectionName="this page">
            {fullWidth ? (
              children
            ) : (
              <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
                {children}
              </div>
            )}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
