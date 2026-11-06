# Jeremiah Escubido — Portfolio

Personal portfolio of Jeremiah Falcon Escubido (Doy), BSIT student at St. Mary's College of Bansalan.

**Live site:** https://itsmeeremiyaaaa.github.io/Website-Portfolio/

## What's inside

- **Intro**: a maroon loader that counts to 100% and wipes away (once per visit)
- **About Doy**: torn coral panel with a photo deck you can shuffle, and a name that bounces on hover
- **Work slides**: scrolling down slides the projects sideways, each with a playable phone demo:
  a StudyQuest quiz with timer and XP, a BansaRide route with passenger toggles, and the real GABAY
  app screens (splash to live AR sign) you can tap through; plus the published research
- **By the numbers**: flip cards
- **Toolbox**: filter tools by shelf and hover one to see where I used it
- **Journey**: a drag-to-scroll slider of milestones
- **Camera roll**: swipe photos away like a deck, click to view
- **Contact**: pick a topic and the email subject fills itself, plus a GitHub QR card

## Agent-built feel

`assets/js/cursors.js` runs eight "agents" as plain colored cursors, with no names or letters. When they finish a
job they fly back and dock in their own slot in the bottom bar (a faded slot means that agent is out working). They drag a frame over each block as it scrolls in, test the demos,
restyle and comment, and every action shows up in the **build log** in the bottom bar. Their edits undo
themselves. Visitors can press `/` to chat, `1`–`5` for reactions, `P` (or Draw) to sketch, click a
mini cursor in the bar to call that agent, click "8 agents building" to gather them, and type `doy` or `hire`.
If a visitor sits idle for 9 seconds, an agent slides the page down one screen (with a pause between
slides, and it stops the instant they move, scroll or press a key).
**Edit mode** lets visitors restyle or drag any element. Agents run on desktop only and are off with
reduced motion; **Hide cursors** turns them off.

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
