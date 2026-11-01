export const boardColours = ['burgundy', 'forest', 'midnight', 'plum'] as const
export type BoardColour = (typeof boardColours)[number]
