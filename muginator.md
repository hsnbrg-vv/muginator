# Muginator

Muginator is a personal web app for iPhone that helps you brew pourover coffee from beans to mug. It records each brew's setup and timing, takes simple tasting notes, and lets you look back through past brews to dial in each coffee.

**Spec version:** 1.0 (2026-11-17)

---

## 1. Platform & tech

- The app is an installable PWA for iPhone Safari, added to the Home Screen. It works offline and is portrait-only.
- It's built with Vite and vanilla TypeScript, with no UI framework. Dependencies:
  - `idb`: a small IndexedDB wrapper
  - `vite-plugin-pwa`: manifest and service worker
  - `@fontsource/archivo` and `@fontsource/inter`: self-hosted fonts
- It's hosted on GitHub Pages. A GitHub Actions workflow builds on each push to `main` and deploys `dist/`. Vite's `base` is set to `/<repo-name>/`.
- When a new version has been deployed, the app shows an "Update available — reload" prompt.
- Charts are hand-drawn SVG, with no chart library.
- Units are grams and °C. Times display as `mm:ss`.

## 2. Data & storage

- All data lives on the phone in IndexedDB, in a database named `muginator` with these stores:

  | Store | Contents |
  |---|---|
  | `brews` | one record per brew, keyed by `id` (UUID) |
  | `suggestions` | remembered text values per field: bean, roaster, origin, process, grinder, brewer, paper |
  | `grinders` | per-grinder `name`, `min`, `max`, `step` |
  | `meta` | last brew id, schema version, last export date |

- On first launch the app calls `navigator.storage.persist()`.
- **Export** (in Settings) writes all stores to `muginator-backup-YYYY-MM-DD.json` and opens the iOS share sheet, so the file can go to Files or iCloud Drive.
- **Import** reads that file back. Records are merged by `id`, and the imported version wins on conflict.
- Settings shows the last export date, plus a gentle reminder when it's more than 30 days old.

### Brew record

```json
{
  "id": "uuid",
  "schemaVersion": 1,
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601",
  "bean": {
    "variety": "Gesha",
    "roaster": "Example Roasters",
    "origin": "Panama",
    "process": "Washed",
    "roastLevel": 1.5,
    "roastDate": "2026-11-02"
  },
  "dose_g": 15,
  "ratio": 16,
  "water_g": 240,
  "grinder": { "model": "1Zpresso K-Ultra", "setting": 4.3 },
  "brewer": "Hario V60 02",
  "paper": "Cafec Abaca",
  "waterTemp_c": 94,
  "timer": {
    "phases": [
      { "name": "Bloom", "duration_s": 40 },
      { "name": "Pour 1", "duration_s": 35 },
      { "name": "Pour 2", "duration_s": 30 },
      { "name": "Drawdown", "duration_s": 60 }
    ],
    "total_s": 165
  },
  "tasting": { "rating": 4, "extraction": 0, "note": "", "tastedAt": "ISO-8601" }
}
```

**Field rules:**

| Field | Values |
|---|---|
| `roastLevel` | 0.5–5 in steps of 0.5, or `null` |
| `roastDate` | a date, or `null` |
| `ratio` | the water part of 1:N, decimal allowed (e.g. 15.5) |
| `water_g` | `round(dose_g × ratio)` |
| `waterTemp_c` | whole °C, or `null` (displays as "–") |
| `tasting` | every field optional and nullable |
| `tasting.rating` | whole number, 1–5 |
| `tasting.extraction` | −2…+2: −2 very sour, 0 balanced, +2 very bitter |

`schemaVersion` lets fields be added later (e.g. strength, attribute scales, flavor tags) without breaking old records.

## 3. Navigation

A bottom tab bar has three tabs: **Brew**, **History** and **Settings**.

## 4. Brew flow

- The setup steps are **Beans → Grinder → Brewer & paper → Water**. A step indicator sits at the top, and Back/Next buttons sit at the bottom.
- You can move freely between steps until you tap **Start Brewing**.
- Every field is prefilled from the last saved brew. **Brew again** in History prefills from the chosen brew instead.

### Text fields with suggestions

- These fields remember every value you've saved: bean variety, roaster, origin, process, grinder, brewer and filter paper.
- While you type, matches appear below the field: case-insensitive prefix matches first, then substring matches.
- **Process** also has preset suggestions: Washed, Natural, Honey and Anaerobic.

### Beans

- **Bean variety, roaster, origin, process:** text fields with suggestions.
- **Roast level:** five coffee-bean icons in a row. Each can be selected as a half or a full bean, giving 0.5–5.
  - The leftmost bean is the lightest roast and the rightmost the darkest.
  - Tapping the currently selected value clears it.
- **Roast date:** optional, set with a date picker. Once it's set, "N days off roast" shows next to it.
- **Dose:** whole grams, entered with the number pad.
- **Ratio:** a single number entered with the decimal keypad (e.g. `16`) and displayed as **1:16**. Water is calculated from dose and ratio.

### Grinder

- **Grinder model:** a text field with suggestions.
- The first time a new model is used, the app asks for its range: min, max and step, defaulting to **0–9.9, step 0.1**. The range can be edited later in Settings → Grinders.
- **Grind wheel:** modeled on the 1Zpresso K-Ultra adjustment ring (see `k-ultra-wheel.JPEG`).
  - **Ring:** a horizontal brushed-silver ring seen from the side. It has a light metallic gradient with subtle noise texture, and darker bevel bands along the top and bottom edges.
  - **Markings:**
    - Digits 0–9 are spaced evenly with a raised dot halfway between each pair (the .5 position).
    - Digits and dots look embossed: a highlight on top and a soft shadow below.
  - **Perspective:** the ring is drawn with cylindrical perspective, so digits compress and fade toward the left and right edges.
  - **Interaction:**
    - Swiping sideways rotates the ring with momentum, and it snaps to each step (0.1).
    - The wheel loops: going past max wraps to min, and the other way round.
  - **Readout:**
    - A fixed notch in the center marks the selected value, and a large readout above shows it, e.g. **4.3**.
    - A haptic tick fires on each step where the device supports it; otherwise there is none.
  - **Other grinders:** the same ring is used, labelled with the integer marks of that grinder's range.

### Brewer & paper

- **Brewer** (e.g. Hario V60 02) and **Filter paper** (e.g. Cafec Abaca): text fields with suggestions.

### Water

- **Water temperature:** optional, in whole °C. Left empty, it displays as "–".
- **Water amount:** read-only, calculated from dose × ratio.
- **Start Brewing** shows a summary card of every value and goes to the timer.

### Timer

- **Screen and accuracy:**
  - The screen stays awake while the timer is open, using the Wake Lock API. Wake lock is requested again whenever the app becomes visible.
  - Timing is based on timestamps, not tick counting, so it stays accurate if the app is briefly backgrounded.
- **Layout, top to bottom:**
  - the phase heading
  - a very large `mm:ss` total timer
  - the completed phases with their durations
  - a large primary button and a secondary button
  - a small **Undo** link
- **Flow:** each tap marks the start of the next phase. A phase lasts from its start until the next tap.

  | Step | You tap | Heading | Primary button | Secondary button |
  |---|---|---|---|---|
  | 0 | — | Ready | **Start Bloom** | — |
  | 1 | Start Bloom | Bloom | **Pour 1** | — |
  | 2 | Pour 1 | Pour 1 | **Pour 2** | **Drawdown** |
  | 3…N | Pour N | Pour N | **Pour N+1** | **Drawdown** |
  | N+1 | Drawdown | Drawdown | **Finished** | — |
  | end | Finished | Finished | — | — |

  - The timer keeps running from Start Bloom until Finished, and shows the total brew time throughout.
  - Each completed phase's duration appears in the list as soon as it ends.
- **Undo** reverts the last tap and returns to the previous phase. The timer keeps running.
- Leaving the timer screen mid-brew asks for confirmation before discarding.

### Finish & tasting

- At the top, the total brew time and each phase's duration are shown as a timeline bar with proportional segments, with a table underneath.
- Next comes the optional **Tasting notes** section (§5).
- A **slide-to-save** control at the bottom does three things:
  - writes the brew to IndexedDB
  - updates the suggestion lists
  - opens the brew's detail page

## 5. Tasting notes

Tasting notes are deliberately simple. A "Taste later" link collapses the section, so you can save first and taste once the coffee has cooled.

1. **Overall rating:** five mug icons, whole mugs only, giving 1–5. Tapping the selected mug clears the rating.
2. **Extraction:** a 5-step segmented scale:

   `Very sour · Sour · Balanced · Bitter · Very bitter`

   It's stored as −2…+2, and each segment is tinted with its extraction color (§7).
3. **Note:** a free-text field.

- Tasting notes can be added or edited later from the brew's detail page, and `tastedAt` updates on each edit.
- Brews without a rating show an **Add notes** badge in History.

## 6. History

A segmented control at the top switches between **Brews** and **Beans**.

### Brews (list)

- Brews are listed newest first and grouped under month headers.
- **Each card shows:**
  - date and time
  - bean · roaster
  - the rating in mugs, or an **Add notes** badge
  - `1:16 · 15 g → 240 g`
  - grind setting
  - total brew time
  - a small extraction dot: pink for sour, green for balanced, brown for bitter. The shade gets stronger for the extreme values.
- **Search:** free text across bean variety, roaster, origin and note.
- **Filters** (bottom sheet):
  - roaster, bean, grinder and brewer, each a multi-select from the values that exist
  - minimum rating
  - date range
  - active filters show as removable chips above the list
- **Sort:** newest (default), oldest, rating, or total time.
- Tapping a card opens the brew's detail page.

### Brew detail

- **Sections:**
  - Beans, including days off roast at brew time
  - Grind, with a small static wheel
  - Brewer & paper
  - Water
  - Timer: the timeline bar and a phase table
  - Tasting
- **Actions:**
  - **Brew again** starts the brew flow prefilled with this brew's setup.
  - **Edit** opens the tasting notes, and a correction mode for the setup fields.
  - **Delete** asks for confirmation, then removes the brew permanently.

### Beans (per-bean dial-in)

- A list of every **bean + roaster** combination, sorted by when it was last brewed. Each row shows:
  - brew count
  - best and average rating
  - last brewed date
- **Bean detail:**
  - A **best brew** card: the highest rating, newest on ties. It has a **Brew again** button.
  - A **dial-in chart**: an SVG scatter plot with grind setting on the x-axis and rating on the y-axis.
    - Points are colored by extraction, and the latest brew is outlined.
    - Tapping a point opens that brew.
    - A toggle switches the y-axis between **Rating** and **Extraction**.
    - Only brews made with one grinder model are plotted. A grinder picker appears when the bean has been brewed with several grinders.
  - Below the chart: all brews of this bean.

## 7. Visual theme

- **Colors** are defined as CSS custom properties:

  | Role | Color |
  |---|---|
  | Background | cream `#F4EBDC` |
  | Cards / surfaces | lighter cream `#FBF6EE`, hairline border `#E2D3BC` |
  | Primary button | brown `#6F4A2F`, off-white text `#FBF6EE` |
  | Secondary button | light brown `#C9A27A`, black text `#1C1714` |
  | Body text | near-black `#1C1714` |
  | Muted text | `#5E4E42` |
  | Extraction: very sour / sour | pink `#E0578A` / `#F09AB8` |
  | Extraction: balanced | green `#3F8F5C` |
  | Extraction: bitter / very bitter | brown `#9A6A45` / `#5A3520` |
  | Danger (delete, discard) | `#B3261E` |
  | Focus ring | `#2F6FDB` |

- **Contrast:** every text/background pair must meet WCAG AA, which means at least 4.5:1. Both button styles reach about 7:1 or better.
- **Typography:**
  - **Archivo** for headings, buttons and timer digits. The timer is set at weight 800, about 96px, with tabular numbers so the digits don't jitter.
  - **Inter** for body text, 17px minimum.
  - Both fonts are self-hosted, so they work offline.
- **Touch targets:** at least 48px. Timer buttons are at least 72px tall, so they're easy to hit with wet hands.
- **Light theme only:** `color-scheme: light`, with no dark mode.

## 8. App icon

- **Design:** a stout, wide, light-yellow mug (`#F3DE8A`) with a chunky handle, soft darker-yellow shading and a dark-brown outline (`#4A2F1E`). It sits on a light-brown square (`#C49A6C`).
- **Source:** `public/icon.svg`. The mug stays inside the central safe zone, so the icon also works as a maskable icon.
- **PNG sizes**, generated with `@vite-pwa/assets-generator`:
  - Apple touch icon, 180px
  - 192px and 512px icons
  - maskable 512px icon
  - favicon
- **Manifest:** `theme_color` `#6F4A2F`, `background_color` `#F4EBDC`.

## 9. Settings

- Export and Import (JSON), with the last export date.
- Grinders: edit each grinder's min, max and step.
- Suggestions: remove remembered values per field.
- Persistent storage status.
- App version.

## 10. Project layout

```
index.html, vite.config.ts, tsconfig.json, package.json
.github/workflows/deploy.yml
public/                icon.svg, generated icons
src/main.ts            hash router, tab bar
src/db.ts              IndexedDB schema, CRUD, export/import, suggestions
src/model.ts           Brew types, calculations (water, days off roast)
src/timer.ts           phase state machine with undo (pure, unit-tested)
src/components/        autocomplete, roastSelector, mugRating, grindWheel,
                       extractionScale, slideToSave, timelineBar, scatterChart
src/screens/           brewSetup, timer, finish, history, brewDetail,
                       beans, beanDetail, settings
src/styles.css
```

## 11. Verification

- **Unit tests** (Vitest):
  - the timer state machine, including undo
  - water calculation
  - export/import round-trip and merge
  - suggestion matching
- **On the phone during development:** run `npm run dev -- --host` and open the shown address over local Wi-Fi.
- **After deploying**, check on the iPhone:
  - Add to Home Screen
  - offline launch
  - the screen stays awake during the timer
  - a full brew → save → History → Beans chart
  - Export to Files, then Import on a cleared install
- **Out of scope for v1:** strength, attribute scales, flavor tags, comparing two brews, sync between devices.
