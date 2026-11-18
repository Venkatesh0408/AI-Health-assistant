import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  ChevronDown,
  LogOut,
  Menu,
  Shield,
  User as UserIcon,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface HeaderProps {
  onToggleSidebar?: () => void;
  showSidebarToggle?: boolean;
}

export function Header({
  onToggleSidebar,
  showSidebarToggle = false,
}: HeaderProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    setMenuOpen(false);
    await signOut();
    navigate('/login');
  };

  const displayName =
    user?.display_name || user?.email?.split('@')[0] || 'Account';

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          {showSidebarToggle && onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              aria-label="Toggle navigation sidebar"
              className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}

          <Link
            to={user ? '/dashboard' : '/'}
            className="flex items-center gap-2.5 text-gray-900"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
              <Activity className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="text-base font-bold tracking-tight sm:text-lg">
              AI Health Monitor
            </span>
          </Link>
        </div>

        <nav
          aria-label="Primary navigation"
          className="hidden items-center gap-5 md:flex"
        >
          <Link
            to="/emergency"
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
          >
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            Emergency
          </Link>
          <Link
            to="/about"
            className="text-sm font-medium text-gray-600 transition-colors hover:text-blue-600"
          >
            About
          </Link>
          {user ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-100"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                  {displayName.charAt(0).toUpperCase()}
                </span>
                <span className="max-w-[140px] truncate">{displayName}</span>
                <ChevronDown className="h-4 w-4 text-gray-500" aria-hidden="true" />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-52 rounded-xl border border-gray-200 bg-white py-1.5 shadow-lg"
                >
                  <div className="border-b border-gray-100 px-3.5 py-2">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {displayName}
                    </p>
                    <p className="truncate text-xs text-gray-500">{user.email}</p>
                  </div>
                  <Link
                    to="/profile"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <UserIcon className="h-4 w-4 text-gray-500" aria-hidden="true" />
                    Profile
                  </Link>
                  <Link
                    to="/privacy"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Shield className="h-4 w-4 text-gray-500" aria-hidden="true" />
                    Privacy & Data
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void handleSignOut()}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                to="/login"
                className="text-sm font-medium text-gray-700 hover:text-blue-600"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                Get Started
              </Link>
            </div>
          )}
        </nav>

        {/* Mobile right controls */}
        <div className="flex items-center gap-2 md:hidden">
          <Link
            to="/emergency"
            aria-label="Emergency contacts"
            className="rounded-lg bg-red-50 p-2 text-red-700"
          >
            <AlertTriangle className="h-5 w-5" />
          </Link>
          {!showSidebarToggle && (
            <button
              type="button"
              onClick={() => setMobileNavOpen((prev) => !prev)}
              aria-label="Toggle menu"
              aria-expanded={mobileNavOpen}
              className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
          {showSidebarToggle && user && (
            <Link
              to="/profile"
              aria-label="Profile"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white"
            >
              {displayName.charAt(0).toUpperCase()}
            </Link>
          )}
        </div>
      </div>

      {/* Mobile public dropdown */}
      {!showSidebarToggle && mobileNavOpen && (
        <div className="border-t border-gray-200 bg-white px-4 py-3 md:hidden">
          <div className="flex flex-col gap-2">
            <Link
              to="/emergency"
              onClick={() => setMobileNavOpen(false)}
              className="rounded-lg px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              Emergency Helplines
            </Link>
            <Link
              to="/about"
              onClick={() => setMobileNavOpen(false)}
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              About & Disclaimer
            </Link>
            {user ? (
              <>
                <Link
                  to="/dashboard"
                  onClick={() => setMobileNavOpen(false)}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-center text-sm font-medium text-white"
                >
                  Go to Dashboard
                </Link>
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  className="rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setMobileNavOpen(false)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-center text-sm font-medium text-gray-700"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileNavOpen(false)}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-center text-sm font-medium text-white"
                >
                  Create Account
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
