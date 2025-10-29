'use server';

import { auth } from '@clerk/nextjs/server';
import { db } from '@/config/db';
import { branches, files } from '@/config/schema';
import { eq, and } from 'drizzle-orm';

export async function fetchFileTreeFromGitHub(owner, repoName, branchName) {
  try {
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return { error: 'GitHub token not configured' };
    }

    const response = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/trees/${branchName}?recursive=1`, {
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GitHub API Error:', response.status, errorText);
      return { error: `Failed to fetch file tree: ${response.status}` };
    }

    const treeData = await response.json();
    return { tree: treeData };
  } catch (error) {
    console.error('Error fetching file tree:', error);
    return { error: 'Failed to fetch file tree' };
  }
}

export async function syncFileTree(repoId, branchId, owner, repoName, branchName) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { error: 'Unauthorized' };
    }

    // Fetch file tree from GitHub
    const result = await fetchFileTreeFromGitHub(owner, repoName, branchName);
    if (result.error) {
      return result;
    }

    // Delete existing files for this branch
    await db.delete(files).where(eq(files.branchId, branchId));

    // Process tree data and store files
    const filesToInsert = result.tree.tree
      .filter(item => {
        // Filter out node_modules
        if (item.path.includes('node_modules/') || item.path === 'node_modules') {
          return false;
        }
        return item.type === 'blob' || item.type === 'tree';
      })
      .map(item => ({
        branchId,
        path: item.path,
        type: item.type === 'blob' ? 'file' : 'folder',
      }));

    if (filesToInsert.length > 0) {
      await db.insert(files).values(filesToInsert);
    }

    // Return files from DB
    const dbFiles = await db.select()
      .from(files)
      .where(eq(files.branchId, branchId));

    // Sort files by path
    dbFiles.sort((a, b) => a.path.localeCompare(b.path));

    return { files: dbFiles };
  } catch (error) {
    console.error('Error syncing file tree:', error);
    return { error: 'Failed to sync file tree' };
  }
}

export async function getFilesForBranch(branchId) {
  try {
    const filesList = await db.select()
      .from(files)
      .where(eq(files.branchId, branchId));

    // Sort files by path
    filesList.sort((a, b) => a.path.localeCompare(b.path));

    return { files: filesList };
  } catch (error) {
    console.error('Error fetching files:', error);
    return { error: 'Failed to fetch files' };
  }
}

