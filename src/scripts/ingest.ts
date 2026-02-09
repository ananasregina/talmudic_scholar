import fs from 'fs/promises';
import path from 'path';
import { pool } from '../db/init.js';
import { generateBatchEmbeddings } from '../services/embeddings.js';
import { config } from '../config.js';

// ============================================================================
// INTERFACES
// ============================================================================

export interface TextChunk {
  id: string;
  content: string;
  hebrew?: string;
  english: string;
  source: 'Torah' | 'Mishnah' | 'Talmud';
  ref: string;
  metadata: ChunkMetadata;
}

export interface ChunkMetadata {
  chapter?: number;
  verse_or_mishnah?: string;
  daf?: string;
  lines_start?: number;
  lines_end?: number;
  speakers: string[];
  topic: string;
  layer?: 'peshat' | 'remez' | 'drash';
}

export interface SefariaData {
  title: string;
  language: string;
  versionTitle: string;
  versionSource: string;
  text: (string[] | string[][])[];
  he?: (string[] | string[][])[];
}

export interface SefariaDataWithHebrew {
  title: string;
  heTitle?: string;
  language: string;
  versionTitle: string;
  versionSource: string;
  text: (string[] | string[][])[];
  he?: (string[] | string[][])[];
}

/**
 * Normalize Sefaria data to consistent format
 * Handles both string[][] (direct) and string[] (array of arrays) formats
 */
function normalizeSefariaData(data: SefariaData): SefariaDataWithHebrew {
  // Check if text is already a 2D array
  if (Array.isArray(data.text[0])) {
    return data as SefariaDataWithHebrew;
  }

  // Handle case where text is string[] but should be string[][] (one chapter)
  const normalizedText = [data.text] as unknown as (string[] | string[][])[];
  const normalizedHe = data.he ? [data.he] as unknown as (string[] | string[][])[] : undefined;

  return {
    ...data,
    text: normalizedText,
    he: normalizedHe
  };
}
// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function stripHtml(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&thinsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractSpeakers(text: string): string[] {
  const speakers: string[] = [];
  const patterns = [
    /רַבִּי\s+([א-ת]+)/g,          // Rabbi [Name]
    /רַבָּן\s+([א-ת]+)/g,           // Rabban [Name]
    /אָמַר\s+([א-ת]+)/g,            // [Name] said
    /אָמְרוּ\s+([א-ת]+)/g,          // [Name] said (plural)
    /אָמַר\s+לֵיהַּ\s+([א-ת]+)/g,   // [Name] said to him
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const speaker = match[1];
      if (speaker && !speakers.includes(speaker)) {
        speakers.push(speaker);
      }
    }
  }

  return speakers;
}

function extractTopic(text: string): string {
  // Simple topic extraction - first significant phrase
  const cleaned = stripHtml(text);
  const sentences = cleaned.split(/[.!?]/);
  if (sentences.length > 0) {
    const firstSentence = sentences[0].trim();
    // Take first 50 characters as topic hint
    return firstSentence.substring(0, 50) + (firstSentence.length > 50 ? '...' : '');
  }
  return '';
}

function detectLayer(text: string): 'peshat' | 'remez' | 'drash' | undefined {
  // Very basic layer detection based on text patterns
  if (text.includes('דְרָשׁ') || text.includes('מִדְרָשׁ')) {
    return 'drash';
  }
  if (text.includes('רֶמֶז') || text.includes('מְרֻמָּז')) {
    return 'remez';
  }
  return 'peshat';
}

// ============================================================================
// CHUNKING STRATEGIES
// ============================================================================

/**
  * Torah chunking: By verse (chapter:verse structure)
  */
function chunkTorah(sefariaData: SefariaDataWithHebrew): TextChunk[] {
  const chunks: TextChunk[] = [];
  const normalizedData = normalizeSefariaData(sefariaData);

  for (let chapter = 0; chapter < normalizedData.text.length; chapter++) {
    const verses = normalizedData.text[chapter];
    const hebrewVerses = normalizedData.he ? normalizedData.he[chapter] : [];

    for (let verse = 0; verse < verses.length; verse++) {
      const verseContent = verses[verse];
      const english = stripHtml(Array.isArray(verseContent) ? verseContent.join(' ') : (verseContent || ''));
      const hebrewVerseContent = hebrewVerses[verse];
      const hebrew = hebrewVerseContent ? stripHtml(Array.isArray(hebrewVerseContent) ? hebrewVerseContent.join(' ') : hebrewVerseContent) : '';
      const content = english || hebrew;

      if (!content) continue;

      chunks.push({
        id: generateId(),
        content,
        hebrew: hebrew || undefined,
        english,
        source: 'Torah',
        ref: `${sefariaData.title} ${chapter + 1}:${verse + 1}`,
        metadata: {
          chapter: chapter + 1,
          verse_or_mishnah: `${verse + 1}`,
          speakers: [],
          topic: extractTopic(content),
          layer: detectLayer(content),
        },
      });
    }
  }

  return chunks;
}

/**
  * Mishnah chunking: By mishnah unit (chapter:mishnah structure)
  */
function chunkMishnah(sefariaData: SefariaDataWithHebrew): TextChunk[] {
  const chunks: TextChunk[] = [];
  const normalizedData = normalizeSefariaData(sefariaData);

  for (let chapter = 0; chapter < normalizedData.text.length; chapter++) {
    const mishnayot = normalizedData.text[chapter];
    const hebrewMishnayot = normalizedData.he ? normalizedData.he[chapter] : [];

    for (let mishnah = 0; mishnah < mishnayot.length; mishnah++) {
      const mishnahContent = mishnayot[mishnah];
      const english = stripHtml(Array.isArray(mishnahContent) ? mishnahContent.join(' ') : (mishnahContent || ''));
      const hebrewMishnahContent = hebrewMishnayot[mishnah];
      const hebrew = hebrewMishnahContent ? stripHtml(Array.isArray(hebrewMishnahContent) ? hebrewMishnahContent.join(' ') : hebrewMishnahContent) : '';
      const content = english || hebrew;

      if (!content) continue;

      chunks.push({
        id: generateId(),
        content,
        hebrew: hebrew || undefined,
        english,
        source: 'Mishnah',
        ref: `${sefariaData.title} ${chapter + 1}:${mishnah + 1}`,
        metadata: {
          chapter: chapter + 1,
          verse_or_mishnah: `${mishnah + 1}`,
          speakers: extractSpeakers(content),
          topic: extractTopic(content),
          layer: detectLayer(content),
        },
      });
    }
  }

  return chunks;
}

/**
  * Talmud chunking: By sugya topic or logical breaks
  * This is most complex - needs to detect speaker changes, argument transitions
  */
function chunkTalmud(sefariaData: SefariaDataWithHebrew): TextChunk[] {
  const chunks: TextChunk[] = [];
  const normalizedData = normalizeSefariaData(sefariaData);

  // Talmud structure: text[dafIndex][lineIndex]
  // Daf 0,1 are usually empty (cover/intro), start from 2 (Berakhot 2a)

  for (let daf = 0; daf < normalizedData.text.length; daf++) {
    const lines = normalizedData.text[daf];
    const hebrewLines = normalizedData.he ? normalizedData.he[daf] : [];

    // Skip empty dafim
    if (!lines || lines.length === 0) continue;

    // Determine daf reference (2a, 2b, 3a, 3b, etc.)
    const dafNum = Math.floor(daf / 2) + 2;
    const dafSide = daf % 2 === 0 ? 'a' : 'b';
    const dafRef = `${dafNum}${dafSide}`;

    // Accumulate lines into logical chunks based on:
    // 1. Speaker changes
    // 2. Argument transitions (question/answer shifts)
    // 3. Size limits (~500-2000 chars)

    let currentChunk = '';
    let currentChunkLines: number[] = [];
    let currentSpeakers: string[] = [];
    let chunkIndex = 0;

    for (let line = 0; line < lines.length; line++) {
      const lineContent = lines[line];
      const english = stripHtml(Array.isArray(lineContent) ? lineContent.join(' ') : (lineContent || ''));
      const hebrewLineContent = hebrewLines[line];
      const hebrew = hebrewLineContent ? stripHtml(Array.isArray(hebrewLineContent) ? hebrewLineContent.join(' ') : hebrewLineContent) : '';
      const content = english || hebrew;

      if (!content) continue;

      const lineSpeakers = extractSpeakers(content);
      const isSpeakerChange = hasSpeakerChange(currentSpeakers, lineSpeakers);
      const isTransition = isArgumentTransition(content);
      const wouldExceedLimit = (currentChunk.length + content.length) > 2000;
      const isAboveMinimum = currentChunk.length > 200;

      // Create new chunk if:
      // - Significant speaker change AND we have enough content
      // - Argument transition AND we have enough content
      // - Would exceed size limit AND we have enough content
      // - End of daf

      const shouldSplit = isAboveMinimum && (
        isSpeakerChange || isTransition || wouldExceedLimit || line === lines.length - 1
      );

      if (shouldSplit && currentChunk) {
        chunks.push(createTalmudChunk(
          currentChunk,
          sefariaData.title,
          dafRef,
          currentChunkLines[0],
          currentChunkLines[currentChunkLines.length - 1],
          currentSpeakers
        ));
        currentChunk = '';
        currentChunkLines = [];
        chunkIndex++;
      }

      currentChunk += (currentChunk ? ' ' : '') + content;
      currentChunkLines.push(line);
      currentSpeakers = [...currentSpeakers, ...lineSpeakers];
    }

    // Don't forget last chunk
    if (currentChunk) {
      chunks.push(createTalmudChunk(
        currentChunk,
        sefariaData.title,
        dafRef,
        currentChunkLines[0],
        currentChunkLines[currentChunkLines.length - 1],
        currentSpeakers
      ));
    }
  }

  return chunks;
}

function hasSpeakerChange(oldSpeakers: string[], newSpeakers: string[]): boolean {
  // Consider it a change if we have new speakers that weren't in old chunk
  const significantNewSpeakers = newSpeakers.filter(s => !oldSpeakers.includes(s));
  return significantNewSpeakers.length > 0;
}

function isArgumentTransition(text: string): boolean {
  // Detect argument transitions: questions, counter-arguments, "on the contrary", etc.
  const transitionPatterns = [
    /גְּמָ׳/,                      // Gemara (start of discussion)
    /אָמַר\s+מָר/,                  // The Master said
    /אִי\s+בָּעֵית\s+אֵימָא/,       // If you want to say
    /וְהָכִי\s+קָתָנֵי/,            // Why was it taught
    /מַאי\s+שְׁנָא/,                // What is the difference
    /אֵלָּא/,                      // Rather
    /וּמִנַּיְיהוּ/,               // From where do we know
    /דִּלְמָא/,                    // Perhaps
    /אֶלָּא\s+לָאוּ/,               // But not
    /עַל\s+כֵּן/,                  // Therefore
    /אִם\s+כֵּן/,                  // If so
  ];

  return transitionPatterns.some(pattern => pattern.test(text));
}

function createTalmudChunk(
  content: string,
  title: string,
  dafRef: string,
  lineStart: number,
  lineEnd: number,
  speakers: string[]
): TextChunk {
  const uniqueSpeakers = Array.from(new Set(speakers));

  return {
    id: generateId(),
    content,
    english: content,
    hebrew: undefined,
    source: 'Talmud',
    ref: `${title} ${dafRef}:${lineStart}-${lineEnd}`,
    metadata: {
      daf: dafRef,
      lines_start: lineStart,
      lines_end: lineEnd,
      speakers: uniqueSpeakers,
      topic: extractTopic(content),
      layer: detectLayer(content),
    },
  };
}

/**
 * Main chunking function - routes to appropriate strategy
 */
export async function chunkTalmudicText(
  sefariaData: SefariaData,
  source: 'Torah' | 'Mishnah' | 'Talmud'
): Promise<TextChunk[]> {
  switch (source) {
    case 'Torah':
      return chunkTorah(sefariaData as SefariaDataWithHebrew);
    case 'Mishnah':
      return chunkMishnah(sefariaData as SefariaDataWithHebrew);
    case 'Talmud':
      return chunkTalmud(sefariaData as SefariaDataWithHebrew);
    default:
      throw new Error(`Unknown source type: ${source}`);
  }
}

// ============================================================================
// DATABASE STORAGE
// ============================================================================

export async function ingestChunk(chunk: TextChunk): Promise<void> {
  const embeddingResult = await generateBatchEmbeddings([chunk.content]);
  const embedding = embeddingResult[0].vector;
  const dimension = embedding.length;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const query = `
      INSERT INTO documents (
        content, hebrew, english, source, ref,
        chapter, verse_or_mishnah, daf, lines_start, lines_end,
        metadata, embedding
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `;

    await client.query(query, [
      chunk.content,
      chunk.hebrew || null,
      chunk.english,
      chunk.source,
      chunk.ref,
      chunk.metadata.chapter || null,
      chunk.metadata.verse_or_mishnah || null,
      chunk.metadata.daf || null,
      chunk.metadata.lines_start || null,
      chunk.metadata.lines_end || null,
      JSON.stringify(chunk.metadata),
      `[${embedding.join(',')}]`,
    ]);

    await client.query('COMMIT');
  } catch (error: any) {
    await client.query('ROLLBACK');
    if (error.message?.includes('expected') && error.message?.includes('dimensions')) {
      throw new Error(
        `Embedding dimension mismatch: got ${dimension} but database expects a different dimension. ` +
        `Check that LM Studio is running the correct model: ${config.embeddings.model}`
      );
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function ingestFile(filePath: string): Promise<number> {
  const content = await fs.readFile(filePath, 'utf-8');
  const data = JSON.parse(content) as SefariaData;
  const fileName = path.basename(filePath, '.json');

  const source = determineSourceFromFilename(fileName);

  console.log(`\nProcessing ${fileName} as ${source}...`);

  const chunks = await chunkTalmudicText(data, source);
  let count = 0;

  for (const chunk of chunks) {
    try {
      await ingestChunk(chunk);
      count++;

      if (count % 10 === 0) {
        console.log(`  Ingested ${count}/${chunks.length} chunks from ${fileName}...`);
      }
    } catch (error) {
      console.error(`  Error ingesting chunk ${chunk.id}:`, error);
    }
  }

  console.log(`  Complete: Ingested ${count} chunks from ${fileName}`);
  return count;
}

export async function ingestDirectory(dirPath: string = path.join(process.cwd(), 'data', 'raw')): Promise<{ total: number; sources: string[] }> {
  const files = await fs.readdir(dirPath);
  const jsonFiles = files.filter(f => f.endsWith('.json'));

  console.log(`Found ${jsonFiles.length} JSON files to process`);

  const sources: string[] = [];
  let total = 0;

  for (const file of jsonFiles) {
    try {
      const filePath = path.join(dirPath, file);
      const count = await ingestFile(filePath);
      total += count;
      sources.push(file);
    } catch (error) {
      console.error(`Error processing ${file}:`, error);
    }
  }

  console.log(`\n✓ Total ingested: ${total} chunks from ${sources.length} files`);
  return { total, sources };
}

// ============================================================================
// HELPER FUNCTIONS FOR SOURCE DETECTION
// ============================================================================

function determineSourceFromFilename(filename: string): 'Torah' | 'Mishnah' | 'Talmud' {
  const lower = filename.toLowerCase();

  // Torah books
  const torahBooks = ['genesis', 'exodus', 'leviticus', 'numbers', 'deuteronomy'];
  if (torahBooks.some(book => lower.includes(book))) {
    return 'Torah';
  }

  // Mishnah
  if (lower.includes('mishnah')) {
    return 'Mishnah';
  }

  // Talmud tractates
  const talmudTractates = ['berakhot', 'shabbat', 'pesachim', 'yoma', 'sukkah', 'beitzah', 'rosh hashanah', 'ta\'anit', 'megillah', 'moed katan', 'chagigah', 'yevamot', 'ketubot', 'nedarim', 'nazir', 'sotah', 'gittin', 'kiddushin', 'bava kamma', 'bava metzia', 'bava batra', 'sanhedrin', 'mekorot', 'avodah zarah', 'horayot', 'zevachim', 'menachot', 'chullin', 'bekhorot', 'arakhin', 'temurah', 'keritot', 'meilah', 'nedavah', 'tamid', 'middot', 'kinim'];
  if (talmudTractates.some(tractate => lower.includes(tractate.replace(' ', '')))) {
    return 'Talmud';
  }

  // Default to Talmud if filename matches a known Sefaria tractate pattern
  return 'Talmud';
}

// ============================================================================
// CLI ENTRY POINT
// ============================================================================

async function main() {
  console.log('='.repeat(60));
  console.log('Talmudic Scholar - Data Ingestion Pipeline');
  console.log('='.repeat(60));
  console.log(`Embedding URL: ${config.embeddings.url}`);
  console.log(`Embedding Model: ${config.embeddings.model}`);
  console.log(`Embedding Dimension: ${config.embeddings.dimension}`);
  console.log('='.repeat(60));

  const startTime = Date.now();

  try {
    await ingestDirectory();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✓ Ingestion completed in ${duration}s`);
    console.log('='.repeat(60));
  } catch (error) {
    console.error('\n✗ Ingestion failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
