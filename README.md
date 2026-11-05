# Jeremiah Escubido — Portfolio

Personal portfolio of Jeremiah Falcon Escubido (Doy), BSIT student at St. Mary's College of Bansalan.

**Live site:** https://itsmeeremiyaaaa.github.io/Website-Portfolio/

## What's inside

- **Intro**: a maroon loader that counts to 100% and wipes away (once per visit)
- **About Doy**: torn coral panel with a photo deck you can shuffle, and a name that bounces on hover
- **Work slides**: scrolling down slides the projects sideways, each with a playable phone demo:
  a StudyQuest quiz with timer and XP, a BansaRide route with passenger toggles, and a GABAY AR view
  where you pick a destination; plus the published research
- **By the numbers**: flip cards
- **Toolbox**: filter tools by shelf and hover one to see where I used it
- **Journey**: a drag-to-scroll slider of milestones
- **Camera roll**: swipe photos away like a deck, click to view
- **Contact**: pick a topic and the email subject fills itself, plus a GitHub QR card

## Live cursors

`assets/js/cursors.js` draws a swarm of tiny cursors that scatter from your mouse, plus three named
cursors (Designer, Developer, Recruiter) that drag a frame over each block as it scrolls in, tilt the
cards, restyle headings and chips, and retype the hero line. Their edits undo themselves.
They also leave comment pins, scribble underlines and circles, chat, and sometimes follow your cursor.
Visitors can press `/` to chat (a cursor replies), drag the stickers and chips, click empty space to call
the swarm, press `1`–`5` for reactions, press `P` (or Draw) to sketch on the page, click a letter of
JEREMIAH in the bar to call that cursor, click "11 editing" to gather everyone, and type `doy` or `hire`
for a surprise. **Edit mode** (bottom bar) lets visitors click any element to
recolor, resize, rotate or drag it.
Named cursors and edit mode run on desktop only; everything is off with reduced motion.

## Built with

Plain HTML, CSS and JavaScript, no framework.

```
index.html               page markup
assets/css/main.css      styles (tokens, maroon and cream sections)
assets/css/cursors.css   live cursors overlay
assets/js/main.js        intro, slides, demos, flip cards, toolbox, journey, photo roll, contact
assets/js/cursors.js     live cursors and edit mode
assets/img/              optimized WebP images and the GitHub QR code
assets/fonts/            self-hosted Caveat Brush and Geist (SIL OFL)
assets/Escubido_Jeremiah_Resume.pdf  downloadable CV
404.html                 custom not-found page
media/                   original source media (not loaded by the site)
```

## Run locally

```bash
npm start   # then open http://localhost:8080
```

## Deploy

After changing any CSS or JS file, run `npm run stamp` before committing. It adds a content fingerprint
(`?v=…`) to the asset links so visitors never get a stale cached file.

GitHub Pages builds from the `master` branch (root folder). Every change merged into `master` goes live automatically.
