# Emberwing Run

A dark-fantasy dragon endless runner for phone browsers. You are **Cinder**, a Smaug-style red dragon with a gem-studded golden belly, fleeing the ashfall across broken islands in a burning sky. Tap to leap, swipe down to dive under iron traps, hold in the air to spread your wings and glide.

Everything is made in code: no image files, no audio files, no libraries, no build step, no CDN, no accounts, no tracking. Plain HTML5 canvas, CSS and JavaScript modules. It installs on a phone like an app and plays offline.

> Status: **Stage 3 of 3, feature complete.** Stage 1 was the core run, Stage 2 added the world (biomes, power-ups, war beasts, forge, quests, daily run, sound), Stage 3 adds trophies, the wardrobe, stats, full settings and accessibility, the installable offline app, performance tuning and the final test pass.

## Play it (GitHub Pages)

When GitHub Pages is switched on (below), the game lives at:

**https://tasosk23.github.io/Cozyrunner/**

### Switch on GitHub Pages (once)

1. On github.com open the repository, then **Settings** and **Pages** (left sidebar).
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Pick branch **main** and folder **/ (root)**, then press **Save**.
4. Wait a minute or two and refresh that page. A box at the top shows the live address.

After that, every push to `main` redeploys the game by itself. The repository already contains a `.nojekyll` file (so GitHub serves the files untouched) and every link in the game is relative, so it works under the `/Cozyrunner/` address.

## Install it on your phone

Open the address **once while you are online** and let the game load. When **Settings > Install and offline** says **Ready to play offline**, the game has saved itself on the phone.

- **Android (Chrome, for example a Samsung S24+):** tap the **Install app** chip at the bottom-left of the title screen (it shows up once Chrome offers installation; **Settings > Install app** does the same). The same thing is in Chrome's menu (the three dots) as **Install app** or **Add to Home screen**. The icon lands in your app drawer and the game opens full-screen with no browser bars.
- **iPhone or iPad (Safari):** tap the **Share** button, then **Add to Home Screen**, then **Add**. iOS has no install button for web apps; the Share sheet is the way in.
- **Desktop Chrome or Edge:** use the install icon at the right end of the address bar.

To prove it works offline: install it, switch on airplane mode, open it from the home-screen icon.

### Updates

When you push a new version, the next time the game is opened with a connection it downloads the update in the background and **waits**: it never swaps code under a running game. Settings shows **Update ready: restart**; press it and the new version starts. Old files are cleaned up automatically. **Settings > Install and offline > Check for update** looks for one right away.

## Controls

| Action | Touch | Keyboard |
|---|---|---|
| Leap | tap (hold a little longer = higher) | Space / Up / W |
| Glide | tap again, or hold while falling | hold the jump key |
| Dive (slide) | swipe down, or just tap the lower part of the screen (setting: **Tap to slide**) | Down / S |
| Pause | pause button (moves to the left with **Left-handed layout**) | P / Esc |

## What is in the game

**The run**
- **Five biomes**, 400 m each, looping: Ashen Highlands, Ruined Keep, Emberdeep Caverns, Stormspire Peaks, Obsidian Lava Lake. Each has its own sky, parallax layers, weather, hazards, music and a stone gateway at the border.
- **Hazards and zones**: hanging iron portcullis traps (dive under them), spiked magma crawlers (leap), falling cinders, gaps (glide), steam vents that blast you skyward, plus speed zones (ash drifts, gales, fog).
- **Five power-ups**: Gold Magnet, Wing Gust, Inferno Dash, Firestorm, Scale Shield.
- **Fair by construction**: every hand-built level chunk is checked by a solver that proves it can be beaten, and a bot plays whole courses on the real engine in the tests.

**Between runs**
- **War Beasts**: nine companions with passive effects, unlocked by flying (not by paying).
- **The Forge**: five permanent upgrades bought with embers.
- **Quests**: three daily quests plus a weekly one, and a **Daily Run** (the same course for everybody that day, with a streak).
- **Dragon eggs** with a pity counter. They can hold embers, XP, war beasts and new looks.

**Collections (new in Stage 3)**
- **Trophies**: 35 in three tiers (bronze, silver, gold). Distance, survival, flawless runs, near misses, gap glides, portcullis dives, collecting, the realm, the daily run and streaks, rank and more. Single-run trophies pop up **during** the run as a small toast at the bottom of the screen and pay their embers on the spot; totals are checked when the run ends.
- **Wardrobe**: 20 looks for Cinder in four slots: **scales, horns, eyes and flame** (obsidian, verdigris, frostbitten and gilded scales, crimson and venom eyes, azure, hellgreen, void and white flames...). Some come from trophies, some from your rank, some only from eggs. A live preview shows the dragon as you pick, and you can try on locked looks to see what you are working toward.
- **Stats**: career, plunder, skill, realm, war-camp and daily-run numbers in one place.

**Settings and access (new in Stage 3)**
- Music and effects volume with mute; **Gentle mode** (one extra heart on normal runs, not on the Daily Run); **Tap to slide**; **Left-handed layout**; break reminders.
- **Vibration**, **Screen shake**, **Screen flashes** and **Reduced motion** switches. On a first visit the game follows the phone's own "reduce motion" and "increased contrast" choices.
- **High contrast** (dimmed backdrop, bright outlines on hazards and rings on pickups) and **Large text** (bigger HUD and menus).
- **Graphics: Auto, High, Medium or Low**, plus a **Show FPS** counter. Auto lowers the detail by itself if the phone struggles.
- Menus work with a keyboard and carry screen-reader labels; the game canvas has a description.

**Sound**
- Procedural music per biome that gets livelier with speed, plus effects, all synthesised live with the Web Audio API. The first tap starts the audio engine (browsers require that).

## Save data

- Progress is saved on **this device**, in the browser's local storage (key `lanternfold.save`; the name is a leftover from the game's first version and is kept so early saves keep working). It is one versioned JSON document (now version 3). Older versions upgrade automatically, and a repair pass fixes or drops anything damaged instead of crashing.
- **Back it up:** **Settings > Save data > Show my code** gives a code that starts with `EW3.` Copy it somewhere safe. **Restore from code** puts it back (older `LF` codes still work). A mistyped or damaged code is refused and changes nothing. There is no cloud sync.
- Clearing the browser's site data, or uninstalling the app, erases the save. On an iPhone the Home Screen app can have its own separate save, apart from Safari: move progress across with a code.

## Run it on your computer

ES modules need a web server (opening `index.html` straight from disk does not work):

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

To try it on a phone on the same Wi-Fi, open `http://<your-computer-ip>:8000`. Browsers only allow installing and offline mode on `https://` addresses or `localhost`, so for those use the GitHub Pages address above.

## Tests

Needs Node.js (tested with v22). The browser tests also need Python 3 with Playwright (`pip install playwright`) and Chrome; they expect it at `/usr/bin/google-chrome`, so change that path at the top of a test file if yours is elsewhere.

```bash
node tests/validate.mjs            # every level chunk is beatable (solver proof), 56 chunks
node tests/bot.mjs 8 3000          # an autopilot plays 8 seeds x 3000 m on the real engine and must never bump
node tests/meta.mjs                # 40 data checks: trophies, looks, eggs, save upgrades v1/v2 to v3, repair, export/import codes
node tools/gen-assets.mjs --check  # the offline file list and build stamp match the files
python3 tests/e2e.py               # 18 checks, headless Chrome: controls, pause, restart, saving, game over
python3 tests/e2e2.py              # 28 checks: menus, forge, beasts, quests, daily run, eggs, audio, break note, frame-rate floor
python3 tests/e2e3.py              # 86 checks: trophies with live toasts, wardrobe, stats, every setting, accessibility, migration, debug panel, title layout on four phone sizes
python3 tests/pwa.py               # 24 checks: manifest, icons, service worker, real offline play, update flow, cache cleanup
```

Visual checks write PNGs to `screenshots/` (not committed): `tests/gallery*.py` (biomes, hazards, wardrobe, trophies), `tests/hero*.py` (the dragon in every pose; `--low` for the lite version), `tests/sheets.py` and `tests/screens.py` (menus), `tests/s3_look.py` (Stage 3 screens at two phone sizes). Profiling helpers: `tests/fps*.py`, `tests/perf.py`, `tests/profile*.py`, `tests/alloc.py`, `tests/heapsample.py`.

## Handy URL options and the debug panel

- `?startM=1000` starts a run at that distance in metres (jump straight to a biome).
- `?debug` adds a small **DEBUG** panel (normal players never load it): a frame-time graph (green under 20 ms, amber under 33 ms, red slower), a hitbox overlay, god mode, graphics level cycle, start at 0 / 400 / 800 / 1200 / 1600 m, **+1000 embers**, **Unlock all**, **+1 day** (shifts the game's clock to test the Daily Run, quests and streaks) and **Wipe save**.
- `window.__cozy` is a small handle the automated tests use.

## Performance notes

- Measured in headless Chrome with software rendering (no GPU, so frame rates there say nothing about a phone): about 1.3 ms of JavaScript render time per frame and about 75 KB of short-lived garbage per frame in normal play. The whole shipped game is 54 files, about 0.8 MB (about 0.5 MB compressed): 400 KB of code and 360 KB of app icons (losslessly re-compressed).
- **Not yet measured on a real phone.** The game uses a fixed 60 Hz simulation with interpolated drawing, a quality monitor that lowers particle and detail levels when frames run long, and a manual **Graphics** setting. If it ever stutters on a device, try **Settings > Graphics > Medium or Low**, and turn on **Show FPS**.

## Changing the game

- After editing **any** shipped file (`index.html`, `manifest.webmanifest`, anything in `css/`, `src/` or `icons/`) run `node tools/gen-assets.mjs`. It rewrites `asset-manifest.json` and stamps a fresh build id into `sw.js`; without that, phones that already installed the game would not notice there is an update. To have git do it on every commit: `git config core.hooksPath .githooks` (once per clone). The tests fail if the stamp is stale.
- `node tools/gen-assets.mjs` is the only tool needed; `tools/gen-icons.py` redraws the app icons from the game's own dragon (needs Playwright).
- Bump `VERSION` in `src/data/meta.js` for a release.
- Game feel lives in `src/data/balance.js`. Trophies, looks, biomes, power-ups, beasts and quests are plain data tables in `src/data/`.

## Project layout

- `index.html`, `css/style.css`, `manifest.webmanifest`, `sw.js`, `asset-manifest.json`, `icons/`, `.nojekyll`: the page and the offline app shell
- `src/main.js`: wires everything together (settings, run lifecycle, trophies, wardrobe preview)
- `src/core/`: loop, input, storage and save (versioned, repair, codes), RNG, clock, quality monitor, haptics, `pwa.js` (install and offline)
- `src/game/`: physics, level solver, chunk generator, world, quests, daily run, eggs, trophies, loadout, juice
- `src/render/`: canvas drawing (backdrop, terrain, the dragon, companions, props, HUD, particles)
- `src/audio/`: the Web Audio synth (music, effects, volume buses)
- `src/data/`: tunable numbers, level chunks, strings, biomes, power-ups, beasts, upgrades, quests, trophies, looks
- `src/ui/`: title, pause and game-over screens, menu sheets, toasts, icons, the debug panel
- `tests/`, `tools/`, `.githooks/`: tests, the asset tool, the pre-commit hook

## Code names

The game started as a cosy critter runner and was re-skinned into a dragon game. Everything the player sees is dragon-themed, but many internal ids kept their first names so saves, tests and level data kept working. When you read the code, translate like this:

| In the code | In the game |
|---|---|
| `Bramble`, `bramble.js`, `BrambleVisual` | Cinder, the dragon (the drawing code) |
| hazards `snail`, `vine`, `drop`; `pad` | magma crawler, iron portcullis, falling cinder; steam vent |
| pickups `seed`, `lantern`, `tea`, `firefly`, `letter` | ember shard, brazier, dragon heart, phoenix wisp, F-I-R-E rune |
| power-ups `honey`, `hop`, `dash`, `burst`, `blanket` | Gold Magnet, Wing Gust, Inferno Dash, Firestorm, Scale Shield |
| biomes `meadow`, `teacup`, `grove`, `heights`, `lake` | Ashen Highlands, Ruined Keep, Emberdeep Caverns, Stormspire Peaks, Obsidian Lava Lake |
| save fields `seedsBank`, `chests.pending`, `companions` | embers, eggs, war beasts |
| storage key `lanternfold.save` | the save itself |

## Known limitations

- Real-phone frame rate and sound quality are untested; everything above was checked in headless Chrome (see Performance).
- The Daily Run, quests and streaks use the device clock, so changing the phone's date changes them. There is no server.
- The save is local to one browser on one device; there is no cloud sync (use a backup code to move it).
- Built for portrait phones; the installed app asks for portrait. On a desktop it runs in the same portrait play area with keyboard controls.
- The first visit must be online so the game can save itself for offline play.

## Licence

Copyright (c) 2026 TasosK23. **All rights reserved.** No licence is granted to copy, modify, distribute or sell this software without the owner's written permission. See `LICENSE`.
