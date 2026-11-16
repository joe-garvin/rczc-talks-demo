# Red Cedar Zen dharma talk archive: demo

An unlisted demo of a possible dharma talk archive for Red Cedar Zen Community, shared for feedback. It's built from a private archive and isn't an official Red Cedar site.

**Published demo:** https://joe-garvin.github.io/rczc-talks-demo/

The home page searches 805 talks by title, teacher, summary and theme. One talk, "Addicted to Clinging" (Nomon Tim Burnett, October 18, 2026), opens in full with audio synced to its transcript. Audio [...]

## Full archive for redcedarzen.org

`archive/` is the full archive, built to sit inside a Wild Apricot page. Visitors stay on redcedarzen.org; the page loads its talk data from here.

- `archive/archive.js` and `archive/archive.css` are the page itself. Every style is scoped to `#rczc-archive`, so the site theme and the archive leave each other alone.
- `archive/data/index.json` lists every talk, and `archive/data/talks/` holds one file per talk, loaded when someone opens it.
- `archive/preview.html` is a stand-in Red Cedar page for testing.

Talks with a reader-friendly transcript are shown in full, with audio synced sentence by sentence. Talks without one show their summary and recording only.

### Wild Apricot snippet

Add a Custom HTML block to the page and paste:

```html
<div id="rczc-archive"></div>
<script src="https://joe-garvin.github.io/rczc-talks-demo/archive/archive.js"></script>
```

Add `data-corrections="address@example.org"` to the div to show a "Report a correction" link that opens an email.

### Rebuild after the archive changes

```
python3 tools/build_archive.py ../rczc-dharma-archive
```

The build reads the private archive checkout and rewrites `archive/data/`. Commit and push to update the site.
