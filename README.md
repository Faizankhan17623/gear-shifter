# Gear Shifter

A literal car gear-shifter desktop app for switching which Claude model you use in [Claude Code](https://claude.com/claude-code). Drag a GT-R-style gearstick between six gate positions — each mapped to a Claude model — and it copies (or, optionally, auto-types) the matching `/model <id>` command so you can drop it straight into your terminal.

![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)

## What this is

Claude Code has no API for a separate desktop app to reach into a running terminal session and change its model directly. So Gear Shifter does the next best thing: it gives you a satisfying, real-feeling gear-shifter UI, and every shift produces the exact `/model <model-id>` command for you to use.

Two ways to get that command into your terminal:

- **Clipboard mode** (default) — shifting copies `/model <id>` to your clipboard. Paste it into Claude Code yourself.
- **Auto-type mode** (experimental, opt-in) — shifting shows you the OS window it's about to type into and asks you to confirm, then types the command and presses Enter for you. Window detection on Windows is best-effort (the OS restricts which apps can query real focus state), so the confirmation step exists specifically to catch a wrong guess before anything gets typed into the wrong place.

## Gear mapping

| Gear | Model | Notes |
|---|---|---|
| R | Haiku 4.5 | fastest / cheapest — also the default reset gear |
| 1 | Haiku 4.5 | |
| 2 | Sonnet 5 | balanced everyday driver |
| 3 | Opus 4.8 | deep reasoning, slower |
| 4 | Fable 5 | most capable, slowest |
| 5 | 🔒 locked | reserved for a future model — greyed out, not clickable |

The mapping is fully editable from the in-app settings panel (⚙ button) and persists across restarts.

## Features

- **Real H-gate physics** — the knob can only travel in straight lines along the actual gate rails and crossbar, exactly like a manual transmission. No diagonal cutting across the gate.
- **Drag-and-drop or click** — grab the knob and drag it into a gate slot, or just click a gear directly.
- **Mechanical shift feel** — a two-phase throw animation (breakaway pause → decisive travel → spring settle with overshoot), a subtle knob lean toward the direction of travel, and a detent "clunk" pulse on arrival.
- **GT-R-styled shifter** — black leather knob with cross-stitched seams, a gunmetal collar, a leather boot/gaiter, and a brushed-metal console plate with a physically-cut gate slot.
- **Locked/reserved gears** — gears without an assigned model render greyed out with a lock icon and don't respond to clicks or drags, so the shifter has room to grow when new models release.
- **Editable settings** — remap any gear to any available model from the settings panel; persisted locally via `electron-store`.
- **System tray** — minimizes to the tray instead of quitting; click the tray icon to show/hide the window.
- **Fully offline** — no network calls, no telemetry, no account system.

## Tech stack

- **Electron** — desktop shell, system clipboard, tray icon, OS window/keystroke automation
- **React 18** + **TypeScript** — UI
- **Vite** — renderer build
- **Framer Motion** — shift animation and drag physics
- **electron-store** — local settings persistence
- **[@nut-tree-fork/nut-js](https://github.com/nut-tree/nut.js)** — native keystroke simulation for auto-type mode (Windows only for now)

No state management library, router, or backend — this is a single-screen utility, not a big app.

## Getting started

```bash
npm install     # also rebuilds the native nut-js module against Electron's Node ABI
npm run build   # compiles the main process + bundles the renderer
npm start       # launches the app
```

For development with hot reload on the renderer:

```bash
npm run dev                                  # starts the Vite dev server
ELECTRON_START_URL=http://localhost:5173 npx electron .   # in a second terminal
```

## Project structure

```
src/
  main/        Electron main process — window, tray, clipboard, IPC, auto-type
  renderer/    React UI — the shifter, settings panel, toasts
  shared/      Model catalog and gear-mapping types shared by both sides
```

## Auto-type mode — how it works and its limits

When enabled, shifting a gear:

1. Asks the main process which OS window was most recently active before Gear Shifter took focus.
2. Shows you that window's title in a confirmation dialog.
3. Only on your explicit confirmation does it focus that window and type `/model <id>` + Enter into it.

This is OS-level automation, not a real Claude Code integration — there is no API for that. Window-focus tracking on Windows is inherently best-effort; in testing, it occasionally identified the wrong window. The confirmation step exists specifically so a wrong guess gets caught and cancelled rather than typed somewhere unintended. If it ever finds no usable target, or you cancel, it falls back to copying the command to your clipboard instead.

## License

MIT
