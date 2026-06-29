# App Icons & Splash Screens

Capacitor (via `@capacitor/assets` or manual Android Studio / Xcode asset catalogs)
needs source images here before generating all required sizes:

```
frontend/resources/
  icon.png        <- 1024x1024px, no transparency, your app icon (square)
  splash.png      <- 2732x2732px, centered logo on background, used for launch screen
```

## Generating all platform sizes automatically

Once you have `icon.png` and `splash.png` in this folder:

```bash
cd frontend
npm install -D @capacitor/assets
npx capacitor-assets generate
```

This produces every Android density (mdpi → xxxhdpi) and iOS icon size
(20pt → 1024pt, all @1x/@2x/@3x) automatically, placed directly into the
`android/` and `ios/` native projects.

## Design notes for VibeLens AI

- Icon background: use the app's dark navy (#080810) or the gold gradient
  (#f0c040 → #c084fc) — avoid plain white backgrounds, they look washed out
  in both stores' rounded-icon previews.
- Keep the icon's focal mark (e.g. the ✦ logomark) centered with generous
  padding — both Android adaptive icons and iOS's rounded-corner mask crop
  edges aggressively.
- Splash screen should be the icon centered on a solid #080810 background —
  no text, since it only shows for ~1 second on launch.
