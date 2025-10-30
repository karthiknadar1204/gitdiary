"use client";

import { GitBranch, Github } from "lucide-react";
import Link from "next/link";
import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from '@clerk/nextjs';

export function Header() {
  return (
    <header className="border-b border-border">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="h-6 w-6 text-primary" />
          <span className="text-xl font-semibold">Git Diary</span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
          >
            <Github className="h-4 w-4" />
            View on GitHub
          </a>
          <SignedOut>
            <SignInButton mode="modal">
              <button className="bg-primary text-primary-foreground rounded-full font-medium text-sm px-4 h-9 cursor-pointer hover:bg-primary/90 transition-colors">
                Sign In
              </button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <Link href="/dashboard">
              <button className="bg-primary text-primary-foreground rounded-full font-medium text-sm px-4 h-9 cursor-pointer hover:bg-primary/90 transition-colors">
                Dashboard
              </button>
            </Link>
            <UserButton />
          </SignedIn>
        </div>
      </div>
    </header>
  );
}

