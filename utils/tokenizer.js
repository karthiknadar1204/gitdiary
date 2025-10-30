'use server'

// Lightweight token estimation with optional tiktoken import. Falls back to heuristic.

let encoder = null;

async function getEncoder(model = 'gpt-4o-mini') {
  if (encoder) return encoder;
  try {
    // Dynamic import if available in the project; otherwise will throw
    const { encoding_for_model } = await import('tiktoken');
    encoder = encoding_for_model(model);
    return encoder;
  } catch (_err) {
    return null;
  }
}

export async function estimateTokensForText(text, model = 'gpt-4o-mini') {
  if (!text) return 0;
  const enc = await getEncoder(model);
  if (enc) {
    try {
      const tokens = enc.encode(text);
      return tokens.length;
    } catch (_err) {}
  }
  // Heuristic: ~4 chars per token average
  return Math.ceil(text.length / 4);
}

export async function estimateTokensForJson(obj, model = 'gpt-4o-mini') {
  try {
    const text = JSON.stringify(obj);
    return await estimateTokensForText(text, model);
  } catch (_err) {
    return 0;
  }
}


