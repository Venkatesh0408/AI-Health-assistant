import { NavLink, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  FileText,
  History,
  Image as ImageIcon,
  Info,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Shield,
  User as UserIcon,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const mainNavItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/chat', label: 'AI Health Chat', icon: MessageSquare },
  { to: '/images', label: 'Image Analysis', icon: ImageIcon },
  { to: '/history', label: 'Health History', icon: History },
  { to: '/reports', label: 'Health Reports', icon: FileText },
];

const accountNavItems = [
  { to: '/profile', label: 'Profile', icon: UserIcon },
  { to: '/privacy', label: 'Privacy & Data', icon: Shield },
  { to: '/about', label: 'About', icon: Info },
];

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    onClose();
    await signOut();
    navigate('/login');
  };

  const navContent = (
    <div className="flex h-full flex-col justify-between bg-white">
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="mb-3 flex items-center justify-between px-2 lg:hidden">
          <span className="text-sm font-semibold text-gray-900">Navigation</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sidebar"
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav aria-label="Main workspace navigation" className="space-y-1">
          {mainNavItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="my-4 border-t border-gray-200" />

        <nav aria-label="Account navigation" className="space-y-1">
          {accountNavItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="border-t border-gray-200 p-3 space-y-2">
        <NavLink
          to="/emergency"
          onClick={onClose}
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors',
              isActive
                ? 'bg-red-600 text-white'
                : 'bg-red-50 text-red-700 hover:bg-red-100'
            )
          }
        >
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Emergency Help</span>
        </NavLink>

        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-red-600 lg:hidden"
        >
          <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop static sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-gray-200 lg:block">
        <div className="sticky top-16 h-[calc(100vh-4rem)]">{navContent}</div>
      </aside>

      {/* Mobile drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-gray-900/50"
            onClick={onClose}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-64 max-w-[80vw] shadow-xl">
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}
