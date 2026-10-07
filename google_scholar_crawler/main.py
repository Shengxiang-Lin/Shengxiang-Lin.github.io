from scholarly import scholarly
import json
from datetime import datetime
import os

scholar_id = os.getenv("GOOGLE_SCHOLAR_ID") or "W-rloDsAAAAJ"
author: dict = scholarly.search_author_id(scholar_id)
scholarly.fill(author, sections=['basics', 'indices', 'counts'])

citation_data = {
    "scholar_id": scholar_id,
    "name": author.get("name"),
    "citedby": author.get("citedby", 0),
    "citedby5y": author.get("citedby5y", 0),
    "hindex": author.get("hindex", 0),
    "hindex5y": author.get("hindex5y", 0),
    "i10index": author.get("i10index", 0),
    "i10index5y": author.get("i10index5y", 0),
    "cites_per_year": author.get("cites_per_year", {}),
    "updated": str(datetime.now()),
}

print(json.dumps(citation_data, indent=2))
os.makedirs('results', exist_ok=True)
with open('results/gs_data.json', 'w') as outfile:
    json.dump(citation_data, outfile, ensure_ascii=False)

shieldio_data = {
    "schemaVersion": 1,
    "label": "citations",
    "message": str(citation_data["citedby"]),
}
with open('results/gs_data_shieldsio.json', 'w') as outfile:
    json.dump(shieldio_data, outfile, ensure_ascii=False)
