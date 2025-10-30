"use client";

import React from 'react';
import { GitBranch } from 'lucide-react';

export function RepoHeader({ repo, onBack }) {
  if (!repo) return null;

  return (
    <header className="border-b border-border">
      <div className="w-full h-16 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <GitBranch className="h-6 w-6 text-primary" />
            <span className="text-xl font-semibold">Git Diary</span>
          </div>
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            ← Back
          </button>
        </div>
        <a
          href={repo.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          {repo.url}
        </a>
      </div>
    </header>
  );
}

export default RepoHeader;


