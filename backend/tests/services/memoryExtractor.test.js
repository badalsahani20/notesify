import { jest } from '@jest/globals';

// Mock the AI service before importing the module under test
jest.unstable_mockModule('../../src/services/ai.service.js', () => ({
  executeOpenRouter: jest.fn(),
  QUICK_MODEL: 'inclusionai/ling-3.0-flash'
}));

// Use dynamic import for ES module mocking
const { extractMemories } = await import('../../src/services/MemoryExtractor.js');
const { executeOpenRouter } = await import('../../src/services/ai.service.js');

describe('MemoryExtractor Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return empty summary and memories if messages array is empty', async () => {
    const result = await extractMemories([]);
    expect(result).toEqual({ summary: '', memories: [] });
    expect(executeOpenRouter).not.toHaveBeenCalled();
  });

  it('should return empty summary and memories if messages is undefined', async () => {
    const result = await extractMemories();
    expect(result).toEqual({ summary: '', memories: [] });
    expect(executeOpenRouter).not.toHaveBeenCalled();
  });

  it('should correctly parse valid JSON returned by the AI', async () => {
    const mockMessages = [
      { role: 'user', content: 'I am learning Java and building a spring boot app.' }
    ];

    const mockAiResponse = JSON.stringify({
      summary: 'User is learning Java and Spring Boot.',
      memories: [
        { category: 'SKILL', content: 'User is learning Java' },
        { category: 'SKILL', content: 'User is learning Spring Boot' }
      ]
    });

    // Mock successful response
    executeOpenRouter.mockResolvedValue(mockAiResponse);

    const result = await extractMemories(mockMessages);

    expect(executeOpenRouter).toHaveBeenCalledTimes(1);
    expect(result.summary).toBe('User is learning Java and Spring Boot.');
    expect(result.memories.length).toBe(2);
    expect(result.memories[0].category).toBe('SKILL');
  });

  it('should successfully strip markdown blocks from AI JSON response', async () => {
    const mockMessages = [{ role: 'user', content: 'I love backend development' }];
    
    // AI sometimes returns markdown formatting
    const mockAiResponse = `\`\`\`json\n{
      "summary": "User prefers backend.",
      "memories": [
        { "category": "PREFERENCE", "content": "User loves backend development" }
      ]
    }\n\`\`\``;

    executeOpenRouter.mockResolvedValue(mockAiResponse);

    const result = await extractMemories(mockMessages);

    expect(result.summary).toBe('User prefers backend.');
    expect(result.memories.length).toBe(1);
    expect(result.memories[0].content).toBe('User loves backend development');
  });

  it('should return empty if AI response is invalid JSON', async () => {
    const mockMessages = [{ role: 'user', content: 'Hello' }];
    
    executeOpenRouter.mockResolvedValue('This is not JSON');

    const result = await extractMemories(mockMessages);

    expect(result).toEqual({ summary: '', memories: [] });
  });

  it('should return empty if executeOpenRouter throws an error', async () => {
    const mockMessages = [{ role: 'user', content: 'Hello' }];
    
    executeOpenRouter.mockRejectedValue(new Error('Network failure'));

    const result = await extractMemories(mockMessages);

    expect(result).toEqual({ summary: '', memories: [] });
  });
});
