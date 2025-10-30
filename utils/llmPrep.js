'use server'

import { estimateTokensForJson } from '@/utils/tokenizer';

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_MAX_TOKENS = 8000; // soft ceiling before summarizing / chunking

function summarizePatch(patch) {
  if (!patch || typeof patch !== 'string') return '';
  const lines = patch.split('\n');
  const summary = [];
  let added = 0, removed = 0;
  for (const line of lines) {
    if (line.startsWith('@@')) summary.push(line);
    if (line.startsWith('+') && !line.startsWith('+++')) added++;
    if (line.startsWith('-') && !line.startsWith('---')) removed++;
  }
  if (summary.length > 15) summary.length = 15; // cap hunk headers
  summary.push(`(+${added} / -${removed})`);
  return summary.join('\n');
}

function stripLargeContent(files) {
  return files.map(f => ({
    filename: f.filename,
    additions: f.additions,
    deletions: f.deletions,
    // Keep only summarized patch content to control tokens
    patchSummary: summarizePatch(f.patch || ''),
  }));
}

export async function buildLlmBatches({
  commitsDetailed,
  model = DEFAULT_MODEL,
  maxTokens = DEFAULT_MAX_TOKENS,
}) {
  // First try full payload; if too large, summarize diffs and chunk
  const fullPayload = commitsDetailed.map(c => ({
    commitId: c.commitId,
    sha: c.sha,
    message: c.message,
    authorName: c.authorName,
    date: c.date,
    prs: c.prs || [],
    issues: c.issues || [],
    files: c.files || [],
  }));

  const fullTokens = await estimateTokensForJson(fullPayload, model);
  if (fullTokens <= maxTokens) {
    return [{ payload: fullPayload, tokens: fullTokens, summarized: false }];
  }

  // Summarize diffs to reduce size
  const summarized = commitsDetailed.map(c => ({
    commitId: c.commitId,
    sha: c.sha,
    message: c.message,
    authorName: c.authorName,
    date: c.date,
    prs: (c.prs || []).map(p => ({ number: p.number, title: p.title, state: p.state })),
    issues: (c.issues || []).map(i => ({ number: i.number, title: i.title, state: i.state })),
    files: stripLargeContent(c.files || []),
  }));

  // Chunk by tokens (greedy pack)
  const batches = [];
  let current = [];
  let currentTokens = 0;

  for (const commit of summarized) {
    const tentative = [...current, commit];
    const tks = await estimateTokensForJson(tentative, model);
    if (tks > maxTokens && current.length > 0) {
      batches.push({ payload: current, tokens: currentTokens, summarized: true });
      current = [commit];
      currentTokens = await estimateTokensForJson(current, model);
    } else {
      current = tentative;
      currentTokens = tks;
    }
  }
  if (current.length > 0) batches.push({ payload: current, tokens: currentTokens, summarized: true });

  return batches;
}


