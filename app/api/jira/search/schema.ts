import { z } from 'zod';

export const jiraSearchSchema = z.object({
  jql: z.string().min(1, { message: 'jql là bắt buộc' }).optional(),
  nextPageToken: z.string().optional(),
  maxResults: z.number().optional(),
  extraFields: z.array(z.string()).optional(),
});
