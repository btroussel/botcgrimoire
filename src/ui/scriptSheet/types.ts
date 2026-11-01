import type { ReactNode } from 'react'
import type { NightMarker, Team } from '../../content'
import type { ArtSource } from '../Art'

export type ScriptSheetMode = 'read' | 'compose' | 'deal'

export interface ScriptSheetRow {
  readonly id: string
  readonly team: Team
  readonly name: string
  readonly ability: string
  readonly inBag?: number // deal mode: copies in the bag; from two, the count follows the name
  readonly below?: ReactNode // what the feature hangs under a row: a deal-mode choice, a setup instruction
  readonly implied?: boolean // compose: the rest of the script brings it, so it has no remove control
}

export interface ScriptSheetTeam {
  readonly team: Team
  readonly label: string // the band's word
  readonly count?: { readonly have: number; readonly of: number; readonly label: string } // compose and deal: the fill and its words
  readonly rows: readonly ScriptSheetRow[]
  readonly add?: { readonly label: string; readonly onPress: () => void }
}

export interface ScriptSheetJinx {
  readonly a: string
  readonly b: string
  readonly reason: string
}

export interface ScriptSheetCountTable {
  readonly players: readonly number[] // the columns, in order
  readonly rows: readonly { readonly team: Team; readonly label: string; readonly by: readonly number[] }[] // one per team, a value per column
}


export type NightOrderItem =
  | { readonly kind: 'character'; readonly id: string; readonly team: Team; readonly name: string }
  | { readonly kind: 'marker'; readonly marker: NightMarker; readonly label: string }

export interface ScriptSheetNightOrders {
  readonly first: readonly NightOrderItem[]
  readonly other: readonly NightOrderItem[]
}

export interface ScriptSheetLabels {
  readonly counts: string // the count table's heading
  readonly firstNight: string
  readonly otherNights: string
  readonly footnote: string // what the asterisk means: not the first night
  readonly jinxes: string
  readonly rules: string // names the list of the Bootlegger's homebrew rules for a screen reader
  readonly teensyville?: string // shown under the title when the script is recognised as one
  readonly credit?: string // whose game this is, at the foot of every printed page
}

export interface ScriptSheetRulesField {
  readonly values: readonly string[] // as typed, blanks included
  readonly onChange: (rules: readonly string[]) => void
  readonly add?: string // the add control's words; omitted once the list is full
  readonly text: (n: number) => string // a rule field's label
  readonly remove: (n: number) => string
}

export interface ScriptSheetNameField {
  readonly value: string
  readonly placeholder: string
  readonly label: string // the field's accessibility label
  readonly onChange: (value: string) => void
  readonly onBlur?: () => void
}

export interface ScriptSheetProps {
  readonly scrollHeader?: ReactNode // introductory controls that scroll away with the paper
  readonly bottomInset?: number // space to scroll the last character clear of floating controls

  readonly mode: ScriptSheetMode
  readonly teensyville?: boolean // classified by the feature
  readonly title?: string
  readonly author?: string
  readonly logo?: ArtSource // the edition's logo, or the custom script's own or bundled one
  readonly nameField?: ScriptSheetNameField // compose: edits the title beside the logo
  readonly authorField?: ScriptSheetNameField
  readonly teams: readonly ScriptSheetTeam[] // in the fixed order, Travellers last
  readonly jinxes?: readonly ScriptSheetJinx[] // grouped at the end, each pair drawn once
  readonly djinn?: { readonly name: string; readonly ability: string } // heads the jinxes, whose rule it is
  readonly notice?: string // a line under the characters, such as the ids this version does not know
  readonly rules?: readonly string[] // the Bootlegger's homebrew rules, under its row
  readonly rulesField?: ScriptSheetRulesField // compose: writes them instead
  readonly counts?: ScriptSheetCountTable
  readonly nightOrders?: ScriptSheetNightOrders
  readonly labels: ScriptSheetLabels
  readonly selected?: readonly string[] // in the bag, or on the composed script
  readonly onTapCharacter?: (id: string) => void // the row and its icon alike
  readonly onLongPressCharacter?: (id: string) => void // deal mode: another token of the character
  readonly onRemoveCharacter?: (id: string) => void
  readonly removeLabel?: (name: string) => string
  readonly onBack?: () => void
  readonly backLabel?: string
  readonly actions?: ReactNode // the header's right: print, share
}
