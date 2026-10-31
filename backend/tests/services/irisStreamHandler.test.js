import { jest } from '@jest/globals';
import { IrisStreamHandler } from '../../src/services/ai/stream/irisStreamHandler.js';

const sseChunk = (payload) => Buffer.from(`data: ${JSON.stringify(payload)}\n\n`);

const toolCallDelta = (index, id, name, args) => ({
  choices: [
    {
      delta: {
        tool_calls: [
          {
            index,
            id,
            function: { name, arguments: typeof args === 'string' ? args : JSON.stringify(args) },
          },
        ],
      },
    },
  ],
});

const makeStream = (chunks) => ({
  async *[Symbol.asyncIterator]() {
    for (const chunk of chunks) yield chunk;
  },
});

const makeRes = () => {
  const writes = [];
  return {
    writes,
    writableEnded: false,
    write: (chunk) => {
      writes.push(String(chunk));
      return true;
    },
  };
};

describe('IrisStreamHandler save_memory', () => {
  const handleWith = async (chunks) => {
    const executor = { execute: jest.fn() };
    const handler = new IrisStreamHandler({ toolExecutor: executor });
    const res = makeRes();

    const result = await handler.handle({
      stream: makeStream(chunks),
      res,
      noteFetched: false,
      userId: 'user_1',
      fallbackNoteId: null,
    });

    return { result, res, executor };
  };

  it('routes save_memory through serverToolCalls instead of saving inline', async () => {
    const { result, res, executor } = await handleWith([
      sseChunk(
        toolCallDelta(0, 'call_1', 'save_memory', {
          category: 'GOAL',
          content: 'Preparing for GATE',
        }),
      ),
    ]);

    expect(result.serverToolCalls).toEqual([
      {
        id: 'call_1',
        tool: 'save_memory',
        args: { category: 'GOAL', content: 'Preparing for GATE' },
      },
    ]);

    // The handler must not execute the write; the agent loop does that.
    expect(executor.execute).not.toHaveBeenCalled();
    expect(result.toolCalls).toEqual([]);

    const emitted = res.writes.filter(
      (w) => w.includes('"tool":"save_memory"') && w.includes('"status":"executing"'),
    );
    expect(emitted).toHaveLength(1);
  });

  it('keeps every save_memory call when several arrive in one turn', async () => {
    const { result } = await handleWith([
      sseChunk(toolCallDelta(0, 'call_1', 'save_memory', { category: 'GOAL', content: 'Goal A' })),
      sseChunk(toolCallDelta(1, 'call_2', 'save_memory', { category: 'SKILL', content: 'Skill B' })),
    ]);

    expect(result.serverToolCalls).toHaveLength(2);
    expect(result.serverToolCalls.map((call) => call.args.content)).toEqual([
      'Goal A',
      'Skill B',
    ]);
  });

  it('does not fabricate a reply for a memory save', async () => {
    const { result } = await handleWith([
      sseChunk(toolCallDelta(0, 'call_1', 'save_memory', { category: 'GOAL', content: 'Goal A' })),
    ]);

    expect(result.finalReply).toBe('');
  });
});

describe('IrisStreamHandler web tools', () => {
  const handleWith = async (chunks) => {
    const executor = { execute: jest.fn() };
    const handler = new IrisStreamHandler({ toolExecutor: executor });
    const res = makeRes();

    const result = await handler.handle({
      stream: makeStream(chunks),
      res,
      noteFetched: false,
      userId: 'user_1',
      fallbackNoteId: null,
    });

    return { result, res, executor };
  };

  it('queues a native search_web call for the agent loop', async () => {
    const { result } = await handleWith([
      sseChunk(toolCallDelta(0, 'call_1', 'search_web', { query: 'latest Node LTS' })),
    ]);

    expect(result.serverToolCalls).toEqual([
      { id: 'call_1', tool: 'search_web', args: { query: 'latest Node LTS' } },
    ]);
    expect(result.toolCalls[0]).toMatchObject({ tool: 'search_web' });
  });

  it('does not re-queue a provider-executed openrouter:web_search call', async () => {
    const { result } = await handleWith([
      sseChunk(
        toolCallDelta(0, 'call_1', 'openrouter:web_search', { query: 'latest Node LTS' }),
      ),
    ]);

    expect(result.serverToolCalls).toEqual([]);
    expect(result.toolCalls[0]).toMatchObject({ tool: 'search_web' });
  });

  it('queues a native crawl_url call for the agent loop', async () => {
    const { result } = await handleWith([
      sseChunk(toolCallDelta(0, 'call_1', 'crawl_url', { url: 'https://example.com/a' })),
    ]);

    expect(result.serverToolCalls).toEqual([
      { id: 'call_1', tool: 'crawl_url', args: { url: 'https://example.com/a' } },
    ]);
    expect(result.toolCalls[0]).toMatchObject({ tool: 'crawl_url' });
  });

  it('does not re-queue a provider-executed openrouter:web_fetch call', async () => {
    const { result } = await handleWith([
      sseChunk(
        toolCallDelta(0, 'call_1', 'openrouter:web_fetch', { url: 'https://example.com/a' }),
      ),
    ]);

    expect(result.serverToolCalls).toEqual([]);
    expect(result.toolCalls[0]).toMatchObject({ tool: 'crawl_url' });
  });
});
