"use client";

import { Button } from "@/components/ui/button";
import { TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";

export function CTA() {
  const router = useRouter();

  const handleGetStarted = () => {
    router.push("/dashboard");
  };

  return (
    <section className="container mx-auto px-6 py-20">
      <div className="max-w-4xl mx-auto text-center bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 rounded-xl p-12">
        <TrendingUp className="h-12 w-12 text-primary mx-auto mb-4" />
        <h2 className="text-3xl font-bold mb-4">Ready to explore your repository?</h2>
        <p className="text-muted-foreground mb-6">
          Start understanding your code's journey in minutes.
        </p>
        <Button 
          onClick={handleGetStarted}
          size="lg"
          className="px-8"
        >
          Get Started Free
        </Button>
      </div>
    </section>
  );
}

