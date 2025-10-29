"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, FileCode, GitCommit } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { addRepository } from "@/utils/addRepository";

export function Hero() {
  const router = useRouter();
  const [repoUrl, setRepoUrl] = useState("");

  const handleAnalyze = async () => {
    if (!repoUrl) return;
    
    const result = await addRepository(repoUrl);
    if (result.error) {
      console.error(result.error);
      return;
    }
    
    router.push("/dashboard");
  };

  return (
    <section className="container mx-auto px-6 py-20">
      <div className="max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full mb-6 border border-primary/20">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-primary">AI-Powered Repository Analysis</span>
        </div>
        
        <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
          Understand Your Code's
          <span className="text-primary block">Evolution Story</span>
        </h1>
        
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Git Diary visualizes your repository's history with AI-powered insights. 
          Track commits, PRs, and issues together to understand how your code evolved over time.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto mb-12">
          <Input
            placeholder="https://github.com/username/repository"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            className="flex-1 h-12 bg-card border-border"
          />
          <Button 
            onClick={handleAnalyze}
            size="lg"
            className="h-12 px-8"
          >
            Analyze Repository
          </Button>
        </div>

        <div className="flex items-center justify-center gap-8 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <FileCode className="h-4 w-4" />
            <span>File History</span>
          </div>
          <div className="flex items-center gap-2">
            <GitCommit className="h-4 w-4" />
            <span>Commit Timeline</span>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            <span>AI Insights</span>
          </div>
        </div>
      </div>
    </section>
  );
}

