import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import type { ChunkType } from '../../stream/types';
import { createTool } from '../../tools';
import { Agent } from '../agent';

// https://github.com/mastra-ai/mastra/issues/29518
//
// A local tool call whose arguments never parsed must not be executed (that part is covered by
// the invalid-args guard in tool-call-step). What is covered here is what happens next: the
// failed call re-enters the loop, and on a truncated (`length`) step that turned a terminal
// truncation into a second model request and reported `stop` instead of `length`.
const usage = { inputTokens: 10, outputTokens: 5, totalTokens: 15 };

function createModel({ input, finishReason }: { input: string; finishReason: 'tool-calls' | 'length' }) {
  let calls = 0;
  const model = new MockLanguageModelV2({
    doStream: async () => {
      calls++;
      if (calls === 1) {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'tool-input-start', id: 'call-1', toolName: 'lookup' },
            { type: 'tool-input-delta', id: 'call-1', delta: input },
            { type: 'tool-input-end', id: 'call-1' },
            { type: 'tool-call', toolCallId: 'call-1', toolName: 'lookup', input },
            { type: 'finish', finishReason, usage },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      }
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'done' },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
  return { model, calls: () => calls };
}

async function run(input: string, finishReason: 'tool-calls' | 'length') {
  const { model, calls } = createModel({ input, finishReason });
  const executed: unknown[] = [];
  const agent = new Agent({
    id: 'truncated-tool-call-agent',
    name: 'Truncated Tool Call Agent',
    instructions: 'Use the lookup tool.',
    model,
    tools: {
      lookup: createTool({
        id: 'lookup',
        description: 'Looks something up',
        inputSchema: z.object({ query: z.string().optional() }),
        execute: async args => {
          executed.push(args);
          return { ok: true };
        },
      }),
    },
  });

  const output = await agent.stream('look up something');
  const chunks: ChunkType[] = [];
  for await (const chunk of output.fullStream) {
    chunks.push(chunk);
  }

  return { executed, modelCalls: calls(), chunks, finishReason: await output.finishReason };
}

describe('tool call that failed on a truncated step', () => {
  it('does not execute the tool, does not request another step, and keeps the length reason', async () => {
    // The conversion layer reports the parse failure through console.error; that log is expected.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await run('{"query":"unfinished', 'length');
    consoleError.mockRestore();

    expect(result.executed).toEqual([]);
    // The failed result is reported once, without buying a request the output limit forbids.
    expect(result.chunks.filter(chunk => chunk.type === 'tool-error')).toHaveLength(1);
    expect(result.modelCalls).toBe(1);
    expect(result.finishReason).toBe('length');
  });

  it('still re-enters the loop when the step was not truncated', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await run('{"query":"unfinished', 'tool-calls');
    consoleError.mockRestore();

    expect(result.executed).toEqual([]);
    expect(result.modelCalls).toBe(2);
  });
});
