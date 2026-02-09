import { config } from '../config.js';

export const SQL = {
  CREATE_EXTENSION: `
    CREATE EXTENSION IF NOT EXISTS vector;
  `,

  CREATE_DOCUMENTS_TABLE: `
    CREATE TABLE IF NOT EXISTS documents (
      id BIGSERIAL PRIMARY KEY,
      content TEXT NOT NULL,
      hebrew TEXT,
      english TEXT,
      source TEXT NOT NULL,              -- "Torah" | "Mishnah" | "Talmud" | "Commentary"
      ref TEXT NOT NULL,                 -- "Genesis 1:1" | "Berakhot 2a" | "Shabbat 31a:12-15"
      chapter INTEGER,
      verse_or_mishnah TEXT,            -- "1" | "1:1" | "2a:1"
      daf TEXT,                         -- For Talmud: "31a"
      lines_start INTEGER,
      lines_end INTEGER,
      speaker TEXT,                      -- "Rabbi Meir" | "Rabbi Judah"
      metadata JSONB,                    -- Flexible: {language, layer, speakers, topics}
      embedding VECTOR(${config.embeddings.dimension}),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `,

  CREATE_INDEX_VECTOR: `
    CREATE INDEX IF NOT EXISTS documents_embedding_idx
    ON documents
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);
  `,

  CREATE_INDEX_REF: `
    CREATE INDEX IF NOT EXISTS documents_ref_idx
    ON documents (ref);
  `,

  CREATE_INDEX_SOURCE: `
    CREATE INDEX IF NOT EXISTS documents_source_idx
    ON documents (source);
  `
} as const;
