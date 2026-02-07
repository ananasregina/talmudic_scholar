"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chunkTalmudicText = chunkTalmudicText;
exports.ingestChunk = ingestChunk;
exports.ingestFile = ingestFile;
exports.ingestDirectory = ingestDirectory;
var promises_1 = require("fs/promises");
var path_1 = require("path");
var init_js_1 = require("../db/init.js");
var embeddings_js_1 = require("../services/embeddings.js");
var config_js_1 = require("../config.js");
/**
 * Normalize Sefaria data to consistent format
 * Handles both string[][] (direct) and string[] (array of arrays) formats
 */
function normalizeSefariaData(data) {
    // Check if text is already a 2D array
    if (Array.isArray(data.text[0])) {
        return data;
    }
    // Convert string[] (array of arrays) to string[][]
    var normalizedText = data.text;
    var normalizedHe = data.he ? data.he.map(function (h) { return h; }) : undefined;
    return __assign(__assign({}, data), { text: normalizedText, he: normalizedHe });
}
// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
function generateId() {
    return "".concat(Date.now(), "-").concat(Math.random().toString(36).substr(2, 9));
}
function stripHtml(text) {
    return text
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&thinsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function extractSpeakers(text) {
    var speakers = [];
    var patterns = [
        /רַבִּי\s+([א-ת]+)/g, // Rabbi [Name]
        /רַבָּן\s+([א-ת]+)/g, // Rabban [Name]
        /אָמַר\s+([א-ת]+)/g, // [Name] said
        /אָמְרוּ\s+([א-ת]+)/g, // [Name] said (plural)
        /אָמַר\s+לֵיהַּ\s+([א-ת]+)/g, // [Name] said to him
    ];
    for (var _i = 0, patterns_1 = patterns; _i < patterns_1.length; _i++) {
        var pattern = patterns_1[_i];
        var match = void 0;
        while ((match = pattern.exec(text)) !== null) {
            var speaker = match[1];
            if (speaker && !speakers.includes(speaker)) {
                speakers.push(speaker);
            }
        }
    }
    return speakers;
}
function extractTopic(text) {
    // Simple topic extraction - first significant phrase
    var cleaned = stripHtml(text);
    var sentences = cleaned.split(/[.!?]/);
    if (sentences.length > 0) {
        var firstSentence = sentences[0].trim();
        // Take first 50 characters as topic hint
        return firstSentence.substring(0, 50) + (firstSentence.length > 50 ? '...' : '');
    }
    return '';
}
function detectLayer(text) {
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
function chunkTorah(sefariaData) {
    var chunks = [];
    var normalizedData = normalizeSefariaData(sefariaData);
    for (var chapter = 0; chapter < normalizedData.text.length; chapter++) {
        var verses = normalizedData.text[chapter];
        var hebrewVerses = normalizedData.he ? normalizedData.he[chapter] : [];
        for (var verse = 0; verse < verses.length; verse++) {
            var english = stripHtml(verses[verse] || '');
            var hebrew = hebrewVerses[verse] ? stripHtml(hebrewVerses[verse]) : '';
            var content = english || hebrew;
            if (!content)
                continue;
            chunks.push({
                id: generateId(),
                content: content,
                hebrew: hebrew || undefined,
                english: english,
                source: 'Torah',
                ref: "".concat(sefariaData.title, " ").concat(chapter + 1, ":").concat(verse + 1),
                metadata: {
                    chapter: chapter + 1,
                    verse_or_mishnah: "".concat(verse + 1),
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
function chunkMishnah(sefariaData) {
    var chunks = [];
    var normalizedData = normalizeSefariaData(sefariaData);
    for (var chapter = 0; chapter < normalizedData.text.length; chapter++) {
        var mishnayot = normalizedData.text[chapter];
        var hebrewMishnayot = normalizedData.he ? normalizedData.he[chapter] : [];
        for (var mishnah = 0; mishnah < mishnayot.length; mishnah++) {
            var english = stripHtml(mishnayot[mishnah] || '');
            var hebrew = hebrewMishnayot[mishnah] ? stripHtml(hebrewMishnayot[mishnah]) : '';
            var content = english || hebrew;
            if (!content)
                continue;
            chunks.push({
                id: generateId(),
                content: content,
                hebrew: hebrew || undefined,
                english: english,
                source: 'Mishnah',
                ref: "".concat(sefariaData.title, " ").concat(chapter + 1, ":").concat(mishnah + 1),
                metadata: {
                    chapter: chapter + 1,
                    verse_or_mishnah: "".concat(mishnah + 1),
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
function chunkTalmud(sefariaData) {
    var chunks = [];
    var normalizedData = normalizeSefariaData(sefariaData);
    // Talmud structure: text[dafIndex][lineIndex]
    // Daf 0,1 are usually empty (cover/intro), start from 2 (Berakhot 2a)
    for (var daf = 0; daf < normalizedData.text.length; daf++) {
        var lines = normalizedData.text[daf];
        var hebrewLines = normalizedData.he ? normalizedData.he[daf] : [];
        // Skip empty dafim
        if (!lines || lines.length === 0)
            continue;
        // Determine daf reference (2a, 2b, 3a, 3b, etc.)
        var dafNum = Math.floor(daf / 2) + 2;
        var dafSide = daf % 2 === 0 ? 'a' : 'b';
        var dafRef = "".concat(dafNum).concat(dafSide);
        // Accumulate lines into logical chunks based on:
        // 1. Speaker changes
        // 2. Argument transitions (question/answer shifts)
        // 3. Size limits (~500-2000 chars)
        var currentChunk = '';
        var currentChunkLines = [];
        var currentSpeakers = [];
        var chunkIndex = 0;
        for (var line = 0; line < lines.length; line++) {
            var english = stripHtml(lines[line] || '');
            var hebrew = hebrewLines[line] ? stripHtml(hebrewLines[line]) : '';
            var content = english || hebrew;
            if (!content)
                continue;
            var lineSpeakers = extractSpeakers(content);
            var isSpeakerChange = hasSpeakerChange(currentSpeakers, lineSpeakers);
            var isTransition = isArgumentTransition(content);
            var wouldExceedLimit = (currentChunk.length + content.length) > 2000;
            var isAboveMinimum = currentChunk.length > 200;
            // Create new chunk if:
            // - Significant speaker change AND we have enough content
            // - Argument transition AND we have enough content
            // - Would exceed size limit AND we have enough content
            // - End of daf
            var shouldSplit = isAboveMinimum && (isSpeakerChange || isTransition || wouldExceedLimit || line === lines.length - 1);
            if (shouldSplit && currentChunk) {
                chunks.push(createTalmudChunk(currentChunk, sefariaData.title, dafRef, currentChunkLines[0], currentChunkLines[currentChunkLines.length - 1], currentSpeakers));
                currentChunk = '';
                currentChunkLines = [];
                chunkIndex++;
            }
            currentChunk += (currentChunk ? ' ' : '') + content;
            currentChunkLines.push(line);
            currentSpeakers = __spreadArray(__spreadArray([], currentSpeakers, true), lineSpeakers, true);
        }
        // Don't forget last chunk
        if (currentChunk) {
            chunks.push(createTalmudChunk(currentChunk, sefariaData.title, dafRef, currentChunkLines[0], currentChunkLines[currentChunkLines.length - 1], currentSpeakers));
        }
    }
    return chunks;
}
currentChunk += (currentChunk ? ' ' : '') + content;
currentChunkLines.push(line);
currentSpeakers = __spreadArray(__spreadArray([], currentSpeakers, true), lineSpeakers, true);
// Don't forget the last chunk
if (currentChunk) {
    chunks.push(createTalmudChunk(currentChunk, sefariaData.title, dafRef, currentChunkLines[0], currentChunkLines[currentChunkLines.length - 1], currentSpeakers));
}
return chunks;
function hasSpeakerChange(oldSpeakers, newSpeakers) {
    // Consider it a change if we have new speakers that weren't in old chunk
    var significantNewSpeakers = newSpeakers.filter(function (s) { return !oldSpeakers.includes(s); });
    return significantNewSpeakers.length > 0;
}
function isArgumentTransition(text) {
    // Detect argument transitions: questions, counter-arguments, "on the contrary", etc.
    var transitionPatterns = [
        /גְּמָ׳/, // Gemara (start of discussion)
        /אָמַר\s+מָר/, // The Master said
        /אִי\s+בָּעֵית\s+אֵימָא/, // If you want to say
        /וְהָכִי\s+קָתָנֵי/, // Why was it taught
        /מַאי\s+שְׁנָא/, // What is the difference
        /אֵלָּא/, // Rather
        /וּמִנַּיְיהוּ/, // From where do we know
        /דִּלְמָא/, // Perhaps
        /אֶלָּא\s+לָאוּ/, // But not
        /עַל\s+כֵּן/, // Therefore
        /אִם\s+כֵּן/, // If so
    ];
    return transitionPatterns.some(function (pattern) { return pattern.test(text); });
}
function createTalmudChunk(content, title, dafRef, lineStart, lineEnd, speakers) {
    var uniqueSpeakers = Array.from(new Set(speakers));
    return {
        id: generateId(),
        content: content,
        english: content,
        hebrew: undefined,
        source: 'Talmud',
        ref: "".concat(title, " ").concat(dafRef, ":").concat(lineStart, "-").concat(lineEnd),
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
function chunkTalmudicText(sefariaData, source) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (source) {
                case 'Torah':
                    return [2 /*return*/, chunkTorah(sefariaData)];
                case 'Mishnah':
                    return [2 /*return*/, chunkMishnah(sefariaData)];
                case 'Talmud':
                    return [2 /*return*/, chunkTalmud(sefariaData)];
                default:
                    throw new Error("Unknown source type: ".concat(source));
            }
            return [2 /*return*/];
        });
    });
}
// ============================================================================
// DATABASE STORAGE
// ============================================================================
function ingestChunk(chunk) {
    return __awaiter(this, void 0, void 0, function () {
        var embeddingResult, embedding, dimension, client, query, error_1;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, (0, embeddings_js_1.generateBatchEmbeddings)([chunk.content])];
                case 1:
                    embeddingResult = _c.sent();
                    embedding = embeddingResult[0].vector;
                    dimension = embedding.length;
                    return [4 /*yield*/, init_js_1.pool.connect()];
                case 2:
                    client = _c.sent();
                    _c.label = 3;
                case 3:
                    _c.trys.push([3, 7, 9, 10]);
                    return [4 /*yield*/, client.query('BEGIN')];
                case 4:
                    _c.sent();
                    query = "\n      INSERT INTO documents (\n        content, hebrew, english, source, ref,\n        chapter, verse_or_mishnah, daf, lines_start, lines_end,\n        metadata, embedding\n      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)\n    ";
                    return [4 /*yield*/, client.query(query, [
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
                            "[".concat(embedding.join(','), "]"),
                        ])];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, client.query('COMMIT')];
                case 6:
                    _c.sent();
                    return [3 /*break*/, 10];
                case 7:
                    error_1 = _c.sent();
                    return [4 /*yield*/, client.query('ROLLBACK')];
                case 8:
                    _c.sent();
                    if (((_a = error_1.message) === null || _a === void 0 ? void 0 : _a.includes('expected')) && ((_b = error_1.message) === null || _b === void 0 ? void 0 : _b.includes('dimensions'))) {
                        throw new Error("Embedding dimension mismatch: got ".concat(dimension, " but database expects a different dimension. ") +
                            "Check that LM Studio is running the correct model: ".concat(config_js_1.config.embeddings.model));
                    }
                    throw error_1;
                case 9:
                    client.release();
                    return [7 /*endfinally*/];
                case 10: return [2 /*return*/];
            }
        });
    });
}
function ingestFile(filePath) {
    return __awaiter(this, void 0, void 0, function () {
        var content, data, fileName, source, chunks, count, _i, chunks_1, chunk, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, promises_1.default.readFile(filePath, 'utf-8')];
                case 1:
                    content = _a.sent();
                    data = JSON.parse(content);
                    fileName = path_1.default.basename(filePath, '.json');
                    source = determineSourceFromFilename(fileName);
                    console.log("\nProcessing ".concat(fileName, " as ").concat(source, "..."));
                    return [4 /*yield*/, chunkTalmudicText(data, source)];
                case 2:
                    chunks = _a.sent();
                    count = 0;
                    _i = 0, chunks_1 = chunks;
                    _a.label = 3;
                case 3:
                    if (!(_i < chunks_1.length)) return [3 /*break*/, 8];
                    chunk = chunks_1[_i];
                    _a.label = 4;
                case 4:
                    _a.trys.push([4, 6, , 7]);
                    return [4 /*yield*/, ingestChunk(chunk)];
                case 5:
                    _a.sent();
                    count++;
                    if (count % 10 === 0) {
                        console.log("  Ingested ".concat(count, "/").concat(chunks.length, " chunks from ").concat(fileName, "..."));
                    }
                    return [3 /*break*/, 7];
                case 6:
                    error_2 = _a.sent();
                    console.error("  Error ingesting chunk ".concat(chunk.id, ":"), error_2);
                    return [3 /*break*/, 7];
                case 7:
                    _i++;
                    return [3 /*break*/, 3];
                case 8:
                    console.log("  Complete: Ingested ".concat(count, " chunks from ").concat(fileName));
                    return [2 /*return*/, count];
            }
        });
    });
}
function ingestDirectory() {
    return __awaiter(this, arguments, void 0, function (dirPath) {
        var files, jsonFiles, sources, total, _i, jsonFiles_1, file, filePath, count, error_3;
        if (dirPath === void 0) { dirPath = path_1.default.join(process.cwd(), 'data', 'raw'); }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, promises_1.default.readdir(dirPath)];
                case 1:
                    files = _a.sent();
                    jsonFiles = files.filter(function (f) { return f.endsWith('.json'); });
                    console.log("Found ".concat(jsonFiles.length, " JSON files to process"));
                    sources = [];
                    total = 0;
                    _i = 0, jsonFiles_1 = jsonFiles;
                    _a.label = 2;
                case 2:
                    if (!(_i < jsonFiles_1.length)) return [3 /*break*/, 7];
                    file = jsonFiles_1[_i];
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 5, , 6]);
                    filePath = path_1.default.join(dirPath, file);
                    return [4 /*yield*/, ingestFile(filePath)];
                case 4:
                    count = _a.sent();
                    total += count;
                    sources.push(file);
                    return [3 /*break*/, 6];
                case 5:
                    error_3 = _a.sent();
                    console.error("Error processing ".concat(file, ":"), error_3);
                    return [3 /*break*/, 6];
                case 6:
                    _i++;
                    return [3 /*break*/, 2];
                case 7:
                    console.log("\n\u2713 Total ingested: ".concat(total, " chunks from ").concat(sources.length, " files"));
                    return [2 /*return*/, { total: total, sources: sources }];
            }
        });
    });
}
// ============================================================================
// HELPER FUNCTIONS FOR SOURCE DETECTION
// ============================================================================
function determineSourceFromFilename(filename) {
    var lower = filename.toLowerCase();
    // Torah books
    var torahBooks = ['genesis', 'exodus', 'leviticus', 'numbers', 'deuteronomy'];
    if (torahBooks.some(function (book) { return lower.includes(book); })) {
        return 'Torah';
    }
    // Mishnah
    if (lower.includes('mishnah')) {
        return 'Mishnah';
    }
    // Talmud tractates
    var talmudTractates = ['berakhot', 'shabbat', 'pesachim', 'yoma', 'sukkah', 'beitzah', 'rosh hashanah', 'ta\'anit', 'megillah', 'moed katan', 'chagigah', 'yevamot', 'ketubot', 'nedarim', 'nazir', 'sotah', 'gittin', 'kiddushin', 'bava kamma', 'bava metzia', 'bava batra', 'sanhedrin', 'mekorot', 'avodah zarah', 'horayot', 'zevachim', 'menachot', 'chullin', 'bekhorot', 'arakhin', 'temurah', 'keritot', 'meilah', 'nedavah', 'tamid', 'middot', 'kinim'];
    if (talmudTractates.some(function (tractate) { return lower.includes(tractate.replace(' ', '')); })) {
        return 'Talmud';
    }
    // Default to Talmud if filename matches a known Sefaria tractate pattern
    return 'Talmud';
}
// ============================================================================
// CLI ENTRY POINT
// ============================================================================
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var startTime, duration, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('='.repeat(60));
                    console.log('Talmudic Scholar - Data Ingestion Pipeline');
                    console.log('='.repeat(60));
                    console.log("Embedding URL: ".concat(config_js_1.config.embeddings.url));
                    console.log("Embedding Model: ".concat(config_js_1.config.embeddings.model));
                    console.log("Embedding Dimension: ".concat(config_js_1.config.embeddings.dimension));
                    console.log('='.repeat(60));
                    startTime = Date.now();
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 6]);
                    return [4 /*yield*/, ingestDirectory()];
                case 2:
                    _a.sent();
                    duration = ((Date.now() - startTime) / 1000).toFixed(2);
                    console.log("\n\u2713 Ingestion completed in ".concat(duration, "s"));
                    console.log('='.repeat(60));
                    return [3 /*break*/, 6];
                case 3:
                    error_4 = _a.sent();
                    console.error('\n✗ Ingestion failed:', error_4);
                    process.exit(1);
                    return [3 /*break*/, 6];
                case 4: return [4 /*yield*/, init_js_1.pool.end()];
                case 5:
                    _a.sent();
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    });
}
// Run if executed directly
if (import.meta.url === "file://".concat(process.argv[1])) {
    main().catch(console.error);
}
