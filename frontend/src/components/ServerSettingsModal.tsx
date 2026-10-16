import React, { useState, useEffect } from 'react';
import { Server, CheckCircle2, AlertCircle, RefreshCw, X } from 'lucide-react';
import { getApiBaseUrl, getCustomApiUrl, setCustomApiUrl, buildApiUrl } from '../config/api';

interface ServerSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onServerChanged?: () => void;
}

export const ServerSettingsModal: React.FC<ServerSettingsModalProps> = ({
  isOpen,
  onClose,
  onServerChanged,
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'healthy' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setUrlInput(getCustomApiUrl());
      checkHealth();
    }
  }, [isOpen]);

  const checkHealth = async (overrideUrl?: string) => {
    setTesting(true);
    setStatus('idle');
    setStatusMessage('');

    const targetBase = overrideUrl !== undefined ? overrideUrl.trim().replace(/\/+$/, '') : getApiBaseUrl();
    const healthUrl = targetBase ? `${targetBase}/api/health` : '/api/health';

    try {
      const res = await fetch(healthUrl, { method: 'GET', signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        const data = await res.json();
        setStatus('healthy');
        setStatusMessage(`Connected successfully to ${data.service || 'ClearClick AI Backend'}`);
      } else {
        setStatus('error');
        setStatusMessage(`Server responded with HTTP ${res.status}`);
      }
    } catch (err: any) {
      setStatus('error');
      setStatusMessage('Unable to reach backend server. Ensure service is active and allows CORS.');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = urlInput.trim();
    setCustomApiUrl(clean || null);
    checkHealth(clean);
    onServerChanged?.();
  };

  const handleReset = () => {
    setUrlInput('');
    setCustomApiUrl(null);
    checkHealth('');
    onServerChanged?.();
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="server-settings-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 dark:bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="bg-paper dark:bg-[#111A2E] border border-border-hairline dark:border-[#26324A] rounded-sm shadow-xl max-w-md w-full p-6 text-ink dark:text-[#E2E8F0]">
        <div className="flex items-center justify-between pb-4 border-b border-border-hairline dark:border-[#26324A]">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-ink dark:text-[#2DD4BF]" aria-hidden="true" />
            <h2 id="server-settings-title" className="font-serif text-lg font-semibold">
              Backend Server Connection
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-sm text-ink-muted hover:text-ink dark:hover:text-[#E2E8F0] transition-colors"
            aria-label="Close server settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="mt-4 space-y-4">
          <div>
            <label htmlFor="backend-url-input" className="block text-xs font-mono uppercase tracking-wider text-ink-muted dark:text-[#94A3B8] mb-1">
              API Base URL
            </label>
            <input
              id="backend-url-input"
              type="text"
              placeholder="e.g. http://127.0.0.1:8000 or https://api.yourdomain.com"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-[#0B1220] border border-border-hairline dark:border-[#26324A] rounded-sm focus:outline-none focus:ring-1 focus:ring-ink dark:focus:ring-[#2DD4BF]"
            />
            <p className="mt-1 text-xs text-ink-muted dark:text-[#94A3B8]">
              Leave blank to use the default same-origin address (for localhost or full-stack deployments).
            </p>
          </div>

          {/* Connection Status Box */}
          <div className="p-3 bg-white dark:bg-[#0B1220] border border-border-hairline dark:border-[#26324A] rounded-sm text-xs flex items-start gap-2">
            {testing ? (
              <RefreshCw className="w-4 h-4 text-ink-muted animate-spin shrink-0 mt-0.5" />
            ) : status === 'healthy' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            ) : status === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-pen dark:text-red-400 shrink-0 mt-0.5" />
            ) : (
              <Server className="w-4 h-4 text-ink-muted shrink-0 mt-0.5" />
            )}
            <div className="min-w-0 flex-1">
              <span className="font-semibold block">
                {testing
                  ? 'Testing connection...'
                  : status === 'healthy'
                  ? 'Backend Connected'
                  : status === 'error'
                  ? 'Connection Failed'
                  : 'Status Unknown'}
              </span>
              {statusMessage && <span className="text-ink-muted dark:text-[#94A3B8] break-words">{statusMessage}</span>}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-ink-muted dark:text-[#94A3B8] hover:text-ink dark:hover:text-[#E2E8F0] underline underline-offset-2"
            >
              Reset to Default
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => checkHealth(urlInput)}
                disabled={testing}
                className="px-3 py-1.5 text-xs font-medium border border-border-hairline dark:border-[#26324A] rounded-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                Test
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-medium bg-ink text-paper dark:bg-[#2DD4BF] dark:text-[#0B1220] rounded-sm hover:opacity-90 transition-opacity"
              >
                Save
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
