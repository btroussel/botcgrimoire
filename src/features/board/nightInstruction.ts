export type InstructionPart =
  | { readonly kind: 'text' | 'emphasis'; readonly text: string }
  | { readonly kind: 'reminder' }

// Interpret only the upstream presentation marks; preserve wording, spacing and token count.
export const nightInstruction = (text: string): readonly InstructionPart[] =>
  text.split(/(:reminder:|\*[^*]+\*)/g).filter(part => part !== '').map(part =>
    part === ':reminder:' ? { kind: 'reminder' } : part.startsWith('*') && part.endsWith('*')
      ? { kind: 'emphasis', text: part.slice(1, -1) } : { kind: 'text', text: part })
