import { pool } from '../db/init.js';

export interface WisdomSnippet {
    text: string;
    ref: string;
    speaker?: string;
    source: string;
}

/**
 * Famous Talmudic sages for extra authenticity points
 */
const NOTABLE_SPEAKERS = [
    'Hillel',
    'Shammai',
    'Rabbi Akiva',
    'Rabbi Meir',
    'Rabbi Judah',
    'Rabbi Shimon',
    'Rav',
    'Shmuel',
    'Abaye',
    'Rava',
    'Rabbi Yochanan',
    'Reish Lakish',
    'Ben Zoma',
    'Ben Azzai',
];

/**
 * Fetches random Talmudic wisdom from the database
 * Prefers short passages with named speakers for that authentic wisdom vibe
 * Falls back to pure chaos (ORDER BY RANDOM()) when needed
 */
export async function getRandomWisdom(): Promise<WisdomSnippet | null> {
    try {
        // First attempt: Short passages with notable speakers (the good stuff)
        const speakerList = NOTABLE_SPEAKERS.map(s => `'${s}'`).join(',');

        const wisdomQuery = `
      SELECT 
        COALESCE(english, content) as text,
        ref,
        speaker,
        source
      FROM documents
      WHERE speaker IN (${speakerList})
        AND LENGTH(COALESCE(english, content)) BETWEEN 20 AND 200
      ORDER BY RANDOM()
      LIMIT 1
    `;

        let result = await pool.query(wisdomQuery);

        // Fallback: Any short passage (still wisdom, just less pedigree)
        if (result.rows.length === 0) {
            const fallbackQuery = `
        SELECT 
          COALESCE(english, content) as text,
          ref,
          speaker,
          source
        FROM documents
        WHERE LENGTH(COALESCE(english, content)) BETWEEN 20 AND 250
        ORDER BY RANDOM()
        LIMIT 1
      `;
            result = await pool.query(fallbackQuery);
        }

        // Ultimate fallback: Literally anything (chaos energy)
        if (result.rows.length === 0) {
            const chaosQuery = `
        SELECT 
          SUBSTRING(COALESCE(english, content), 1, 200) as text,
          ref,
          speaker,
          source
        FROM documents
        ORDER BY RANDOM()
        LIMIT 1
      `;
            result = await pool.query(chaosQuery);
        }

        if (result.rows.length === 0) {
            return null;
        }

        const row = result.rows[0];
        return {
            text: cleanWisdom(row.text),
            ref: row.ref,
            speaker: row.speaker || undefined,
            source: row.source,
        };
    } catch (error) {
        console.error('Error fetching wisdom:', error);
        return null;
    }
}

/**
 * Clean up the wisdom text for display
 */
function cleanWisdom(text: string): string {
    // Trim and remove excessive whitespace
    let cleaned = text.trim().replace(/\s+/g, ' ');

    // If it ends mid-sentence, try to end at a natural break
    if (cleaned.length > 180 && !cleaned.endsWith('.') && !cleaned.endsWith('?') && !cleaned.endsWith('!')) {
        const lastPeriod = cleaned.lastIndexOf('.');
        const lastQuestion = cleaned.lastIndexOf('?');
        const lastExclaim = cleaned.lastIndexOf('!');
        const lastBreak = Math.max(lastPeriod, lastQuestion, lastExclaim);

        if (lastBreak > 50) {
            cleaned = cleaned.substring(0, lastBreak + 1);
        } else {
            cleaned = cleaned + '...';
        }
    }

    return cleaned;
}
