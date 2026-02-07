import OpenAI from 'openai';
import { config } from '../config.js';

const embeddingClient = new OpenAI({
  baseURL: config.embeddings.url,
  apiKey: 'dummy-key', // LM Studio doesn't require real auth
});

export interface EmbeddingResult {
  vector: number[];
  dimension: number;
}

export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  try {
    const response = await embeddingClient.embeddings.create({
      model: config.embeddings.model,
      input: text,
      encoding_format: 'float',
    });

    const vector = response.data[0].embedding;
    
    return {
      vector,
      dimension: vector.length,
    };
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

export async function generateBatchEmbeddings(
  texts: string[]
): Promise<EmbeddingResult[]> {
  const batchSize = 10;
  const results: EmbeddingResult[] = [];

  // Use explicit model name to ensure correct dimension (768)
  const modelName = config.embeddings.model;

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);

    try {
      const response = await embeddingClient.embeddings.create({
        model: modelName,
        input: batch,
        encoding_format: 'float',
      });

      const embeddings = response.data.map(item => ({
        vector: item.embedding,
        dimension: item.embedding.length,
      }));

      results.push(...embeddings);
    } catch (error) {
      console.error(`Error in batch ${i / batchSize}:`, error);
      throw error;
    }
  }

  return results;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
