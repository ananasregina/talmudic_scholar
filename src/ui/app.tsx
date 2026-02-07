import { useState, useEffect, useRef } from 'react';
import { render, Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { ragQuery } from '../services/rag.js';
import { getRandomWisdom, type WisdomSnippet } from '../services/wisdom.js';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: string[];
}

export function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'system-1',
      role: 'system',
      content: 'Welcome to תלמוד חכם (Talmudic Scholar). Ask questions about Torah, Talmud, and rabbinic literature.'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wisdom, setWisdom] = useState<WisdomSnippet | null>(null);
  const wisdomIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch and rotate wisdom during loading
  useEffect(() => {
    if (loading) {
      // Fetch initial wisdom
      const fetchWisdom = async () => {
        const newWisdom = await getRandomWisdom();
        if (newWisdom) setWisdom(newWisdom);
      };
      fetchWisdom();

      // Rotate wisdom every 4 seconds
      wisdomIntervalRef.current = setInterval(async () => {
        const newWisdom = await getRandomWisdom();
        if (newWisdom) setWisdom(newWisdom);
      }, 4000);
    } else {
      // Clear wisdom when loading stops
      if (wisdomIntervalRef.current) {
        clearInterval(wisdomIntervalRef.current);
        wisdomIntervalRef.current = null;
      }
      setWisdom(null);
    }

    return () => {
      if (wisdomIntervalRef.current) {
        clearInterval(wisdomIntervalRef.current);
      }
    };
  }, [loading]);

  const handleSubmit = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input;
    setInput('');
    setLoading(true);
    setError(null);

    setMessages(prev => [
      ...prev,
      { id: Date.now().toString(), role: 'user', content: userMessage }
    ]);

    try {
      const answer = await ragQuery(userMessage);
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: answer,
          sources: extractSources(answer)
        }
      ]);
    } catch (err) {
      setError('Sorry, an error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="single" borderColor="magenta" paddingX={2} marginBottom={1} flexDirection="column">
        <Text color="magenta" bold>
          תלמוד חכם (Talmudic Scholar)
        </Text>
        <Text color="blue">
          Ask questions about Torah, Talmud, and rabbinic literature
        </Text>
      </Box>

      <Box flexDirection="column" marginBottom={1} flexGrow={1}>
        {messages.slice(-10).map((msg) => (
          <Box key={msg.id} flexDirection="column" marginBottom={1}>
            {msg.role === 'system' ? (
              <Text color="gray" italic wrap="wrap">
                ℹ️ {msg.content}
              </Text>
            ) : (
              <Box flexDirection="column">
                <Text color={msg.role === 'user' ? 'green' : 'white'} wrap="wrap">
                  {msg.role === 'user' ? '> ' : '📜 '}
                </Text>
                <Text color={msg.role === 'user' ? 'green' : 'white'} wrap="wrap">
                  {msg.content}
                </Text>
                {msg.sources && msg.sources.length > 0 && (
                  <Text color="yellow" wrap="wrap">
                    {'  '}Sources: {msg.sources.join(', ')}
                  </Text>
                )}
              </Box>
            )}
          </Box>
        ))}
        {loading && (
          <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1} paddingY={0}>
            <Box>
              <Text color="yellow">
                <Spinner type="dots" />
              </Text>
              <Text color="yellow"> Consulting the sages...</Text>
            </Box>
            {wisdom && (
              <Box flexDirection="column" marginTop={1}>
                <Text color="cyan" italic wrap="wrap">
                  💡 "{wisdom.text}"
                </Text>
                <Text color="gray" dimColor>
                  {'   '}— {wisdom.speaker ? `${wisdom.speaker}, ` : ''}{wisdom.ref} ({wisdom.source})
                </Text>
              </Box>
            )}
          </Box>
        )}
        {error && (
          <Text color="red">
            {error}
          </Text>
        )}
      </Box>

      <Box borderStyle="round" borderColor="cyan" paddingX={1}>
        <Text color="cyan">? </Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          placeholder="Ask about Torah, Talmud, or rabbinic texts..."
        />
      </Box>
    </Box>
  );
}

function extractSources(response: string): string[] {
  const sources: string[] = [];
  const pattern = /(?:[A-Z][a-z]+\s+\d+[a-z]?(?::\d+)?(?:-\d+)?)|(?:[A-Z][a-z]+\s+\d+:\d+(?:-\d+)?)/g;
  let match;
  while ((match = pattern.exec(response)) !== null) {
    if (!sources.includes(match[0])) {
      sources.push(match[0]);
    }
  }
  return sources;
}

// Render the application
render(<App />);
