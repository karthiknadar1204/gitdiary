'use client';

import { useEffect, useState } from 'react';
import { getUserRepos } from '@/utils/getUserRepos';
import { addRepository } from '@/utils/addRepository';
import { Card } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export default function Dashboard() {
  const router = useRouter();
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [repoUrl, setRepoUrl] = useState('');
  const [saving, setSaving] = useState(false);

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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="h-9 px-4">Add Repository</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a GitHub repository</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Input
                placeholder="https://github.com/username/repository"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                onClick={async () => {
                  if (!repoUrl || saving) return;
                  setSaving(true);
                  const result = await addRepository(repoUrl);
                  setSaving(false);
                  if (result?.error) {
                    console.error(result.error);
                    return;
                  }
                  // Refresh list
                  setLoading(true);
                  const updated = await getUserRepos();
                  if (!updated.error) setRepos(updated.repos || []);
                  setLoading(false);
                  setRepoUrl('');
                  setIsAddOpen(false);
                }}
                disabled={saving}
              >
                {saving ? 'Analyzing…' : 'Analyze Repository'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
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