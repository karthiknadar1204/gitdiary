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
  const containerRef = useRef(null);
  const [isResizing, setIsResizing] = useState(false);
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(256);
  const minLeftWidth = 200;
  const maxLeftWidth = 480;

  useEffect(() => {
    function onMouseMove(e) {
      if (!isResizing || !containerRef.current) return;
      const containerLeft = containerRef.current.getBoundingClientRect().left;
      const nextWidth = e.clientX - containerLeft;
      const clamped = Math.max(minLeftWidth, Math.min(maxLeftWidth, nextWidth));
      setLeftSidebarWidth(clamped);
    }

    function onMouseUp() {
      if (isResizing) setIsResizing(false);
    }

    if (isResizing) {
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
  }, [isResizing]);


  const [filterType, setFilterType] = useState('all');
  const [lastNValue, setLastNValue] = useState(50);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [hashFrom, setHashFrom] = useState('');
  const [hashTo, setHashTo] = useState('');

  const [selectedCommitIds, setSelectedCommitIds] = useState(new Set());
  const [selectedCommitFiles, setSelectedCommitFiles] = useState(new Map());

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
      if (next.has(commitId)) next.delete(commitId); else next.add(commitId);
      return next;
    });
  };

  const handleToggleFileSelect = (commitId, filename) => {
    setSelectedCommitFiles(prev => {
      const next = new Map(prev);
      const setForCommit = new Set(next.get(commitId) || []);
      if (setForCommit.has(filename)) setForCommit.delete(filename); else setForCommit.add(filename);
      next.set(commitId, setForCommit);
      return next;
    });
  };

  const handleSelectAllCommitsForCurrentFile = async (checked) => {
    if (!selectedFile) return;
    setSelectedCommitIds(prev => {
      if (!checked) return new Set();
      const next = new Set(prev);
      filteredCommits.forEach(c => next.add(c.id));
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

    const inScopeCommits = filteredCommits && Array.isArray(filteredCommits) ? filteredCommits : commits;

    for (const c of inScopeCommits) {
      const isWholeCommitSelected = commitIdSet.has(c.id);
      const selectedFilesForCommit = filesMap.get(c.id);

      if (!isWholeCommitSelected && (!selectedFilesForCommit || selectedFilesForCommit.size === 0)) continue;

      const details = commitDetails[c.id];
      const filesChanged = Array.isArray(details?.filesChanged) ? details.filesChanged : [];

      const files = (isWholeCommitSelected
        ? filesChanged
        : filesChanged.filter(f => selectedFilesForCommit?.has(f.filename))
      ).map(f => ({
        filename: f.filename,
        additions: f.additions,
        deletions: f.deletions,
        patch: f.patch || null,
      }));

      if (files.length === 0) continue;

      detailed.push({
        commitId: c.id,
        sha: c.sha,
        message: c.message,
        authorName: c.authorName,
        date: c.date,
        files,
      });
    }

    // eslint-disable-next-line no-console
    console.log('Selection (detailed):', detailed);
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
          />
        </div>

        <AICopilotPanel />
      </div>
    </div>
  );
}

