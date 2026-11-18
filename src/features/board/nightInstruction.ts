export type InstructionPart =
  | { readonly kind: 'text' | 'emphasis'; readonly text: string }
  | { readonly kind: 'reminder' }

// Interpret only the upstream presentation marks; preserve wording, spacing and token count.
// Most translations mark a token's words with asterisks, Catalan with HTML bold, and a <br>
// starts a new line.
export const nightInstruction = (text: string): readonly InstructionPart[] =>
  text.split(/(:reminder:|\*[^*]+\*|<b>[^<]*<\/b>|<br\s*\/?>)/g).filter(part => part !== '').map(part =>
    part === ':reminder:' ? { kind: 'reminder' }
      : part.startsWith('*') && part.endsWith('*') ? { kind: 'emphasis', text: part.slice(1, -1) }
        : part.startsWith('<b>') ? { kind: 'emphasis', text: part.slice(3, -4) }
          : /^<br\s*\/?>$/.test(part) ? { kind: 'text', text: '\n' }
            : { kind: 'text', text: part })
