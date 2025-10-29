'use server';

import { auth } from '@clerk/nextjs/server';
import { db } from '@/config/db';
import { repos, users } from '@/config/schema';
import { eq, and } from 'drizzle-orm';

export async function addRepository(repoUrl) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return { error: 'Unauthorized' };
    }

    // Extract owner and repo name from URL (handle various formats)
    const cleanUrl = repoUrl.trim().replace(/\/$/, ''); // Remove trailing slash
    const match = cleanUrl.match(/github\.com\/([\w\-\.]+)\/([\w\-\.]+)(?:\/|$)/);
    if (!match) {
      return { error: 'Invalid GitHub URL' };
    }

    const [, owner, name] = match;

    // Get user from database
    const [user] = await db.select().from(users).where(eq(users.clerkId, userId)).limit(1);
    if (!user) {
      return { error: 'User not found' };
    }

    // Fetch repo details from GitHub API
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      console.error('GITHUB_TOKEN is not set in environment variables');
      return { error: 'GitHub token not configured' };
    }

    console.log('Fetching repo:', owner, name);
    const response = await fetch(`https://api.github.com/repos/${owner}/${name}`, {
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GitHub API Error:', response.status, errorText);
      return { error: `Failed to fetch repository from GitHub: ${response.status}` };
    }

    const repoData = await response.json();

    // Check if repo already exists for this user
    const existingRepo = await db.select()
      .from(repos)
      .where(and(eq(repos.url, cleanUrl), eq(repos.userId, user.id)))
      .limit(1);

    if (existingRepo.length > 0) {
      return { repo: existingRepo[0], created: false };
    }

    // Insert new repo
    const [newRepo] = await db.insert(repos).values({
      userId: user.id,
      owner: repoData.owner.login,
      name: repoData.name,
      url: cleanUrl,
      defaultBranch: repoData.default_branch,
    }).returning();

    return { repo: newRepo, created: true };
  } catch (error) {
    console.error('Error adding repository:', error);
    return { error: 'Failed to add repository' };
  }
}

