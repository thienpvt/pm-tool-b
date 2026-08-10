import { z } from 'zod';

// Message.content is Array<ContentBlock> = TextBlock | ThinkingBlock | ...
// Only the text block is consumed, so the schema asserts an array of text
// blocks with passthrough (upstream additions never 502) and the client scans
// for the FIRST text block rather than assuming content[0] — extended thinking
// can prepend a ThinkingBlock.
export const messageContentSchema = z.array(z.object({
  type: z.literal('text'),
  text: z.string(),
}).passthrough()).nonempty();
