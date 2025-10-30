'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getRepoById, syncBranches, getBranchesForRepo } from '@/utils/repoActions';
import { syncFileTree, getFilesForBranch } from '@/utils/fileTreeActions';
import { syncFileCommits, getCommitsForFile, getCommitDetailsWithRelations } from '@/utils/commitActions';
import { Folder, File, ChevronRight, ChevronDown, GitPullRequest, Bug } from 'lucide-react';
import RepoHeader from '@/components/dashboard/RepoHeader';
import FilesSidebar from '@/components/dashboard/FilesSidebar';
import CommitContent from '@/components/dashboard/CommitContent';
import AICopilotPanel from '@/components/dashboard/AICopilotPanel';
import { buildLlmBatches } from '@/utils/llmPrep';

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
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [selectedFile, setSelectedFile] = useState(null);
  const [commits, setCommits] = useState([]);
  const [loadingCommits, setLoadingCommits] = useState(false);
  const [allCommitsMap, setAllCommitsMap] = useState(new Map());
  const [expandedCommits, setExpandedCommits] = useState(new Set());
  const [commitDetails, setCommitDetails] = useState({});
  const [branchOpen, setBranchOpen] = useState(false);
  const [branchSearchQuery, setBranchSearchQuery] = useState('');
  const [visibleBranchCount, setVisibleBranchCount] = useState(50);
  const containerRef = useRef(null);
  const [isResizing, setIsResizing] = useState(false);
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(256);
  const minLeftWidth = 200;
  const maxLeftWidth = 480;
  const [rightBatches, setRightBatches] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [rightSidebarWidth, setRightSidebarWidth] = useState(320);
  const minRightWidth = 240;
  const maxRightWidth = 560;
  const [isResizingRight, setIsResizingRight] = useState(false);

  useEffect(() => {
    function onMouseMove(e) {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (isResizing) {
        const nextWidth = e.clientX - rect.left;
        const clamped = Math.max(minLeftWidth, Math.min(maxLeftWidth, nextWidth));
        setLeftSidebarWidth(clamped);
      }
      if (isResizingRight) {
        const nextWidthRight = rect.right - e.clientX;
        const clampedRight = Math.max(minRightWidth, Math.min(maxRightWidth, nextWidthRight));
        setRightSidebarWidth(clampedRight);
      }
    }

    function onMouseUp() {
      if (isResizing) setIsResizing(false);
      if (isResizingRight) setIsResizingRight(false);
    }

    if (isResizing || isResizingRight) {
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
    }

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing, isResizingRight]);


  const [filterType, setFilterType] = useState('all');
  const [lastNValue, setLastNValue] = useState(50);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [hashFrom, setHashFrom] = useState('');
  const [hashTo, setHashTo] = useState('');

  const [selectedCommitIds, setSelectedCommitIds] = useState(new Set());
  const [selectedCommitFiles, setSelectedCommitFiles] = useState(new Map());
  const MAX_COMMITS = 5; // per request limit
  const MAX_FILES_PER_REQUEST = 10; // total files per request limit

  const getCommitFileCount = (commitId) => {
    const details = commitDetails[commitId];
    return Array.isArray(details?.filesChanged) ? details.filesChanged.length : 0;
  };

  const getTotalSelectedFileCount = () => {
    let total = 0;
    selectedCommitIds.forEach((cid) => {
      total += getCommitFileCount(cid);
    });
    selectedCommitFiles.forEach((filesSet, cid) => {
      if (!selectedCommitIds.has(cid)) total += filesSet.size;
    });
    return total;
  };

  useEffect(() => {
    async function loadRepo() {
      const result = await getRepoById(repoId);
      if (result.error) {
        console.error(result.error);
        router.push('/dashboard');
        return;
      }
      setRepo(result.repo);

      const existingBranchesResult = await getBranchesForRepo(repoId);
      if (existingBranchesResult.branches && existingBranchesResult.branches.length > 0) {
        setBranches(existingBranchesResult.branches);
        const defaultBranch = existingBranchesResult.branches.find(b => b.name === result.repo.defaultBranch) || existingBranchesResult.branches[0];
        if (defaultBranch) {
          setSelectedBranch(defaultBranch);
        }
        setLoading(false);

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
        setSyncing(true);
        const branchesResult = await syncBranches(repoId, result.repo.owner, result.repo.name);
        setSyncing(false);

        if (branchesResult.error) {
          console.error(branchesResult.error);
        } else {
          setBranches(branchesResult.branches || []);
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

  useEffect(() => {
    async function loadFiles() {
      if (!selectedBranch || !repo || loadingFilesRef.current) return;

      loadingFilesRef.current = true;
      setLoadingFiles(true);

      try {
        const dbFilesResult = await getFilesForBranch(selectedBranch.id);

        if (dbFilesResult.files && dbFilesResult.files.length > 0) {
          setFiles(dbFilesResult.files);
        } else {
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
        setLoadingFiles(false);
      }
    }

    loadFiles();
  }, [selectedBranch?.id, repo?.owner, repo?.name, repoId]);

  const handleBranchChange = async (branchId) => {
    const branch = branches.find(b => b.id === parseInt(branchId));
    if (branch) {
      setSelectedBranch(branch);
      setFiles([]);
      setSelectedFile(null);
      setCommits([]);
      setBranchSearchQuery('');
      setVisibleBranchCount(50);
    }
  };

  const handleFileClick = async (filePath) => {
    if (!repo || !selectedBranch || filePath === selectedFile) return;

    setSelectedFile(filePath);
    setLoadingCommits(true);
    setCommits([]);

    // Don't clear selections when switching files - preserve user choices

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

      const commitsResult = await getCommitsForFile(repoId, selectedBranch.id, filePath);
      if (commitsResult.error) {
        console.error(commitsResult.error);
      } else {
        const loadedCommits = commitsResult.commits || [];
        setCommits(loadedCommits);
        // Store in global map to preserve across file switches
        setAllCommitsMap(prev => {
          const next = new Map(prev);
          loadedCommits.forEach(c => next.set(c.id, c));
          return next;
        });
      }
    } catch (error) {
      console.error('Error loading commits:', error);
    } finally {
      setLoadingCommits(false);
    }
  };


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

  const handleToggleCommitSelect = (commitId) => {
    setSelectedCommitIds(prev => {
      const next = new Set(prev);
      if (next.has(commitId)) {
        next.delete(commitId);
        return next;
      }
      if (next.size >= MAX_COMMITS) {
        // eslint-disable-next-line no-console
        console.warn(`You can select up to ${MAX_COMMITS} commits at once.`);
        return prev;
      }
      const potential = getTotalSelectedFileCount() + getCommitFileCount(commitId);
      if (potential > MAX_FILES_PER_REQUEST) {
        // eslint-disable-next-line no-console
        console.warn(`Selecting this commit exceeds the ${MAX_FILES_PER_REQUEST} files-per-request limit.`);
        return prev;
      }
      next.add(commitId);
      return next;
    });
  };

  const handleToggleFileSelect = (commitId, filename) => {
    setSelectedCommitFiles(prev => {
      const next = new Map(prev);
      const setForCommit = new Set(next.get(commitId) || []);
      if (setForCommit.has(filename)) {
        setForCommit.delete(filename);
      } else {
        const current = getTotalSelectedFileCount();
        if (current >= MAX_FILES_PER_REQUEST) {
          // eslint-disable-next-line no-console
          console.warn(`You can select up to ${MAX_FILES_PER_REQUEST} files per request.`);
          return prev;
        }
        setForCommit.add(filename);
      }
      next.set(commitId, setForCommit);
      return next;
    });
  };

  const handleSelectAllCommitsForCurrentFile = async (checked) => {
    if (!selectedFile) return;
    setSelectedCommitIds(prev => {
      if (!checked) return new Set();
      const next = new Set();
      let filesSoFar = 0;
      for (const c of filteredCommits) {
        if (next.size >= MAX_COMMITS) break;
        const fc = getCommitFileCount(c.id);
        if (filesSoFar + fc > MAX_FILES_PER_REQUEST) break;
        next.add(c.id);
        filesSoFar += fc;
      }
      if (next.size < Math.min(filteredCommits.length, MAX_COMMITS)) {
        // eslint-disable-next-line no-console
        console.warn(`Selection limited by ${MAX_COMMITS} commits and ${MAX_FILES_PER_REQUEST} files per request.`);
      }
      return next;
    });
    if (checked) {
      const missing = filteredCommits.filter(c => !commitDetails[c.id]);
      if (missing.length > 0) {
        const results = await Promise.allSettled(missing.map(c => getCommitDetailsWithRelations(c.id)));
        const updates = {};
        results.forEach((res, idx) => {
          if (res.status === 'fulfilled' && !res.value?.error && res.value?.commit) {
            updates[missing[idx].id] = res.value.commit;
          }
        });
        if (Object.keys(updates).length > 0) {
          setCommitDetails(prev => ({ ...prev, ...updates }));
        }
      }
    }
  };

  const handleSubmitSelection = async () => {
    const commitIdSet = new Set(selectedCommitIds);
    const needDetails = Array.from(commitIdSet).filter(id => !commitDetails[id]);
    if (needDetails.length > 0) {
      const results = await Promise.allSettled(needDetails.map(id => getCommitDetailsWithRelations(id)));
      const toMerge = {};
      results.forEach((res, idx) => {
        if (res.status === 'fulfilled' && !res.value?.error && res.value?.commit) {
          toMerge[needDetails[idx]] = res.value.commit;
        }
      });
      if (Object.keys(toMerge).length > 0) {
        setCommitDetails(prev => ({ ...prev, ...toMerge }));
      }
    }
    const detailed = [];
    const filesMap = selectedCommitFiles;

    // Get all selected commits from the global map, not just current file
    const inScopeCommits = Array.from(allCommitsMap.values()).filter(c =>
      commitIdSet.has(c.id) || filesMap.has(c.id)
    );

    for (const c of inScopeCommits) {
      const isWholeCommitSelected = commitIdSet.has(c.id);
      const selectedFilesForCommit = filesMap.get(c.id);

      if (!isWholeCommitSelected && (!selectedFilesForCommit || selectedFilesForCommit.size === 0)) continue;

      const details = commitDetails[c.id];
      const filesChanged = Array.isArray(details?.filesChanged) ? details.filesChanged : [];
      const prs = Array.isArray(details?.prs) ? details.prs : [];
      const issues = Array.isArray(details?.issues) ? details.issues : [];

      let files = (isWholeCommitSelected
        ? filesChanged
        : filesChanged.filter(f => selectedFilesForCommit?.has(f.filename))
      ).map(f => ({
        filename: f.filename,
        additions: f.additions,
        deletions: f.deletions,
        patch: f.patch || null,
      }));


      if (files.length > MAX_FILES_PER_REQUEST) {
        // eslint-disable-next-line no-console
        console.warn(`Capping files for commit ${c.sha.substring(0, 7)} to ${MAX_FILES_PER_REQUEST}.`);
        files = files.slice(0, MAX_FILES_PER_REQUEST);
      }

      if (files.length === 0) continue;

      detailed.push({
        commitId: c.id,
        sha: c.sha,
        message: c.message,
        authorName: c.authorName,
        date: c.date,
        files,
        prs,
        issues,
      });
    }

    const batches = await buildLlmBatches({ commitsDetailed: detailed });
    // eslint-disable-next-line no-console
    console.log('LLM batches:', batches);
    setRightBatches(batches);
  };

  const handlePromptSubmit = async (userPrompt) => {
    if (!rightBatches) return;
    // Keep the user's prompt visible and create an AI placeholder to stream into
    setConversations(prev => [...prev, { type: 'user', content: userPrompt }, { type: 'ai', content: '' }]);
    setLoadingAi(true);
    let streamedText = '';
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batches: rightBatches, userPrompt }),
      });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      streamedText = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        streamedText += decoder.decode(value, { stream: true });
        // Update the last AI message in place as the stream arrives
        setConversations(prev => {
          const next = [...prev];
          const lastIndex = next.length - 1;
          if (lastIndex >= 0 && next[lastIndex].type === 'ai') {
            next[lastIndex] = { ...next[lastIndex], content: streamedText };
          } else {
            next.push({ type: 'ai', content: streamedText });
          }
          return next;
        });
      }
    } catch (err) {
      // Replace the last AI placeholder with an error message
      setConversations(prev => {
        const next = [...prev];
        const lastIndex = next.length - 1;
        if (lastIndex >= 0 && next[lastIndex].type === 'ai') {
          next[lastIndex] = { ...next[lastIndex], content: 'Error calling AI API' };
        } else {
          next.push({ type: 'ai', content: 'Error calling AI API' });
        }
        return next;
      });
    } finally {
      setLoadingAi(false);
    }
  };

  const handleClearSelections = () => {
    setRightBatches(null);
    setConversations([]);
    setSelectedCommitIds(new Set());
    setSelectedCommitFiles(new Map());
  };

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


  const handleToggleCommit = async (commit, isExpanded, details) => {
    if (isExpanded) {
      setExpandedCommits(prev => {
        const newSet = new Set(prev);
        newSet.delete(commit.id);
        return newSet;
      });
    } else {
      setExpandedCommits(prev => new Set(prev).add(commit.id));
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
  };

  return (
    <div className="min-h-screen bg-background">
      <RepoHeader repo={repo} onBack={() => router.push('/dashboard')} />

      <div ref={containerRef} className="h-[calc(100vh-4rem)] flex">
        <FilesSidebar
          width={leftSidebarWidth}
          syncing={syncing}
          loadingFiles={loadingFiles}
          branches={branches}
          selectedBranch={selectedBranch}
          branchOpen={branchOpen}
          setBranchOpen={setBranchOpen}
          branchSearchQuery={branchSearchQuery}
          setBranchSearchQuery={setBranchSearchQuery}
          visibleBranchCount={visibleBranchCount}
          setVisibleBranchCount={setVisibleBranchCount}
          onSelectBranch={handleBranchChange}
          fileTree={fileTree}
          expandedFolders={expandedFolders}
          toggleFolder={toggleFolder}
          selectedFile={selectedFile}
          onFileClick={handleFileClick}
        />
        <div
          onMouseDown={() => setIsResizing(true)}
          className="w-1 cursor-col-resize relative group"
          aria-label="Resize sidebar"
        >
          <div className="absolute inset-y-0 left-0 right-0 bg-border/0 group-hover:bg-border/60 transition-colors" />
        </div>

        <div className="flex-1 min-w-0">
          <CommitContent
            selectedFile={selectedFile}
            loadingCommits={loadingCommits}
            commits={commits}
            filteredCommits={filteredCommits}
            filterType={filterType}
            setFilterType={setFilterType}
            lastNValue={lastNValue}
            setLastNValue={setLastNValue}
            dateFrom={dateFrom}
            setDateFrom={setDateFrom}
            dateTo={dateTo}
            setDateTo={setDateTo}
            hashFrom={hashFrom}
            setHashFrom={setHashFrom}
            hashTo={hashTo}
            setHashTo={setHashTo}
            expandedCommits={expandedCommits}
            onToggleCommit={handleToggleCommit}
            commitDetails={commitDetails}
            selectedCommitIds={selectedCommitIds}
            selectedCommitFiles={selectedCommitFiles}
            onToggleCommitSelect={handleToggleCommitSelect}
            onToggleFileSelect={handleToggleFileSelect}
            onSelectAllCommitsForFile={handleSelectAllCommitsForCurrentFile}
            onSubmitSelection={handleSubmitSelection}
            maxFilesPerRequest={MAX_FILES_PER_REQUEST}
            currentSelectedFileCount={getTotalSelectedFileCount()}
          />
        </div>

        {/* Right resize handle (left edge of right panel) */}
        <div
          onMouseDown={() => setIsResizingRight(true)}
          className="w-1 cursor-col-resize relative group"
          aria-label="Resize right sidebar"
        >
          <div className="absolute inset-y-0 left-0 right-0 bg-border/0 group-hover:bg-border/60 transition-colors" />
        </div>

        <AICopilotPanel batches={rightBatches} width={rightSidebarWidth} onSubmitPrompt={handlePromptSubmit} conversations={conversations} loadingAi={loadingAi} onClearSelections={handleClearSelections} />
      </div>
    </div>
  );
}

