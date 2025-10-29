'use server';

import { db } from '@/config/db';
import { users } from '@/config/schema';
import { eq } from 'drizzle-orm';

export async function syncUser(clerkId, email, name) {
  try {
    if (!clerkId || !email || !name) {
      return { error: 'Clerk ID, email and name are required' };
    }

    const existingUser = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);

    if (existingUser.length > 0) {
      return { user: existingUser[0], created: false };
    } else {
      const [newUser] = await db.insert(users).values({
        clerkId,
        email,
        name,
      }).returning();

      return { user: newUser, created: true };
    }
  } catch (error) {
    console.error('Error syncing user:', error);
    return { error: 'Failed to sync user' };
  }
}

