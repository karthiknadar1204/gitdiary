import OpenAI from 'openai';

let client = null;

export function getOpenAI() {
  if (client) return client;
  client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}


