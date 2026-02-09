import dotenv from 'dotenv';

dotenv.config();

export interface Config {
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
  };
  embeddings: {
    url: string;
    model: string;
    dimension: number;
    chunkSizeBytes: number;
  };
  llm: {
    apiKey: string;
    apiUrl: string;
    model: string;
    reasoningEffort: string;
    contextWindowMaxTokens: number;
  };
}

export const config: Config = {
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    name: process.env.DB_NAME || 'talmudic_scholar',
    user: process.env.DB_USER || 'talimoreno',
    password: process.env.DB_PASSWORD || '',
  },
  embeddings: {
    url: process.env.EMBEDDING_URL || 'http://127.0.0.1:1338/v1',
    model: process.env.EMBEDDING_MODEL || 'text-embedding-bge-m3',
    dimension: parseInt(process.env.EMBEDDING_DIMENSION || '768'),
    chunkSizeBytes: parseInt(process.env.EMBEDDING_CHUNK_SIZE_BYTES || '1024'),
  },
  llm: {
    apiKey: process.env.LLM_API_KEY || '',
    apiUrl: process.env.LLM_API_URL || 'https://openrouter.ai/api/v1',
    model: process.env.LLM_MODEL || 'openrouter/pony-alpha',
    reasoningEffort: process.env.LLM_REASONING_EFFORT || 'xhigh',
    contextWindowMaxTokens: parseInt(process.env.CONTEXT_WINDOW_MAX_TOKENS || '200000'),
  },
};
