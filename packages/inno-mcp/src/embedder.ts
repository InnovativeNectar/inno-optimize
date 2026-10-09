export const EMBEDDING_DIMENSIONS = 384;

export interface Embedder {
  embed(text: string): Promise<number[]>;
}

function fnv1a(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function hashEmbedding(text: string, dimensions: number = EMBEDDING_DIMENSIONS): number[] {
  const vector = new Array<number>(dimensions).fill(0);
  const tokens = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0);

  if (tokens.length === 0) {
    vector[0] = 1;
    return vector;
  }

  for (const token of tokens) {
    const index = fnv1a(token) % dimensions;
    vector[index] = (vector[index] ?? 0) + 1;
  }

  let norm = 0;
  for (const value of vector) {
    norm += value * value;
  }
  norm = Math.sqrt(norm);
  if (norm === 0) {
    vector[0] = 1;
    return vector;
  }
  return vector.map((value) => value / norm);
}

export const hashEmbedder: Embedder = {
  embed: async (text: string): Promise<number[]> => hashEmbedding(text),
};
