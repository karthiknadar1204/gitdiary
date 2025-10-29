'use server';

import { auth } from '@clerk/nextjs/server';
import { db } from '@/config/db';
import { repos, users } from '@/config/schema';
import { eq } from 'drizzle-orm';

export async function getUserRepos() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return { error: 'Unauthorized' };
    }

    const [user] = await db.select().from(users).where(eq(users.clerkId, userId)).limit(1);
    if (!user) {
      return { error: 'User not found' };
    }

    const userRepos = await db.select()
      .from(repos)
      .where(eq(repos.userId, user.id));

    return { repos: userRepos };
  } catch (error) {
    console.error('Error fetching repositories:', error);
    return { error: 'Failed to fetch repositories' };
  }
}

