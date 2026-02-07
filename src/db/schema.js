"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SQL = void 0;
exports.SQL = {
    CREATE_EXTENSION: "\n    CREATE EXTENSION IF NOT EXISTS vector;\n  ",
    CREATE_DOCUMENTS_TABLE: "\n    CREATE TABLE IF NOT EXISTS documents (\n      id BIGSERIAL PRIMARY KEY,\n      content TEXT NOT NULL,\n      hebrew TEXT,\n      english TEXT,\n      source TEXT NOT NULL,              -- \"Torah\" | \"Mishnah\" | \"Talmud\" | \"Commentary\"\n      ref TEXT NOT NULL,                 -- \"Genesis 1:1\" | \"Berakhot 2a\" | \"Shabbat 31a:12-15\"\n      chapter INTEGER,\n      verse_or_mishnah TEXT,            -- \"1\" | \"1:1\" | \"2a:1\"\n      daf TEXT,                         -- For Talmud: \"31a\"\n      lines_start INTEGER,\n      lines_end INTEGER,\n      speaker TEXT,                      -- \"Rabbi Meir\" | \"Rabbi Judah\"\n      metadata JSONB,                    -- Flexible: {language, layer, speakers, topics}\n      embedding VECTOR(768),\n      created_at TIMESTAMP DEFAULT NOW(),\n      updated_at TIMESTAMP DEFAULT NOW()\n    );\n  ",
    CREATE_INDEX_VECTOR: "\n    CREATE INDEX IF NOT EXISTS documents_embedding_idx\n    ON documents\n    USING ivfflat (embedding vector_cosine_ops)\n    WITH (lists = 100);\n  ",
    CREATE_INDEX_REF: "\n    CREATE INDEX IF NOT EXISTS documents_ref_idx\n    ON documents (ref);\n  ",
    CREATE_INDEX_SOURCE: "\n    CREATE INDEX IF NOT EXISTS documents_source_idx\n    ON documents (source);\n  "
};
