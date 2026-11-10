// A field with a limit shows its count only near the end, so a short name carries no number, and
// marks the limit once reached, since the field then drops whatever else is typed or pasted.
export type FieldCount = 'hidden' | 'near' | 'full'

export const fieldCount = (length: number, max: number): FieldCount =>
  length >= max ? 'full' : length >= max * 0.8 ? 'near' : 'hidden'
