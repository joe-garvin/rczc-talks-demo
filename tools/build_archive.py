#!/usr/bin/env python3
"""Build the public archive data from the private archive repo.

Usage: python3 tools/build_archive.py <path to rczc-dharma-archive> [--transcripts rf|all|none]

Writes data/index.json (one entry per talk) and data/talks/<slug>.json (one file per
talk, loaded when a visitor opens it). Python stdlib only.

--transcripts rf    (default) full text only for talks with a reader-friendly version
--transcripts all   full text for every talk (verbatim when there's no reader-friendly)
--transcripts none  summaries, themes and audio only
"""
import argparse, difflib, json, os, re, shutil, sys, unicodedata

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "archive", "data")
DISPLAY = {"Shobogenzo": "Shōbōgenzō", "Dogen": "Dōgen", "Mumonkan": "Mumonkan"}

def slugify(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:90]

def frontmatter(text):
    m = re.match(r"---\n(.*?)\n---\n", text, re.S)
    meta = {}
    if m:
        for line in m.group(1).split("\n"):
            if ":" in line and not line.startswith(" "):
                k, v = line.split(":", 1)
                v = v.strip()
                if v.startswith('"') and v.endswith('"'):
                    v = v[1:-1].replace('\\"', '"')
                meta[k.strip()] = v
    return meta, text[m.end():] if m else text

def sections(body):
    parts = re.split(r"^## (.+)$", body, flags=re.M)
    out = {"_head": parts[0]}
    for i in range(1, len(parts), 2):
        out[parts[i].strip()] = parts[i + 1].strip()
    return out

def links(head, label):
    m = re.search(r"^\*\*%s:\*\*(.*)$" % label, head, re.M)
    if not m:
        return []
    names = [x.split("|")[-1] for x in re.findall(r"\[\[([^\]]+)\]\]", m.group(1))]
    return [DISPLAY.get(n, n) for n in names]

def name_summary(summary, speaker):
    """Swap 'the speaker' for the teacher's name: full name first, dharma name after."""
    if not summary or " and " in speaker or "," in speaker:
        return summary
    short = speaker.split()[0]
    n = [0]
    def rep(m):
        n[0] += 1
        return speaker if n[0] == 1 else short
    s = re.sub(r"\b[Tt]he speaker\b(?!s)", rep, summary)
    return s

def https(url):
    return re.sub(r"^http://rczc-audio", "https://rczc-audio", url or "")

def tsec(ts):
    p = [int(x) for x in ts.split(":")]
    return p[0] * 3600 + p[1] * 60 + p[2] if len(p) == 3 else p[0] * 60 + p[1]

def verbatim_blocks(text):
    blocks = []
    for m in re.finditer(r"^\*\*\[([\d:]+)\]\*\*\s*\n(.*?)(?=^\*\*\[[\d:]+\]\*\*|\Z)", text, re.M | re.S):
        t = " ".join(m.group(2).split())
        if t:
            blocks.append({"t": tsec(m.group(1)), "text": t})
    return blocks

norm = lambda w: re.sub(r"[^a-z0-9']", "", w.lower())

def align(paragraphs, blocks):
    """Give each reader-friendly sentence a start time from the verbatim timestamps.

    Every verbatim word gets a time by spreading each block's words evenly to the next
    block's start; reader-friendly words are matched to verbatim words with difflib, and
    each sentence takes the time of its first matched word (interpolated if none match).
    """
    vw, vt = [], []
    for i, b in enumerate(blocks):
        words = b["text"].split()
        end = blocks[i + 1]["t"] if i + 1 < len(blocks) else b["t"] + len(words) / 2.6
        for j, w in enumerate(words):
            vw.append(norm(w)); vt.append(b["t"] + (end - b["t"]) * j / max(1, len(words)))
    sents = []
    for pi, para in enumerate(paragraphs):
        for s in re.split(r"(?:(?<=[.!?…])|(?<=[.!?…][”\"’)]))\s+(?=[A-Z“\"'(*])", para):
            if s.strip():
                sents.append([pi, s.strip()])
    rw, owner = [], []
    for si, (_, s) in enumerate(sents):
        for w in s.split():
            rw.append(norm(w)); owner.append(si)
    times = [None] * len(sents)
    if vw and rw:
        sm = difflib.SequenceMatcher(None, vw, rw, autojunk=False)
        for a, b, size in sm.get_matching_blocks():
            for k in range(size):
                si = owner[b + k]
                if times[si] is None:
                    times[si] = vt[a + k]
    # fill gaps by interpolation and keep times moving forward
    known = [i for i, t in enumerate(times) if t is not None]
    if not known:
        return None
    for i in range(len(times)):
        if times[i] is None:
            prev = max([k for k in known if k < i], default=None)
            nxt = min([k for k in known if k > i], default=None)
            if prev is None: times[i] = times[nxt]
            elif nxt is None: times[i] = times[prev]
            else: times[i] = times[prev] + (times[nxt] - times[prev]) * (i - prev) / (nxt - prev)
    for i in range(1, len(times)):
        if times[i] < times[i - 1]:
            times[i] = times[i - 1]
    return [{"p": p, "t": round(t, 1), "text": s} for (p, s), t in zip(sents, times)]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("archive")
    ap.add_argument("--transcripts", choices=["rf", "all", "none"], default="rf")
    a = ap.parse_args()
    talks_dir = os.path.join(a.archive, "Talks")
    if os.path.isdir(os.path.join(OUT, "talks")):
        shutil.rmtree(os.path.join(OUT, "talks"))
    os.makedirs(os.path.join(OUT, "talks"))
    index, slugs, weak = [], set(), 0
    for fn in sorted(os.listdir(talks_dir)):
        if not fn.endswith(".md"):
            continue
        meta, body = frontmatter(open(os.path.join(talks_dir, fn), encoding="utf-8").read())
        sec = sections(body)
        head = sec["_head"]
        speaker, date = meta.get("speaker", ""), meta.get("date", "")
        slug = slugify(f"{date}-{meta.get('title', fn)}")
        while slug in slugs:
            slug += "-2"
        slugs.add(slug)
        blocks = verbatim_blocks(sec.get("Transcript", ""))
        rf = sec.get("Reader-friendly transcript", "")
        paras = [" ".join(p.split()) for p in re.split(r"\n\s*\n", rf) if p.strip()]
        duration = 0
        if blocks:
            duration = int(blocks[-1]["t"] + len(blocks[-1]["text"].split()) / 2.6)
        summary = name_summary(" ".join(sec.get("Summary", "").split()), speaker)
        summary = re.sub(r"(?<![*\w])\*([^*\n]+?)\*(?![*\w])", r"\1", summary)  # drop markdown italics
        src = https(meta.get("source", ""))
        audio = src if "rczc-audio" in src or re.search(r"\.(mp3|mp4|m4a)$", src, re.I) else ""
        yt = re.search(r"(?:v=|youtu\.be/)([\w-]{11})", src)
        show_text = a.transcripts == "all" or (a.transcripts == "rf" and paras)
        mode = ("rf" if paras else "verbatim") if show_text else "none"
        entry = {
            "id": slug, "title": meta.get("title", ""), "speaker": speaker, "date": date,
            "series": meta.get("series", ""), "summary": summary,
            "themes": links(head, "Themes"), "texts": links(head, "Texts"),
            "figures": links(head, "Figures"), "minutes": round(duration / 60) if duration else 0,
            "text": mode, "format": meta.get("format", ""),
        }
        index.append(entry)
        talk = dict(entry)
        talk.update({
            "audio": audio, "youtube": yt.group(1) if yt else "", "duration": duration,
            "topics": [l[2:].strip() for l in sec.get("Key topics", "").split("\n") if l.startswith("- ")],
        })
        if mode == "rf":
            sents = align(paras, blocks)
            if sents is None:
                weak += 1
                sents = [{"p": i, "t": None, "text": p} for i, p in enumerate(paras)]
            talk["sentences"] = sents
            talk["verbatim"] = blocks
        elif mode == "verbatim":
            talk["verbatim"] = blocks
        with open(os.path.join(OUT, "talks", slug + ".json"), "w", encoding="utf-8") as f:
            json.dump(talk, f, ensure_ascii=False, separators=(",", ":"))
    index.sort(key=lambda t: t["date"], reverse=True)
    with open(os.path.join(OUT, "index.json"), "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, separators=(",", ":"))
    counts = {m: sum(1 for t in index if t["text"] == m) for m in ("rf", "verbatim", "none")}
    print(f"{len(index)} talks: {counts}; {weak} without alignment", file=sys.stderr)

if __name__ == "__main__":
    main()
