import https from 'https';
import { createHash } from 'crypto';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface DownloadTarget {
  path: string;
  filename: string;
  category: 'Torah' | 'Mishnah' | 'Talmud';
  description: string;
  priority: number;
}

interface DownloadProgress {
  target: DownloadTarget;
  downloaded: number;
  total: number;
  speed: number; // bytes/sec
  eta: number; // seconds remaining
}

interface DownloadResult {
  target: DownloadTarget;
  success: boolean;
  filePath?: string;
  error?: string;
  duration: number;
  size?: number;
  checksum?: string;
}

interface DownloadOptions {
  filter?: string; // 'torah', 'mishnah', 'talmud', or 'all'
  language?: 'English' | 'Hebrew' | 'both';
  concurrency?: number;
  retryAttempts?: number;
  skipExisting?: boolean;
}

// ============================================================================
// CONFIGURATION - Sefaria Text Categories
// ============================================================================

const SEFARIA_BASE = 'https://raw.githubusercontent.com/Sefaria/Sefaria-Export/master';
const DATA_DIR = path.join(process.cwd(), 'data', 'raw');

// Torah: 5 books
const TORAH_BOOKS = [
  'Genesis',
  'Exodus',
  'Leviticus',
  'Numbers',
  'Deuteronomy'
] as const;

// Mishnah Structure: Seder -> Tractates
const MISHNAH_STRUCTURE: Record<string, string[]> = {
  'Seder Zeraim': [
    'Berakhot', 'Peah', 'Demai', 'Kilayim', 'Sheviit',
    'Terumot', 'Maasrot', 'Maaser Sheni', 'Challah', 'Orlah', 'Bikkurim'
  ],
  'Seder Moed': [
    'Shabbat', 'Eruvin', 'Pesachim', 'Shekalim', 'Yoma', 'Sukkah', 'Beitzah',
    'Rosh Hashanah', 'Ta\'anit', 'Megillah', 'Moed Katan', 'Chagigah'
  ],
  'Seder Nashim': [
    'Yevamot', 'Ketubot', 'Nedarim', 'Nazir', 'Sotah', 'Gittin', 'Kiddushin'
  ],
  'Seder Nezikin': [
    'Bava Kamma', 'Bava Metzia', 'Bava Batra', 'Sanhedrin', 'Makkot',
    'Shevuot', 'Eduyot', 'Avodah Zarah', 'Pirkei Avot', 'Horayot'
  ],
  'Seder Kodashim': [
    'Zevachim', 'Menachot', 'Chullin', 'Bekhorot', 'Arakhin',
    'Temurah', 'Keritot', 'Meilah', 'Tamid', 'Middot', 'Kinnim'
  ],
  'Seder Tahorot': [
    'Kelim', 'Oholot', 'Negaim', 'Parah', 'Tahorot', 'Mikvaot',
    'Niddah', 'Makhshirin', 'Zavim', 'Tevul Yom', 'Yadayim', 'Oktzin'
  ]
};

// Talmud Bavli Structure: Seder -> Tractates (Only those with Gemara)
const TALMUD_STRUCTURE: Record<string, string[]> = {
  'Seder Zeraim': ['Berakhot'],
  'Seder Moed': [
    'Shabbat', 'Eruvin', 'Pesachim', 'Yoma', 'Sukkah', 'Beitzah',
    'Rosh Hashanah', 'Taanit', 'Megillah', 'Moed Katan', 'Chagigah'
    // Shekalim in Bavli is typically Yerushalmi, often excluded or differently structured in exports
  ],
  'Seder Nashim': [
    'Yevamot', 'Ketubot', 'Nedarim', 'Nazir', 'Sotah', 'Gittin', 'Kiddushin'
  ],
  'Seder Nezikin': [
    'Bava Kamma', 'Bava Metzia', 'Bava Batra', 'Sanhedrin', 'Makkot',
    'Shevuot', 'Avodah Zarah', 'Horayot'
  ],
  'Seder Kodashim': [
    'Zevachim', 'Menachot', 'Chullin', 'Bekhorot', 'Arakhin',
    'Temurah', 'Keritot', 'Meilah', 'Tamid'
  ],
  'Seder Tahorot': ['Niddah']
};

// ============================================================================
// GENERATE DOWNLOAD TARGETS
// ============================================================================

function generateDownloadTargets(options: DownloadOptions): DownloadTarget[] {
  const targets: DownloadTarget[] = [];
  const languages = options.language === 'both' || !options.language
    ? ['English', 'Hebrew']
    : [options.language];

  // Torah targets
  if (!options.filter || options.filter === 'all' || options.filter === 'torah') {
    for (const book of TORAH_BOOKS) {
      for (const lang of languages) {
        targets.push({
          path: `json/Tanakh/Torah/${book}/${lang}/merged.json`,
          filename: `${book}_${lang}.json`,
          category: 'Torah',
          description: `Torah ${book} (${lang})`,
          priority: 1
        });
      }
    }
  }

  // Mishnah targets
  if (!options.filter || options.filter === 'all' || options.filter === 'mishnah') {
    for (const [seder, tractates] of Object.entries(MISHNAH_STRUCTURE)) {
      for (const tractate of tractates) {
        for (const lang of languages) {
          // Mishnah directory structure: json/Mishnah/<Seder>/Mishnah <Tractate>/<Language>/merged.json
          // EXCEPTIONS: Pirkei Avot has no "Mishnah " prefix

          let tractateDirName = `Mishnah ${tractate}`;
          if (tractate === 'Pirkei Avot') {
            tractateDirName = tractate;
          }

          const sederPath = seder.replace(/ /g, '%20');
          const tractatePath = tractateDirName.replace(/ /g, '%20');

          targets.push({
            path: `json/Mishnah/${sederPath}/${tractatePath}/${lang}/merged.json`,
            filename: `Mishnah_${tractate.replace(/ /g, '_').replace(/'/g, '')}_${lang}.json`,
            category: 'Mishnah',
            description: `Mishnah ${tractate} (${lang})`,
            priority: 2
          });
        }
      }
    }
  }

  // Talmud targets
  if (!options.filter || options.filter === 'all' || options.filter === 'talmud') {
    for (const [seder, tractates] of Object.entries(TALMUD_STRUCTURE)) {
      for (const tractate of tractates) {
        for (const lang of languages) {
          // Talmud directory structure: json/Talmud/Bavli/<Seder>/<Tractate>/<Language>/merged.json
          const sederPath = seder.replace(/ /g, '%20');
          const tractatePath = tractate.replace(/ /g, '%20');

          targets.push({
            path: `json/Talmud/Bavli/${sederPath}/${tractatePath}/${lang}/merged.json`,
            filename: `Talmud_${tractate.replace(/ /g, '_')}_${lang}.json`,
            category: 'Talmud',
            description: `Talmud Bavli ${tractate} (${lang})`,
            priority: 3
          });
        }
      }
    }
  }

  return targets;
}

// ============================================================================
// CHECKSUM FUNCTIONS
// ============================================================================

async function calculateChecksum(filePath: string): Promise<string> {
  const content = await fsPromises.readFile(filePath);
  return createHash('sha256').update(content).digest('hex');
}

async function loadChecksums(): Promise<Map<string, string>> {
  const checksumsPath = path.join(DATA_DIR, '.checksums.json');
  try {
    const content = await fsPromises.readFile(checksumsPath, 'utf-8');
    const data = JSON.parse(content);
    return new Map(Object.entries(data));
  } catch {
    return new Map();
  }
}

async function saveChecksums(checksums: Map<string, string>): Promise<void> {
  const checksumsPath = path.join(DATA_DIR, '.checksums.json');
  await fsPromises.writeFile(checksumsPath, JSON.stringify(Object.fromEntries(checksums), null, 2));
}

// ============================================================================
// DOWNLOAD FUNCTIONS
// ============================================================================

interface DownloadOptionsInternal {
  url: string;
  filePath: string;
  onProgress?: (progress: number, speed: number, eta: number) => void;
}

async function downloadWithProgress(options: DownloadOptionsInternal): Promise<void> {
  return new Promise((resolve, reject) => {
    const { url, filePath, onProgress } = options;
    let startTime = Date.now();
    let downloaded = 0;
    let total = 0;
    let lastProgressTime = startTime;

    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }

      total = parseInt(response.headers['content-length'] || '0', 10);

      // Create directory if it doesn't exist
      fsPromises.mkdir(path.dirname(filePath), { recursive: true }).catch(() => { });

      // Stream to file
      const fileStream = fs.createWriteStream(filePath);
      const chunks: Buffer[] = [];

      response.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
        downloaded += chunk.length;

        // Update progress every 100ms
        const now = Date.now();
        if (now - lastProgressTime > 100 && total > 0) {
          const elapsed = (now - startTime) / 1000;
          const speed = downloaded / elapsed; // bytes/sec
          const eta = (total - downloaded) / speed;

          onProgress?.(downloaded, speed, eta);
          lastProgressTime = now;
        }
      });

      response.on('end', async () => {
        await fsPromises.writeFile(filePath, Buffer.concat(chunks));
        fileStream.close();
        resolve();
      });

      response.on('error', (error) => {
        fileStream.close();
        reject(error);
      });

      // Pipe response to file (for large files)
      if (total > 50 * 1024 * 1024) { // > 50MB
        response.pipe(fileStream);
      }

    }).on('error', (error) => {
      reject(error);
    });
  });
}

async function downloadWithRetry(
  target: DownloadTarget,
  maxAttempts: number = 3
): Promise<DownloadResult> {
  const url = `${SEFARIA_BASE}/${target.path}`;
  const filePath = path.join(DATA_DIR, target.filename);
  const checksums = await loadChecksums();

  // Check if file already exists with valid checksum (resume capability)
  if (fs.existsSync(filePath)) {
    const existingChecksum = await calculateChecksum(filePath);
    const expectedChecksum = checksums.get(target.filename);

    if (expectedChecksum && existingChecksum === expectedChecksum) {
      return {
        target,
        success: true,
        filePath,
        duration: 0,
        size: (await fsPromises.stat(filePath)).size,
        checksum: existingChecksum
      };
    }
  }

  // Download with retry logic
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`Downloading URL: ${url}`);
      process.stdout.write(`[${attempt}/${maxAttempts}] Downloading ${target.filename}... `);

      const startTime = Date.now();

      await downloadWithProgress({
        url,
        filePath,
        onProgress: (downloaded, speed, eta) => {
          const percent = ((downloaded / (parseFloat(process.stdout.columns as unknown as number) * 100)) * 100).toFixed(1);
          const speedMB = (speed / 1024 / 1024).toFixed(2);
          const etaMin = Math.ceil(eta / 60);
          process.stdout.write(`\r[${attempt}/${maxAttempts}] ${target.filename} - ${percent}% - ${speedMB} MB/s - ETA: ${etaMin}min `);
        }
      });

      const duration = (Date.now() - startTime) / 1000;
      const size = (await fsPromises.stat(filePath)).size;
      const checksum = await calculateChecksum(filePath);

      // Save checksum
      checksums.set(target.filename, checksum);
      await saveChecksums(checksums);

      process.stdout.write(`\r[✓] ${target.filename} - ${(size / 1024).toFixed(1)} KB - ${duration.toFixed(1)}s\n`);

      return {
        target,
        success: true,
        filePath,
        duration,
        size,
        checksum
      };

    } catch (error: any) {
      lastError = error;
      console.error(`\n  Attempt ${attempt} failed: ${error.message}`);

      if (attempt < maxAttempts) {
        // Exponential backoff: 1s, 2s, 4s
        const backoff = Math.pow(2, attempt - 1) * 1000;
        console.log(`  Retrying in ${backoff / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, backoff));
      }
    }
  }

  return {
    target,
    success: false,
    error: lastError?.message || 'Unknown error',
    duration: 0
  };
}

// ============================================================================
// PARALLEL DOWNLOAD QUEUE
// ============================================================================

async function downloadAll(
  targets: DownloadTarget[],
  concurrency: number = 3,
  retryAttempts: number = 3
): Promise<DownloadResult[]> {
  const results: DownloadResult[] = [];
  const queue = [...targets];
  let completed = 0;
  let total = targets.length;
  let startTime = Date.now();

  console.log(`\nStarting download of ${total} files with concurrency ${concurrency}`);
  console.log(`Target directory: ${DATA_DIR}\n`);

  async function processNext(): Promise<void> {
    if (queue.length === 0) return;

    const target = queue.shift();
    if (!target) return;

    const result = await downloadWithRetry(target, retryAttempts);
    results.push(result);
    completed++;

    const progress = ((completed / total) * 100).toFixed(1);
    const elapsed = (Date.now() - startTime) / 1000;
    const speed = completed / elapsed; // files/sec
    const eta = (total - completed) / speed;

    console.log(`\n[Progress: ${progress}%] ${completed}/${total} files - Speed: ${speed.toFixed(2)} files/s - ETA: ${Math.ceil(eta / 60)}min\n`);

    await processNext();
  }

  // Start concurrent workers
  const workers = Math.min(concurrency, total);
  await Promise.all(Array.from({ length: workers }, () => processNext()));

  return results;
}

// ============================================================================
// CLI INTERFACE
// ============================================================================

function parseArgs(): DownloadOptions {
  const args = process.argv.slice(2);
  const options: DownloadOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--filter':
      case '-f':
        options.filter = args[++i]?.toLowerCase();
        break;
      case '--language':
      case '-l':
        options.language = args[++i] === 'hebrew' ? 'Hebrew' :
          args[i] === 'english' ? 'English' : 'both';
        break;
      case '--concurrency':
      case '-c':
        options.concurrency = parseInt(args[++i], 10) || 3;
        break;
      case '--retry':
      case '-r':
        options.retryAttempts = parseInt(args[++i], 10) || 3;
        break;
      case '--skip-existing':
      case '-s':
        options.skipExisting = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
      default:
        if (arg.startsWith('--')) {
          console.error(`Unknown option: ${arg}`);
          printHelp();
          process.exit(1);
        }
    }
  }

  // Validate filter
  if (options.filter && !['torah', 'mishnah', 'talmud', 'all'].includes(options.filter)) {
    console.error(`Invalid filter: ${options.filter}. Must be: torah, mishnah, talmud, or all`);
    process.exit(1);
  }

  return options;
}

function printHelp(): void {
  console.log(`
Sefaria Text Downloader - Download Talmudic texts from Sefaria-Export

Usage: npm run download [options]

Options:
  -f, --filter <category>    Filter by category: torah, mishnah, talmud, or all (default: all)
  -l, --language <lang>      Filter by language: english, hebrew, or both (default: both)
  -c, --concurrency <num>    Maximum concurrent downloads (default: 3)
  -r, --retry <attempts>     Maximum retry attempts per file (default: 3)
  -s, --skip-existing        Skip files that already exist with valid checksums
  -h, --help                 Show this help message

Examples:
  npm run download                              # Download all texts
  npm run download --filter torah            # Download only Torah
  npm run download --filter talmud -l english  # Download Talmud in English only
  npm run download -c 5                      # Download with 5 concurrent connections

Files are downloaded to: data/raw/
  `);
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════════╗');
  console.log('║  Sefaria Text Downloader                                    ║');
  console.log('║  Download Talmudic texts from Sefaria-Export repository          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const options = parseArgs();
  const targets = generateDownloadTargets(options);

  if (targets.length === 0) {
    console.log('No targets match your filter criteria.');
    process.exit(0);
  }

  console.log(`Found ${targets.length} files to download:`);
  console.log(`  Category filter: ${options.filter || 'all'}`);
  console.log(`  Language filter: ${options.language || 'both'}`);
  console.log(`  Concurrency: ${options.concurrency || 3}`);
  console.log(`  Retry attempts: ${options.retryAttempts || 3}\n`);

  const startTime = Date.now();
  const results = await downloadAll(targets, options.concurrency || 3, options.retryAttempts || 3);
  const duration = (Date.now() - startTime) / 1000;

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════╗');
  console.log('║  Download Summary                                              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`✓ Successful: ${successful.length}/${results.length}`);
  console.log(`✗ Failed: ${failed.length}/${results.length}`);
  console.log(`Duration: ${duration.toFixed(1)}s\n`);

  if (successful.length > 0) {
    const totalSize = successful.reduce((sum, r) => sum + (r.size || 0), 0);
    console.log(`Total downloaded: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
  }

  if (failed.length > 0) {
    console.log('\nFailed downloads:');
    for (const result of failed) {
      console.log(`  ✗ ${result.target.filename} - ${result.error}`);
    }
  }

  console.log(`\nFiles saved to: ${DATA_DIR}`);
  console.log('To ingest, run: npm run ingest\n');

  // Exit with error code if any failed
  if (failed.length > 0) {
    process.exit(1);
  }
}

// Run if executed directly
main().catch(error => {
  console.error('\n✗ Download failed:', error);
  process.exit(1);
});
