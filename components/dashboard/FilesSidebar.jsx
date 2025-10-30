"use client";

import React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { ChevronsUpDown, ChevronRight, ChevronDown, Folder, File, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export function FilesSidebar({
  width,
  syncing,
  loadingFiles,
  branches,
  selectedBranch,
  branchOpen,
  setBranchOpen,
  branchSearchQuery,
  setBranchSearchQuery,
  visibleBranchCount,
  setVisibleBranchCount,
  onSelectBranch,
  fileTree,
  expandedFolders,
  toggleFolder,
  selectedFile,
  onFileClick,
}) {
  const renderFileTree = (tree, level = 0, parentPath = '') => {
    const entries = Object.values(tree).sort((a, b) => {
      if (a.type === 'folder' && b.type !== 'folder') return -1;
      if (a.type !== 'folder' && b.type === 'folder') return 1;
      return a.name.localeCompare(b.name);
    });

    return (
      <div>
        {entries.map((entry) => {
          const fullPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;
          const isExpanded = expandedFolders.has(fullPath);
          const hasChildren = Object.keys(entry.children).length > 0;

          return (
            <div key={entry.path}>
              {entry.type === 'folder' ? (
                <>
                  <div
                    className="flex items-center gap-1 py-1 px-2 hover:bg-accent rounded cursor-pointer"
                    onClick={() => toggleFolder(fullPath)}
                  >
                    {hasChildren ? (
                      isExpanded ? (
                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      )
                    ) : (
                      <div className="w-3" />
                    )}
                    <Folder className="h-4 w-4 shrink-0" />
                    <span className="text-base truncate">{entry.name}</span>
                  </div>
                  {hasChildren && isExpanded && (
                    <div className="ml-4">
                      {renderFileTree(entry.children, level + 1, fullPath)}
                    </div>
                  )}
                </>
              ) : (
                <div
                  className={`flex items-center gap-1 py-1 px-2 hover:bg-accent rounded cursor-pointer ${
                    selectedFile === entry.path ? 'bg-accent' : ''
                  }`}
                  onClick={() => onFileClick(entry.path)}
                >
                  <div className="w-3" />
                  <File className="h-4 w-4 shrink-0" />
                  <span className="text-base truncate">{entry.name}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ width }} className="border-r border-border bg-card flex flex-col min-h-0">
      <div className="p-4 border-b border-border shrink-0">
        <h2 className="text-sm font-semibold mb-3">FILES</h2>
        <Popover open={branchOpen} onOpenChange={setBranchOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={branchOpen}
              className="w-full justify-between"
              disabled={syncing}
            >
              {selectedBranch
                ? branches.find((branch) => branch.id === selectedBranch.id)?.name
                : "Select branch..."}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput 
                placeholder="Search branch..." 
                value={branchSearchQuery}
                onValueChange={(value) => {
                  setBranchSearchQuery(value);
                  setVisibleBranchCount(50);
                }}
              />
              <CommandList 
                className="max-h-[300px]"
                onScroll={(e) => {
                  const target = e.target;
                  if (target.scrollHeight - target.scrollTop <= target.clientHeight + 100) {
                    setVisibleBranchCount((prev) => {
                      const filteredBranches = branchSearchQuery
                        ? branches.filter((branch) =>
                            branch.name.toLowerCase().includes(branchSearchQuery.toLowerCase())
                          )
                        : branches;
                      return Math.min(prev + 50, filteredBranches.length);
                    });
                  }
                }}
              >
                <CommandEmpty>No branch found.</CommandEmpty>
                <CommandGroup>
                  {(() => {
                    const filteredBranches = branchSearchQuery
                      ? branches.filter((branch) =>
                          branch.name.toLowerCase().includes(branchSearchQuery.toLowerCase())
                        )
                      : branches;

                    const displayedBranches = filteredBranches.slice(0, visibleBranchCount);

                    return (
                      <>
                        {displayedBranches.map((branch) => (
                          <CommandItem
                            key={branch.id}
                            value={branch.name}
                            onSelect={() => {
                              onSelectBranch(branch.id.toString());
                              setBranchOpen(false);
                              setBranchSearchQuery('');
                              setVisibleBranchCount(50);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedBranch?.id === branch.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {branch.name}
                          </CommandItem>
                        ))}
                        {visibleBranchCount < filteredBranches.length && (
                          <div className="px-2 py-1.5 text-xs text-muted-foreground text-center">
                            Showing {visibleBranchCount} of {filteredBranches.length} branches. 
                            Scroll to load more.
                          </div>
                        )}
                      </>
                    );
                  })()}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="p-4">
          {syncing || loadingFiles ? (
            <div className="text-sm text-muted-foreground">Loading files...</div>
          ) : Object.keys(fileTree || {}).length === 0 ? (
            <div className="text-sm text-muted-foreground">No files found</div>
          ) : (
            renderFileTree(fileTree)
          )}
        </div>
      </div>
    </div>
  );
}

export default FilesSidebar;


