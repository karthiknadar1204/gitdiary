"use client";

import { FileCode, GitCommit, Sparkles } from "lucide-react";

export function Features() {
  const features = [
    {
      icon: FileCode,
      title: "Visual File Explorer",
      description: "Navigate your repository structure with an intuitive tree view. Select any file to see its complete commit history."
    },
    {
      icon: GitCommit,
      title: "Linked Timeline",
      description: "View commits with their associated PRs and issues. Understand the context behind every code change."
    },
    {
      icon: Sparkles,
      title: "AI-Powered Analysis",
      description: "Get intelligent summaries of file evolution. Select commits to generate comprehensive reports."
    }
  ];

  return (
    <section className="container mx-auto px-6 py-20">
      <div className="grid md:grid-cols-3 gap-8">
        {features.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <div key={index} className="p-6 bg-card border border-border rounded-lg hover:border-primary/50 transition-colors">
              <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <Icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

