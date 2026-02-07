"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateEmbedding = generateEmbedding;
exports.generateBatchEmbeddings = generateBatchEmbeddings;
exports.cosineSimilarity = cosineSimilarity;
var openai_1 = require("openai");
var config_js_1 = require("../config.js");
var embeddingClient = new openai_1.default({
    baseURL: config_js_1.config.embeddings.url,
    apiKey: 'dummy-key', // LM Studio doesn't require real auth
});
function generateEmbedding(text) {
    return __awaiter(this, void 0, void 0, function () {
        var response, vector, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, embeddingClient.embeddings.create({
                            model: config_js_1.config.embeddings.model,
                            input: text,
                            encoding_format: 'float',
                        })];
                case 1:
                    response = _a.sent();
                    vector = response.data[0].embedding;
                    return [2 /*return*/, {
                            vector: vector,
                            dimension: vector.length,
                        }];
                case 2:
                    error_1 = _a.sent();
                    console.error('Error generating embedding:', error_1);
                    throw error_1;
                case 3: return [2 /*return*/];
            }
        });
    });
}
function generateBatchEmbeddings(texts) {
    return __awaiter(this, void 0, void 0, function () {
        var batchSize, results, modelName, i, batch, response, embeddings, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    batchSize = 10;
                    results = [];
                    modelName = config_js_1.config.embeddings.model;
                    i = 0;
                    _a.label = 1;
                case 1:
                    if (!(i < texts.length)) return [3 /*break*/, 6];
                    batch = texts.slice(i, i + batchSize);
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, embeddingClient.embeddings.create({
                            model: modelName,
                            input: batch,
                            encoding_format: 'float',
                        })];
                case 3:
                    response = _a.sent();
                    embeddings = response.data.map(function (item) { return ({
                        vector: item.embedding,
                        dimension: item.embedding.length,
                    }); });
                    results.push.apply(results, embeddings);
                    return [3 /*break*/, 5];
                case 4:
                    error_2 = _a.sent();
                    console.error("Error in batch ".concat(i / batchSize, ":"), error_2);
                    throw error_2;
                case 5:
                    i += batchSize;
                    return [3 /*break*/, 1];
                case 6: return [2 /*return*/, results];
            }
        });
    });
}
function cosineSimilarity(a, b) {
    if (a.length !== b.length) {
        throw new Error('Vectors must have the same length');
    }
    var dotProduct = 0;
    var normA = 0;
    var normB = 0;
    for (var i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
