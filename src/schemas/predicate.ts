import z from 'zod';

const StringPredicateSchema = z.union([
  z.object({
    is: z.string()
  }),
  z.object({
    matchesRegex: z.object({
      pattern: z.string(),
      flags: z.string().default('')
    })
  }),
  z.string()
]);

const CellTypeSchema = z.enum(['code', 'markdown']);
const CellTypePredicateSchema = z.union([
  z.object({
    is: CellTypeSchema
  }),
  CellTypeSchema
]);

const makeArrayPredicateSchema = <P extends z.ZodTypeAny>(
  elementPredicate: P
) =>
  z.union([
    z.object({ any: elementPredicate }),
    z.object({ all: elementPredicate })
  ] as const);

const ArrayOfStringsPredicateSchema = makeArrayPredicateSchema(
  StringPredicateSchema
);

const PredicateSubSchema = z.union([
  z.object({
    cellType: CellTypePredicateSchema
  }),
  z.object({
    // always returns FALSE if there is no output.
    output: StringPredicateSchema
  }),
  z.object({
    hasError: z.boolean()
  }),
  z.object({
    content: StringPredicateSchema
  }),
  z.object({
    isEditable: z.boolean()
  }),
  z.object({
    tags: ArrayOfStringsPredicateSchema
  })
]);

export const PredicateSchema = z.union([
  z.object({
    get AND() {
      return z.array(PredicateSchema);
    }
  }),
  z.object({
    get OR() {
      return z.array(PredicateSchema);
    }
  }),
  z.object({
    get NOT() {
      return PredicateSchema;
    }
  }),
  z.object({
    get nearbyCell() {
      return z.object({
        relativePosition: z.number().int(),
        matches: PredicateSchema
      });
    }
  }),
  PredicateSubSchema
]);
