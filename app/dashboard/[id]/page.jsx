'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getRepoById, syncBranches, getBranchesForRepo } from '@/utils/repoActions';
import { syncFileTree, getFilesForBranch } from '@/utils/fileTreeActions';
import { syncFileCommits, getCommitsForFile, getCommitDetailsWithRelations } from '@/utils/commitActions';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Folder, File, ChevronRight, ChevronDown, GitPullRequest, Bug, Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function DashboardDetail() {
  const params = useParams();
  const router = useRouter();
  const repoId = parseInt(params.id);

  const [repo, setRepo] = useState(null);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const loadingFilesRef = useRef(false);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [selectedFile, setSelectedFile] = useState(null);
  const [commits, setCommits] = useState([]);
  const [loadingCommits, setLoadingCommits] = useState(false);
  const [expandedCommits, setExpandedCommits] = useState(new Set());
  const [commitDetails, setCommitDetails] = useState({});
  const [branchOpen, setBranchOpen] = useState(false);
  const [branchSearchQuery, setBranchSearchQuery] = useState('');
  const [visibleBranchCount, setVisibleBranchCount] = useState(50);
  
  // Filter states
  const [filterType, setFilterType] = useState('all'); // 'all', 'lastN', 'dateRange', 'hashRange'
  const [lastNValue, setLastNValue] = useState(50);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [hashFrom, setHashFrom] = useState('');
  const [hashTo, setHashTo] = useState('');

  // Load repo and branches on mount
  useEffect(() => {
    async function loadRepo() {
      const result = await getRepoById(repoId);
      if (result.error) {
        console.error(result.error);
        router.push('/dashboard');
        return;
      }
      setRepo(result.repo);

      // First, load existing branches from DB to show immediately
      const existingBranchesResult = await getBranchesForRepo(repoId);
      if (existingBranchesResult.branches && existingBranchesResult.branches.length > 0) {
        setBranches(existingBranchesResult.branches);
        // Select default branch or first branch from existing
        const defaultBranch = existingBranchesResult.branches.find(b => b.name === result.repo.defaultBranch) || existingBranchesResult.branches[0];
        if (defaultBranch) {
          setSelectedBranch(defaultBranch);
        }
        setLoading(false);
        
        // Then sync branches from GitHub in background (non-blocking)
        syncBranches(repoId, result.repo.owner, result.repo.name)
          .then((branchesResult) => {
            if (branchesResult.error) {
              console.error(branchesResult.error);
            } else {
              setBranches(branchesResult.branches || []);
            }
          })
          .catch((error) => {
            console.error('Error syncing branches:', error);
          });
      } else {
        // No existing branches, sync now but show loading state
        setSyncing(true);
        const branchesResult = await syncBranches(repoId, result.repo.owner, result.repo.name);
        setSyncing(false);

        if (branchesResult.error) {
          console.error(branchesResult.error);
        } else {
          setBranches(branchesResult.branches || []);
          // Select default branch or first branch
          const defaultBranch = branchesResult.branches.find(b => b.name === result.repo.defaultBranch) || branchesResult.branches[0];
          if (defaultBranch) {
            setSelectedBranch(defaultBranch);
          }
        }
        setLoading(false);
      }
    }

    if (repoId) {
      loadRepo();
    }
  }, [repoId, router]);

  // Load files when branch is selected
  useEffect(() => {
    async function loadFiles() {
      if (!selectedBranch || !repo || loadingFilesRef.current) return;
      
      loadingFilesRef.current = true;

      try {
        // Check if files exist in DB
        const dbFilesResult = await getFilesForBranch(selectedBranch.id);
        
        if (dbFilesResult.files && dbFilesResult.files.length > 0) {
          setFiles(dbFilesResult.files);
        } else {
          // Sync files from GitHub
          setSyncing(true);
          const result = await syncFileTree(repoId, selectedBranch.id, repo.owner, repo.name, selectedBranch.name);
          setSyncing(false);

          if (result.error) {
            console.error(result.error);
          } else {
            setFiles(result.files || []);
          }
        }
      } finally {
        loadingFilesRef.current = false;
      }
    }

    loadFiles();
  }, [selectedBranch?.id, repo?.owner, repo?.name, repoId]);

  const handleBranchChange = async (branchId) => {
    const branch = branches.find(b => b.id === parseInt(branchId));
    if (branch) {
      setSelectedBranch(branch);
      setFiles([]); // Clear files while loading new branch
      setSelectedFile(null); // Clear selected file
      setCommits([]); // Clear commits
      setBranchSearchQuery(''); // Clear search when branch is selected
      setVisibleBranchCount(50); // Reset visible count
    }
  };

  const handleFileClick = async (filePath) => {
    if (!repo || !selectedBranch || filePath === selectedFile) return;

    setSelectedFile(filePath);
    setLoadingCommits(true);
    setCommits([]);
    
    // Reset filter when file changes
    setFilterType('all');
    setLastNValue(50);
    setDateFrom('');
    setDateTo('');
    setHashFrom('');
    setHashTo('');

    try {
      const result = await syncFileCommits(
        repoId,
        selectedBranch.id,
        repo.owner,
        repo.name,
        selectedBranch.name,
        filePath
      );

      if (result.error) {
        console.error(result.error);
        setLoadingCommits(false);
        return;
      }

      // Fetch commits from DB for display
      const commitsResult = await getCommitsForFile(repoId, selectedBranch.id, filePath);
      if (commitsResult.error) {
        console.error(commitsResult.error);
      } else {
        setCommits(commitsResult.commits || []);
      }
    } catch (error) {
      console.error('Error loading commits:', error);
    } finally {
      setLoadingCommits(false);
    }
  };

  // Build file tree structure - memoized to prevent infinite loops
  // MUST be called before conditional returns to maintain hook order
  // Filter commits based on selected filter
  const filteredCommits = useMemo(() => {
    if (!commits || commits.length === 0) return [];
    if (filterType === 'all') return commits;
    
    let filtered = [...commits];
    
    if (filterType === 'lastN') {
      filtered = commits.slice(0, lastNValue);
    } else if (filterType === 'dateRange') {
      if (dateFrom || dateTo) {
        filtered = commits.filter(commit => {
          if (!commit.date) return false;
          const commitDate = new Date(commit.date);
          const from = dateFrom ? new Date(dateFrom) : null;
          const to = dateTo ? new Date(dateTo) : null;
          
          if (from && commitDate < from) return false;
          if (to && commitDate > to) return false;
          return true;
        });
      }
    } else if (filterType === 'hashRange') {
      if (hashFrom || hashTo) {
        const fromIndex = hashFrom ? commits.findIndex(c => c.sha.startsWith(hashFrom)) : -1;
        const toIndex = hashTo ? commits.findIndex(c => c.sha.startsWith(hashTo)) : -1;
        
        if (fromIndex !== -1 && toIndex !== -1) {
          const start = Math.min(fromIndex, toIndex);
          const end = Math.max(fromIndex, toIndex);
          filtered = commits.slice(start, end + 1);
        } else if (fromIndex !== -1) {
          filtered = commits.slice(fromIndex);
        } else if (toIndex !== -1) {
          filtered = commits.slice(0, toIndex + 1);
        }
      }
    }
    
    return filtered;
  }, [commits, filterType, lastNValue, dateFrom, dateTo, hashFrom, hashTo]);

  const fileTree = useMemo(() => {
    if (!files || files.length === 0) return {};
    
    const tree = {};
    
    files.forEach(file => {
      const parts = file.path.split('/');
      let current = tree;
      
      parts.forEach((part, index) => {
        if (!current[part]) {
          current[part] = {
            name: part,
            type: index === parts.length - 1 ? file.type : 'folder',
            path: file.path,
            children: {},
          };
        }
        current = current[part].children;
      });
    });

    return tree;
  }, [files]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-6 py-20">
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  if (!repo) {
    return null;
  }

  const toggleFolder = (folderPath) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderPath)) {
        newSet.delete(folderPath);
      } else {
        newSet.add(folderPath);
      }
      return newSet;
    });
  };

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
                  onClick={() => handleFileClick(entry.path)}
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="w-full h-16 flex items-center justify-between px-6">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            ← Back
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xl font-semibold">Git Diary</span>
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

      {/* Three Column Layout */}
      <ResizablePanelGroup direction="horizontal" className="h-[calc(100vh-4rem)]">
        {/* Left Panel - Files */}
        <ResizablePanel defaultSize={20} minSize={15} maxSize={40} className="border-r border-border bg-card">
          <div className="h-full overflow-y-auto">
          <div className="p-4 border-b border-border">
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
                      setVisibleBranchCount(50); // Reset visible count on search
                    }}
                  />
                  <CommandList 
                    className="max-h-[300px]"
                    onScroll={(e) => {
                      const target = e.target;
                      // Load more when user scrolls near bottom
                      if (target.scrollHeight - target.scrollTop <= target.clientHeight + 100) {
                        setVisibleBranchCount(prev => {
                          const filteredBranches = branchSearchQuery
                            ? branches.filter(branch =>
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
                        // Filter branches based on search query
                        const filteredBranches = branchSearchQuery
                          ? branches.filter(branch =>
                              branch.name.toLowerCase().includes(branchSearchQuery.toLowerCase())
                            )
                          : branches;

                        // Use cursor-based pagination: show only visibleBranchCount items
                        const displayedBranches = filteredBranches.slice(0, visibleBranchCount);

                        return (
                          <>
                            {displayedBranches.map((branch) => (
                              <CommandItem
                                key={branch.id}
                                value={branch.name}
                                onSelect={() => {
                                  handleBranchChange(branch.id.toString());
                                  setBranchOpen(false);
                                  setBranchSearchQuery('');
                                  setVisibleBranchCount(50); // Reset on select
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
          <div className="p-4">
            {syncing ? (
              <div className="text-sm text-muted-foreground">Loading files...</div>
            ) : files.length === 0 ? (
              <div className="text-sm text-muted-foreground">No files found</div>
            ) : (
              renderFileTree(fileTree)
            )}
          </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Middle Panel - Main Content */}
        <ResizablePanel defaultSize={55} minSize={30}>
          <div className="h-full overflow-y-auto">
          {!selectedFile ? (
            <div className="p-8">
              <h2 className="text-2xl font-bold mb-2">Select a file to view history</h2>
              <p className="text-muted-foreground">Choose a file from the left panel.</p>
            </div>
          ) : (
            <div className="p-8">
              <h2 className="text-2xl font-bold mb-4">Commit History: {selectedFile}</h2>
              
              {/* Filter Bar */}
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
                <div className="space-y-4">
                  {filteredCommits.map((commit) => {
                    const isExpanded = expandedCommits.has(commit.id);
                    const details = commitDetails[commit.id];

                    return (
                      <div key={commit.id} className="border border-border rounded-lg p-4">
                        <div
                          className="cursor-pointer"
                          onClick={async () => {
                            if (isExpanded) {
                              setExpandedCommits(prev => {
                                const newSet = new Set(prev);
                                newSet.delete(commit.id);
                                return newSet;
                              });
                            } else {
                              setExpandedCommits(prev => new Set(prev).add(commit.id));
                              
                              // Fetch commit details if not already loaded
                              if (!details) {
                                const result = await getCommitDetailsWithRelations(commit.id);
                                if (result.error) {
                                  console.error(result.error);
                                } else {
                                  setCommitDetails(prev => ({
                                    ...prev,
                                    [commit.id]: result.commit,
                                  }));
                                }
                              }
                            }
                          }}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                                <h3 className="font-semibold truncate max-w-2xl" title={commit.message}>
                                  {commit.message && commit.message.length > 80 
                                    ? `${commit.message.substring(0, 80)}...` 
                                    : commit.message}
                                </h3>
                              </div>
                              <p className="text-sm text-muted-foreground ml-6">
                                {commit.authorName} • {commit.date ? new Date(commit.date).toLocaleDateString() : ''}
                              </p>
                            </div>
                            <span className="text-xs font-mono text-muted-foreground">
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
                            {/* Diffs */}
                            {details.filesChanged && Array.isArray(details.filesChanged) && details.filesChanged.length > 0 && (
                              <div>
                                <h4 className="font-semibold mb-2 text-sm">Files Changed:</h4>
                                <div className="space-y-2">
                                  {details.filesChanged.map((file, idx) => (
                                    <div key={idx} className="bg-card border border-border rounded p-3">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-mono">{file.filename}</span>
                                        <div className="flex items-center gap-2 text-xs">
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
                                              // Convert tabs to spaces for consistent indentation (4 spaces per tab)
                                              const normalizedLine = line.replace(/\t/g, '    ');
                                              
                                              if (normalizedLine.startsWith('+') && !normalizedLine.startsWith('+++')) {
                                                return (
                                                  <div 
                                                    key={lineIdx} 
                                                    className="text-green-600 bg-green-500/10 whitespace-pre font-mono block"
                                                  >
                                                    {normalizedLine}
                                                  </div>
                                                );
                                              } else if (normalizedLine.startsWith('-') && !normalizedLine.startsWith('---')) {
                                                return (
                                                  <div 
                                                    key={lineIdx} 
                                                    className="text-red-600 bg-red-500/10 whitespace-pre font-mono block"
                                                  >
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
                                                  <div 
                                                    key={lineIdx} 
                                                    className="text-muted-foreground whitespace-pre font-mono block"
                                                  >
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

                            {/* PRs */}
                            {details.prs && details.prs.length > 0 && (
                              <div>
                                <h4 className="font-semibold mb-2 text-sm flex items-center gap-2">
                                  <GitPullRequest className="h-4 w-4" />
                                  Pull Requests:
                                </h4>
                                <div className="space-y-2">
                                  {details.prs.map((pr) => (
                                    <div key={pr.id} className="bg-card border border-border rounded p-3">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="text-sm font-semibold">PR #{pr.number}</span>
                                        <span className={`text-xs px-2 py-0.5 rounded ${
                                          pr.state === 'open' ? 'bg-green-500/20 text-green-600' :
                                          pr.state === 'closed' ? 'bg-red-500/20 text-red-600' :
                                          'bg-blue-500/20 text-blue-600'
                                        }`}>
                                          {pr.state}
                                        </span>
                                      </div>
                                      <p className="text-sm mb-1">{pr.title}</p>
                                      {pr.body && (
                                        <p className="text-xs text-muted-foreground line-clamp-2">{pr.body}</p>
                                      )}

                                      {/* Issues linked to this PR */}
                                      {pr.issues && pr.issues.length > 0 && (
                                        <div className="mt-2 pt-2 border-t border-border">
                                          <p className="text-xs font-semibold mb-1 flex items-center gap-1">
                                            <Bug className="h-3 w-3" />
                                            Linked Issues:
                                          </p>
                                          <div className="space-y-1">
                                            {pr.issues.map((issue) => (
                                              <div key={issue.id} className="text-xs text-muted-foreground">
                                                Issue #{issue.number}: {issue.title}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
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
          )}
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right Panel - AI Copilot */}
        <ResizablePanel defaultSize={25} minSize={15} maxSize={40} className="border-l border-border bg-card">
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
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

