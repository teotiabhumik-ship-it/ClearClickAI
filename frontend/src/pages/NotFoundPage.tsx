import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileQuestion } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4 max-w-lg mx-auto">
      <div className="w-16 h-16 rounded-2xl bg-surface-container border border-outline-variant/40 flex items-center justify-center text-on-surface-variant mb-6">
        <FileQuestion className="w-8 h-8" aria-hidden="true" />
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight mb-3 outline-none">
        Page not found
      </h1>

      <p className="text-on-surface-variant text-sm sm:text-base leading-relaxed mb-8">
        The link you followed does not exist or may have been moved. You can return to the page analyser to run a check.
      </p>

      <Link
        to="/"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-on-primary font-semibold text-sm hover:opacity-95 transition-opacity focus-visible:ring-2 focus-visible:ring-primary"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        <span>Return to page analyser</span>
      </Link>
    </div>
  );
};
