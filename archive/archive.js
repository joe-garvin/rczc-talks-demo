/* Red Cedar Zen dharma talk archive.
   Paste into a Wild Apricot Custom HTML block:
     <div id="rczc-archive"></div>
     <script src="https://joe-garvin.github.io/rczc-talks-demo/archive/archive.js"></script>
   Optional: data-corrections="someone@example.org" on the div adds a "Report a correction" link. */
(function () {
  "use strict";
  const root = document.getElementById("rczc-archive");
  if (!root || root.dataset.ready) return;
  root.dataset.ready = "1";
  const me = document.currentScript || [...document.scripts].find(s => /archive\.js/.test(s.src));
  const BASE = me ? me.src.replace(/[^/]*$/, "") : "";
  const CORR = root.dataset.corrections || "";

  const css = document.createElement("link");
  css.rel = "stylesheet"; css.href = BASE + "archive.css?v=3";
  document.head.appendChild(css);

  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const md = s => esc(s).replace(/\*(.+?)\*/g, "<em>$1</em>");
  const fmt = s => { s = Math.max(0, Math.floor(s || 0)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = String(s % 60).padStart(2, "0"); return h ? `${h}:${String(m).padStart(2, "0")}:${x}` : `${m}:${x}`; };
  const fmtDate = (d, long) => {
    const [y, m, day] = (d || "").split("-").map(Number);
    if (!y) return "";
    if (!m) return String(y);
    const o = { month: long ? "long" : "short", year: "numeric" };
    if (day) o.day = "numeric";
    if (day && long) o.weekday = "long";
    return new Date(y, m - 1, day || 1).toLocaleDateString("en-US", o);
  };
  const $ = sel => root.querySelector(sel);
  const qs = o => Object.entries(o).filter(([, v]) => v).map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");
  const toast = msg => { let el = $(".toast"); if (!el) { el = document.createElement("div"); el.className = "toast"; el.setAttribute("role", "status"); root.appendChild(el); } el.textContent = msg; el.classList.add("on"); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("on"), 2400); };

  let T = [], cleanup = () => {};
  const tally = key => { const m = new Map(); T.forEach(t => [].concat(t[key]).filter(Boolean).forEach(v => m.set(v, (m.get(v) || 0) + 1))); return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])); };

  root.innerHTML = '<div class="rza-loading">Loading the talk archive…</div>';
  fetch(BASE + "data/index.json").then(r => r.json()).then(data => {
    T = data;
    window.addEventListener("hashchange", route);
    route();
  }).catch(() => { root.innerHTML = '<div class="rza-loading">The talk archive couldn’t load. Please refresh the page.</div>'; });

  function parseHash() {
    const h = location.hash.replace(/^#\/?/, "");
    const [path, query] = h.split("?");
    const params = Object.fromEntries(new URLSearchParams(query || ""));
    return { path, params };
  }
  function route() {
    cleanup(); cleanup = () => {};
    root.classList.remove("follow");
    const { path, params } = parseHash();
    if (path.startsWith("talk/")) talk(decodeURIComponent(path.slice(5)), params);
    else home(params);
  }
  const top = () => { const y = root.getBoundingClientRect().top + scrollY - 20; if (scrollY > y) scrollTo({ top: y }); };

  /* ---------- Home: search and browse ---------- */
  function home(p) {
    const speakers = tally("speaker"), themes = tally("themes"), texts = tally("texts"), series = tally("series");
    const years = [...new Set(T.map(t => t.date.slice(0, 4)))].sort().reverse();
    const opt = (list, label, sel) => `<option value="">${label}</option>` + list.map(([s, n]) => `<option value="${esc(s)}"${s === sel ? " selected" : ""}>${esc(s)} (${n})</option>`).join("");
    root.innerHTML = `
      <section class="hero">
        <h1>Dharma Talk Archive</h1>
        <p class="intro">Talks given at Red Cedar since 2001, each with a summary and a recording.</p>
        <div class="search" role="search">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <input id="rza-q" type="search" autocomplete="off" aria-label="Search talks" placeholder="Search titles, teachers and summaries" value="${esc(p.q || "")}">
        </div>
        <div class="filters">
          <select data-k="teacher" aria-label="Teacher">${opt(speakers, "Any teacher", p.teacher)}</select>
          <select data-k="series" aria-label="Series">${opt(series, "Any series", p.series)}</select>
          <select data-k="theme" aria-label="Theme">${opt(themes, "Any theme", p.theme)}</select>
          <select data-k="text" aria-label="Text">${opt(texts, "Any text", p.text)}</select>
          <select data-k="year" aria-label="Year"><option value="">Any year</option>${years.map(y => `<option${y === p.year ? " selected" : ""}>${y}</option>`).join("")}</select>
        </div>
      </section>
      <section class="results" hidden aria-live="polite"><div class="count"></div><div class="rlist"></div></section>
      <div class="browse">
        <section class="grid">
          <div class="box"><h2>Latest Talks</h2><div class="body latest"></div></div>
          <div class="box ochre"><h2>From the Archive</h2><div class="body feature"></div></div>
        </section>
        <section class="three">
          <div class="box olive"><h2>Teachers</h2><div class="body"><ul class="list" data-list="teacher"></ul><button class="more"></button></div></div>
          <div class="box"><h2>Series</h2><div class="body"><ul class="list" data-list="series"></ul><button class="more"></button></div></div>
          <div class="box ochre"><h2>Themes</h2><div class="body"><ul class="list" data-list="theme"></ul><button class="more"></button></div></div>
        </section>
      </div>
      <div class="foot">Transcripts were made with speech recognition and edited for reading with AI help. The recording is always the authoritative version.</div>`;

    $(".latest").innerHTML = T.slice(0, 6).map(t => row(t)).join("");
    const old = T.filter(t => t.date < "2016" && t.summary && t.text === "rf");
    const f = old[Math.floor(Date.now() / 6048e5) % old.length];
    if (f) $(".feature").innerHTML = `<a href="#/talk/${f.id}"><div class="eyebrow">${fmtDate(f.date)}</div><h3>${esc(f.title)}</h3><div class="who">${esc(f.speaker)}${f.minutes ? " · " + f.minutes + " min" : ""}</div><p>${esc(f.summary.split(/(?<=\.)\s/).slice(0, 2).join(" "))}</p></a>`;

    const lists = { teacher: speakers, series, theme: themes };
    root.querySelectorAll("[data-list]").forEach(ul => {
      const k = ul.dataset.list, all = lists[k], btn = ul.nextElementSibling;
      const draw = full => {
        ul.innerHTML = (full ? all : all.slice(0, 8)).map(([s, n]) => `<li><button data-k="${k}" data-v="${esc(s)}"><span class="name">${esc(s)}</span><span class="n">${n}</span></button></li>`).join("");
        btn.textContent = full ? "Show fewer" : `All ${all.length}`;
        btn.hidden = all.length <= 8; btn.dataset.full = full ? "1" : "";
      };
      draw(false);
      btn.onclick = () => draw(!btn.dataset.full);
      ul.onclick = e => { const b = e.target.closest("button"); if (!b) return; setParams({ [b.dataset.k]: b.dataset.v }); top(); };
    });

    let shown = 40;
    const read = () => { const o = { q: $("#rza-q").value.trim() }; root.querySelectorAll(".filters select").forEach(s => o[s.dataset.k] = s.value); return o; };
    const setParams = o => { const cur = read(); Object.assign(cur, o); root.querySelectorAll(".filters select").forEach(s => s.value = cur[s.dataset.k] || ""); $("#rza-q").value = cur.q || ""; shown = 40; run(true); };
    function run(push) {
      const o = read(), q = (o.q || "").toLowerCase();
      const h = "#/" + (qs(o) ? "?" + qs(o) : "");
      if (location.hash !== h && (location.hash || h !== "#/")) history.replaceState(null, "", h);
      const active = Object.values(o).some(Boolean);
      $(".results").hidden = !active; $(".browse").hidden = active;
      if (!active) return;
      const words = q.split(/\s+/).filter(Boolean);
      let hits = T.filter(t => {
        if (o.teacher && t.speaker !== o.teacher) return false;
        if (o.series && t.series !== o.series) return false;
        if (o.theme && !t.themes.includes(o.theme)) return false;
        if (o.text && !t.texts.includes(o.text)) return false;
        if (o.year && !t.date.startsWith(o.year)) return false;
        if (!words.length) return true;
        const hay = [t.title, t.speaker, t.series, t.summary, t.themes.join(" "), t.texts.join(" "), t.figures.join(" ")].join(" ").toLowerCase();
        return words.every(w => hay.includes(w));
      });
      if (words.length) hits = hits.map(t => [t, words.reduce((s, w) => s + (t.title.toLowerCase().includes(w) ? 5 : 0) + (t.speaker.toLowerCase().includes(w) ? 3 : 0) + 1, 0)]).sort((a, b) => b[1] - a[1] || (a[0].date < b[0].date ? 1 : -1)).map(x => x[0]);
      else if (o.series) hits.sort((a, b) => a.date < b.date ? -1 : 1);
      $(".count").innerHTML = `<span>${hits.length} talk${hits.length === 1 ? "" : "s"}</span><button class="clear">Clear search</button>`;
      $(".count .clear").onclick = () => { root.querySelectorAll(".filters select").forEach(s => s.value = ""); $("#rza-q").value = ""; run(true); };
      $(".rlist").innerHTML = hits.slice(0, shown).map(t => row(t, words)).join("") + (hits.length > shown ? `<button class="more" id="rza-more">Show more talks</button>` : "");
      const more = $("#rza-more"); if (more) more.onclick = () => { shown += 40; run(); };
    }
    let timer;
    $("#rza-q").addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => { shown = 40; run(); }, 150); });
    root.querySelectorAll(".filters select").forEach(s => s.onchange = () => { shown = 40; run(); });
    run();
  }

  function row(t, words) {
    const hl = s => words && words.length ? esc(s).replace(new RegExp(`(${words.map(w => esc(w).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi"), "<mark>$1</mark>") : esc(s);
    return `<a class="row" href="#/talk/${t.id}"><h3>${hl(t.title)}</h3>
      <p class="date">${hl(t.speaker)} · ${fmtDate(t.date)}${t.minutes ? " · " + t.minutes + " min" : ""}${t.series ? " · " + esc(t.series) : ""}${t.text === "rf" ? "" : ' · <span class="noted">summary and audio</span>'}</p>
      ${words ? `<p class="sum">${hl(t.summary)}</p>` : ""}</a>`;
  }

  /* ---------- Talk page ---------- */
  function talk(id, params) {
    const entry = T.find(t => t.id === id);
    if (!entry) { root.innerHTML = `<p class="rza-loading">That talk isn’t in the archive. <a href="#/">Back to all talks</a></p>`; return; }
    root.innerHTML = '<div class="rza-loading">Loading…</div>';
    top();
    let alive = true;
    cleanup = () => { alive = false; };
    fetch(BASE + "data/talks/" + id + ".json").then(r => r.json()).then(D => { if (alive) renderTalk(D, params); })
      .catch(() => { root.innerHTML = '<p class="rza-loading">This talk couldn’t load. <a href="#/">Back to all talks</a></p>'; });
  }

  function renderTalk(D, params) {
    const hasText = D.text === "rf" && D.sentences;
    const mins = D.minutes ? `${D.minutes} minutes` : "";
    const ctrl = new AbortController(), on = (el, ev, fn, o) => el.addEventListener(ev, fn, Object.assign({ signal: ctrl.signal }, o));
    let poll = 0;
    document.title = `${D.title} · ${D.speaker} · Dharma Talk Archive`;
    root.innerHTML = `
      <a class="back" href="#/">← All talks</a>
      <div class="talk-head">
        <div class="eyebrow">${esc(D.speaker)}</div>
        <h1>${esc(D.title)}</h1>
        <div class="meta">${[fmtDate(D.date, true), D.series, mins].filter(Boolean).map(esc).join(" · ")}</div>
      </div>
      ${D.audio ? `
      <div class="player" role="group" aria-label="Audio player">
        <button class="pb" aria-label="Play"><svg class="icon" width="16" height="16" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.5 10.5 6 3 10.5z" fill="#fff"/></svg></button>
        <button class="skip back15" aria-label="Back 15 seconds">−15</button>
        <span class="time cur">0:00</span>
        <div class="scrub" role="slider" tabindex="0" aria-label="Seek" aria-valuemin="0" aria-valuenow="0"><div class="track"><div class="buf"></div><div class="fill"></div><div class="knob"></div></div></div>
        <span class="time dur">${fmt(D.duration)}</span>
        <button class="skip fwd15" aria-label="Forward 15 seconds">+15</button>
        <button class="speed" aria-label="Playback speed">1×</button>
        <button class="skip share" aria-label="Copy a link to this moment">Share</button>
      </div><audio preload="metadata"></audio>` : D.youtube ? `<div class="yt"><div id="rza-yt"></div></div>` : `<p class="noaudio">The recording for this talk isn’t online yet.</p>`}
      <div class="cols">
        <article>
          <div class="lede"><h2>Summary</h2><p>${esc(D.summary)}</p></div>
          ${hasText ? `
          <div class="toolbar">
            <div class="seg" role="group" aria-label="Reading mode">
              <button data-mode="read" aria-pressed="true">Reader-friendly</button>
              ${D.audio || D.youtube ? '<button data-mode="follow" aria-pressed="false">Follow along</button>' : ""}
              <button data-mode="verb" aria-pressed="false">Verbatim</button>
            </div>
            <div class="tools" role="group" aria-label="Text size"><span class="tlabel">Text size</span><button class="smaller" aria-label="Smaller text">−</button><button class="bigger" aria-label="Larger text">+</button></div>
          </div>
          <div class="text" tabindex="0" aria-label="Transcript"></div>` : `<p class="pending">A transcript of this talk is still being prepared.${D.audio || D.youtube ? " The full talk is in the recording above." : ""}</p>`}
        </article>
        <aside>
          <div class="teacher"><button data-go="teacher=${encodeURIComponent(D.speaker)}">${esc(D.speaker)}</button></div>
          ${D.themes.length ? `<div class="box"><h2>Themes</h2><div class="body">${D.themes.map(t => `<a class="chip" href="#/?theme=${encodeURIComponent(t)}">${esc(t)}</a>`).join("")}</div></div>` : ""}
          ${D.texts.length + D.figures.length ? `<div class="box ochre"><h2>Texts and Figures</h2><div class="body">${D.texts.map(t => `<a class="chip" href="#/?text=${encodeURIComponent(t)}">${esc(t)}</a>`).join("")}${D.figures.map(t => `<a class="chip" href="#/?q=${encodeURIComponent(t)}">${esc(t)}</a>`).join("")}</div></div>` : ""}
          ${D.topics.length ? `<div class="box olive"><h2>Key Topics</h2><div class="body"><ul>${D.topics.map(t => `<li>${esc(t)}</li>`).join("")}</ul></div></div>` : ""}
          <div class="box"><h2>${D.series ? "More in This Series" : "Related Talks"}</h2><div class="body"><ul class="related"></ul></div></div>
          ${CORR ? `<a class="fix" href="mailto:${esc(CORR)}?subject=${encodeURIComponent("Transcript correction: " + D.title + " (" + D.date + ")")}">Report a correction</a>` : ""}
        </aside>
      </div>`;

    // Related: the rest of the series in order, otherwise talks sharing the most themes and texts
    let rel;
    if (D.series) rel = T.filter(t => t.series === D.series && t.id !== D.id).sort((a, b) => a.date < b.date ? -1 : 1).slice(0, 8);
    else rel = T.filter(t => t.id !== D.id && t.text === "rf").map(t => [t, t.themes.filter(x => D.themes.includes(x)).length + t.texts.filter(x => D.texts.includes(x)).length * 2 + (t.speaker === D.speaker ? 1 : 0)]).filter(x => x[1] >= 3).sort((a, b) => b[1] - a[1] || (a[0].date < b[0].date ? 1 : -1)).slice(0, 5).map(x => x[0]);
    $(".related").innerHTML = rel.map(t => `<li><a href="#/talk/${t.id}">${esc(t.title)}</a><small>${esc(t.speaker)} · ${fmtDate(t.date)}</small></li>`).join("");
    if (!rel.length) $(".related").closest(".box").remove();
    on($(".teacher button"), "click", e => { location.hash = "#/?" + e.currentTarget.dataset.go; });

    /* Player: native audio for the archive recordings, the YouTube player otherwise */
    const P = { t: () => 0, seek: () => {}, toggle: () => {}, paused: () => true };
    if (D.audio) {
      const audio = $("audio");
      audio.src = D.audio;
      P.t = () => audio.currentTime; P.paused = () => audio.paused;
      P.seek = t => { audio.currentTime = Math.max(0, Math.min(t, audio.duration || D.duration || t)); sync(true); };
      P.toggle = () => audio.paused ? audio.play().catch(() => toast("The recording couldn’t start. Check your connection.")) : audio.pause();
      const setIcon = () => { const playing = !audio.paused; $(".icon").innerHTML = playing ? '<rect x="2.6" y="1.5" width="2.4" height="9" fill="#fff"/><rect x="7" y="1.5" width="2.4" height="9" fill="#fff"/>' : '<path d="M3 1.5 10.5 6 3 10.5z" fill="#fff"/>'; $(".pb").setAttribute("aria-label", playing ? "Pause" : "Play"); };
      on($(".pb"), "click", P.toggle);
      on($(".back15"), "click", () => P.seek(audio.currentTime - 15));
      on($(".fwd15"), "click", () => P.seek(audio.currentTime + 15));
      const speeds = [1, 1.25, 1.5, 0.75]; let sp = 0;
      on($(".speed"), "click", () => { sp = (sp + 1) % speeds.length; audio.playbackRate = speeds[sp]; $(".speed").textContent = speeds[sp] + "×"; });
      on($(".share"), "click", () => {
        const url = location.href.split("#")[0] + "#/talk/" + D.id + "?t=" + Math.floor(audio.currentTime);
        (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => toast(`Link to ${fmt(audio.currentTime)} copied`), () => toast(url));
      });
      on(audio, "play", setIcon); on(audio, "pause", setIcon);
      on(audio, "loadedmetadata", () => { $(".dur").textContent = fmt(audio.duration); if (params.t) P.seek(+params.t); });
      on(audio, "timeupdate", () => {
        const d = audio.duration || D.duration, pct = (audio.currentTime / d) * 100;
        $(".fill").style.width = pct + "%"; $(".knob").style.left = pct + "%"; $(".cur").textContent = fmt(audio.currentTime);
        $(".scrub").setAttribute("aria-valuenow", Math.floor(audio.currentTime)); sync();
      });
      on(audio, "progress", () => { try { const d = audio.duration; if (audio.buffered.length && d) $(".buf").style.width = (audio.buffered.end(audio.buffered.length - 1) / d * 100) + "%"; } catch (e) { } });
      const scrub = $(".scrub"), scrubAt = e => { const r = scrub.getBoundingClientRect(); P.seek(((e.clientX - r.left) / r.width) * (audio.duration || D.duration)); };
      let dragging = false;
      on(scrub, "pointerdown", e => { dragging = true; scrub.setPointerCapture(e.pointerId); scrubAt(e); });
      on(scrub, "pointermove", e => dragging && scrubAt(e));
      on(scrub, "pointerup", () => dragging = false);
      on(scrub, "keydown", e => { if (e.key === "ArrowLeft") P.seek(audio.currentTime - 5); if (e.key === "ArrowRight") P.seek(audio.currentTime + 5); });
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({ title: D.title, artist: D.speaker, album: "Red Cedar Zen dharma talks" });
        navigator.mediaSession.setActionHandler("seekbackward", () => P.seek(audio.currentTime - 15));
        navigator.mediaSession.setActionHandler("seekforward", () => P.seek(audio.currentTime + 15));
      }
      const stop = () => { audio.pause(); audio.removeAttribute("src"); audio.load(); };
      ctrl.stopAudio = stop;
    } else if (D.youtube) {
      let yp = null;
      const make = () => {
        yp = new YT.Player("rza-yt", { videoId: D.youtube, playerVars: { rel: 0, modestbranding: 1, start: +params.t || 0 },
          events: { onReady: () => { poll = setInterval(() => sync(), 300); } } });
      };
      if (window.YT && YT.Player) make();
      else {
        const prevReady = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => { prevReady && prevReady(); make(); };
        if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) { const s = document.createElement("script"); s.src = "https://www.youtube.com/iframe_api"; document.head.appendChild(s); }
      }
      P.t = () => yp && yp.getCurrentTime ? yp.getCurrentTime() : 0;
      P.paused = () => !yp || !yp.getPlayerState || yp.getPlayerState() !== 1;
      P.seek = t => { if (yp && yp.seekTo) { yp.seekTo(Math.max(0, t), true); sync(true); } };
      P.toggle = () => { if (!yp || !yp.playVideo) return; P.paused() ? yp.playVideo() : yp.pauseVideo(); };
    }

    /* Transcript */
    let mode = "read", sentEls = [], paraEls = [], times = [], lastIdx = -1;
    const frame = $(".text");
    function render() {
      if (!frame) return;
      frame.classList.toggle("verb", mode === "verb");
      if (mode === "verb") {
        frame.innerHTML = D.verbatim.map((b, i) => `<p><button class="t" data-t="${b.t}">${fmt(b.t)}</button><span class="s" data-t="${b.t}">${esc(b.text)}</span></p>`).join("");
        times = D.verbatim.map(b => b.t);
      } else {
        let html = "", p = -1;
        D.sentences.forEach((s, i) => {
          if (s.p !== p) { if (p >= 0) html += "</p>"; p = s.p; html += `<p>${s.t != null ? `<button class="t" data-t="${s.t}">${fmt(s.t)}</button>` : ""}`; }
          html += `<span class="s" data-t="${s.t ?? ""}">${md(s.text)}</span> `;
        });
        frame.innerHTML = html + "</p>";
        times = D.sentences.map(s => s.t ?? 0);
      }
      sentEls = [...frame.querySelectorAll(".s")]; paraEls = [...frame.querySelectorAll("p")];
      lastIdx = -1; sync(true);
    }
    let userScrolled = 0, autoScrolling = false;
    const center = (p, smooth) => {
      autoScrolling = true;
      frame.scrollTo({ top: p.offsetTop - frame.clientHeight / 2 + Math.min(p.offsetHeight, frame.clientHeight * 0.6) / 2, behavior: smooth ? "smooth" : "auto" });
      clearTimeout(center._t); center._t = setTimeout(() => autoScrolling = false, 700);
    };
    const inView = p => p.offsetTop >= frame.scrollTop && p.offsetTop + 40 <= frame.scrollTop + frame.clientHeight;
    const indexAt = t => { let lo = 0, hi = times.length - 1, ans = 0; while (lo <= hi) { const m = (lo + hi) >> 1; if (times[m] <= t + 1) { ans = m; lo = m + 1; } else hi = m - 1; } return ans; };
    function sync(force) {
      if (!frame || !sentEls.length) return;
      const t = P.t(), i = indexAt(t);
      if (i === lastIdx && !force) return;
      if (t < 0.5 && P.paused() && !force) return;
      sentEls.forEach(e => e.classList.remove("cur"));
      paraEls.forEach(e => e.classList.remove("now", "past"));
      if (t < 0.5 && P.paused()) { lastIdx = -1; return; }
      const s = sentEls[i]; if (!s) return;
      if (mode !== "verb") s.classList.add("cur");
      const p = s.closest("p"); p.classList.add("now");
      paraEls.slice(0, paraEls.indexOf(p)).forEach(e => e.classList.add("past"));
      if (!P.paused() && i !== lastIdx) {
        if (mode === "follow") center(p, true);
        else if (Date.now() - userScrolled > 6000 && !inView(p)) center(p, true);
      }
      lastIdx = i;
    }
    if (frame) {
      ["wheel", "touchmove", "keydown"].forEach(ev => on(frame, ev, () => { if (!autoScrolling) userScrolled = Date.now(); }, { passive: true }));
      on(frame, "click", e => { const el = e.target.closest("[data-t]"); if (!el || el.dataset.t === "" || !(D.audio || D.youtube)) return; P.seek(+el.dataset.t); if (P.paused()) P.toggle(); });
      root.querySelectorAll(".seg button").forEach(b => on(b, "click", () => {
        mode = b.dataset.mode;
        root.querySelectorAll(".seg button").forEach(x => x.setAttribute("aria-pressed", x === b));
        root.classList.toggle("follow", mode === "follow");
        render();
        const now = frame.querySelector("p.now"); if (now) center(now, false);
      }));
      let size = 17; const setSize = n => { size = Math.max(15, Math.min(25, n)); root.style.setProperty("--read-size", size + "px"); };
      on($(".smaller"), "click", () => setSize(size - 2)); on($(".bigger"), "click", () => setSize(size + 2));
      render();
    }

    on(document, "keydown", e => {
      if (e.target.matches("input,textarea,select,[contenteditable]") || !(D.audio || D.youtube)) return;
      if (e.code === "Space" && !e.target.matches("button,a")) { e.preventDefault(); P.toggle(); }
      if (e.key === "ArrowLeft" && !e.target.closest(".scrub")) P.seek(P.t() - 15);
      if (e.key === "ArrowRight" && !e.target.closest(".scrub")) P.seek(P.t() + 15);
    });

    cleanup = () => { ctrl.abort(); clearInterval(poll); if (ctrl.stopAudio) ctrl.stopAudio(); document.title = docTitle; };
  }
  const docTitle = document.title;
})();
