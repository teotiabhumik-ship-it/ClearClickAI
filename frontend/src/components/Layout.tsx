import React from 'react';
import { NavLink, Link, Outlet } from 'react-router-dom';
import { ShieldCheck, Search, BookOpen, Info, Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export const Layout: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-surface dark:bg-[#0B1220] font-sans text-on-surface dark:text-[#E2E8F0] flex flex-col transition-colors duration-150">
      {/* 1. Accessible Skip Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-on-primary focus:rounded-lg focus:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary text-sm font-semibold"
      >
        Skip to main content
      </a>

      {/* 2. Top Header */}
      <header className="fixed top-0 inset-x-0 z-40 bg-surface/85 dark:bg-[#0B1220]/85 backdrop-blur-xl pt-safe border-b border-outline-variant/20 dark:border-[#26324A] shadow-[0_1px_8px_rgba(0,0,0,0.03)]">
        <div className="h-14 max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          {/* Logo / Brand */}
          <Link
            to="/"
            className="flex items-center gap-2 group select-none outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg px-1 py-0.5"
          >
            <ShieldCheck className="w-6 h-6 text-primary dark:text-[#2DD4BF]" aria-hidden="true" />
            <span className="font-bold text-lg text-on-surface dark:text-[#E2E8F0] tracking-tight">ClearClick</span>
            <span className="text-xs font-mono uppercase bg-primary-fixed dark:bg-[#2DD4BF]/20 text-primary dark:text-[#2DD4BF] px-2 py-0.5 rounded-full font-semibold ml-1">
              AI Auditor
            </span>
          </Link>

          {/* Desktop Navigation (>= 640px) */}
          <div className="flex items-center gap-2 sm:gap-4">
            <nav aria-label="Main" className="hidden sm:flex items-center gap-1">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-primary-container text-on-primary-container dark:bg-[#2DD4BF]/20 dark:text-[#2DD4BF] font-semibold'
                      : 'text-on-surface-variant dark:text-[#94A3B8] hover:text-on-surface dark:hover:text-[#E2E8F0] hover:bg-surface-container/60 dark:hover:bg-[#111A2E]'
                  }`
                }
              >
                Analyse
              </NavLink>

              <NavLink
                to="/methodology"
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-primary-container text-on-primary-container dark:bg-[#2DD4BF]/20 dark:text-[#2DD4BF] font-semibold'
                      : 'text-on-surface-variant dark:text-[#94A3B8] hover:text-on-surface dark:hover:text-[#E2E8F0] hover:bg-surface-container/60 dark:hover:bg-[#111A2E]'
                  }`
                }
              >
                Methodology
              </NavLink>

              <NavLink
                to="/about"
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-primary-container text-on-primary-container dark:bg-[#2DD4BF]/20 dark:text-[#2DD4BF] font-semibold'
                      : 'text-on-surface-variant dark:text-[#94A3B8] hover:text-on-surface dark:hover:text-[#E2E8F0] hover:bg-surface-container/60 dark:hover:bg-[#111A2E]'
                  }`
                }
              >
                About
              </NavLink>
            </nav>

            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              className="p-2 rounded-lg text-on-surface-variant dark:text-[#94A3B8] hover:text-on-surface dark:hover:text-[#E2E8F0] hover:bg-surface-container dark:hover:bg-[#111A2E] transition-all focus-visible:ring-2 focus-visible:ring-primary"
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5 text-[#2DD4BF]" aria-hidden="true" />
              ) : (
                <Moon className="w-5 h-5 text-on-surface-variant" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* 3. Main Routed Content */}
      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 flex flex-col relative w-full max-w-7xl mx-auto px-4 sm:px-6 pt-20 pb-28 sm:pb-16 outline-none"
      >
        <Outlet />
      </main>

      {/* 4. Shared Footer */}
      <footer className="w-full border-t border-outline-variant/20 dark:border-[#26324A] bg-surface dark:bg-[#0B1220] py-8 px-4 sm:px-6 text-sm">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <nav aria-label="Footer" className="flex items-center gap-6">
            <Link
              to="/"
              className="text-on-surface-variant dark:text-[#94A3B8] hover:text-on-surface dark:hover:text-[#E2E8F0] transition-colors"
            >
              Analyse
            </Link>
            <Link
              to="/methodology"
              className="text-on-surface-variant dark:text-[#94A3B8] hover:text-on-surface dark:hover:text-[#E2E8F0] transition-colors"
            >
              Methodology
            </Link>
            <Link
              to="/about"
              className="text-on-surface-variant dark:text-[#94A3B8] hover:text-on-surface dark:hover:text-[#E2E8F0] transition-colors"
            >
              About
            </Link>
          </nav>

          <p className="text-xs text-on-surface-variant dark:text-[#94A3B8] text-center sm:text-right max-w-md">
            ClearClick AI findings are automated warnings for human review, not legal conclusions.
          </p>
        </div>
      </footer>

      {/* 5. Bottom Mobile Tab Navigation (< 640px) */}
      <nav
        aria-label="Main"
        className="sm:hidden fixed bottom-0 inset-x-0 z-40 pb-safe bg-surface/90 dark:bg-[#0B1220]/90 backdrop-blur-xl border-t border-outline-variant/20 dark:border-[#26324A] shadow-[0_-1px_8px_rgba(0,0,0,0.04)]"
      >
        <div className="flex justify-around items-center h-16 max-w-md mx-auto px-4">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 w-20 h-12 rounded-xl transition-all ${
                isActive
                  ? 'bg-primary-container text-on-primary-container dark:bg-[#2DD4BF]/20 dark:text-[#2DD4BF] font-semibold'
                  : 'text-on-surface-variant dark:text-[#94A3B8] hover:text-on-surface dark:hover:text-[#E2E8F0]'
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
                  ? 'bg-primary-container text-on-primary-container dark:bg-[#2DD4BF]/20 dark:text-[#2DD4BF] font-semibold'
                  : 'text-on-surface-variant dark:text-[#94A3B8] hover:text-on-surface dark:hover:text-[#E2E8F0]'
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
                  ? 'bg-primary-container text-on-primary-container dark:bg-[#2DD4BF]/20 dark:text-[#2DD4BF] font-semibold'
                  : 'text-on-surface-variant dark:text-[#94A3B8] hover:text-on-surface dark:hover:text-[#E2E8F0]'
              }`
            }
          >
            <Info className="w-5 h-5" aria-hidden="true" />
            <span className="text-xs font-medium">About</span>
          </NavLink>
        </div>
      </nav>
    </div>
  );
};
