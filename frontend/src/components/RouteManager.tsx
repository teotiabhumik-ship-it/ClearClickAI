import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const RouteManager: React.FC = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    // 1. Set document.title based on route
    if (pathname === '/') {
      document.title = 'ClearClick AI — Evidence-Based Fair Design Checker';
    } else if (pathname === '/methodology') {
      document.title = 'Methodology — ClearClick AI';
    } else if (pathname === '/about') {
      document.title = 'About — ClearClick AI';
    } else {
      document.title = 'Page Not Found — ClearClick AI';
    }

    // 2. Handle scroll to hash or top
    if (hash) {
      const targetId = hash.replace(/^#/, '');
      // Try immediate lookup, or retry on next tick for DOM mount
      const scrollToElement = () => {
        const el = document.getElementById(targetId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
          return true;
        }
        return false;
      };

      if (!scrollToElement()) {
        const timer = setTimeout(scrollToElement, 100);
        return () => clearTimeout(timer);
      }
    } else {
      window.scrollTo(0, 0);
    }

    // 3. Accessibility: Programmatically focus <h1>
    const timer = setTimeout(() => {
      const h1 = document.querySelector('main h1') as HTMLElement | null;
      if (h1) {
        if (!h1.hasAttribute('tabindex')) {
          h1.setAttribute('tabindex', '-1');
        }
        h1.focus({ preventScroll: Boolean(hash) });
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [pathname, hash]);

  return null;
};
