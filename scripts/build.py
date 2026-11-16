#!/usr/bin/env python3
"""Download and preprocess the official Open Government source into a static site."""
import argparse
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import gzip
import json
from pathlib import Path
import re
import shutil
import sys
import tempfile
import time
from urllib.parse import unquote, urlsplit
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
MODE = "catalogue"
CATALOGUE = "https://open.canada.ca/static/od-do-canada.jsonl.gz"
SOURCE = CATALOGUE
ID = re.compile(r"^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$", re.I)
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def clean(value):
    return " ".join(value.split()) if isinstance(value, str) else ""


def translated(obj, key, lang):
    value = obj.get(key)
    return clean(value.get(lang)) if isinstance(value, dict) else ""


def date_only(value):
    text = clean(value)[:10]
    if DATE.fullmatch(text):
        try:
            return datetime.fromisoformat(text).date().isoformat()
        except ValueError:
            pass
    return ""


def download(path):
    for attempt in range(3):
        try:
            req = Request(SOURCE, headers={"User-Agent": "CoolCode static catalogue snapshot builder/1.0"})
            with urlopen(req, timeout=90) as response, path.open("wb") as output:
                shutil.copyfileobj(response, output)
                header = response.headers.get("Last-Modified")
            try:
                return parsedate_to_datetime(header).date().isoformat() if header else ""
            except (ValueError, TypeError):
                return ""
        except OSError as exc:
            if attempt == 2:
                raise ValueError(f"Official download failed after three attempts: {exc}") from exc
            print(f"Download retry {attempt + 1}: {exc}", file=sys.stderr)
            time.sleep(2 ** (attempt + 1))


def write_json(path, data):
    body = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode()
    if path.suffix == ".gz":
        with path.open("wb") as stream, gzip.GzipFile(filename="", mode="wb", fileobj=stream, compresslevel=6, mtime=0) as out:
            out.write(body)
    else:
        path.write_bytes(body)


def resource_fields(raw):
    for res in raw if isinstance(raw, list) else []:
        if not isinstance(res, dict):
            continue
        name = translated(res, "name_translated", "en") or clean(res.get("name"))
        fr = translated(res, "name_translated", "fr")
        url = clean(res.get("url"))
        try:
            parts = urlsplit(url)
        except ValueError:
            continue
        if parts.scheme not in ("https", "http") or not parts.hostname or parts.username is not None:
            continue
        filename = unquote(parts.path.rsplit("/", 1)[-1])
        fmt = clean(res.get("format")).upper() or "UNSPECIFIED"
        yield [name or filename or "Publisher resource", fr, fmt, url, filename, clean(res.get("size"))]


def catalogue(path):
    seen = set()
    with gzip.open(path, "rt", encoding="utf-8-sig") as stream:
        for line in stream:
            item = json.loads(line)
            uid = clean(item.get("id"))
            title = translated(item, "title_translated", "en") or clean(item.get("title"))
            french = translated(item, "title_translated", "fr")
            if not ID.fullmatch(uid) or uid in seen or not (title or french):
                continue
            seen.add(uid)
            organization = item.get("organization") or {}
            org = clean(organization.get("title")).split("|")[0].strip() if isinstance(organization, dict) else ""
            date = date_only(item.get("date_modified") or item.get("metadata_modified"))
            resources = list(resource_fields(item.get("resources")))
            formats = sorted({res[2] for res in resources})
            names = dict.fromkeys(label for r in resources for label in (r[0], r[1], r[4]) if label)
            words = item.get("keywords") or {}
            keywords = []
            if isinstance(words, dict):
                for lang in ("en", "fr"):
                    group = words.get(lang)
                    if isinstance(group, list):
                        keywords.extend(clean(k) for k in group)
            terms = " ".join(dict.fromkeys([*keywords, *names]))
            notes = translated(item, "notes_translated", "en") or clean(item.get("notes")) or translated(item, "notes_translated", "fr")
            licence = clean(item.get("license_title"))
            details = [notes[:5000], licence, clean(item.get("license_url")), resources, date_only(item.get("date_published"))]
            yield [uid, title or french, french, org, date, formats, date, terms, len(resources)], details


def build(path, stage, updated):
    data = stage / "data"
    data.mkdir()
    rows = []
    shards = []
    details = []
    for row, detail in catalogue(path):
        if detail is not None:
            shard = len(shards)
            row.append(shard)
            details.append([row[0], detail])
            if len(details) >= 320:
                name = f"records-{shard}.json.gz"
                write_json(data / name, details)
                shards.append(name)
                details = []
        rows.append(row)
    if details:
        name = f"records-{len(shards)}.json.gz"
        write_json(data / name, details)
        shards.append(name)
    if len(rows) < 100:
        raise ValueError(f"Only {len(rows)} valid source entries; export appears incomplete.")
    rows.sort(key=lambda x: (x[6], x[0]), reverse=True)
    # Year/org/format labels are derived directly from the same rows as search.
    index = []
    for offset in range(0, len(rows), 12000):
        name = f"index-{len(index)}.json.gz"
        write_json(data / name, rows[offset:offset + 12000])
        index.append(name)
    write_json(data / "manifest.json", {
        "mode": MODE, "count": len(rows), "source": SOURCE, "publisherDate": updated,
        "built": datetime.now(timezone.utc).date().isoformat(), "newest": rows[0][4],
        "index": index, "shards": shards,
    })
    initial = sum((data / name).stat().st_size for name in index)
    print(f"{len(rows):,} entries, {initial / 1024 ** 2:.1f} MiB compressed search index, {len(shards)} detail files")


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--input", type=Path, help="Use a locally saved official export")
    p.add_argument("--output", type=Path, default=ROOT / "dist")
    args = p.parse_args()
    output = args.output.resolve()
    if output == ROOT or output in ROOT.parents or output == ROOT / "web" or (ROOT / "web") in output.parents:
        p.error("Choose a dedicated output directory outside the source web directory.")
    if args.input and args.input.resolve().is_relative_to(output):
        p.error("Keep the local export outside the output directory.")
    try:
        output.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix="coolcode-data-", dir=output.parent) as tmp:
            temp = Path(tmp)
            src = args.input or (temp / "source")
            updated = "" if args.input else download(src)
            stage = temp / "site"
            shutil.copytree(ROOT / "web", stage)
            build(src, stage, updated)
            if output.exists():
                shutil.rmtree(output)
            stage.replace(output)
    except (OSError, ValueError, KeyError, EOFError) as exc:
        p.exit(1, f"Build failed: {exc}\n")


if __name__ == "__main__":
    main()
