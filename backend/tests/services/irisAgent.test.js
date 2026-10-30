import { jest } from '@jest/globals';

jest.unstable_mockModule('../../src/services/ai/chatService.js', () => ({
  chatWithAi: jest.fn(),
}));

const { chatWithAi } = await import('../../src/services/ai/chatService.js');
const { IrisAgent } = await import('../../src/services/ai/agent/irisAgent.js');

const usage = { promptTokens: 10, completionTokens: 5, totalTokens: 15, cachedTokens: 0 };

const makeRes = () => ({ writableEnded: false, write: jest.fn() });

describe('IrisAgent save_memory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    chatWithAi.mockResolvedValue({ stream: {}, model: 'test-model' });
  });

  it('executes the write, reports the result, and continues the loop', async () => {
    const executeServerTool = jest.fn().mockResolvedValue({
      saved: true,
      created: true,
      category: 'GOAL',
      content: 'Preparing for GATE',
    });

    const streamAiResponse = jest
      .fn()
      .mockResolvedValueOnce({
        finalReply: '',
        toolCalls: [],
        serverToolCalls: [
          {
            id: 'call_1',
            tool: 'save_memory',
            args: { category: 'GOAL', content: 'Preparing for GATE' },
          },
        ],
        tokenUsage: usage,
      })
      .mockResolvedValueOnce({
        finalReply: 'Saved — good luck with GATE!',
        toolCalls: [],
        serverToolCalls: [],
        tokenUsage: usage,
      });

    const agent = new IrisAgent({ maxToolRounds: 5 });

    const result = await agent.run({
      message: 'remember that I am preparing for GATE',
      userId: 'user_1',
      stream: true,
      res: makeRes(),
      streamAiResponse,
      executeServerTool,
    });

    expect(executeServerTool).toHaveBeenCalledWith(
      'save_memory',
      { category: 'GOAL', content: 'Preparing for GATE' },
      'user_1',
      null,
    );
    expect(streamAiResponse).toHaveBeenCalledTimes(2);
    expect(result.finalReply).toContain('Saved');
    expect(result.toolCalls[0]).toMatchObject({
      tool: 'save_memory',
      status: 'success',
      data: { saved: true, created: true },
    });
  });

  it('confirms an already-known memory when the model says nothing', async () => {
    const executeServerTool = jest.fn().mockResolvedValue({
      saved: true,
      created: false,
      category: 'GOAL',
      content: 'Preparing for GATE',
    });

    const streamAiResponse = jest
      .fn()
      .mockResolvedValueOnce({
        finalReply: '',
        toolCalls: [],
        serverToolCalls: [
          { id: 'call_1', tool: 'save_memory', args: { category: 'GOAL', content: 'GATE' } },
        ],
        tokenUsage: usage,
      })
      .mockResolvedValueOnce({
        finalReply: '',
        toolCalls: [],
        serverToolCalls: [],
        tokenUsage: usage,
      });

    const res = makeRes();
    const agent = new IrisAgent({ maxToolRounds: 5 });

    const result = await agent.run({
      message: 'remember I am preparing for GATE',
      userId: 'user_1',
      stream: true,
      res,
      streamAiResponse,
      executeServerTool,
    });

    expect(result.finalReply).toBe('Got it — I already had that saved.');
    expect(res.write).toHaveBeenCalledWith(
      expect.stringContaining('"content":"Got it — I already had that saved."'),
    );
  });
});
