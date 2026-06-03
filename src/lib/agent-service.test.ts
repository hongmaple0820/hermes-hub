import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentService } from '@/lib/agent-service';
import { db } from '@/lib/db';

// Mock the database
vi.mock('@/lib/db', () => ({
  db: {
    agent: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    agentTemplate: {
      findUnique: vi.fn(),
    },
  },
}));

describe('AgentService', () => {
  let service: AgentService;

  beforeEach(() => {
    service = new AgentService();
    vi.clearAllMocks();
  });

  describe('createAgent', () => {
    it('should create a builtin agent', async () => {
      const mockAgent = {
        id: 'agent-123',
        name: 'Test Agent',
        description: 'A test agent',
        mode: 'builtin',
        agentCategory: 'assistant',
        userId: 'user-123',
        status: 'offline',
      };

      (db.agent.create as any).mockResolvedValue(mockAgent);

      const result = await service.createAgent({
        type: 'builtin',
        name: 'Test Agent',
        description: 'A test agent',
        userId: 'user-123',
      });

      expect(db.agent.create).toHaveBeenCalled();
      expect(result.agent).toEqual(mockAgent);
    });

    it('should create an external agent with token', async () => {
      const mockAgent = {
        id: 'agent-123',
        name: 'External Agent',
        mode: 'acrp',
        agentToken: 'acrp_test_token',
      };

      (db.agent.create as any).mockResolvedValue(mockAgent);

      const result = await service.createAgent({
        type: 'external',
        name: 'External Agent',
        agentType: 'hermes-agent',
        userId: 'user-123',
      });

      expect(result.agent).toEqual(mockAgent);
      expect(result.agentToken).toBeDefined();
      expect(result.connectGuide).toBeDefined();
    });
  });
});
