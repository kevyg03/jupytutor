import z from 'zod';
import { PredicateSchema } from './predicate';

export const ConfigSchema = z.object({
  rules: z.object({
    when: PredicateSchema,
    config: z.object({
      instructorNote: z.string().default(''),
      instructorNoteBehavior: z.enum(['replace', 'append'])
    })
  })
});
