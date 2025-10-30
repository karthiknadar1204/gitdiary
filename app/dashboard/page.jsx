'use client';

import { useEffect, useState } from 'react';
import { getUserRepos } from '@/utils/getUserRepos';
import { addRepository } from '@/utils/addRepository';
import { Card } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { GitBranch, Calendar, ExternalLink, ArrowRight } from 'lucide-react';

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
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {repos.map((repo) => (
          <Card 
            key={repo.id} 
            className="p-4 hover:border-primary/50 transition-colors group"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h2 className="text-lg font-semibold mb-1">{repo.name}</h2>
                <p className="text-xs text-muted-foreground">{repo.owner}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/dashboard/${repo.id}`);
                }}
              >
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
            
            <div className="space-y-2 mb-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium">Default:</span>
                <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{repo.defaultBranch || 'N/A'}</code>
              </div>
              
              {repo.createdAt && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>Added {new Date(repo.createdAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>
            
            <div className="pt-3 border-t border-border">
              <a 
                href={repo.url} 
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="h-3 w-3" />
                View on GitHub
              </a>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}