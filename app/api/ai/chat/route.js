'use server'

import { NextResponse } from 'next/server';
import { getOpenAI } from '@/utils/ai/openai';

export async function POST(req) {
    try {
        const { batches, userPrompt, conversationHistory = [] } = await req.json();

        if (!batches || batches.length === 0) {
            return NextResponse.json({ error: 'No commits selected' }, { status: 400 });
        }

    const openai = getOpenAI();

    const systemPrompt = `You are Smart Git Historian, an AI assistant that explains the evolution of code in plain English.

Your role:
- Act like a senior engineer reviewing commits and PRs.
- Translate raw commit history, diffs, PRs, and issues into clear, structured narratives.

Core objectives:
1. Summarize what changed in each commit, PR, or issue.
2. Explain why it changed, using commit messages, PR descriptions, and linked issues as context.
3. Highlight patterns or repeated changes (e.g., rewrites, recurring bugfixes).
4. Identify risks or fragile areas if the same file has been heavily modified.
5. Write in plain, accessible English so a new developer or PM could understand.

Rules for output:
- Be structured and concise — avoid rambling.
- When multiple commits are analyzed:
  - Give a high-level evolution summary first.
  - Then, list per-commit insights (commit message + purpose).
- When PRs or issues are present, integrate their context into the explanation.
- If diffs are provided, summarize the essence of the code changes (not every line).
- Use bullet points or sections when helpful.
- Always end with a short overall takeaway: what this means for the stability, purpose, or direction of the code.

Tone:
- Professional, clear, and explanatory.
- No assumptions beyond the given context, but infer intent when obvious.`;

        const userContent = `${userPrompt || 'Please analyze these commits'}

Here are the commits:
${JSON.stringify(batches, null, 2)}`;

    // Build messages array: system prompt, conversation history (last 5), and new user message
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory, // Last 5 messages from previous conversation
      { role: 'user', content: userContent },
    ];

    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      stream: true,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content || '';
          if (text) {
            controller.enqueue(encoder.encode(text));
          }
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: { 'Content-Type': 'text/event-stream' },
    });
    } catch (error) {
        console.error('AI API error:', error);
        return NextResponse.json({ error: 'Failed to get AI response' }, { status: 500 });
    }
}
