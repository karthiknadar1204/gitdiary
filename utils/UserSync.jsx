'use client';

import { useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { syncUser } from './syncUser';

export default function UserSync() {
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (isLoaded && user) {
      const clerkId = user.id;
      const email = user.primaryEmailAddress?.emailAddress || '';
      const name = user.fullName || user.firstName || 'User';

      syncUser(clerkId, email, name)
        .then(data => {
          console.log('User synced:', data);
        })
        .catch(error => {
          console.error('Error syncing user:', error);
        });
    }
  }, [user, isLoaded]);

  return null;
}