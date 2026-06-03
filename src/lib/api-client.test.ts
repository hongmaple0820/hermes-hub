import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '@/lib/api-client';

// Mock fetch
global.fetch = vi.fn();

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAgents', () => {
    it('should fetch agents successfully', async () => {
      const mockAgents = [
        { id: '1', name: 'Agent 1', mode: 'builtin' },
        { id: '2', name: 'Agent 2', mode: 'acrp' },
      ];

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ agents: mockAgents }),
      });

      const result = await api.getAgents();

      expect(fetch).toHaveBeenCalledWith('/api/agents', expect.any(Object));
      expect(result).toEqual({ agents: mockAgents });
    });

    it('should handle fetch errors', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });

      await expect(api.getAgents()).rejects.toThrow();
    });
  });

  describe('getSkills', () => {
    it('should fetch skills', async () => {
      const mockSkills = [
        { id: '1', name: 'web-search' },
        { id: '2', name: 'code-execution' },
      ];

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ skills: mockSkills }),
      });

      const result = await api.getSkills();

      expect(fetch).toHaveBeenCalledWith('/api/skills', expect.any(Object));
      expect(result).toEqual({ skills: mockSkills });
    });
  });
});
