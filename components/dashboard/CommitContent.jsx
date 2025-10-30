"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { ChevronDown, ChevronRight, X } from 'lucide-react';

export function CommitContent({
  selectedFile,
  loadingCommits,
  commits,
  filteredCommits,
  filterType,
  setFilterType,
  lastNValue,
  setLastNValue,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  hashFrom,
  setHashFrom,
  hashTo,
  setHashTo,
  expandedCommits,
  onToggleCommit,
  commitDetails,
  selectedCommitIds,
  selectedCommitFiles,
  onToggleCommitSelect,
  onToggleFileSelect,
  onSelectAllCommitsForFile,
  onSubmitSelection,
  maxFilesPerRequest,
  currentSelectedFileCount,
}) {
  if (!selectedFile) {
    return (
      <div className="p-8">
        <h2 className="text-2xl font-bold mb-2">Select a file to view history</h2>
        <p className="text-muted-foreground">Choose a file from the left panel.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto w-full min-w-0">
      <div className="p-8 max-w-full w-full min-w-0">
        <div className="mb-4 flex items-center gap-3">
          <h2 className="text-2xl font-bold truncate">Commit History: {selectedFile}</h2>
          {!loadingCommits && commits.length > 0 && (
            <div className="ml-auto">
              <Button
                onClick={onSubmitSelection}
                className="h-9 px-4"
                disabled={currentSelectedFileCount === 0}
              >
                Submit
              </Button>
            </div>
          )}
        </div>

        {!loadingCommits && commits.length > 0 && (
          <div className="mb-6 p-4 border border-border rounded-lg bg-card">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Filter:</span>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All commits</SelectItem>
                    <SelectItem value="lastN">Last N commits</SelectItem>
                    <SelectItem value="dateRange">Date range</SelectItem>
                    <SelectItem value="hashRange">Hash range</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {filterType === 'lastN' && (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="1"
                    value={lastNValue}
                    onChange={(e) => setLastNValue(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20"
                    placeholder="10"
                  />
                  <span className="text-sm text-muted-foreground">commits</span>
                </div>
              )}

              {filterType === 'dateRange' && (
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-40"
                  />
                  <span className="text-sm text-muted-foreground">to</span>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-40"
                  />
                </div>
              )}

              {filterType === 'hashRange' && (
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    value={hashFrom}
                    onChange={(e) => setHashFrom(e.target.value)}
                    className="w-32 font-mono text-xs"
                    placeholder="From hash"
                  />
                  <span className="text-sm text-muted-foreground">to</span>
                  <Input
                    type="text"
                    value={hashTo}
                    onChange={(e) => setHashTo(e.target.value)}
                    className="w-32 font-mono text-xs"
                    placeholder="To hash"
                  />
                </div>
              )}

              {filterType !== 'all' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilterType('all');
                    setLastNValue(50);
                    setDateFrom('');
                    setDateTo('');
                    setHashFrom('');
                    setHashTo('');
                  }}
                  className="h-8"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              )}

              <div className="ml-auto text-sm text-muted-foreground">
                Showing <span className="font-medium text-foreground">{filteredCommits.length}</span> of {commits.length} commits
              </div>
            </div>
          </div>
        )}

        {loadingCommits ? (
          <div className="text-muted-foreground">Loading commits...</div>
        ) : commits.length === 0 ? (
          <div className="text-muted-foreground">No commits found for this file.</div>
        ) : filteredCommits.length === 0 ? (
          <div className="text-muted-foreground">No commits match the selected filter.</div>
        ) : (
          <div className="space-y-4 max-w-full w-full min-w-0">
            {filteredCommits.map((commit) => {
              const isExpanded = expandedCommits.has(commit.id);
              const details = commitDetails[commit.id];

              const commitChecked = selectedCommitIds?.has(commit.id);
              const commitFileCount = Array.isArray(commitDetails?.[commit.id]?.filesChanged)
                ? commitDetails[commit.id].filesChanged.length
                : 0;
              const wouldExceedFiles = !commitChecked && (currentSelectedFileCount + commitFileCount) > (maxFilesPerRequest || 10);
              return (
                <div key={commit.id} className="border border-border rounded-lg p-4 max-w-full w-full min-w-0 overflow-x-auto">
                  <div
                    className="cursor-pointer"
                    onClick={() => onToggleCommit(commit, isExpanded, details)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 min-w-0">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <h3 className="font-semibold truncate max-w-full" title={commit.message}>
                            {commit.message && commit.message.length > 80 
                              ? `${commit.message.substring(0, 80)}...` 
                              : commit.message}
                          </h3>
                        </div>
                        <p className="text-sm text-muted-foreground ml-6">
                          {commit.authorName} • {commit.date ? new Date(commit.date).toLocaleDateString() : ''}
                        </p>
                      </div>
                      <span className="text-xs font-mono text-muted-foreground flex-none shrink-0 whitespace-nowrap ml-2">
                        {commit.sha.substring(0, 7)}
                      </span>
                    </div>
                    {commit.filesChanged && Array.isArray(commit.filesChanged) && (
                      <div className="ml-6 mt-2 text-sm text-muted-foreground">
                        {commit.filesChanged.length} file(s) changed
                      </div>
                    )}
                  </div>

                  {isExpanded && details && (
                    <div className="mt-4 pt-4 border-t border-border space-y-4">
                      {details.filesChanged && Array.isArray(details.filesChanged) && details.filesChanged.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-2 text-sm">Files Changed:</h4>
                          <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                            {details.filesChanged.map((file, idx) => (
                              <div key={idx} className="bg-card border border-border rounded p-3 w-full min-w-0">
                                <div className="flex items-center justify-between mb-2 gap-2 min-w-0">
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <input
                                      type="checkbox"
                                      className="flex-none"
                                      checked={commitChecked || !!selectedCommitFiles?.get(commit.id)?.has(file.filename)}
                                      disabled={commitChecked || (!selectedCommitFiles?.get(commit.id)?.has(file.filename) && currentSelectedFileCount >= (maxFilesPerRequest || 10))}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        onToggleFileSelect(commit.id, file.filename);
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    <span className="text-sm font-mono truncate">{file.filename}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs flex-none">
                                    <span className="text-green-600">+{file.additions}</span>
                                    <span className="text-red-600">-{file.deletions}</span>
                                  </div>
                                </div>
                                {file.patch && (
                                  <details className="mt-2">
                                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                      Show diff
                                    </summary>
                                    <div className="mt-2 text-xs bg-muted p-3 rounded overflow-x-auto max-h-64 overflow-y-auto font-mono leading-relaxed">
                                      {file.patch.split('\n').map((line, lineIdx) => {
                                        const normalizedLine = line.replace(/\t/g, '    ');
                                        if (normalizedLine.startsWith('+') && !normalizedLine.startsWith('+++')) {
                                          return (
                                            <div key={lineIdx} className="text-green-600 bg-green-500/10 whitespace-pre font-mono block">
                                              {normalizedLine}
                                            </div>
                                          );
                                        } else if (normalizedLine.startsWith('-') && !normalizedLine.startsWith('---')) {
                                          return (
                                            <div key={lineIdx} className="text-red-600 bg-red-500/10 whitespace-pre font-mono block">
                                              {normalizedLine}
                                            </div>
                                          );
                                        } else if (normalizedLine.startsWith('@@')) {
                                          return (
                                            <div key={lineIdx} className="text-blue-400 bg-blue-500/20 font-semibold whitespace-pre font-mono block">
                                              {normalizedLine}
                                            </div>
                                          );
                                        } else {
                                          return (
                                            <div key={lineIdx} className="text-muted-foreground whitespace-pre font-mono block">
                                              {normalizedLine}
                                            </div>
                                          );
                                        }
                                      })}
                                    </div>
                                  </details>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default CommitContent;


