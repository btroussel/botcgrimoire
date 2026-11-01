// The script laid out as the printed player sheet (docs/ui.md): ink on parchment, the teams in
// the fixed order as bands whose word sits on the divider rule, one row per character, the
// Bootlegger's homebrew rules under its row, the count table, night orders and jinxes below.
// Printing uses plain white paper.
// The one rule it keeps: it is told what every word says and what a tap means. Read, compose
// and deal are one sheet with different rows lit; the feature decides which and why.
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native'

import type { Team } from '../content'
import { Button, IconButton } from './Button'
import { CharacterIcon } from './CharacterIcon'
import { PaperTexture } from './PaperTexture'
import { Band, JinxLine, Row } from './scriptSheet/CharacterRows'
import { fitPrintedRoles, printCss } from './scriptSheet/print'
import { CountTable, NightOrder, ReferenceRow, ReferenceTeam, SheetArt } from './scriptSheet/Reference'
import { RuleList, Rules } from './scriptSheet/Rules'
import { styles } from './scriptSheet/styles'
import type { ScriptSheetProps, ScriptSheetRow } from './scriptSheet/types'
import { palette, type } from './theme'

export type * from './scriptSheet/types'

const teensyvilleMaxPlayers = 6

export const ScriptSheet = (props: ScriptSheetProps) => {
  const { width: windowWidth } = useWindowDimensions()
  const [sheetWidth, setSheetWidth] = useState<number | null>(null)
  const twoColumns = (sheetWidth ?? windowWidth) >= 640
  const { mode, title, logo, nameField, authorField, teams, jinxes = [], counts, nightOrders, labels } = props
  const { selected = [], onTapCharacter, onBack, backLabel, actions } = props
  const p = palette
  const teensyville = props.teensyville === true
  const [nameFocused, setNameFocused] = useState(false)
  const [authorFocused, setAuthorFocused] = useState(false)

  useEffect(() => {
    window.addEventListener('beforeprint', fitPrintedRoles)
    return () => window.removeEventListener('beforeprint', fitPrintedRoles)
  }, [])

  const rowsById = useMemo(() => new Map(teams.flatMap((g) => g.rows.map((r) => [r.id, r] as const))), [teams])
  const visibleJinxes = jinxes.filter((j) => rowsById.has(j.a) && rowsById.has(j.b))
  const jinxPartners = useMemo(() => {
    const partners = new Map<string, ScriptSheetRow[]>()
    for (const { a, b } of jinxes) {
      const left = rowsById.get(a)
      const right = rowsById.get(b)
      if (!left || !right) continue
      for (const [id, partner] of [[a, right], [b, left]] as const) {
        const list = partners.get(id) ?? []
        if (!list.some((row) => row.id === partner.id)) list.push(partner)
        partners.set(id, list)
      }
    }
    return partners
  }, [jinxes, rowsById])

  const children: ReactNode[] = props.scrollHeader ? [<View key="intro">{props.scrollHeader}</View>] : []
  const teamOf = (team: Team) => teams.find((group) => group.team === team && group.rows.length > 0)
  const npcs = [teamOf('fabled'), teamOf('loric')].flatMap((group) => group?.rows ?? [])

  // The deal supplies its own introduction instead of a logo and title; an
  // empty head would still take its padding.
  const headEmpty = !nameField && logo === undefined && !title && !(teensyville && labels.teensyville)
  if (!headEmpty) children.push(
    <View key="head" id="script-sheet-head" style={styles.head}>
      <View style={styles.identity}>
        {logo !== undefined ? (
          <View id="script-sheet-logo"><SheetArt source={logo} width={88} height={56} /></View>
        ) : null}
        <View style={styles.identityText}>
          {nameField ? (
            <TextInput
              value={nameField.value}
              onChangeText={nameField.onChange}
              placeholder={nameField.placeholder}
              placeholderTextColor={p.inkMuted}
              accessibilityLabel={nameField.label}
              selectTextOnFocus
              onFocus={() => setNameFocused(true)}
              onBlur={() => { setNameFocused(false); nameField.onBlur?.() }}
              style={[type.display.title, styles.nameField, { color: p.ink, borderBottomColor: nameFocused ? p.accent : p.parchmentShade }]}
            />
          ) : title ? <Text id="script-sheet-title" role="heading" style={[type.display.title, { color: p.ink }]}>{title}</Text> : null}
          {authorField ? (
            <TextInput
              value={authorField.value}
              onChangeText={authorField.onChange}
              placeholder={authorField.placeholder}
              placeholderTextColor={p.inkMuted}
              accessibilityLabel={authorField.label}
              selectTextOnFocus
              onFocus={() => setAuthorFocused(true)}
              onBlur={() => { setAuthorFocused(false); authorField.onBlur?.() }}
              style={[type.text.body, styles.nameField, { color: p.inkMuted, borderBottomColor: authorFocused ? p.accent : p.parchmentShade }]}
            />
          ) : props.author ? <Text id="script-sheet-author" style={[type.text.small, { color: p.inkMuted }]}>{props.author}</Text> : null}
        </View>
        {/* Paper names the Fabled and Loric beside the title, since their text waits on the next page. */}
        {npcs.length > 0 ? (
          <div className="script-print-only script-sheet-npcs">
            {npcs.map((row) => (
              <span key={row.id} className={`script-sheet-npc-${row.team}`}>
                <CharacterIcon id={row.id} team={row.team} size={24} />
                <span>{row.name}</span>
              </span>
            ))}
          </div>
        ) : null}
      </View>
      {teensyville && labels.teensyville ? (
        <Text style={[type.text.small, styles.centred, { color: p.inkMuted }]}>{labels.teensyville}</Text>
      ) : null}
    </View>,
  )

  // The count table reads first at the deal, where the bag is counted against it; on the
  // printed sheet it follows the characters.
  const countTable = counts ? (
    <CountTable
      key="counts"
      table={counts}
      columns={teensyville ? counts.players.filter((n) => n <= teensyvilleMaxPlayers) : counts.players}
      heading={labels.counts}
      p={p}
    />
  ) : null
  if (countTable && mode === 'deal') children.push(countTable)

  const rules = props.rulesField || (props.rules?.length ?? 0) > 0
    ? <Rules label={labels.rules} {...(props.rulesField ? { field: props.rulesField } : { rules: props.rules ?? [] })} p={p} />
    : null

  let footnote = false
  teams.forEach((group) => {
    const color = p.teamOnPaper[group.team]
    // The Fabled and Loric are few, with long text, and the Bootlegger carries its rules under
    // it: one column keeps them readable where two would leave a narrow, ragged half. Other teams
    // keep both halves on a phone too, stacked, since printing sets them side by side.
    const columns = group.team === 'fabled' || group.team === 'loric'
      ? [group.rows]
      : [group.rows.slice(0, Math.ceil(group.rows.length / 2)), group.rows.slice(Math.ceil(group.rows.length / 2))]
    // Each team is its own block so its band sticks only until the team's last row leaves.
    children.push(
      <View key={`team-${group.team}`} id={`script-sheet-block-${group.team}`}>
        <Band group={group} color={color} p={p} />
        {group.rows.length === 0 && group.add ? (
          <View style={styles.emptyTeam}>
            <Button label={group.add.label} icon="add" onPress={group.add.onPress} surface="paper" variant="text" />
          </View>
        ) : null}
        <View id={`script-sheet-team-${group.team}`} style={styles.rows}>
          {columns.map((column, index) => (
            <View key={index} id={`script-sheet-column-${group.team}-${index}`} style={twoColumns && columns.length > 1 ? styles.half : styles.full}>
              {column.map((row) => {
                if (row.skipsFirstNight) footnote = true
                return (
                  <View key={row.id} style={styles.full} id={`script-sheet-row-${row.id}`}>
                    <Row
                      {...row}
                      below={row.id === 'bootlegger' && rules ? <>{rules}{row.below}</> : row.below}
                      jinxPartners={jinxPartners.get(row.id)}
                      color={color}
                      mode={mode}
                      selected={selected.includes(row.id)}
                      onTap={onTapCharacter}
                      onTapIcon={onTapCharacter}
                      onLongPress={props.onLongPressCharacter}
                      onRemove={props.onRemoveCharacter}
                      removeLabel={props.removeLabel?.(row.name)}
                    />
                  </View>
                )
              })}
            </View>
          ))}
        </View>
      </View>,
    )
  })

  if (footnote) {
    children.push(
      <Text key="footnote" id="script-sheet-footnote" style={[type.text.small, styles.footnote, { color: p.inkMuted }]}>
        {`* ${labels.footnote}`}
      </Text>,
    )
  }

  if (props.notice) {
    children.push(
      <Text key="notice" id="script-sheet-notice" style={[type.text.small, styles.footnote, { color: p.inkMuted }]}>
        {props.notice}
      </Text>,
    )
  }

  const references: ReactNode[] = []
  if (countTable && mode !== 'deal') references.push(countTable)

  if (nightOrders) {
    references.push(
      <View key="nights" id="script-sheet-nights" style={[styles.section, styles.nights]}>
        <NightOrder heading={labels.firstNight} items={nightOrders.first} p={p} />
        <NightOrder heading={labels.otherNights} items={nightOrders.other} p={p} />
      </View>,
    )
  }

  // The Djinn heads the jinxes, as on the official sheet: its rule is what they are. Each jinx sits
  // indented under it.
  const djinn = visibleJinxes.length > 0 ? props.djinn : undefined
  const jinxSection = visibleJinxes.length > 0 ? (
    <View id="script-sheet-jinxes" role="group" aria-label={labels.jinxes} style={styles.section}>
      {djinn ? <ReferenceRow row={{ id: 'djinn', team: 'fabled', ...djinn }} color={p.teamOnPaper.fabled} p={p} /> : null}
      <View id="script-sheet-jinxlist" style={[styles.jinxList, djinn ? styles.jinxIndent : null]}>
        {visibleJinxes.map((j) => (
          <JinxLine key={`${j.a}-${j.b}`} jinx={j} rowsById={rowsById} p={p} />
        ))}
      </View>
    </View>
  ) : null

  // A few Travellers, Fabled or Loric would leave a page almost empty after the Demons, so paper
  // lists them on this page instead, and print hides their bands. Like the official sheet, the
  // Fabled and Loric need no heading there; the Travellers, being optional, sit under a band.
  // The Bootlegger's rules follow it, read only.
  const paperRules = (props.rules ?? props.rulesField?.values ?? []).filter((rule) => rule.trim() !== '')
  const onPaper = (team: Team) => {
    const group = teamOf(team)
    const rows = group?.rows.filter((row) => !(djinn && row.id === 'djinn')) ?? []
    return group && rows.length > 0 ? (
      <div className="script-print-only">
        <ReferenceTeam group={{ ...group, rows }} color={p.teamOnPaper[team]} p={p} band={team === 'traveller'}
          below={(id) => id === 'bootlegger' && paperRules.length > 0 ? <RuleList label={labels.rules} rules={paperRules} text={type.text.small} p={p} /> : null} />
      </div>
    ) : null
  }

  // On paper the night orders take the outer columns and the rest stacks between them.
  if (references.length > 0 || jinxSection) children.push(
    <View key="references" id="script-sheet-references">
      {references}
      <View id="script-sheet-centre">
        <div className="script-reference-title">
          <div>{title ?? nameField?.value}</div>
          {props.author || authorField?.value ? <small>{props.author ?? authorField?.value}</small> : null}
        </div>
        {jinxSection}
        {onPaper('fabled')}
        {onPaper('loric')}
        {onPaper('traveller')}
      </View>
    </View>,
  )

  const hasToolbar = onBack !== undefined || actions !== undefined
  return (
    <View id="script-sheet" style={[styles.paper, { backgroundColor: p.parchment }]} onLayout={event => setSheetWidth(event.nativeEvent.layout.width)}>
      <PaperTexture />
      <style href="script-sheet-layout" precedence="default">
        {printCss}
      </style>
      {hasToolbar ? (
        <View id="script-sheet-toolbar" style={styles.toolbar}>
          {onBack ? <IconButton icon="back" label={backLabel ?? ''} onPress={onBack} surface="paper" /> : null}
          <View style={styles.grow} />
          {actions}
        </View>
      ) : null}
      <ScrollView
        id="script-sheet-scroll"
        showsVerticalScrollIndicator={false}
        style={styles.grow}
        contentContainerStyle={[styles.content, props.bottomInset ? { paddingBottom: props.bottomInset } : null]}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
      {labels.credit || footnote ? (
        <div id="script-sheet-page-foot">
          <span>{labels.credit}</span>
          {footnote ? <span>{`* ${labels.footnote}`}</span> : null}
        </div>
      ) : null}
    </View>
  )
}
