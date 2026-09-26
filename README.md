# Jeremiah Escubido — Portfolio

Personal portfolio of Jeremiah Falcon Escubido, BSIT student at St. Mary's College of Bansalan.

**Live site:** https://itsmeeremiyaaaa.github.io/Website-Portfolio/

## What's inside

- **Selected work**: GradeHub, RecipesPOS, and GABAY (applications); published research (AJESS, 2025); an isometric game prototype built in Godot, this site, and a video edit
- **About, stack, journey**: education, recognition, and the tools I use
- **Contact**: email, LinkedIn, GitHub, ORCID, and a downloadable CV

## Built with

Plain HTML, CSS, and JavaScript. No framework or build step.

```
index.html          page markup
assets/css/main.css styles (design tokens, light/dark themes)
assets/js/main.js   nav, theme toggle, reveals, 3D tilt, video previews, photo viewer
assets/js/iso-scene.js  interactive isometric island in the hero (Canvas 2D)
assets/img/         optimized WebP images
assets/video/       compressed project videos
assets/fonts/       self-hosted Geist fonts (Latin subset, SIL OFL)
assets/Escubido_Jeremiah_Resume.pdf  downloadable CV
404.html            custom not-found page
media/              original source media (not loaded by the site)
```

## Run locally

```bash
npm start
```

Then open http://localhost:8080.

## Deploy

After changing any CSS or JS file, run `npm run stamp` before committing. It adds a content fingerprint (`?v=…`) to the asset links so visitors never get a stale cached stylesheet with new HTML.


GitHub Pages builds from the `master` branch (root folder). Every change merged into `master` goes live automatically.
