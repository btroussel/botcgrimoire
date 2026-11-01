export interface AbilityPart {
  readonly setup: boolean
  readonly text: string
}

// The official Script Tool prints an ability's bracketed setup change, like the Baron's
// [+2 Outsiders], in bold with its brackets. Ability text carries no other mark, and an unmatched
// bracket, such as a translation's typo, stays plain. Split leaves each captured bracket at an
// odd index.
export const abilityParts = (text: string): readonly AbilityPart[] =>
  text.split(/(\[[^\]]*\])/g).map((part, index) => ({ setup: index % 2 === 1, text: part })).filter(part => part.text !== '')
