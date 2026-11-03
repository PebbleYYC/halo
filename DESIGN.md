# Halo design direction

Halo should look and feel like an Apple app: clean, modern, easy to read, and calm. Every screen should be readable at a glance, and no element ever sits on top of another.

Reading this as: a personal health app for one person checking in a few times a day, in Apple's iOS 26 visual language, dial ENERGY 1 / RHYTHM 2 / MOTION 2.

## Personality

- Calm and trustworthy. The numbers are the content; the interface stays out of their way.
- Plain-spoken. Short sentences, sentence case, no hype, no emoji, no em dashes.
- Quietly alive: a ring drawing on or a number rolling into place, never decoration for its own sake.

## Layout

- Apple's grouped style: a grey ground, white cards (black and near-black in dark mode), inset lists with hairline separators.
- 16 px side margins, 12 px between cards, 20 px card corners. Lists and controls use iOS's own radii, so not everything is a pill.
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

## Colour

- Neutrals do most of the work: ground, card, ink and secondary ink.
- One semantic system: each health area keeps one colour everywhere it appears. Recovery green, sleep indigo, strain orange, heart pink, activity blue, body sand, stress lavender. This mirrors Apple Health, and it is the reason the palette has more than three hues.
- One action accent: blue, for links and buttons only.
- Readability first: all text passes WCAG AA (4.5:1). Text uses iOS's Increased Contrast system colours; rings and fills use the vivid ones.
- Light and dark mode follow the system, and both must work fully.

## Materials

- Liquid Glass is used on navigation chrome only: the tab bar, its round action button and the top bar's buttons. Cards, sheets and lists are solid. This matches Apple's iOS 26 design and overrides anti-slop R-10 (glass on more than two elements at once); pending the owner's keep-or-drop answer.

## Icons

- Lucide line icons stand in for SF Symbols, which are licensed for Apple platforms only.
- Every icon names its subject: a moon for sleep, a heart for heart rate, a flame for strain. No generic sparkles, stars or magic wands.

## Motion

- Motion explains a change: rings draw on, numbers roll, sheets slide. Nothing loops or floats.
- Under 400 ms for most transitions. Reduce Motion shows the end state at once.

## Identity motif

- The ring: Halo's mark, the score rings and the progress rings all share the same round-capped, colour-graded arc.
