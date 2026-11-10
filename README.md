# Red Cedar Zen dharma talk archive: demo

An unlisted demo of a possible dharma talk archive for Red Cedar Zen Community, shared for feedback. It's built from a private archive and isn't an official Red Cedar site.

**Published demo:** https://joe-garvin.github.io/rczc-talks-demo/

The home page searches 805 talks by title, teacher, summary and theme. One talk, "Addicted to Clinging" (Nomon Tim Burnett, October 18, 2026), opens in full with audio synced to its transcript. Audio [...]

## Embedding on redcedarzen.org

`embed/archive.js` runs the same archive inside another site's page, such as a Wild Apricot page with a Custom HTML gadget:

```html
<div id="rczc-talk-archive"></div>
<script src="https://joe-garvin.github.io/rczc-talks-demo/embed/archive.js" defer></script>
```

It mounts in a shadow root, so the host theme's CSS and the archive's CSS stay apart, and it loads everything (styles, `talks.js`, talk files) as scripts from this site. On Wild Apricot, `joe-garvin.github.io` has to be on Website > Settings > JavaScript whitelist.

Each talk gets a hash link, like `dharma-talk-archive#addicted-to-clinging`, and `#addicted-to-clinging?t=416` cues a moment. Talks listed in `embed/talks/manifest.js` open in full from `embed/talks/<file>.js` (same format as `talk-data.js`); every other talk opens a summary page.
