/* Red Cedar Zen dharma talk archive, embeddable version.

   Paste this into a Wild Apricot Custom HTML gadget (or any page):

     <div id="rczc-talk-archive"></div>
     <script src="https://joe-garvin.github.io/rczc-talks-demo/embed/archive.js" defer></script>

   The archive mounts inside a shadow root, so the host site's theme CSS can't
   reach in and the archive's CSS can't leak out. Everything (styles included)
   loads as scripts from the same host as this file, so a Content Security
   Policy only needs that host on its script allowlist.

   Routes live in the URL hash:
     page#                       the search and browse view
     page#addicted-to-clinging   one talk
     page#addicted-to-clinging?t=416   one talk, cued to 6:56

   Optional attributes on the div:
     data-base     where talks.js and embed/ live (defaults to this script's site)
     data-heading  "none" to leave out the "Dharma Talk Archive" heading
*/
(() => {
  "use strict";
  const SCRIPT = document.currentScript;
  const SCRIPT_URL = SCRIPT && SCRIPT.src ? SCRIPT.src : location.href;

  function start() {
    let host = document.getElementById("rczc-talk-archive");
    if (!host) { host = document.createElement("div"); host.id = "rczc-talk-archive"; SCRIPT && SCRIPT.parentNode ? SCRIPT.parentNode.insertBefore(host, SCRIPT) : document.body.appendChild(host); }
    if (host.dataset.mounted) return;
    host.dataset.mounted = "1";
    const BASE = new URL(host.dataset.base || "../", host.dataset.base ? location.href : SCRIPT_URL).href;
    const TALK_DIR = new URL("embed/talks/", BASE).href;
    mount(host, BASE, TALK_DIR);
  }

  // ---------- helpers ----------
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const md = s => esc(s).replace(/\*(.+?)\*/g, "<em>$1</em>");
  const fmt = s => { s = Math.max(0, Math.floor(s || 0)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = String(s % 60).padStart(2, "0"); return h ? `${h}:${String(m).padStart(2, "0")}:${x}` : `${m}:${x}`; };
  const parts = d => (d || "").split("-").map(Number);
  const fmtDate = d => { const [y, m, day] = parts(d); return y ? new Date(y, (m || 1) - 1, day || 1).toLocaleDateString("en-US", { month: m ? "short" : undefined, day: day ? "numeric" : undefined, year: "numeric" }) : ""; };
  const dateLong = d => { const [y, m, day] = parts(d); return y ? new Date(y, (m || 1) - 1, day || 1).toLocaleDateString("en-US", { weekday: day ? "long" : undefined, month: m ? "long" : undefined, day: day ? "numeric" : undefined, year: "numeric" }) : ""; };
  const slugify = s => String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src; s.async = true;
      s.onload = () => { s.remove(); resolve(); };
      s.onerror = () => { s.remove(); reject(new Error("Couldn't load " + src)); };
      (document.head || document.documentElement).appendChild(s);
    });
  }

  // Give every talk a readable slug. A slug the pipeline writes (t.slug) wins.
  // Otherwise the title is used, and when two talks share a title the older one
  // keeps the plain slug and the later ones get their date added.
  function assignSlugs(T) {
    const used = new Set(), bySlug = new Map();
    T.filter(t => t.slug).forEach(t => used.add(t.slug));
    [...T].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)).forEach(t => {
      if (!t.slug) {
        let s = slugify(t.title) || "talk";
        if (used.has(s)) s = `${s}-${t.date}`;
        let n = 2; const base = s;
        while (used.has(s)) s = `${base}-${n++}`;
        used.add(s); t.slug = s;
      }
      bySlug.set(t.slug, t);
    });
    return bySlug;
  }

  // ---------- app ----------
  function mount(host, BASE, TALK_DIR) {
    const root = host.attachShadow({ mode: "open" });
    try {
      const sheet = new CSSStyleSheet(); sheet.replaceSync(CSS); root.adoptedStyleSheets = [sheet];
    } catch (e) {
      const st = document.createElement("style"); st.textContent = CSS; root.appendChild(st);
    }
    const shell = document.createElement("div");
    shell.className = "frame";
    shell.innerHTML = `<div class="app" id="app"><p class="loading">Loading the dharma talk archive…</p></div>`;
    root.appendChild(shell);
    const toastEl = document.createElement("div");
    toastEl.className = "toast"; toastEl.setAttribute("role", "status");
    root.appendChild(toastEl);
    const toast = msg => { toastEl.textContent = msg; toastEl.classList.add("on"); clearTimeout(toastEl._t); toastEl._t = setTimeout(() => toastEl.classList.remove("on"), 2600); };
    const app = root.getElementById("app");

    Promise.all([
      window.TALKS ? Promise.resolve() : loadScript(new URL("talks.js", BASE).href),
      window.RCZC_TALK_FILES ? Promise.resolve() : loadScript(TALK_DIR + "manifest.js").catch(() => {})
    ]).then(() => {
      if (!Array.isArray(window.TALKS) || !window.TALKS.length) throw new Error("No talks");
      run(window.TALKS, window.RCZC_TALK_FILES || {});
    }).catch(() => {
      app.innerHTML = `<p class="loading">The talk archive couldn't load just now. Please try again in a moment.</p>`;
    });

    function run(T, FILES) {
      const bySlug = assignSlugs(T);
      const full = t => Object.prototype.hasOwnProperty.call(FILES, t.id);
      const demoTalk = T.find(full);
      const count = key => { const m = new Map(); T.forEach(t => [].concat(t[key]).filter(Boolean).forEach(v => m.set(v, (m.get(v) || 0) + 1))); return [...m].sort((a, b) => b[1] - a[1]); };
      const speakers = count("speaker"), themes = count("themes"), texts = count("texts"), series = count("series");
      const years = T.map(t => +String(t.date).slice(0, 4)).filter(Boolean);
      const heading = host.dataset.heading === "none" ? "" : `<h1>Dharma Talk Archive</h1>`;
      const demoNote = demoTalk && Object.keys(FILES).length < 20
        ? `<div class="demo-note">Demo · search works across all ${T.length} talks · ${Object.keys(FILES).length === 1 ? `one talk, <a href="#${esc(demoTalk.slug)}">${esc(demoTalk.title)}</a>, opens in full` : `${Object.keys(FILES).length} talks open in full`}</div>` : "";

      app.innerHTML = `
        ${demoNote}
        <section class="view" id="home" aria-label="Dharma talk archive">
          <div class="hero">
            ${heading}
            <p class="intro">Every talk given at Red Cedar since ${Math.min(...years)}, with a summary and a full transcript.<br>Search for a word or phrase, or browse by teacher, series and theme.</p>
            <div class="search" role="search">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
              <label for="q" class="sr">Search talks</label>
              <input id="q" type="search" autocomplete="off" placeholder="Search titles, teachers and summaries">
            </div>
            <div class="filters">
              <select id="f-speaker" aria-label="Teacher"><option value="">Any teacher</option>${speakers.map(([s]) => `<option>${esc(s)}</option>`).join("")}</select>
              <select id="f-theme" aria-label="Theme"><option value="">Any theme</option>${themes.map(([s]) => `<option>${esc(s)}</option>`).join("")}</select>
              <select id="f-era" aria-label="Years"><option value="">Any year</option><option value="2001-2009">2001–2009</option><option value="2010-2014">2010–2014</option><option value="2015-2019">2015–2019</option><option value="2020-2029">2020 on</option></select>
            </div>
            <div class="stats"><span>${T.length} talks</span>·<span>${speakers.length} teachers</span>·<span>${series.length} series</span>·<span>${Math.min(...years)} to ${Math.max(...years)}</span></div>
          </div>
          <section class="results" id="results" hidden aria-live="polite"><div class="count" id="count"></div><div id="result-list"></div></section>
          <div id="browse">
            <section class="grid">
              <div class="box sky"><h2>Latest Talks</h2><div class="body" id="latest"></div></div>
              <div class="box ochre"><h2>From the Archive</h2><div class="body feature" id="feature"></div></div>
            </section>
            <section class="three">
              <div class="box olive"><h2>Series</h2><div class="body"><ol class="num" id="series-list"></ol></div></div>
              <div class="box sky"><h2>Themes</h2><div class="body"><ul class="themes" id="theme-list"></ul><button class="more" id="theme-more" aria-expanded="false"></button></div></div>
              <div class="box ochre"><h2>Texts</h2><div class="body"><ol class="num" id="text-list"></ol></div></div>
            </section>
          </div>
        </section>
        <section class="view" id="talk" hidden></section>
        <footer class="foot">Transcripts were made with speech recognition and lightly edited with AI help.</footer>`;

      const $ = id => root.getElementById(id);
      const home = $("home"), talkView = $("talk");

      // ----- home -----
      const hlRe = q => { const w = q.split(/\s+/).filter(Boolean).map(x => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")); return w.length ? new RegExp(`(${w.join("|")})`, "gi") : null; };
      function row(t, q) {
        const re = q && hlRe(q), hl = s => re ? esc(s).replace(re, "<mark>$1</mark>") : esc(s);
        return `<a class="row${full(t) ? " full" : ""}" href="#${esc(t.slug)}">
          <h3>${hl(t.title)}</h3>
          <p class="date">${hl(t.speaker)} · ${fmtDate(t.date)}${t.minutes ? " · " + t.minutes + " min" : ""}${t.series ? " · " + esc(t.series) : ""}</p>
          ${q ? `<p class="sum">${hl(t.summary)}</p>` : ""}</a>`;
      }
      $("latest").innerHTML = T.slice(0, 5).map(t => row(t)).join("");
      const old = T.filter(t => t.date < "2015" && t.summary && t.minutes);
      if (old.length) {
        const f = old[Math.floor(Date.now() / 6048e5) % old.length];
        $("feature").innerHTML = `<a class="feat" href="#${esc(f.slug)}"><div class="eyebrow">${fmtDate(f.date)}</div><h3>${esc(f.title)}</h3><div class="who">${esc(f.speaker)}${f.minutes ? " · " + f.minutes + " min" : ""}</div><p>${esc(f.summary.split(/(?<=\.)\s/).slice(0, 2).join(" "))}</p></a>`;
      }
      $("series-list").innerHTML = series.slice(0, 6).map(([s, n]) => `<li><button data-q="${esc(s)}"><span>${esc(s)}</span><small>${n}</small></button></li>`).join("");
      $("text-list").innerHTML = texts.slice(0, 6).map(([s, n]) => `<li><button data-q="${esc(s)}"><span>${esc(s.replace(/^Shobogenzo$/, "Shōbōgenzō"))}</span><small>${n}</small></button></li>`).join("");
      let allThemes = false;
      const drawThemes = () => {
        $("theme-list").innerHTML = (allThemes ? themes : themes.slice(0, 6)).map(([s, n]) => `<li><button data-theme="${esc(s)}"><span class="name">${esc(s)}</span><span class="n">${n}</span></button></li>`).join("");
        $("theme-more").textContent = allThemes ? "Fewer themes" : `All ${themes.length} themes`;
        $("theme-more").setAttribute("aria-expanded", allThemes);
      };
      drawThemes();
      $("theme-more").onclick = () => { allThemes = !allThemes; drawThemes(); };

      function search() {
        const q = $("q").value.trim().toLowerCase(), sp = $("f-speaker").value, th = $("f-theme").value, era = $("f-era").value;
        const active = q || sp || th || era;
        $("results").hidden = !active; $("browse").hidden = !!active;
        if (!active) return;
        const words = q.split(/\s+/).filter(Boolean);
        let hits = T.filter(t => {
          if (sp && t.speaker !== sp) return false;
          if (th && !(t.themes || []).includes(th)) return false;
          if (era) { const [a, b] = era.split("-"), y = String(t.date).slice(0, 4); if (y < a || y > b) return false; }
          const hay = [t.title, t.speaker, t.series, t.summary, (t.themes || []).join(" "), (t.texts || []).join(" ")].join(" ").toLowerCase();
          return words.every(w => hay.includes(w));
        });
        if (words.length) hits = hits.map(t => [t, words.reduce((s, w) => s + (t.title.toLowerCase().includes(w) ? 5 : 0) + (t.speaker.toLowerCase().includes(w) ? 3 : 0) + 1, 0)]).sort((a, b) => b[1] - a[1] || (a[0].date < b[0].date ? 1 : -1)).map(x => x[0]);
        $("count").textContent = `${hits.length} talk${hits.length === 1 ? "" : "s"}`;
        $("result-list").innerHTML = hits.slice(0, 40).map(t => row(t, q)).join("") || `<p class="count">Nothing matched. Try fewer words.</p>`;
      }
      let timer;
      $("q").addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(search, 120); });
      ["f-speaker", "f-theme", "f-era"].forEach(id => $(id).addEventListener("change", search));
      const setFilter = ({ q = "", theme = "" }) => { $("q").value = q; $("f-theme").value = theme; $("f-speaker").value = ""; $("f-era").value = ""; search(); };
      home.addEventListener("click", e => {
        const b = e.target.closest("button[data-theme],button[data-q]"); if (!b) return;
        setFilter(b.dataset.theme ? { theme: b.dataset.theme } : { q: b.dataset.q }); scrollToTop();
      });

      // ----- routing -----
      let current = null, homeScroll = 0;
      function scrollToTop() {
        const top = host.getBoundingClientRect().top;
        if (top < 0) window.scrollTo({ top: Math.max(0, top + window.scrollY - 16) });
      }
      function parseHash() {
        let h = location.hash.slice(1);
        try { h = decodeURIComponent(h); } catch (e) {}
        const [slug, qs = ""] = h.split("?");
        const t = /(?:^|&)t=(\d+)/.exec(qs);
        return { slug, t: t ? +t[1] : null };
      }
      function goHome(filter) {
        if (location.hash) { try { history.pushState(null, "", location.pathname + location.search); } catch (e) { location.hash = ""; } }
        route();
        if (filter) { setFilter(filter); scrollToTop(); }
      }
      app.addEventListener("click", e => {
        const a = e.target.closest("a[href='#']");
        if (a) { e.preventDefault(); goHome(); }
      });
      function route() {
        const { slug, t } = parseHash();
        const meta = slug && bySlug.get(slug);
        if (!meta) { // home (also any hash that isn't a talk, so the host's own anchors still work)
          if (current) { current.destroy(); current = null; }
          if (home.hidden) { home.hidden = false; talkView.hidden = true; talkView.innerHTML = ""; requestAnimationFrame(() => window.scrollTo({ top: homeScroll })); }
          return;
        }
        if (current && current.slug === slug) { if (t != null) current.seek(t, true); return; }
        if (!home.hidden) homeScroll = window.scrollY;
        if (current) current.destroy();
        home.hidden = true; talkView.hidden = false;
        talkView.innerHTML = `<p class="loading">Loading “${esc(meta.title)}”…</p>`;
        scrollToTop();
        const mine = current = { slug, destroy() {}, seek() {} };
        const file = FILES[meta.id];
        (file ? loadTalk(file) : Promise.resolve(null)).then(D => {
          if (current !== mine) return;
          current = D ? mountFull(meta, D, t) : mountSummary(meta, !!file);
          current.slug = slug;
        });
      }
      window.addEventListener("hashchange", route);
      window.addEventListener("popstate", route);

      // Talk files share talk-data.js's format (window.TALK = {...}), so load them one at a time.
      const cache = new Map(); let queue = Promise.resolve();
      function loadTalk(file) {
        if (!cache.has(file)) {
          const p = queue.then(() => { window.TALK = undefined; return loadScript(TALK_DIR + file).then(() => { const d = window.TALK; window.TALK = undefined; return d || null; }, () => null); });
          queue = p; cache.set(file, p);
        }
        return cache.get(file);
      }

      // ----- talk page pieces shared by full and summary pages -----
      const chips = (list, attr) => list.filter(Boolean).map(x => `<button class="chip" data-${attr}="${esc(x)}">${esc(x)}</button>`).join("");
      function related(meta, th, tx) {
        return T.filter(t => t !== meta && t.summary).map(t => [t, (t.themes || []).filter(x => th.includes(x)).length + (t.texts || []).filter(x => tx.includes(x)).length])
          .filter(x => x[1] >= 3).sort((a, b) => b[1] - a[1] || (a[0].date < b[0].date ? 1 : -1)).slice(0, 4)
          .map(([t]) => `<li><a href="#${esc(t.slug)}">${esc(t.title)}</a><small>${esc(t.speaker)} · ${String(t.date).slice(0, 4)}</small></li>`).join("");
      }
      const crumbs = meta => `<div class="crumbs"><a href="#">Dharma talk archive</a> › ${esc(meta.title)}</div>`;
      function wireChips(el) {
        el.addEventListener("click", e => {
          const c = e.target.closest(".chip"); if (!c) return;
          goHome(c.dataset.theme ? { theme: c.dataset.theme } : { q: c.dataset.q });
        });
      }

      function mountSummary(meta, failed) {
        const th = meta.themes || [], tx = meta.texts || [];
        talkView.innerHTML = `${crumbs(meta)}
          <div class="talk-head"><div class="eyebrow">${esc(meta.speaker)}</div><h2 class="title">${esc(meta.title)}</h2>
          <div class="meta">${dateLong(meta.date)}${meta.series ? " · " + esc(meta.series) : ""}${meta.minutes ? " · " + meta.minutes + " minutes" : ""}</div></div>
          <div class="cols"><article>
            ${meta.summary ? `<div class="lede static"><div class="lede-h">Summary</div><p>${esc(meta.summary)}</p></div>` : ""}
            <p class="pending">${failed ? "The recording and transcript for this talk couldn’t load just now. Please try again in a moment." : "The recording and full transcript for this talk aren’t in the online archive yet."}</p>
          </article><aside>
            ${th.length ? `<div class="box sky"><h2>Themes</h2><div class="body">${chips(th, "theme")}</div></div>` : ""}
            ${tx.length ? `<div class="box ochre"><h2>Texts</h2><div class="body">${chips(tx, "q")}</div></div>` : ""}
            ${(() => { const r = related(meta, th, tx); return r ? `<div class="box sky"><h2>Related Talks</h2><div class="body"><ul>${r}</ul></div></div>` : ""; })()}
          </aside></div>`;
        wireChips(talkView);
        return { destroy() {}, seek() {} };
      }

      // ----- full talk: player and synced transcript (ported from talk.html) -----
      function mountFull(meta, D, startAt) {
        const ac = new AbortController(), sig = { signal: ac.signal };
        const mins = Math.round(D.duration / 60);
        talkView.innerHTML = `${crumbs(meta)}
          <div class="talk-head"><div class="eyebrow">${esc(D.speaker)}</div><h2 class="title">${esc(D.title)}</h2>
          <div class="meta">on ${dateLong(D.date)}${meta.series ? " · " + esc(meta.series) : ""} · ${mins} minutes</div></div>
          <div class="hint">Click any sentence to hear it · space to play or pause, arrow keys to skip 15 seconds</div>
          <div class="player" role="group" aria-label="Audio player">
            <button class="pb" id="play" aria-label="Play"><svg id="icon" width="16" height="16" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.5 10.5 6 3 10.5z" fill="#fff"/></svg></button>
            <button class="skip" id="back" aria-label="Back 15 seconds">−15</button>
            <span class="time" id="cur">0:00</span>
            <div class="scrub" id="scrub" role="slider" tabindex="0" aria-label="Seek" aria-valuemin="0" aria-valuenow="0"><div class="track"><div class="buf" id="buf"></div><div class="fill" id="fill"></div><div class="knob" id="knob"></div></div></div>
            <span class="time" id="dur">${fmt(D.duration)}</span>
            <button class="skip" id="fwd" aria-label="Forward 15 seconds">+15</button>
            <button class="speed" id="speed" aria-label="Playback speed">1×</button>
            <button class="skip" id="share" aria-label="Copy a link to this moment">Share</button>
          </div>
          <audio id="audio" preload="metadata"></audio>
          <div class="cols">
            <article>
              <details class="lede" id="lede" open><summary>Summary</summary><p>${esc(D.summary)}</p></details>
              <div class="toolbar">
                <div class="seg" role="group" aria-label="Reading mode">
                  <button data-mode="read" aria-pressed="true">Reader-friendly</button><button data-mode="follow" aria-pressed="false">Follow along</button><button data-mode="verb" aria-pressed="false">Verbatim</button>
                </div>
                <div class="tools" role="group" aria-label="Text size"><span class="tlabel">Text size</span><button id="smaller" aria-label="Smaller text">−</button><button id="bigger" aria-label="Larger text">+</button></div>
              </div>
              <div class="text" id="transcript" aria-label="Transcript" tabindex="0"></div>
            </article>
            <aside>
              <div class="teacher"><b>${esc(D.speaker)}</b><span>${T.filter(t => t.speaker === D.speaker).length} talks in the archive</span></div>
              <div class="box sky"><h2>Themes</h2><div class="body">${chips(D.themes || [], "theme")}</div></div>
              <div class="box ochre"><h2>Texts and Figures</h2><div class="body">${chips((D.texts || []).concat(D.figures || []), "q")}</div></div>
              <div class="box olive"><h2>Key Topics</h2><div class="body"><ul>${(D.topics || []).map(t => `<li>${esc(t)}</li>`).join("")}</ul></div></div>
              <div class="box sky"><h2>Related Talks</h2><div class="body"><ul>${related(meta, D.themes || [], D.texts || [])}</ul></div></div>
              <a class="fix" id="fix" href="#fix">Report a correction</a>
            </aside>
          </div>`;
        wireChips(talkView);
        const audio = $("audio"), frame = $("transcript");
        $("fix").addEventListener("click", e => { e.preventDefault(); toast("Corrections would go to the archive stewards. Not wired up in this demo."); });

        let mode = "read", sentEls = [], paraEls = [], times = [], lastIdx = -1;
        function render() {
          frame.classList.toggle("verb", mode === "verb");
          if (mode === "verb") {
            frame.innerHTML = D.verbatim.map((b, i) => `<p data-i="${i}"><button class="t" data-t="${b.t}">${fmt(b.t)}</button><span class="s" data-t="${b.t}">${esc(b.text)}</span></p>`).join("");
            times = D.verbatim.map(b => b.t);
          } else {
            let html = "", p = -1;
            D.sentences.forEach((s, i) => {
              if (s.p !== p) { if (p >= 0) html += "</p>"; p = s.p; html += `<p data-p="${p}"><button class="t" data-t="${s.t}">${fmt(s.t)}</button>`; }
              html += `<span class="s" data-i="${i}" data-t="${s.t}">${md(s.text)}</span> `;
            });
            frame.innerHTML = html + "</p>";
            times = D.sentences.map(s => s.t);
          }
          sentEls = [...frame.querySelectorAll(".s")]; paraEls = [...frame.querySelectorAll("p")];
          lastIdx = -1; sync(true);
        }
        // The transcript scrolls inside its own frame, so the summary and sidebar stay put
        let userScrolled = 0, autoScrolling = false, centerT;
        function center(p, smooth) {
          autoScrolling = true;
          frame.scrollTo({ top: p.offsetTop - frame.clientHeight / 2 + Math.min(p.offsetHeight, frame.clientHeight * 0.6) / 2, behavior: smooth ? "smooth" : "auto" });
          clearTimeout(centerT); centerT = setTimeout(() => autoScrolling = false, 700);
        }
        const inView = p => p.offsetTop >= frame.scrollTop && p.offsetTop + 40 <= frame.scrollTop + frame.clientHeight;
        ["wheel", "touchmove", "keydown"].forEach(ev => frame.addEventListener(ev, () => { if (!autoScrolling) userScrolled = Date.now(); }, { passive: true }));
        function indexAt(t) { let lo = 0, hi = times.length - 1, ans = 0; while (lo <= hi) { const m = (lo + hi) >> 1; if (times[m] <= t + 1) { ans = m; lo = m + 1; } else hi = m - 1; } return ans; }
        function sync(force) {
          const t = audio.currentTime || 0, i = indexAt(t);
          if (i === lastIdx && !force) return;
          sentEls.forEach(e => e.classList.remove("cur"));
          paraEls.forEach(e => e.classList.remove("now", "past"));
          const s = sentEls[i]; if (!s) return;
          if (mode !== "verb") s.classList.add("cur");
          const p = s.closest("p"); p.classList.add("now");
          paraEls.slice(0, paraEls.indexOf(p)).forEach(e => e.classList.add("past"));
          if (!audio.paused && i !== lastIdx) {
            if (mode === "follow") center(p, true);
            else if (Date.now() - userScrolled > 6000 && !inView(p)) center(p, true);
          }
          lastIdx = i;
        }

        // Player
        audio.innerHTML = `<source src="${esc(D.audio)}" type="video/mp4">`; audio.load();
        const setIcon = () => { const playing = !audio.paused; $("icon").innerHTML = playing ? '<rect x="2.6" y="1.5" width="2.4" height="9" fill="#fff"/><rect x="7" y="1.5" width="2.4" height="9" fill="#fff"/>' : '<path d="M3 1.5 10.5 6 3 10.5z" fill="#fff"/>'; $("play").setAttribute("aria-label", playing ? "Pause" : "Play"); };
        const toggle = () => audio.paused ? audio.play().catch(() => toast("The recording couldn’t start. Check your connection.")) : audio.pause();
        const seek = t => { audio.currentTime = Math.max(0, Math.min(t, audio.duration || D.duration)); sync(true); };
        $("play").onclick = toggle;
        $("back").onclick = () => seek(audio.currentTime - 15);
        $("fwd").onclick = () => seek(audio.currentTime + 15);
        const speeds = [1, 1.25, 1.5, 0.75]; let sp = 0;
        $("speed").onclick = () => { sp = (sp + 1) % speeds.length; audio.playbackRate = speeds[sp]; $("speed").textContent = speeds[sp] + "×"; };
        $("share").onclick = () => {
          const url = location.href.split("#")[0] + "#" + meta.slug + "?t=" + Math.floor(audio.currentTime);
          (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => toast(`Link to ${fmt(audio.currentTime)} copied`), () => toast(url));
        };
        audio.addEventListener("play", setIcon); audio.addEventListener("pause", setIcon);
        audio.addEventListener("loadedmetadata", () => { $("dur").textContent = fmt(audio.duration); });
        audio.addEventListener("timeupdate", () => {
          const d = audio.duration || D.duration, pct = (audio.currentTime / d) * 100;
          $("fill").style.width = pct + "%"; $("knob").style.left = pct + "%"; $("cur").textContent = fmt(audio.currentTime);
          $("scrub").setAttribute("aria-valuenow", Math.floor(audio.currentTime)); sync();
        });
        audio.addEventListener("progress", () => { try { const d = audio.duration; if (audio.buffered.length && d) $("buf").style.width = (audio.buffered.end(audio.buffered.length - 1) / d * 100) + "%"; } catch (e) {} });
        const scrub = $("scrub");
        const scrubAt = e => { const r = scrub.getBoundingClientRect(); seek(((e.clientX - r.left) / r.width) * (audio.duration || D.duration)); };
        let dragging = false;
        scrub.addEventListener("pointerdown", e => { dragging = true; scrub.setPointerCapture(e.pointerId); scrubAt(e); });
        scrub.addEventListener("pointermove", e => dragging && scrubAt(e));
        scrub.addEventListener("pointerup", () => dragging = false);
        scrub.addEventListener("keydown", e => { if (e.key === "ArrowLeft") seek(audio.currentTime - 5); if (e.key === "ArrowRight") seek(audio.currentTime + 5); });

        frame.addEventListener("click", e => { const el = e.target.closest("[data-t]"); if (!el) return; seek(+el.dataset.t); if (audio.paused) toggle(); });

        talkView.querySelectorAll(".seg button").forEach(b => b.onclick = () => {
          const keep = audio.currentTime; mode = b.dataset.mode;
          talkView.querySelectorAll(".seg button").forEach(x => x.setAttribute("aria-pressed", x === b));
          app.classList.toggle("follow", mode === "follow");
          render(); audio.currentTime = keep;
          const now = frame.querySelector("p.now"); if (now && keep > 1) center(now, false);
        });
        let size = 17; const setSize = n => { size = Math.max(15, Math.min(25, n)); app.style.setProperty("--read-size", size + "px"); };
        $("smaller").onclick = () => setSize(size - 2); $("bigger").onclick = () => setSize(size + 2);

        // Keyboard: only when focus is in the archive or nowhere in particular
        document.addEventListener("keydown", e => {
          const el = (e.composedPath && e.composedPath()[0]) || e.target;
          if (!(el === document.body || el === document.documentElement || root.contains(el))) return;
          if (el.matches && el.matches("input,textarea,select,[contenteditable]")) return;
          if (e.code === "Space" && !(el.matches && el.matches("button,a,summary"))) { e.preventDefault(); toggle(); }
          if (e.key === "ArrowLeft" && el.id !== "scrub") { e.preventDefault(); seek(audio.currentTime - 15); }
          if (e.key === "ArrowRight" && el.id !== "scrub") { e.preventDefault(); seek(audio.currentTime + 15); }
        }, sig);

        if ("mediaSession" in navigator) {
          try {
            navigator.mediaSession.metadata = new MediaMetadata({ title: D.title, artist: D.speaker, album: "Red Cedar Zen dharma talks" });
            navigator.mediaSession.setActionHandler("seekbackward", () => seek(audio.currentTime - 15));
            navigator.mediaSession.setActionHandler("seekforward", () => seek(audio.currentTime + 15));
          } catch (e) {}
        }

        // Stretch the transcript window so its bottom lines up with the end of the sidebar
        function fitFrame() {
          if (app.clientWidth <= 900) { frame.style.height = ""; return; }
          const top = frame.getBoundingClientRect().top, fix = $("fix").getBoundingClientRect().bottom;
          frame.style.height = Math.max(420, Math.round(fix - top)) + "px";
        }
        window.addEventListener("resize", fitFrame, sig);
        $("lede").addEventListener("toggle", fitFrame);
        document.fonts && document.fonts.ready.then(fitFrame);

        render(); fitFrame();
        const cue = (t, scroll) => { audio.currentTime = t; sync(true); setTimeout(() => { const now = frame.querySelector("p.now"); now && center(now, false); }, scroll ? 300 : 0); };
        if (startAt != null) cue(startAt, true);
        return {
          seek: cue,
          destroy() { ac.abort(); audio.pause(); audio.removeAttribute("src"); audio.innerHTML = ""; app.classList.remove("follow"); }
        };
      }

      // Keyboard shortcut: "/" jumps to search on the home view
      document.addEventListener("keydown", e => {
        if (e.key !== "/" || home.hidden) return;
        const el = (e.composedPath && e.composedPath()[0]) || e.target;
        if (el.matches && el.matches("input,textarea,select,[contenteditable]")) return;
        if (!(el === document.body || root.contains(el))) return;
        e.preventDefault(); $("q").focus();
      });

      route();
    }
  }

  // ---------- styles (scoped to the shadow root) ----------
  const CSS = `
:host{all:initial;display:block;
  --bg:#fff;--ink:#373737;--head:#333;--muted:#666;--soft:#8a8a8a;--rule:#cccccc;--hair:#e8e8e8;
  --maroon:#660000;--teal:#008bae;--sky:#40b2cf;--ochre:#bd8d46;--olive:#97a96a;
  --sky-tint:#eaf6fa;--ochre-tint:#f8f1e6;
  --sans:"Open Sans",Arial,Helvetica,sans-serif;--read-size:17px}
*{box-sizing:border-box;margin:0;padding:0}
[hidden]{display:none!important}
.frame{container:archive/inline-size}
.app{color:var(--ink);font:400 16px/1.6 var(--sans);-webkit-font-smoothing:antialiased;text-align:left;background:var(--bg)}
a{color:var(--maroon)}
button,input,select{font:inherit;color:inherit}
button{background:none;border:0;cursor:pointer;text-align:inherit}
:focus-visible{outline:2px solid var(--teal);outline-offset:3px}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.loading{padding:40px 0;text-align:center;color:var(--muted)}
.demo-note{background:var(--sky-tint);color:var(--head);font-size:13px;text-align:center;padding:7px 16px;border:1px solid #cfe9f1}
.demo-note a{color:var(--maroon)}
.crumbs{font-size:13px;color:var(--muted);padding:16px 0 0}
.crumbs a{color:var(--teal);text-decoration:none}
.crumbs a:hover{text-decoration:underline}

.chip{display:inline-block;border:1px solid var(--rule);border-radius:3px;padding:3px 10px;margin:0 6px 8px 0;font-size:13px;color:var(--ink);text-decoration:none;background:#fff;line-height:1.5}
.chip:hover{border-color:var(--teal);color:var(--teal)}

.box{border:3px solid var(--sky);background:#fff}
.box>h2{background:var(--sky);color:var(--head);font:700 19px/1.3 var(--sans);padding:14px 16px 16px}
.box>.body{padding:6px 16px 14px}
.box.ochre{border-color:var(--ochre)}.box.ochre>h2{background:var(--ochre)}
.box.olive{border-color:var(--olive)}.box.olive>h2{background:var(--olive)}

.hero{padding:30px 0 30px;text-align:center}
.hero h1{font:700 30px/1.25 var(--sans);color:var(--head);margin-bottom:10px}
.hero .intro{max-width:640px;margin:0 auto;font-size:15px}
.search{margin:24px auto 0;max-width:620px;position:relative}
.search input{width:100%;font:400 17px var(--sans);color:var(--ink);background:#fff;border:1px solid #bbb;border-radius:0;padding:13px 18px 13px 46px;outline:none;height:auto;box-shadow:none;-webkit-appearance:none;appearance:none}
.search input:focus{border-color:var(--teal);box-shadow:0 0 0 3px rgba(0,139,174,.15)}
.search svg{position:absolute;left:16px;top:50%;transform:translateY(-50%);color:#999}
.stats{margin-top:12px;color:var(--muted);font-size:13px}
.stats span{margin:0 7px}
.filters{display:flex;justify-content:center;gap:8px;margin-top:12px;flex-wrap:wrap}
.filters select{font:400 13px var(--sans);color:var(--ink);background:#fff;border:1px solid #bbb;border-radius:0;padding:6px 10px;height:auto}
.results{padding:4px 0 48px;max-width:820px;margin:0 auto}
.results .count{color:var(--muted);font-size:14px;margin-bottom:6px}
.grid{display:grid;grid-template-columns:1.5fr 1fr;gap:28px;padding:10px 0 28px;align-items:start}
.row{display:block;padding:14px 0;border-top:1px solid var(--hair);text-decoration:none;color:inherit}
.row:first-child{border-top:0}
.row h3{font:700 17px/1.35 var(--sans);color:var(--maroon)}
.row.full h3{text-decoration:underline;text-decoration-color:rgba(102,0,0,.35);text-underline-offset:3px}
.row:hover h3{text-decoration:underline;text-decoration-color:var(--maroon)}
.row .date{font-size:13px;font-style:italic;color:var(--muted);margin-top:2px}
.row p{color:var(--muted);font-size:14px}
.row .sum{color:var(--ink);margin-top:6px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.row mark{background:#fff2b8;color:inherit;padding:0 1px}
.results .row{padding:16px 0}
.feature{padding-top:14px!important}
.feat{display:block;text-decoration:none;color:inherit}
.feat:hover h3{text-decoration:underline}
.feature .eyebrow{font-size:13px;font-style:italic;color:var(--muted)}
.feature h3{font:700 19px/1.3 var(--sans);color:var(--maroon);margin:4px 0 2px}
.feature .who{font-size:14px;color:var(--muted)}
.feature p{font-size:15px;color:var(--ink);margin-top:10px}
.three{display:grid;grid-template-columns:repeat(3,1fr);gap:28px;padding:0 0 40px;align-items:stretch}
ol.num,.themes,aside ul{list-style:none}
ol.num li,.themes li{border-top:1px solid var(--hair)}
ol.num li:first-child,.themes li:first-child{border-top:0}
ol.num button,.themes button{display:grid;grid-template-columns:1fr auto;align-items:center;gap:10px;width:100%;padding:8px 0;font-size:15px;text-align:left}
ol.num button span,.themes .name{color:var(--maroon)}
ol.num button:hover span,.themes button:hover .name{text-decoration:underline}
ol.num small,.themes .n{font-size:13px;color:var(--muted);text-align:right}
.more{font-size:13px;color:var(--teal);font-weight:600;padding:8px 0 2px}
.foot{padding:20px 0 30px;color:var(--muted);font-size:13px;border-top:1px solid var(--hair)}

.talk-head{padding:18px 0 22px;border-bottom:1px solid var(--hair);margin-bottom:22px}
.talk-head .eyebrow{font-size:14px;font-weight:600;color:var(--muted)}
.talk-head .title{font:700 32px/1.25 var(--sans);color:var(--maroon);margin:2px 0 6px}
.talk-head .meta{color:var(--muted);font-size:14px;font-style:italic}
.hint{font-size:13px;color:var(--muted);margin:-10px 0 12px}
.pending{color:var(--muted);font-size:15px;font-style:italic}
.player{position:sticky;top:8px;z-index:10;display:flex;align-items:center;gap:12px;background:#fff;border:3px solid var(--sky);padding:8px 14px 8px 8px;box-shadow:0 6px 18px -14px rgba(0,0,0,.4)}
.pb{width:42px;height:42px;background:var(--teal);display:grid;place-items:center;flex:none}
.pb:hover{background:#007795}
.skip{font-size:13px;color:var(--muted);font-weight:600;padding:4px}
.skip:hover{color:var(--teal)}
.time{font-size:13px;color:var(--muted);font-variant-numeric:tabular-nums;min-width:40px;text-align:center}
.scrub{flex:1;height:22px;display:flex;align-items:center;cursor:pointer;position:relative;touch-action:none}
.scrub .track{width:100%;height:4px;background:var(--hair);position:relative}
.scrub .fill{position:absolute;left:0;top:0;bottom:0;background:var(--teal);width:0}
.scrub .buf{position:absolute;left:0;top:0;bottom:0;background:#cde7ef;width:0}
.scrub .knob{position:absolute;top:50%;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;background:var(--teal);left:0}
.speed{font-size:13px;font-weight:600;color:var(--muted);min-width:34px}
.cols{display:grid;grid-template-columns:minmax(0,1fr) 230px;gap:40px;padding:30px 0 60px}
.teacher{font-size:14px;color:var(--muted);margin-bottom:22px}
.teacher b{display:block;color:var(--head);font-weight:700;font-size:15px}
.toolbar{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;padding-bottom:10px;border-bottom:1px solid var(--hair)}
.seg{display:inline-flex;border:1px solid var(--rule);font-size:14px}
.seg button{padding:6px 14px;white-space:nowrap;color:var(--muted);border-left:1px solid var(--hair)}
.seg button:first-child{border-left:0}
.seg button:hover{color:var(--teal)}
.seg button[aria-pressed=true]{background:#000;color:#fff}
.tools{display:flex;gap:6px;align-items:center}
.tools .tlabel{font-size:13px;color:var(--muted);margin-right:4px}
.tools button{border:1px solid var(--rule);width:30px;height:28px;font-size:16px;line-height:1;color:var(--ink);text-align:center}
.tools button:hover{border-color:var(--teal);color:var(--teal)}
.lede{font-size:16px;line-height:1.65;background:var(--ochre-tint);border-left:4px solid var(--ochre);padding:12px 18px;margin-bottom:24px}
.lede summary,.lede-h{list-style:none;cursor:pointer;display:flex;align-items:center;gap:8px;font-weight:700;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:var(--ochre)}
.lede-h{cursor:default}
.lede summary::-webkit-details-marker{display:none}
.lede summary:after{content:"";width:7px;height:7px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(45deg);margin:-3px 0 0 2px;transition:transform .2s}
.lede:not([open]) summary:after{transform:rotate(-45deg);margin:0}
.lede summary:hover{color:#9c7235}
.lede p{margin-top:6px}
.text{position:relative;height:min(72vh,720px);overflow-y:auto;overscroll-behavior:contain;padding:26px 14px 40px 64px;outline:none;border-bottom:1px solid var(--hair);
  scrollbar-width:thin;scrollbar-color:#dcdcdc transparent;
  -webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 22px,#000 calc(100% - 40px),transparent 100%);mask-image:linear-gradient(to bottom,transparent 0,#000 22px,#000 calc(100% - 40px),transparent 100%)}
.text::-webkit-scrollbar{width:6px}
.text::-webkit-scrollbar-thumb{background:#dcdcdc;border-radius:3px}
.text::-webkit-scrollbar-track{background:transparent}
.text>p:last-child{margin-bottom:0}
.text p{font:400 var(--read-size)/1.75 var(--sans);margin-bottom:1em;position:relative;padding:4px 0;transition:background .25s,box-shadow .25s,color .35s}
.text p .t{position:absolute;left:-60px;top:9px;font-size:12px;color:var(--soft);font-variant-numeric:tabular-nums;width:48px;text-align:right}
.text p .t:hover{color:var(--teal)}
.text .s{cursor:pointer;transition:background .2s}
.text .s:hover{background:var(--sky-tint)}
.text p.now{background:var(--sky-tint);box-shadow:0 0 0 12px var(--sky-tint)}
.text p.now .t{color:var(--teal);font-weight:700}
.text .s.cur{text-decoration:underline;text-decoration-color:var(--sky);text-decoration-thickness:2px;text-underline-offset:5px}
.text em{font-style:italic}
.verb p{font-size:calc(var(--read-size) - 2px)}
aside .box{margin-bottom:22px}
aside .box>h2{font-size:16px;padding:10px 14px 11px}
aside .box>.body{padding:10px 14px 8px}
aside li{font-size:14px;padding:6px 0;border-top:1px solid var(--hair)}
aside li:first-child{border-top:0}
aside li a{color:var(--maroon);text-decoration:none}
aside li a:hover{text-decoration:underline}
aside li small{display:block;font-size:12px;color:var(--muted)}
.fix{font-size:14px;color:var(--maroon)}
.toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%) translateY(20px);background:#333;color:#fff;padding:10px 18px;font:400 14px/1.4 var(--sans);opacity:0;transition:.25s;pointer-events:none;z-index:2147483000;max-width:90vw}
.toast.on{opacity:1;transform:translateX(-50%)}

.app.follow .text p{color:#b3b3b3}
.app.follow .text p.past{color:#9a9a9a}
.app.follow .text p.now{color:var(--head)}
.app.follow .text p .t{color:#c8c8c8}

@container archive (max-width:900px){
  .grid,.three,.cols{grid-template-columns:1fr;gap:20px}
  .text p .t{position:static;display:block;text-align:left;margin-bottom:2px}
  .text{padding:18px 4px 32px;height:64vh}
  .player{flex-wrap:wrap;gap:8px 10px;padding:8px 10px 4px 8px}
  .player #share,.player #dur{display:none}
  .scrub{order:5;flex-basis:100%}
  .talk-head .title{font-size:26px}
}
`;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
