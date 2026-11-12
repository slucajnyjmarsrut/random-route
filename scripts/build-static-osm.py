#!/usr/bin/env python3
"""One-time city-centre OSM walking-graph snapshot for GitHub Pages.

This is a small bounded OSM API extract (not a tile server or repeated runtime API).
The resulting file is cached on this site and used by browser-side Dijkstra.
Data © OpenStreetMap contributors, ODbL 1.0.
"""
import json
import os
import pathlib
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/"data"/"yakutsk-center-walking.json"
# Southwest lon/lat, northeast lon/lat. ~2.5 km x 3 km downtown.
BBOX=(129.708,62.016,129.760,62.046)
API="https://api.openstreetmap.org/api/0.6/map"
ROAD_TYPES=set("footway path pedestrian steps living_street residential service unclassified tertiary secondary primary track cycleway".split())
TAGS=set("highway foot access sidewalk area construction disused oneway:foot".split())

def main():
    if OUT.exists() and OUT.stat().st_size>15000:
        print("Already generated:",OUT,OUT.stat().st_size)
        return
    b=",".join(f"{v:.6f}" for v in BBOX)
    url=API+"?"+urllib.parse.urlencode({"bbox":b})
    req=urllib.request.Request(url,headers={
      "User-Agent":"SlucajnyMarsrut/1.0 (research walking map; https://github.com/slucajnyjmarsrut/random-route)",
      "Accept":"application/xml",
    })
    print("Downloading bounded downtown OSM extract; bbox:", b, flush=True)
    with urllib.request.urlopen(req,timeout=85) as response:
        xml=response.read()
    print("OSM XML bytes:",len(xml),flush=True)
    root=ET.fromstring(xml)
    nodes={}
    for n in root.findall("node"):
        try:nodes[int(n.attrib["id"])]=(float(n.attrib["lat"]),float(n.attrib["lon"]))
        except (ValueError,KeyError):pass
    ways=[];edge_count=0
    for w in root.findall("way"):
        tags={t.attrib.get("k"):t.attrib.get("v") for t in w.findall("tag")}
        if tags.get("highway") not in ROAD_TYPES:continue
        ids=[int(n.attrib["ref"]) for n in w.findall("nd") if n.attrib.get("ref")]
        if len(ids)<2 or any(i not in nodes for i in ids):continue
        geometry=[{"lat":nodes[i][0],"lon":nodes[i][1]} for i in ids]
        ways.append({"nodes":ids,"geometry":geometry,"tags":{k:v for k,v in tags.items() if k in TAGS}})
        edge_count+=len(ids)-1
    if len(ways)<100 or edge_count<1000:
        raise SystemExit(f"Too little street geometry for safe publishing: ways={len(ways)}, edges={edge_count}")
    doc={"version":1,"source":"OpenStreetMap API 0.6, © OpenStreetMap contributors (ODbL 1.0)",
         "bbox":{"south":BBOX[1],"west":BBOX[0],"north":BBOX[3],"east":BBOX[2]},
         "created_at":datetime.now(timezone.utc).isoformat(),"ways":ways}
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(doc,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    print(f"REAL_OSM_CACHE_READY ways={len(ways)} nodes={len(nodes)} edges={edge_count} bytes={OUT.stat().st_size}",flush=True)

if __name__=="__main__":
    main()
