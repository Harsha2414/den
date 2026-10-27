---
title: Design
summary: How Den looks and sounds: the newspaper landing page, colours, fonts, layout, dark mode and the writing style.
---

# Design

*Last updated 26 October 2026.*

## The idea

Den should feel like **campus**, not like a generic tech app. Two pictures guide it:

- **Outside** (the landing page, sign-in and share card): a **printed newspaper crossed with an exam hall**. It has a masthead, columns and rules, pen scribbles in the margins, a mini exam paper, and an answer-sheet feel. It's Indian, a bit funny and easy to remember.
- **Inside** (the app itself): **calm and clean**. White or deep-blue-grey paper, one teal accent, and serif headings that carry the newspaper's voice. Nothing gets in the way of posts and chats.

The serif **Den.** logo with its saffron full stop ties the two together. It's the same on the landing page, in the app, on the share card and in Den Admin.

## Principles

1. **Phone first.** Most students will open Den on an Android phone over 4G. Every screen is designed at phone width first, and the aim is a first screen in under 2 seconds on 4G.
2. **Plain words.** "Sign in", "Join Den", "Get your blue tick", never jargon. Error messages say what happened and what to do next.
3. **Honest.** No fake numbers, testimonials or quotes. When a college has no one yet, Den says so (planned: "Be the first from your college").
4. **Indian by default.** All Indian colleges, Indian degrees, rupees, Indian languages on the landing page, and fonts that handle Devanagari.
5. **Calm inside, playful outside.** Jokes and handwriting stay on the landing page; the app stays quiet.
6. **Accessible.** Readable contrast in light and dark, visible keyboard focus (a saffron outline), proper labels on search boxes, and tap targets about 38 px or larger.

## The landing page (design H, "Full edition")

**How we chose it.** We drew eight directions (A–H) on a design canvas, including a classic newspaper, a campus map (E) and an exam hall (F). You chose **H**, which mixes the newspaper with the exam hall, and asked for more creative content. You then removed "Letters to the editor" and "From the editor" and rewrote the viva answers. The campus map is parked for later.

**What's on it, from top to bottom (on phones):**

| Part | What it does |
|---|---|
| Masthead | **Den.** logo, "The student hangout for every college in India", a pen scribble ("read this before exams!!") and Sign in |
| Pick your edition | Search any college in India. The choice is remembered and pre-filled at sign-up |
| Language strip | Headline in English, हिंदी, தமிழ், తెలుగు, ಕನ್ನಡ, বাংলা, मराठी |
| Night edition | Dark version of the paper |
| Front page | The headline story of what Den is |
| Mini exam | A short, funny question paper students can actually answer |
| Notice board, debates, and an "obituary" | Spaces, debates and the old WhatsApp-group way, told as news |
| Exam-o-scope and crossword | Side by side |
| Funnies and classifieds | Side by side; the classifieds show Market, notes and events |
| Viva FAQ | Questions and answers. The app is coming soon; sign in with a college email for the tick straight away, or with Google and then verify with an ID card or two classmates |
| Join bar | Fixed to the bottom of phone screens; goes to Sign up |

**Touches.**
- Pen marks draw themselves as you scroll.
- There's a chai-cup ring on the paper.
- Handwriting is kept to short lines, and longer answers are in print so they're easy to read.

**Share card.** When a Den link is shared on WhatsApp, Instagram or X, the preview is a small newspaper front page in the same style.

**Sign in and Sign up.** On a laptop, the page is split: a newspaper side on the left and the form on the right. On a phone, it shows the form only with the same logo.

## Colours

**In the app** (light / dark):

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--paper` | #FFFFFF | #0F171D | Page background |
| `--surface` | #FFFFFF | #17222A | Cards, sheets |
| `--ink` | #172033 | #E6EDF1 | Main text |
| `--muted` | #566274 | #9AA8B4 | Secondary text |
| `--line` | #D8DFE5 | #2A3843 | Borders |
| `--teal` | #0E5E6F | #62B9CA | Main accent: buttons, links |
| `--saffron` | #F4A340 | — | Logo dot, focus outline, highlights |
| `--leaf` | #2F8F5B | #5CC38A | Success, the verified tick |
| `--rose` | #C9485F | #EA8396 | Errors, unread badges |

**On the newspaper pages:**

| Token | Light | Used for |
|---|---|---|
| `--np-paper` | #F4EFE4 | Newsprint |
| `--np-ink` | #1B1A17 | Print |
| `--np-pen` | #1E3A9E | Blue-pen handwriting |
| `--np-red` | #B42D38 | Red-pen corrections |
| `--np-margin` | #E7949A | Exam-sheet margin line |
| `--np-rule` | #C6D5EA | Ruled lines |
| `--np-teal` | #0E5E6F | Links that match the app |

Den Admin uses the same colours, with a light grey background (#F6F8F9).

## Fonts

| Font | Role | Notes |
|---|---|---|
| **Fraunces** | Logo, headings, newspaper headlines | A variable serif with weights 400–900; the logo uses 900 |
| **Hind** | Everything else | Clear on small screens; covers Devanagari |
| **Kalam** | Handwriting | Only on the landing and sign-in pages, for short notes |

Bricolage Grotesque was used before 24 October and has been removed, so Den now uses one serif everywhere.

## Layout inside the app

- **Top bar**: menu, the **Den.** logo, the college switch pill, search, and your profile photo.
- **College switcher**: drops down from the top, with your college, All India, recently visited, and search across every college.
- **Side menu**: grouped into *Study & career*, *Create* and *Yours*. On laptops it sits on the left and can be hidden with the button at its top; the ☰ button brings it back, and Den remembers the choice on that device.
- **Bottom bar on phones**: Home, Spaces, Events, Messages.
- **Feed**: light, without boxes around every post. A round **+** button creates a post, grey placeholders show while loading, and motion is smooth.
- **Sheets**: forms slide up from the bottom on phones.
- **Toasts**: short messages at the bottom, for example "You already have a Den account, so we signed you in."

## Dark mode

Dark mode follows the phone's setting until the student picks one with the switch in the menu or on Profile. The choice is remembered and applied before the page appears, with a short colour fade. The landing page has its own **night edition**.

## Writing style

- Talk like a friendly senior: short sentences, "you", and no corporate tone.
- Buttons say what happens next: "Send my code", "Sign in instead", "Use what you typed".
- Errors are specific and kind: "No college found for “cvr engg”. Try a shorter name or the city."
- Empty screens invite action: "No posts here yet. Ask a doubt or share campus news to start the conversation."

## Still to design

- Club and fest section, and "Be the first from your college" (Day 1 leftover).
- Guided "Get your blue tick" step in sign-up (Day 2).
- Polish for the home feed and menu, posting and profiles, messages, events, Spaces and debates, notes, placements, Market and Articles, notifications, and empty and error screens (Days 3–8).
- Real campus photos for the front page, and checked translations (your items).
