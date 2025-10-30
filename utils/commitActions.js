'use server';

import { auth } from '@clerk/nextjs/server';
import { db } from '@/config/db';
import { commits, pullRequests, issues, commitToPR, commitToBranch, prToIssue, repos } from '@/config/schema';
import { eq, and, inArray } from 'drizzle-orm';


async function fetchWithRetry(url, options, maxRetries = 3, timeout = 30000) {
  let timeoutId;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const controller = new AbortController();
    
    try {
      timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          const errorText = await response.text().catch(() => '');
          return { error: `HTTP ${response.status}: ${errorText}`, response: null };
        }
        
        if (attempt < maxRetries - 1) {
          if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After');
            const delay = retryAfter ? parseInt(retryAfter) * 1000 : Math.min(1000 * Math.pow(2, attempt), 10000);
            await response.text().catch(() => {});
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          await response.text().catch(() => {});
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        const errorText = await response.text().catch(() => '');
        return { error: `HTTP ${response.status}: ${errorText}`, response: null };
      }

      return { response, error: null };
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      
      if (attempt === maxRetries - 1) {
        return { 
          error: error.name === 'AbortError' ? 'Request timeout after 30s' : error.message,
          response: null
        };
      }

      const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  return { error: 'Max retries exceeded', response: null };
}

export async function fetchCommitsForFile(owner, repoName, filePath, branchName) {
  try {
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return { error: 'GitHub token not configured' };
    }

    const url = `https://api.github.com/repos/${owner}/${repoName}/commits?path=${encodeURIComponent(filePath)}&sha=${branchName}&per_page=100`;
    const result = await fetchWithRetry(url, {
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (result.error) {
      console.error('GitHub API Error fetching commits:', result.error);
      return { error: `Failed to fetch commits: ${result.error}` };
    }

    const commitsData = await result.response.json();
    return { commits: commitsData };
  } catch (error) {
    console.error('Error fetching commits:', error);
    return { error: 'Failed to fetch commits' };
  }
}

export async function fetchCommitDetails(owner, repoName, sha) {
  try {
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return { error: 'GitHub token not configured' };
    }

    const url = `https://api.github.com/repos/${owner}/${repoName}/commits/${sha}`;
    const result = await fetchWithRetry(url, {
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (result.error) {
      console.error('GitHub API Error fetching commit details:', result.error);
      return { error: `Failed to fetch commit details: ${result.error}` };
    }

    const commitData = await result.response.json();
    return { commit: commitData };
  } catch (error) {
    console.error('Error fetching commit details:', error);
    return { error: 'Failed to fetch commit details' };
  }
}

export async function fetchPRsForCommit(owner, repoName, sha) {
  try {
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return { error: 'GitHub token not configured' };
    }

    const url = `https://api.github.com/repos/${owner}/${repoName}/commits/${sha}/pulls`;
    const result = await fetchWithRetry(url, {
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.groot-preview+json',
      },
    });

    if (result.error) {
      if (result.error.includes('404')) {
        return { prs: [] };
      }
      console.error('GitHub API Error fetching PRs:', result.error);
      return { error: `Failed to fetch PRs: ${result.error}` };
    }

    const prsData = await result.response.json();
    return { prs: prsData };
  } catch (error) {
    console.error('Error fetching PRs:', error);
    return { error: 'Failed to fetch PRs' };
  }
}

export async function fetchPRDetails(owner, repoName, prNumber) {
  try {
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return { error: 'GitHub token not configured' };
    }

    const url = `https://api.github.com/repos/${owner}/${repoName}/pulls/${prNumber}`;
    const result = await fetchWithRetry(url, {
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (result.error) {
      console.error('GitHub API Error fetching PR details:', result.error);
      return { error: `Failed to fetch PR details: ${result.error}` };
    }

    const prData = await result.response.json();
    return { pr: prData };
  } catch (error) {
    console.error('Error fetching PR details:', error);
    return { error: 'Failed to fetch PR details' };
  }
}

export async function fetchIssueDetails(owner, repoName, issueNumber) {
  try {
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return { error: 'GitHub token not configured' };
    }

    const url = `https://api.github.com/repos/${owner}/${repoName}/issues/${issueNumber}`;
    const result = await fetchWithRetry(url, {
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (result.error) {
      console.error('GitHub API Error fetching issue details:', result.error);
      return { error: `Failed to fetch issue details: ${result.error}` };
    }

    const issueData = await result.response.json();
    return { issue: issueData };
  } catch (error) {
    console.error('Error fetching issue details:', error);
    return { error: 'Failed to fetch issue details' };
  }
}

function parseIssueReferences(prBody) {
  if (!prBody) return [];
  const issueRegex = /#(\d+)/g;
  const matches = prBody.matchAll(issueRegex);
  const issueNumbers = [...matches].map(match => parseInt(match[1]));
  return [...new Set(issueNumbers)];
}

export async function syncFileCommits(repoId, branchId, owner, repoName, branchName, filePath) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { error: 'Unauthorized' };
    }

    const commitsResult = await fetchCommitsForFile(owner, repoName, filePath, branchName);
    if (commitsResult.error) {
      return commitsResult;
    }

    const commitsData = commitsResult.commits || [];
    const processedCommits = [];

    for (const commitInfo of commitsData) {
      const sha = commitInfo.sha;

      const [existingCommit] = await db.select()
        .from(commits)
        .where(eq(commits.sha, sha))
        .limit(1);

      let commitId;

      if (existingCommit) {
        commitId = existingCommit.id;
      } else {
        const commitDetailsResult = await fetchCommitDetails(owner, repoName, sha);
        if (commitDetailsResult.error) {
          console.error(`Error fetching commit ${sha}:`, commitDetailsResult.error);
          continue;
        }

        const commitData = commitDetailsResult.commit;

        const filesChanged = commitData.files?.map(file => ({
          filename: file.filename,
          additions: file.additions,
          deletions: file.deletions,
          changes: file.changes,
        })) || [];

        const [newCommit] = await db.insert(commits).values({
          repoId,
          sha: commitData.sha,
          message: commitData.commit.message,
          authorName: commitData.commit.author.name,
          authorEmail: commitData.commit.author.email,
          date: new Date(commitData.commit.author.date),
          filesChanged: filesChanged,
          parentSha: commitData.parents?.[0]?.sha || null,
        }).returning();

        commitId = newCommit.id;
      }

      const [existingLink] = await db.select()
        .from(commitToBranch)
        .where(and(eq(commitToBranch.commitId, commitId), eq(commitToBranch.branchId, branchId)))
        .limit(1);

      if (!existingLink) {
        await db.insert(commitToBranch).values({
          commitId,
          branchId,
        });
      }

      const prsResult = await fetchPRsForCommit(owner, repoName, sha);
      if (prsResult.error) {
        console.error(`Error fetching PRs for commit ${sha}:`, prsResult.error);
      } else {
        const prs = prsResult.prs || [];

        for (const prInfo of prs) {
          const prNumber = prInfo.number;

          const [existingPR] = await db.select()
            .from(pullRequests)
            .where(and(eq(pullRequests.repoId, repoId), eq(pullRequests.number, prNumber)))
            .limit(1);

          let prId;

          if (existingPR) {
            prId = existingPR.id;
          } else {
            const prDetailsResult = await fetchPRDetails(owner, repoName, prNumber);
            if (prDetailsResult.error) {
              console.error(`Error fetching PR ${prNumber}:`, prDetailsResult.error);
              continue;
            }

            const prData = prDetailsResult.pr;

            const [newPR] = await db.insert(pullRequests).values({
              repoId,
              number: prData.number,
              title: prData.title,
              body: prData.body,
              state: prData.state,
              createdAt: prData.created_at ? new Date(prData.created_at) : null,
              mergedAt: prData.merged_at ? new Date(prData.merged_at) : null,
            }).returning();

            prId = newPR.id;

            const issueNumbers = parseIssueReferences(prData.body);
            for (const issueNumber of issueNumbers) {
              const [existingIssue] = await db.select()
                .from(issues)
                .where(and(eq(issues.repoId, repoId), eq(issues.number, issueNumber)))
                .limit(1);

              let issueId;

              if (existingIssue) {
                issueId = existingIssue.id;
              } else {
                const issueDetailsResult = await fetchIssueDetails(owner, repoName, issueNumber);
                if (issueDetailsResult.error) {
                  console.error(`Error fetching issue ${issueNumber}:`, issueDetailsResult.error);
                  continue;
                }

                const issueData = issueDetailsResult.issue;

                const [newIssue] = await db.insert(issues).values({
                  repoId,
                  number: issueData.number,
                  title: issueData.title,
                  body: issueData.body,
                  state: issueData.state,
                  createdAt: issueData.created_at ? new Date(issueData.created_at) : null,
                  closedAt: issueData.closed_at ? new Date(issueData.closed_at) : null,
                }).returning();

                issueId = newIssue.id;
              }

              const [existingPRIssueLink] = await db.select()
                .from(prToIssue)
                .where(and(eq(prToIssue.prId, prId), eq(prToIssue.issueId, issueId)))
                .limit(1);

              if (!existingPRIssueLink) {
                await db.insert(prToIssue).values({
                  prId,
                  issueId,
                });
              }
            }
          }

          const [existingCommitPRLink] = await db.select()
            .from(commitToPR)
            .where(and(eq(commitToPR.commitId, commitId), eq(commitToPR.prId, prId)))
            .limit(1);

          if (!existingCommitPRLink) {
            await db.insert(commitToPR).values({
              commitId,
              prId,
            });
          }
        }
      }

      processedCommits.push({
        commitId,
        sha: existingCommit?.sha || commitInfo.sha,
      });
    }

    return { commits: processedCommits };
  } catch (error) {
    console.error('Error syncing file commits:', error);
    return { error: 'Failed to sync file commits' };
  }
}

export async function getCommitsForFile(repoId, branchId, filePath) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { error: 'Unauthorized' };
    }

    const branchCommits = await db.select({
      commitId: commitToBranch.commitId,
    })
      .from(commitToBranch)
      .where(eq(commitToBranch.branchId, branchId));

    const commitIds = branchCommits.map(bc => bc.commitId);

    if (commitIds.length === 0) {
      return { commits: [] };
    }

    const allCommits = await db.select()
      .from(commits)
      .where(and(
        eq(commits.repoId, repoId),
        inArray(commits.id, commitIds)
      ));

    const fileCommits = allCommits.filter(commit => {
      if (!commit.filesChanged || !Array.isArray(commit.filesChanged)) {
        return false;
      }
      return commit.filesChanged.some(file => file.filename === filePath);
    });

    fileCommits.sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    });

    return { commits: fileCommits };
  } catch (error) {
    console.error('Error fetching commits:', error);
    return { error: 'Failed to fetch commits' };
  }
}

export async function getCommitDetailsWithRelations(commitId) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { error: 'Unauthorized' };
    }

    const [commit] = await db.select()
      .from(commits)
      .where(eq(commits.id, commitId))
      .limit(1);

    if (!commit) {
      return { error: 'Commit not found' };
    }

    let filesChangedWithPatches = commit.filesChanged;
    const needsPatches = commit.filesChanged && Array.isArray(commit.filesChanged) && 
      commit.filesChanged.length > 0 && 
      commit.filesChanged.some(file => !file.patch);

    if (needsPatches) {
      const repo = await db.select()
        .from(repos)
        .where(eq(repos.id, commit.repoId))
        .limit(1);

      if (repo.length > 0) {
        const repoData = repo[0];
        const commitDetailsResult = await fetchCommitDetails(repoData.owner, repoData.name, commit.sha);
        
        if (!commitDetailsResult.error && commitDetailsResult.commit) {
          const patchMap = new Map();
          commitDetailsResult.commit.files?.forEach(file => {
            patchMap.set(file.filename, file.patch);
          });

          filesChangedWithPatches = commit.filesChanged.map(file => ({
            ...file,
            patch: patchMap.get(file.filename) || file.patch || null,
          }));

          await db.update(commits)
            .set({ filesChanged: filesChangedWithPatches })
            .where(eq(commits.id, commitId));
        }
      }
    }

    const commitPRs = await db.select({
      prId: commitToPR.prId,
    })
      .from(commitToPR)
      .where(eq(commitToPR.commitId, commitId));

    const prIds = commitPRs.map(cp => cp.prId);

    let prs = [];
    if (prIds.length > 0) {
      const prsData = await db.select()
        .from(pullRequests)
        .where(inArray(pullRequests.id, prIds));

      for (const pr of prsData) {
        const prIssues = await db.select({
          issueId: prToIssue.issueId,
        })
          .from(prToIssue)
          .where(eq(prToIssue.prId, pr.id));

        const issueIds = prIssues.map(pi => pi.issueId);

        let issuesList = [];
        if (issueIds.length > 0) {
          issuesList = await db.select()
            .from(issues)
            .where(inArray(issues.id, issueIds));
        }

        prs.push({
          ...pr,
          issues: issuesList,
        });
      }
    }

    return {
      commit: {
        ...commit,
        filesChanged: filesChangedWithPatches,
        prs,
      },
    };
  } catch (error) {
    console.error('Error fetching commit details:', error);
    return { error: 'Failed to fetch commit details' };
  }
}

