# Halo design direction

Halo should look and feel like an Apple app: clean, modern, easy to read, and calm. Every screen should be readable at a glance, and no element ever sits on top of another.

Reading this as: a personal health app for one person checking in a few times a day, in Apple's iOS 26 visual language, dial ENERGY 1 / RHYTHM 2 / MOTION 2.

## Personality

- Calm and trustworthy. The numbers are the content; the interface stays out of their way.
- Plain-spoken. Short sentences, sentence case, no hype, no emoji, no em dashes.
- Quietly alive: a ring drawing on or a number rolling into place, never decoration for its own sake.

## Layout

- Apple's grouped style: a grey ground, white cards (black and near-black in dark mode), inset lists with hairline separators.
- 16 px side margins, 12 px between cards. One corner scale: cards 20, inset lists 16, panels nested inside a card 14, text fields 12, buttons and chips a full pill. Pop-up menus keep iOS's own radius.
- Every tab opens the same way: the day as a caps eyebrow over the large title, with round blue steps for the previous and next day beside it (a tap on the title opens the calendar). The bar puts the band's sync status and your avatar at the top right of every tab; Sleep and Activity keep their info button at the top left.
- One focal point per screen: the score's ring or number at the top. Everything else is supporting detail beneath it.
- Rhythm varies with the content: a hero, then lists, tiles or charts as the data needs. No screen is a grid of identical cards.

## No overlapping elements

- Nothing is ever readable under a bar. The top bar's scroll edge is near solid behind its buttons and title, and the page ground fills everything below the top of the tab bar.
- Text never runs under or into another element. Long labels wrap or shrink to fit; they are never clipped behind an icon, a button or the system gesture bar.
- Touch targets are at least 44 × 44 px and never closer than 8 px.
- Sheets and dialogs cover what they sit over; nothing shows through a dialog's text.

## Type

- Inter, set to iOS text styles: Large Title 34/41 bold, Title 22/28, Headline 17/22 semibold, Body 17/22, Subhead 15/20, Footnote 13/18, Caption 12/16. Reason: SF Pro is licensed for Apple platforms only, and Inter is the closest open match.
- Numbers use tabular figures, so values don't jump as they change.
- Big numbers carry the hierarchy; labels sit quietly beside or under them.

## Writing numbers

- Durations in words are "6 h 28 min" or "45 min", everywhere: sentences, subtitles and the big Sleep number. Tables and rows that line durations up use "4:54"; Sleep's stage totals keep Apple Health's own form.
- A range beside a label is "8.4–10.5"; in a sentence it is "8.4 to 10.5". Spans of time or dates are "23:01 – 06:20" and "Nov 3 – Nov 9". Never a hyphen.
- Stress, and anything measured against it (Today's state card, headache risk), uses Stress's Low, Medium and High in its blue, purple and orange.

## Colour

- Neutrals do most of the work: ground, card, ink and secondary ink.
- One semantic system: each health area keeps one colour everywhere it appears. Recovery green, sleep indigo, strain orange, heart pink, activity blue, body sand, stress lavender. This mirrors Apple Health, and it is the reason the palette has more than three hues.
- One action accent: blue, for links and buttons only.
- Readability first: all text passes WCAG AA (4.5:1). Text uses iOS's Increased Contrast system colours; rings and fills use the vivid ones.
- Light and dark mode follow the system, and both must work fully.

## Materials

- Liquid Glass is used on navigation chrome only: the tab bar, its round action button and the top bar's buttons. Cards, sheets and lists are solid. This matches Apple's iOS 26 design and overrides anti-slop R-10 (glass on more than two elements at once); the owner chose to keep it (2026-11-03).

## Icons

- Lucide line icons stand in for SF Symbols, which are licensed for Apple platforms only.
- Every icon names its subject: a moon for sleep, a heart for heart rate, a flame for strain. No generic sparkles, stars or magic wands.

## Motion

- Motion explains a change: rings draw on, numbers roll, sheets slide. Nothing loops or floats.
- Under 400 ms for most transitions. Reduce Motion shows the end state at once.

## Halo Age

- The orb is Halo Age's focal point: the age and its gap inside a glowing, particle-filled blob whose rim takes the gap's colour. Anti-slop flags glowing orbs (R-01, R-04, R-13); the owner chose to keep it (2026-11-03) because Halo is named for it and it gives Halo Age its own identity.
- It swirls in, moves for 5 seconds, then rests; press and hold spins it. Reduce Motion shows it still.
- The card stays solid like every other card: no glowing border, and nothing drawn behind the Pace of Aging scale.

## Identity motif

- The ring: Halo's mark, the score rings and the progress rings all share the same round-capped, colour-graded arc.
