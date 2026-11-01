import { useId, useState } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'

import type { BoardColour, Locale, Translate } from '../../content'
import { focusStyle, isFocused } from '../../ui/Button'
import { useFocusVisible } from '../../ui/focus'
import { Icon } from '../../ui/icons'
import { PaperTexture } from '../../ui/PaperTexture'
import { Picker } from '../../ui/Picker'
import { usePhone } from '../../ui/breakpoint'
import { Screen } from '../../ui/Screen'
import { Section } from '../../ui/Section'
import { focusRing, motion, palette, radius, space, type } from '../../ui/theme'
import { velvetArt } from '../../ui/Velvet'
import { AboutSection } from './AboutSection'
import type { SettingsView } from './useSettings'
import { useSettings } from './useSettings'

export const SettingsScreen = () => {
  const s = useSettings()
  const { t } = s
  const phone = usePhone()
  return (
    <Screen title={t('common.settings')} onBack={s.back} backLabel={t('common.back')}>
      <SettingsStyles />
      <View style={[styles.paper, { padding: phone ? space.lg : space.xl }]}>
        <PaperTexture radius={radius.tile} />
        <Section label={t('common.language')}>
          <Languages t={t} options={s.localeOptions} onChange={s.setLocale} />
        </Section>

        <Section label={t('common.grimoireStyle')}>
          <Swatches label={t('common.grimoireStyle')} options={s.colourOptions} onChange={s.setBoardColour} />
        </Section>

        <Section label={t('common.about')}>
          <AboutSection t={t} />
        </Section>
      </View>
    </Screen>
  )
}

// A language's code, short unless two bundled variants share it: nb, but es and es-419. A name
// that already ends in a parenthesis takes the code inside it.
const withCode = (name: string, locale: Locale, options: SettingsView['localeOptions']) => {
  const language = locale.split('-')[0]!
  // A non-breaking hyphen keeps es-419 on one line when the name wraps.
  const code = (options.filter((o) => o.locale.split('-')[0] === language).length > 1 ? locale : language).replace('-', '\u2011')
  return name.endsWith(')') ? `${name.slice(0, -1)}, ${code})` : `${name} (${code})`
}

// One row names the chosen language. The whole list would crowd the page, so it opens in the
// shared picker as one short line per language: its own name and its code.
const Languages = ({ t, options, onChange }: {
  readonly t: Translate
  readonly options: SettingsView['localeOptions']
  readonly onChange: (locale: Locale) => void
}) => {
  const [open, setOpen] = useState(false)
  const focusVisible = useFocusVisible()
  const current = options.find((o) => o.selected)
  return (
    <>
      <Pressable accessibilityRole="button" aria-haspopup="dialog" accessibilityLabel={`${t('common.language')}, ${current?.name ?? ''}`}
        onPress={() => setOpen(true)}
        style={(state) => [styles.languageRow, { backgroundColor: state.pressed ? palette.paperPressed : 'transparent' },
          focusStyle(palette, isFocused(state) && focusVisible, 'paper')]}>
        <span lang={current?.locale} style={{ flex: 1, minWidth: 0, display: 'block', textAlign: 'start' }}><Text style={[type.text.strong, styles.languageName]}>{current?.name}</Text></span>
        <Icon name="chevronRight" color={palette.ink} size={22} />
      </Pressable>
      <Picker visible={open} title={t('common.language')} onClose={() => setOpen(false)} closeLabel={t('common.close')} emptyLabel=""
        groups={[{ key: 'languages', rows: options.map((o) => ({ id: o.locale, name: withCode(o.name, o.locale, options), lang: o.locale })) }]}
        selected={current ? [current.locale] : []}
        onPick={(id) => {
          setOpen(false)
          const picked = options.find((o) => o.locale === id)
          if (picked) onChange(picked.locale)
        }} />
    </>
  )
}

// Native radios, as in Segment, give the swatches one tab stop and arrow-key selection.
const Swatches = ({ label, options, onChange }: {
  readonly label: string
  readonly options: SettingsView['colourOptions']
  readonly onChange: (colour: BoardColour) => void
}) => {
  const name = useId()
  return (
    <div className="settings-swatch-frame">
      <div className="settings-swatches" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <label key={o.key} className="settings-swatch">
            <input type="radio" name={name} value={o.key} checked={o.selected} aria-label={o.name} onChange={() => onChange(o.key)} />
            <span className="settings-fabric">
              <Image source={velvetArt[o.key]} resizeMode="cover" style={styles.fabric} accessible={false} />
              <span className="settings-check" aria-hidden="true"><Icon name="check" color={palette.onAccent} size={18} /></span>
            </span>
            <span className="settings-swatch-name">{o.name}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

// The swatches go to one row once there is room for four without cramping the names. A container
// query decides before paint, by the panel's width rather than the window's.
const SettingsStyles = () => <style href="grimoire-settings" precedence="default">{`
  .settings-swatch-frame { container: settings-swatches / inline-size; }
  .settings-swatches { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: ${space.sm}px; }
  @container settings-swatches (min-width: 520px) { .settings-swatches { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
  .settings-swatch {
    position: relative; display: flex; flex-direction: column; min-width: 0; cursor: pointer;
    border: 2px solid ${palette.inkMuted}; border-radius: ${radius.control}px; overflow: hidden;
    -webkit-tap-highlight-color: transparent;
    transition: border-color ${motion.duration.mark}ms ${motion.css.ease};
  }
  .settings-swatch input { position: absolute; width: 1px; height: 1px; opacity: 0; margin: 0; }
  .settings-swatch:hover { border-color: ${palette.ink}; }
  .settings-swatch:active { opacity: ${motion.pressedOpacity}; }
  .settings-swatch:has(input:focus-visible) { outline: ${focusRing.width}px solid ${palette.ink}; outline-offset: ${focusRing.offset}px; }
  .settings-swatch:has(input:checked) { border-color: ${palette.accent}; }
  .settings-fabric { position: relative; display: block; height: 96px; overflow: hidden; }
  .settings-swatch-name {
    display: block; padding: ${space.xs}px ${space.sm}px; text-align: center; overflow-wrap: anywhere;
    font: ${type.text.strong.fontSize}px/${type.text.strong.lineHeight}px ${type.text.strong.fontFamily};
    color: ${palette.ink};
    transition: background-color ${motion.duration.mark}ms ${motion.css.ease}, color ${motion.duration.mark}ms ${motion.css.ease};
  }
  .settings-swatch:has(input:checked) .settings-swatch-name { background-color: ${palette.accent}; color: ${palette.onAccent}; }
  .settings-check {
    position: absolute; top: ${space.xs}px; right: ${space.xs}px; width: 28px; height: 28px; border-radius: 14px;
    display: flex; align-items: center; justify-content: center; background: ${palette.accent};
    opacity: 0; transform: scale(0.8);
    transition: opacity ${motion.duration.mark}ms ${motion.css.ease}, transform ${motion.duration.mark}ms ${motion.css.ease};
  }
  .settings-swatch:has(input:checked) .settings-check { opacity: 1; transform: none; }
  @media (prefers-reduced-motion: reduce) {
    .settings-swatch, .settings-swatch-name { transition: none; }
    .settings-check { transform: none; transition: opacity ${motion.duration.fade}ms linear; }
  }
`}</style>

const styles = StyleSheet.create({
  paper: {
    gap: space.xxl,
    borderWidth: 1,
    borderRadius: radius.tile,
    backgroundColor: palette.parchment,
    borderColor: palette.parchmentShade,
  },
  // A close crop shows the weave instead of shrinking the whole board into a flat colour.
  fabric: { position: 'absolute', width: '300%', height: '300%', left: '-100%', top: '-100%' },
  languageRow: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 52, paddingHorizontal: space.md,
    borderWidth: 2, borderColor: palette.inkMuted, borderRadius: radius.control,
  },
  languageName: { color: palette.ink },
})
