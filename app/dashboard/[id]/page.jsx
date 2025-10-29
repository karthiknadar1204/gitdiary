'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getRepoById, syncBranches, getBranchesForRepo } from '@/utils/repoActions';
import { syncFileTree, getFilesForBranch } from '@/utils/fileTreeActions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Folder, File, ChevronRight, ChevronDown } from 'lucide-react';

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

      // Sync branches from GitHub
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
    }
  };

  // Build file tree structure - memoized to prevent infinite loops
  // MUST be called before conditional returns to maintain hook order
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
                <div className="flex items-center gap-1 py-1 px-2 hover:bg-accent rounded cursor-pointer">
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
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Left Panel - Files */}
        <div className="w-64 border-r border-border bg-card overflow-y-auto">
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-semibold mb-3">FILES</h2>
            <Select
              value={selectedBranch?.id?.toString()}
              onValueChange={handleBranchChange}
              disabled={syncing}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id.toString()}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

        {/* Middle Panel - Main Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-8">
            <h2 className="text-2xl font-bold mb-2">Select a file to view history</h2>
            <p className="text-muted-foreground">Choose a file from the left panel.</p>
          </div>
        </div>

        {/* Right Panel - AI Copilot */}
        <div className="w-80 border-l border-border bg-card overflow-y-auto">
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
    </div>
  );
}

