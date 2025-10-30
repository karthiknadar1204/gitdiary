"use client";

import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import ReactMarkdown from 'react-markdown';
import { X } from 'lucide-react';

export function AICopilotPanel({ batches = null, width, onSubmitPrompt, conversations = [], loadingAi = false, onClearSelections }) {
  const [prompt, setPrompt] = useState("");
  return (
    <div className="max-w-[40%] min-w-60 border-l border-border bg-card" style={{ width }}>
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            ✨ AI Copilot
          </h2>
          {batches && batches.length > 0 && conversations.length === 0 && onClearSelections && (
            <button
              onClick={onClearSelections}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent transition-colors"
              aria-label="Clear selections"
            >
              <X className="h-3 w-3" />
            </button>
          )}
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
            {conversations.map((msg, idx) => (
              <div key={idx} className={`p-3 rounded-md ${msg.type === 'user' ? 'bg-primary/10 ml-auto max-w-[85%]' : 'bg-background border border-border mr-auto max-w-[85%]'}`}>
                {msg.type === 'user' ? (
                  <div className="text-xs text-foreground">{msg.content}</div>
                ) : (
                  <div className="text-xs prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown 
                      components={{
                        h1: ({ children }) => <h1 className="text-base font-bold mt-2 mb-1">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-sm font-bold mt-2 mb-1">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-xs font-bold mt-2 mb-1">{children}</h3>,
                        p: ({ children }) => <p className="mb-2">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc ml-4 mb-2">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal ml-4 mb-2">{children}</ol>,
                        li: ({ children }) => <li className="mb-1">{children}</li>,
                        code: ({ children }) => <code className="bg-muted px-1 py-0.5 rounded text-[10px] font-mono">{children}</code>,
                        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            ))}
            {loadingAi && (
              <div className="text-center py-4 text-sm text-muted-foreground">Loading analysis...</div>
            )}
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


