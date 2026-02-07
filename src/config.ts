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
  zai: {
    apiKey: string;
    apiUrl: string;
    model: string;
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
    model: process.env.EMBEDDING_MODEL || 'text-embedding-nomic-embed-text-v1.5-embedding',
    dimension: parseInt(process.env.EMBEDDING_DIMENSION || '768'),
    chunkSizeBytes: parseInt(process.env.EMBEDDING_CHUNK_SIZE_BYTES || '1024'),
  },
  zai: {
    apiKey: process.env.ZAI_API_KEY || '',
    apiUrl: process.env.ZAI_API_URL || 'https://open.bigmodel.cn/api/paas/v4/',
    model: process.env.ZAI_MODEL || 'glm-4-plus',
  },
};
