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
import { run as runTUI } from './ui/app.js';

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
  console.log('  talmudic-scholar                  - Launch the TUI interface (default)');
  console.log('  talmudic-scholar web [options]    - Start web server');
  console.log('  talmudic-scholar query "..."      - Query via CLI');
  console.log('\n📦 Web Server Options:');
  console.log('  -p, --port <number>   - Specify port (default: 3000)');
  console.log('  --help                - Show this help\n');
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Check if running directly - launch TUI
  if (args.length === 0) {
    runTUI();
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

    case 'web': {
      let port = 3000;
      for (let i = 1; i < args.length; i++) {
        if ((args[i] === '-p' || args[i] === '--port') && args[i + 1]) {
          port = parseInt(args[i + 1], 10);
          if (isNaN(port) || port < 1 || port > 65535) {
            console.error('❌ Invalid port number');
            process.exit(1);
          }
          i++;
        } else if (args[i] === '--help' || args[i] === '-h') {
          printHeader();
          printCommands();
          process.exit(0);
        }
      }
      
      process.env.PORT = String(port);
      await import('./web/server.js');
      break;
    }

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
