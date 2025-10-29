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

    const response = await fetch(`https://api.github.com/repos/${owner}/${repoName}/branches`, {
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
    return { branches: branchesData };
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

    // Fetch branches from GitHub
    const result = await fetchBranchesFromGitHub(owner, repoName);
    if (result.error) {
      return result;
    }

    // Store branches in database
    const branchesToInsert = result.branches.map(branch => ({
      repoId,
      name: branch.name,
      commitSha: branch.commit.sha,
    }));

    // Insert or update branches
    for (const branch of branchesToInsert) {
      const existing = await db.select()
        .from(branches)
        .where(and(eq(branches.repoId, repoId), eq(branches.name, branch.name)))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(branches).values(branch);
      } else {
        await db.update(branches)
          .set({ commitSha: branch.commitSha, updatedAt: new Date() })
          .where(eq(branches.id, existing[0].id));
      }
    }

    // Return branches from DB
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
    const branches = await db.select()
      .from(branches)
      .where(eq(branches.repoId, repoId));

    return { branches };
  } catch (error) {
    console.error('Error fetching branches:', error);
    return { error: 'Failed to fetch branches' };
  }
}

