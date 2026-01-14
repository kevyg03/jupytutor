import z from 'zod';

export const JupytutorNotebookMetadataSchema = z.object({
  enabled: z.boolean().default(false)
});
