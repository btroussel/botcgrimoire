// The camera reading a share link's QR code (docs/app.md, Scripts). An iPhone's own camera
// opens a scanned link in Safari, whose storage is not the installed app's, so the app reads the
// code itself. Decoding runs on the device; no frame leaves it.
import type { QRCamera } from 'qr/dom.js'
import { QRCanvas, frameLoop, rearCamera } from 'qr/dom.js'
import { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { isWeb } from '../../store/browser'
import { palette, radius, space, type } from '../../ui/theme'

// Only the installed app on a touch screen offers it. In a browser tab the phone's own camera
// opens the link in that same browser, and a computer's webcam has no business reading a phone.
export const canScan = isWeb && typeof navigator.mediaDevices?.getUserMedia === 'function'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(display-mode: standalone) and (pointer: coarse)').matches

export interface QrScannerProps {
  readonly onRead: (text: string) => void
  readonly hint: string
  readonly failed: string // the camera would not start: refused, missing or busy
  readonly label: string
}

export const QrScanner = ({ onRead, hint, failed, label }: QrScannerProps) => {
  const video = useRef<HTMLVideoElement>(null)
  const read = useRef(onRead)
  useEffect(() => {
    read.current = onRead
  })
  const [broken, setBroken] = useState(false)

  useEffect(() => {
    const player = video.current
    if (!player) return
    let done = false
    let camera: QRCamera | undefined
    let cancel: (() => void) | undefined
    const stop = () => {
      done = true
      cancel?.()
      camera?.stop()
    }
    rearCamera(player).then((opened) => {
      camera = opened
      if (done) {
        opened.stop()
        return
      }
      const canvas = new QRCanvas()
      let reading = false
      // A frame that holds no code throws or reads as nothing; the next frame tries again. The
      // camera's own pixels, not the preview box, which squeezes the frame into a square.
      cancel = frameLoop(() => {
        if (reading || done) return
        reading = true
        opened.readFrame(canvas, true).then((result) => {
          reading = false
          if (typeof result !== 'string' || done) return
          stop()
          read.current(result)
        }, () => {
          reading = false
        })
      }, player)
    }, () => {
      if (!done) setBroken(true)
    })
    return stop
  }, [])

  return (
    <View style={styles.wrap}>
      {broken ? (
        <Text accessibilityRole="alert" style={[type.text.body, { color: palette.ink }]}>{failed}</Text>
      ) : (
        <>
          <View style={[styles.frame, { backgroundColor: palette.ink }]}>
            <video ref={video} aria-label={label} muted playsInline style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />
          </View>
          <Text style={[type.text.body, { color: palette.ink }]}>{hint}</Text>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: space.md, alignItems: 'center' },
  frame: { width: '100%', maxWidth: 320, aspectRatio: 1, borderRadius: radius.tile, overflow: 'hidden' },
})
