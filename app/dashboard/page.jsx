'use client';

import { useEffect, useState } from 'react';
import { getUserRepos } from '@/utils/getUserRepos';
import { Card } from '@/components/ui/card';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const router = useRouter();
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUserRepos().then((result) => {
      if (result.error) {
        console.error(result.error);
      } else {
        setRepos(result.repos || []);
      }
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="container mx-auto px-6 py-20">Loading...</div>;
  }

  return (
    <div className="container mx-auto px-6 py-20">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {repos.map((repo) => (
          <Card 
            key={repo.id} 
            className="p-6 cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => router.push(`/dashboard/${repo.id}`)}
          >
            <h2 className="text-xl font-semibold mb-2">{repo.name}</h2>
            <p className="text-muted-foreground mb-2">Owner: {repo.owner}</p>
            <p className="text-muted-foreground mb-2">Default Branch: {repo.defaultBranch || 'N/A'}</p>
            <a 
              href={repo.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {repo.url}
            </a>
          </Card>
        ))}
      </div>
    </div>
  );
}