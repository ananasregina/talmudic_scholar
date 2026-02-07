import { pool } from '../db/init.js';
import { generateEmbedding } from './embeddings.js';
import { config } from '../config.js';
import OpenAI from 'openai';

export interface Document {
  id: number;
  content: string;
  hebrew: string | null;
  english: string;
  source: string;
  ref: string;
  metadata: any;
}

export interface SearchResult {
  id: number;
  content: string;
  hebrew: string | null;
  english: string;
  source: string;
  ref: string;
  metadata: any;
  similarity: number;
}

export interface LegacySearchResult {
  document: Document;
  similarity: number;
}

/**
 * Vector Similarity Search using pgvector cosine distance
 */
export async function search(
  query: string,
  topK: number = 5,
  threshold: number = 0.3
): Promise<SearchResult[]> {
  try {
    const queryEmbedding = await generateEmbedding(query);
    const vectorArray = `[${queryEmbedding.vector.join(',')}]`;

    const sql = `
      SELECT
        id,
        content,
        hebrew,
        english,
        source,
        ref,
        metadata,
        1 - (embedding <=> $1::vector) as similarity
      FROM documents
      WHERE 1 - (embedding <=> $1::vector) < $2
      ORDER BY similarity DESC
      LIMIT $3
    `;

    const result = await pool.query(sql, [vectorArray, 1 - threshold, topK]);

    return result.rows.map((row: any) => ({
      id: row.id,
      content: row.content,
      hebrew: row.hebrew,
      english: row.english,
      source: row.source,
      ref: row.ref,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      similarity: row.similarity,
    }));
  } catch (error) {
    console.error('Error in RAG search:', error);
    throw error;
  }
}

/**
 * Legacy search function for backward compatibility
 */
export async function searchSimilar(
  query: string,
  limit: number = 5,
  sourceFilter?: string
): Promise<LegacySearchResult[]> {
  try {
    const queryEmbedding = await generateEmbedding(query);
    const vectorArray = `[${queryEmbedding.vector.join(',')}]`;

    let sql = `
      SELECT
        id,
        content,
        hebrew,
        english,
        source,
        ref,
        metadata,
        1 - (embedding <=> $1::vector) as similarity
      FROM documents
      WHERE embedding IS NOT NULL
    `;

    const params: any[] = [vectorArray];
    let paramCount = 1;

    if (sourceFilter) {
      paramCount++;
      sql += ` AND source = $${paramCount}`;
      params.push(sourceFilter);
    }

    sql += `
      ORDER BY embedding <=> $1::vector
      LIMIT $${paramCount + 1}
    `;
    params.push(limit);

    const result = await pool.query(sql, params);

    return result.rows.map((row: any) => ({
      document: {
        id: row.id,
        content: row.content,
        hebrew: row.hebrew,
        english: row.english,
        source: row.source,
        ref: row.ref,
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      },
      similarity: row.similarity,
    }));
  } catch (error) {
    console.error('Error in RAG search:', error);
    throw error;
  }
}

/**
 * Talmudic Scholar System Prompt for GLM 4.7
 */
const TALMUDIC_SCHOLAR_SYSTEM_PROMPT = `<system>
## I. CORE IDENTITY

You are a sophisticated Talmudic learning companion synthesizing:

1. **Analytical Rigor**: PhD-level Brisker methodology
   - Every response reveals underlying conceptual structures (chakiras)

2. **Pastoral Wisdom**: Boundless ahavat Yisrael
   - Meeting every user with patience and warmth

3. **Talmudic Expertise**: Deep knowledge of:
   - Tanakh (Torah, Nevi'im, Ketuvim)
   - Mishnah and Talmud Bavli and Yerushalmi
   - Rishonim: Rashi, Tosafot, Rambam, Ramban
   - Acharonim: Shulchan Aruch, Mishnah Berurah

**Operating Principle**: Precision delivered with gentle wisdom. You are a havruta (study partner), never a posek.
</system>

## II. SAFETY PROTOCOLS

### Halachic Disclaimer [MANDATORY]
For ANY practical halachic matter, MUST append:
> "NOTE: This Torah discussion is educational, not psak halacha. Practical decisions require consulting your local Orthodox rabbi."

### Professional Boundaries
- Medical: "For medical concerns, consult qualified healthcare providers."
- Legal: "For legal advice, consult an attorney."
- Psychological: "For mental health, please see a licensed therapist."

## III. RESPONSE ARCHITECTURE

### Anchor in Sources
- Cite 1-3 primary texts with precision: ex. "Berakhot 2a" | "Shabbat 31a:12-15"
- Extract and articulate chakira for disputes

### Multi-Dimensional Analysis [PaRDeS Layers]
- **Peshat**: Contextual plain meaning
- **Remez**: Intertextual connections
- **Drash**: Homiletical insights
- When uncertain, choose humility over assertion
</system>`;

/**
 * GLM 4.7 LLM client for Z.AI
 */
const llmClient = new OpenAI({
  apiKey: config.zai.apiKey,
  baseURL: config.zai.apiUrl,
});

/**
 * Generate response using GLM 4.7 with Talmudic context
 */
export async function generateResponse(
  query: string,
  context: SearchResult[]
): Promise<string> {
  try {
    const contextText = context
      .map((doc, i) => `[${i + 1}] ${doc.source} ${doc.ref}: ${doc.content}`)
      .join('\n\n');

    const response = await llmClient.chat.completions.create({
      model: config.zai.model,
      messages: [
        {
          role: 'system',
          content: TALMUDIC_SCHOLAR_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: `Using the following Talmudic sources, please answer: ${query}\n\n${contextText}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 3000,
      // @ts-ignore - Z.AI specific parameter for Max Reasoning / Preserved Thinking
      clear_thinking: false,
    });

    return response.choices[0].message.content || 'I apologize, but I could not generate a response.';
  } catch (error) {
    console.error('Error generating LLM response:', error);
    throw error;
  }
}

/**
 * RAG Pipeline: Retrieve + Generate
 */
export async function ragQuery(query: string): Promise<string> {
  try {
    const context = await search(query, 5, 0.3);

    if (context.length === 0) {
      return 'I could not find relevant Talmudic sources. Please rephrase your question.';
    }

    const answer = await generateResponse(query, context);

    return answer;
  } catch (error) {
    console.error('Error in RAG query:', error);
    throw error;
  }
}

/**
 * Legacy function for backward compatibility
 */
export async function getContextForQuery(
  query: string,
  maxResults: number = 3
): Promise<string> {
  const results = await searchSimilar(query, maxResults);

  if (results.length === 0) {
    return 'No relevant context found in the Talmudic corpus.';
  }

  const contextBlocks = results.map(
    (result, index) =>
      `[${index + 1}] ${result.document.ref} (${result.document.source}):\n${result.document.content}`
  );

  return `RELEVANT PASSAGES FROM TALMUDIC TEXTS:\n\n${contextBlocks.join('\n\n')}`;
}
