'use server';

import { auth } from '@clerk/nextjs/server';
import { db } from '@/config/db';
import { repos, branches } from '@/config/schema';
import { eq, and } from 'drizzle-orm';

export async function getRepoById(repoId) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { error: 'Unauthorized' };
    }

    const repo = await db.select()
      .from(repos)
      .where(eq(repos.id, repoId))
      .limit(1);

    if (repo.length === 0) {
      return { error: 'Repository not found' };
    }

    return { repo: repo[0] };
  } catch (error) {
    console.error('Error fetching repo:', error);
    return { error: 'Failed to fetch repository' };
  }
}

export async function fetchBranchesFromGitHub(owner, repoName) {
  try {
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return { error: 'GitHub token not configured' };
    }

    let allBranches = [];
    let page = 1;
    let hasMore = true;

    // GitHub API paginates results, fetch all pages
    while (hasMore) {
      const response = await fetch(`https://api.github.com/repos/${owner}/${repoName}/branches?page=${page}&per_page=100`, {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('GitHub API Error:', response.status, errorText);
        return { error: `Failed to fetch branches: ${response.status}` };
      }

      const branchesData = await response.json();
      allBranches = allBranches.concat(branchesData);

      // Check if there are more pages (GitHub sends Link header or empty array)
      const linkHeader = response.headers.get('link');
      if (linkHeader && linkHeader.includes('rel="next"')) {
        page++;
      } else {
        hasMore = false;
      }

      // If we got fewer than 100 items, we're on the last page
      if (branchesData.length < 100) {
        hasMore = false;
      }
    }

    console.log(`Fetched ${allBranches.length} branches total`);
    return { branches: allBranches };
  } catch (error) {
    console.error('Error fetching branches:', error);
    return { error: 'Failed to fetch branches' };
  }
}

export async function syncBranches(repoId, owner, repoName) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { error: 'Unauthorized' };
    }

    const result = await fetchBranchesFromGitHub(owner, repoName);
    if (result.error) {
      return result;
    }

    // Get existing branches in bulk to avoid individual queries
    const existingBranches = await db.select()
      .from(branches)
      .where(eq(branches.repoId, repoId));

    const existingMap = new Map(existingBranches.map(b => [b.name, b]));

    const branchesToInsert = [];
    const branchesToUpdate = [];

    for (const branch of result.branches) {
      const branchData = {
        repoId,
        name: branch.name,
        commitSha: branch.commit.sha,
      };

      const existing = existingMap.get(branch.name);
      if (existing) {
        // Only update if commit SHA changed
        if (existing.commitSha !== branch.commit.sha) {
          branchesToUpdate.push({
            id: existing.id,
            commitSha: branch.commit.sha,
            updatedAt: new Date(),
          });
        }
      } else {
        branchesToInsert.push(branchData);
      }
    }

    // Batch insert new branches
    if (branchesToInsert.length > 0) {
      // Split into chunks of 100 for better performance
      const chunkSize = 100;
      for (let i = 0; i < branchesToInsert.length; i += chunkSize) {
        const chunk = branchesToInsert.slice(i, i + chunkSize);
        await db.insert(branches).values(chunk);
      }
    }

    // Batch update existing branches
    if (branchesToUpdate.length > 0) {
      for (const branchUpdate of branchesToUpdate) {
        await db.update(branches)
          .set({ commitSha: branchUpdate.commitSha, updatedAt: branchUpdate.updatedAt })
          .where(eq(branches.id, branchUpdate.id));
      }
    }

    // Fetch all branches again to return complete list
    const dbBranches = await db.select()
      .from(branches)
      .where(eq(branches.repoId, repoId));

    return { branches: dbBranches };
  } catch (error) {
    console.error('Error syncing branches:', error);
    return { error: 'Failed to sync branches' };
  }
}

export async function getBranchesForRepo(repoId) {
  try {
    const branchesList = await db.select()
      .from(branches)
      .where(eq(branches.repoId, repoId));

    return { branches: branchesList };
  } catch (error) {
    console.error('Error fetching branches:', error);
    return { error: 'Failed to fetch branches' };
  }
}

