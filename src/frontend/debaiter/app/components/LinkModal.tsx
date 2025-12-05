'use client';

import { useState } from 'react';

type LinkModalProp = {
  isOpen: boolean;
  opponentLink: string;
};

function LinkModal({ isOpen, opponentLink }: LinkModalProp) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(opponentLink);
      setCopied(true);
      // Reset the "Copied" state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
        
        {/* Header */}
        <div className="p-6 text-center border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
            <ShareIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
            Challenge an Opponent
          </h2>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Share the unique link below to invite someone to this debate.
          </p>
        </div>

        {/* Body */}
        <div className="p-6">
          <label className="mb-2 block text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
            Debate Link
          </label>
          
          <div className="flex gap-2">
            <div className="relative flex-grow">
              <input
                type="text"
                readOnly
                value={opponentLink}
                className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"
              />
            </div>
            
            <button
              onClick={handleCopy}
              className={`flex min-w-[100px] items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 
                ${copied 
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                  : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
                }`}
            >
              {copied ? (
                <>
                  <CheckIcon className="h-4 w-4" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <CopyIcon className="h-4 w-4" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer / Status */}
        <div className="flex items-center justify-center gap-2 bg-zinc-50 py-4 text-xs font-medium text-zinc-500 dark:bg-zinc-800/50 dark:text-zinc-400 border-t border-zinc-100 dark:border-zinc-800">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-500"></span>
          </span>
          Waiting for opponent to join...
        </div>
      </div>
    </div>
  );
}

// --- Icons ---

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" x2="15.42" y1="13.51" y2="17.49" />
      <line x1="15.41" x2="8.59" y1="6.51" y2="10.49" />
    </svg>
  );
}

export default LinkModal;