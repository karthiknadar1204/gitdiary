"use client";

import React from 'react';

export function AICopilotPanel() {
  return (
    <div className="w-80 max-w-[40%] min-w-60 border-l border-border bg-card">
      <div className="h-full overflow-y-auto">
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            ✨ AI Copilot
          </h2>
        </div>
        <div className="p-8 flex flex-col items-center justify-center h-full">
          <div className="text-4xl mb-4">✨</div>
          <p className="text-sm font-medium mb-2">Select commits to analyze</p>
          <p className="text-xs text-muted-foreground text-center">
            Select commits from the timeline to get AI-powered analysis.
          </p>
        </div>
      </div>
    </div>
  );
}

export default AICopilotPanel;


