#!/usr/bin/env node

/**
 * Talmudic Scholar - Unified Entry Point
 *
 * This is the main entry point that:
 * 1. Initializes the application with error handling
 * 2. Provides graceful shutdown handling
 * 3. Routes to appropriate command-line operations
 */

import { ragQuery } from './services/rag.js';
export { ragQuery };
import { closePool } from './db/init.js';
import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';

// @ts-ignore
marked.setOptions({
  renderer: new TerminalRenderer() as any
});

// ============================================================================
// ERROR HANDLING & GRACEFUL SHUTDOWN
// ============================================================================

let isShuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    console.log('\n⚠️  Shutdown already in progress...');
    return;
  }

  isShuttingDown = true;
  console.log(`\n\n🛑 Received ${signal}. Gracefully shutting down...`);

  try {
    console.log('📊 Closing database connections...');
    await closePool();
    console.log('✓ Database connections closed');
  } catch (error) {
    console.error('✗ Error closing database:', error);
  }

  console.log('👋 Goodbye! May your studies be fruitful.');
  process.exit(0);
}

// Register shutdown handlers
process.on('SIGINT', () => shutdown('SIGINT (Ctrl+C)'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Handle uncaught errors
process.on('uncaughtException', (error: Error) => {
  console.error('\n❌ Uncaught Exception:');
  console.error(error);
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('\n❌ Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  shutdown('unhandledRejection');
});

// ============================================================================
// APPLICATION INFO
// ============================================================================

function printHeader(): void {
  console.log('\n' + '='.repeat(60));
  console.log('  תלמוד חכם (Talmudic Scholar)');
  console.log('  AI-Powered Talmudic Research Assistant');
  console.log('='.repeat(60));
}

function printCommands(): void {
  console.log('\n📚 Available Commands:');
  console.log('  npm run db:init    - Initialize PostgreSQL database with pgvector');
  console.log('  npm run download   - Download Talmudic texts from Sefaria');
  console.log('  npm run ingest     - Ingest documents with vector embeddings');
  console.log('  npm run dev         - Launch the TUI interface\n');
}

// ============================================================================
// CLI INTERACTIVE MODE
// ============================================================================

async function interactiveMode(): Promise<void> {
  printHeader();
  printCommands();

  console.log('💡 Type your question or "exit" to quit.\n');

  // Read from stdin
  process.stdin.setEncoding('utf-8');
  process.stdin.resume();

  let buffer = '';

  process.stdin.on('data', async (chunk: Buffer) => {
    buffer += chunk.toString();

    // Process complete lines
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const query = line.trim();

      if (!query) continue;

      if (query.toLowerCase() === 'exit' || query.toLowerCase() === 'quit') {
        await shutdown('user requested exit');
        return;
      }

      if (query.toLowerCase() === 'help') {
        printCommands();
        continue;
      }

      try {
        console.log(`\n🤔 Query: ${query}`);
        console.log('⏳ Searching Talmudic texts and generating response...\n');

        const answer = await ragQuery(query);

        console.log('📜 Response:');
        console.log('─'.repeat(60));
        console.log(marked.parse(answer));
        console.log('─'.repeat(60) + '\n');
      } catch (error: any) {
        console.error('❌ Error processing query:', error.message);
        if (error.message?.includes('database')) {
          console.error('💡 Hint: Make sure PostgreSQL is running and initialized with: npm run db:init');
        } else if (error.message?.includes('embedding')) {
          console.error('💡 Hint: Make sure LM Studio is running on http://127.0.0.1:1338');
        } else if (error.message?.includes('API')) {
          console.error('💡 Hint: Check your ZAI_API_KEY in .env file');
        }
        console.log('');
      }
    }
  });
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Check if running directly (should use TUI interface)
  if (args.length === 0) {
    console.log('ℹ️  Running in CLI mode. For the full TUI interface, use: npm run dev');
    await interactiveMode();
    return;
  }

  // Handle command-line arguments
  const command = args[0].toLowerCase();

  switch (command) {
    case 'help':
    case '--help':
    case '-h':
      printHeader();
      printCommands();
      break;

    case 'query':
      if (args.length < 2) {
        console.error('❌ Usage: npm run query -- "your question"');
        process.exit(1);
      }
      const query = args.slice(1).join(' ');
      try {
        console.log('\n' + '─'.repeat(60));
        console.log('📜 The Havruta prepares to share the wisdom of our ancestors...');
        console.log('🤔 Query: ' + query);
        console.log('─'.repeat(60));

        const answer = await ragQuery(query);

        console.log('\n📚 Insight from the Talmudic Tradition:');
        console.log('─'.repeat(60));
        console.log(marked.parse(answer));
        console.log('─'.repeat(60) + '\n');

        await shutdown('query completed');
      } catch (error: any) {
        console.error('❌ Error:', error.message);
        process.exit(1);
      }
      break;

    default:
      console.error(`❌ Unknown command: ${command}`);
      printCommands();
      process.exit(1);
  }
}

// ============================================================================
// EXECUTE
// ============================================================================

main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
