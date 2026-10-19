import React, { useState } from 'react';
import { NavLink, Link, Outlet } from 'react-router-dom';
import { Search, BookOpen, Info, Server } from 'lucide-react';
import { ServerSettingsModal } from './ServerSettingsModal';
import { Logo } from './Logo';

export const Layout: React.FC = () => {
  const [isServerModalOpen, setIsServerModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-paper font-sans text-ink flex flex-col">
      {/* 1. Accessible Skip Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-ink focus:text-paper focus:rounded-sm focus:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 text-sm font-semibold"
      >
        Skip to main content
      </a>

      {/* 2. Top Header */}
      <header className="fixed top-0 inset-x-0 z-40 bg-paper/95 backdrop-blur-xl pt-safe border-b border-border-hairline shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div className="h-16 max-w-[1360px] mx-auto px-4 sm:px-6 flex items-center justify-between">
          {/* Logo / Brand */}
          <div className="flex items-center gap-4 sm:gap-6">
            <Link
              to="/"
              className="flex items-center gap-2 group select-none outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded px-1 py-0.5"
            >
              <Logo className="w-8 h-8 shrink-0 transition-transform group-hover:scale-105" />
              <div className="flex items-baseline gap-1.5">
                <span className="font-serif text-xl font-semibold tracking-tight text-ink">
                  ClearClick
                </span>
                <span className="font-mono text-xs uppercase tracking-widest text-amber-700 font-bold">
                  AI
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation (>= 640px) */}
          <div className="flex items-center gap-3 sm:gap-4">
            <nav aria-label="Main" className="hidden sm:flex items-center gap-2 text-sm text-ink-muted">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg transition-all font-mono text-xs ${
                    isActive
                      ? 'bg-amber-400/20 text-stone-900 border border-amber-400/40 font-semibold shadow-xs'
                      : 'text-ink-muted hover:text-ink hover:bg-black/5'
                  }`
                }
              >
                Analyse
              </NavLink>

              <NavLink
                to="/methodology"
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg transition-all font-mono text-xs ${
                    isActive
                      ? 'bg-amber-400/20 text-stone-900 border border-amber-400/40 font-semibold shadow-xs'
                      : 'text-ink-muted hover:text-ink hover:bg-black/5'
                  }`
                }
              >
                Methodology
              </NavLink>

              <NavLink
                to="/about"
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg transition-all font-mono text-xs ${
                    isActive
                      ? 'bg-amber-400/20 text-stone-900 border border-amber-400/40 font-semibold shadow-xs'
                      : 'text-ink-muted hover:text-ink hover:bg-black/5'
                  }`
                }
              >
                About
              </NavLink>
            </nav>

            {/* Server Settings Button */}
            <button
              type="button"
              onClick={() => setIsServerModalOpen(true)}
              aria-label="Configure backend server connection"
              title="Backend Server Connection"
              className="p-1.5 rounded-lg border border-border-hairline bg-white text-ink-muted hover:text-ink transition-colors focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              <Server className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* 3. Main Routed Content */}
      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 flex flex-col relative w-full max-w-[1360px] mx-auto px-4 sm:px-6 pt-20 pb-28 sm:pb-16 outline-none"
      >
        {/* Subtle warm paper lamp glow in top-center */}
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[720px] h-[360px] bg-amber-400/10 rounded-full blur-[120px] pointer-events-none" />
        <Outlet />
      </main>

      {/* 4. Shared Footer */}
      <footer className="w-full border-t border-border-hairline bg-paper py-6 px-4 sm:px-6 text-sm text-ink-muted">
        <div className="max-w-[1360px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <nav aria-label="Footer" className="flex items-center gap-6 text-sm">
            <Link
              to="/"
              className="hover:text-ink transition-colors"
            >
              Analyse
            </Link>
            <Link
              to="/methodology"
              className="hover:text-ink transition-colors"
            >
              Methodology
            </Link>
            <Link
              to="/about"
              className="hover:text-ink transition-colors"
            >
              About
            </Link>
          </nav>

          <p className="text-xs text-center sm:text-right font-mono text-ink-muted">
            ClearClick AI • Automated interface warnings for consumer evaluation, not legal conclusions.
          </p>
        </div>
      </footer>

      {/* 5. Bottom Mobile Tab Navigation (< 640px) */}
      <nav
        aria-label="Main"
        className="sm:hidden fixed bottom-0 inset-x-0 z-40 pb-safe bg-surface/90 backdrop-blur-xl border-t border-outline-variant/20 shadow-[0_-1px_8px_rgba(0,0,0,0.04)]"
      >
        <div className="flex justify-around items-center h-16 max-w-md mx-auto px-4">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 w-20 h-12 rounded-xl transition-all ${
                isActive
                  ? 'bg-amber-400/20 text-stone-900 font-semibold'
                  : 'text-ink-muted hover:text-ink'
              }`
            }
          >
            <Search className="w-5 h-5" aria-hidden="true" />
            <span className="text-xs font-medium">Analyse</span>
          </NavLink>

          <NavLink
            to="/methodology"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 w-20 h-12 rounded-xl transition-all ${
                isActive
                  ? 'bg-amber-400/20 text-stone-900 font-semibold'
                  : 'text-ink-muted hover:text-ink'
              }`
            }
          >
            <BookOpen className="w-5 h-5" aria-hidden="true" />
            <span className="text-xs font-medium">Methodology</span>
          </NavLink>

          <NavLink
            to="/about"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 w-20 h-12 rounded-xl transition-all ${
                isActive
                  ? 'bg-amber-400/20 text-stone-900 font-semibold'
                  : 'text-ink-muted hover:text-ink'
              }`
            }
          >
            <Info className="w-5 h-5" aria-hidden="true" />
            <span className="text-xs font-medium">About</span>
          </NavLink>
        </div>
      </nav>

      {/* Backend Server Settings Modal */}
      <ServerSettingsModal
        isOpen={isServerModalOpen}
        onClose={() => setIsServerModalOpen(false)}
      />
    </div>
  );
};
