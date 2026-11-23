# Government Dataset Explorer

Explore Canada's Open Government catalogue from [CoolCode](https://coolcode.ca/datasetexplorer/). Search bilingual titles, keywords, publisher names, file names, formats and resource labels. Filter by format, organization and modified year. Open an entry to see its descriptions, reported licence and published resource links.

The build uses the government's [Open Data Portal Catalogue](https://open.canada.ca/data/en/dataset/c4c5c7f1-bfa6-4ff6-b4a0-c164cb2060f7) and its [compressed JSONL export](https://open.canada.ca/static/od-do-canada.jsonl.gz). The catalogue page also offers SQLite and CSV. The Explorer mirrors catalogue metadata and links out to resources; availability and terms of the underlying resource are set by its publisher.

Contains information licensed under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada), published by the Treasury Board of Canada Secretariat. Individual catalogue entries can list different terms.

## Build

```sh
python3 scripts/build.py
python3 -m http.server 8080 --directory dist
```

Use Python 3.10+ and a current browser. The build can read an already downloaded export with `--input /path/to/catalogue.jsonl.gz`; `--output` sets a dedicated output directory. The build downloads the full compressed feed, then writes a browser search index and smaller resource-detail files. Description previews in the app are capped at 5,000 characters; the portal has the complete record.

GitHub Actions refreshes the app daily and on **Run workflow**, and deploys to Pages only after a successful import. The search worker loads the compressed index for local search. Individual resource-detail files load on demand. The site reports the publisher's export date and the build date separately.


<!-- coolcode:guide -->
Search the downloaded federal catalogue, or use Live catalogue search for a current CKAN query. Preview CSV and JSON resources up to 2 MB when the publisher allows browser access. You can also open a local CSV or JSON extract without uploading it; previews show up to 50 rows and 30 columns.
<!-- /coolcode:guide -->


## Added browser workflow

Search the downloaded federal catalogue, or use Live catalogue search for a current CKAN query. Preview CSV and JSON resources up to 2 MB when the publisher allows browser access. You can also open a local CSV or JSON extract without uploading it; previews show up to 50 rows and 30 columns.
