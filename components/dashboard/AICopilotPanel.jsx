"use client";

import React, { useState } from 'react';
import { Input } from '@/components/ui/input';

export function AICopilotPanel({ batches = null, width, onSubmitPrompt, aiAnalysis = null, loadingAi = false }) {
  const [prompt, setPrompt] = useState("");
  return (
    <div className="max-w-[40%] min-w-60 border-l border-border bg-card" style={{ width }}>
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            ✨ AI Copilot
          </h2>
        </div>
        {!batches || batches.length === 0 ? (
          <div className="p-8 flex flex-col items-center justify-center flex-1 overflow-y-auto">
            <div className="text-4xl mb-4">✨</div>
            <p className="text-sm font-medium mb-2">Select commits to analyze</p>
            <p className="text-xs text-muted-foreground text-center">
              Select commits from the timeline to get AI-powered analysis.
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-3 flex-1 overflow-y-auto">
            {loadingAi && (
              <div className="text-center py-4 text-sm text-muted-foreground">Loading analysis...</div>
            )}
            {aiAnalysis && (
              <div className="p-3 border border-border rounded-md bg-background">
                <div className="text-xs font-semibold mb-2">AI Analysis:</div>
                <div className="text-xs whitespace-pre-wrap text-muted-foreground">{aiAnalysis}</div>
              </div>
            )}
            {batches.map((batch, idx) => (
              <div key={idx} className="border border-border rounded-md p-3 bg-background">
                <div className="text-xs text-muted-foreground mb-2">
                  Batch {idx + 1} • Tokens ~{batch.tokens} • {batch.summarized ? 'summarized' : 'full'}
                </div>
                <div className="space-y-2">
                  {batch.payload.map((c) => (
                    <div key={c.sha} className="text-xs">
                      <div className="font-medium truncate" title={c.message}>{c.message}</div>
                      <div className="text-muted-foreground">{c.sha.substring(0,7)} • {c.authorName}</div>
                      <div className="text-muted-foreground">{Array.isArray(c.files) ? c.files.length : 0} file(s)</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="p-4 border-t border-border">
          <Input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && prompt && batches) {
                onSubmitPrompt(prompt);
                setPrompt('');
              }
            }}
            placeholder="Add a note or prompt..."
          />
        </div>
      </div>
    </div>
  );
}

export default AICopilotPanel;


