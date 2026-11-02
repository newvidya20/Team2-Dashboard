import pathlib, urllib.request, json, re, urllib.parse
root=pathlib.Path(__file__).resolve().parent/'schemas'; root.mkdir(exist_ok=True)
urls=[f'https://developer.microsoft.com/json-schemas/fabric/item/report/definition/{part}/{ver}/schema.json' for part,ver in [('visualContainer','2.4.0'),('page','2.1.0'),('pagesMetadata','1.0.0'),('report','3.3.0'),('versionMetadata','1.0.0')]]
seen={}
def fetch(url):
    if url in seen: return
    data=json.loads(urllib.request.urlopen(url,timeout=30).read())
    seen[url]=data
    def walk(x):
        if isinstance(x,dict):
            if '$ref' in x and not x['$ref'].startswith('#'):
                ref=urllib.parse.urljoin(url,x['$ref']).split('#')[0]
                if ref.startswith('https://developer.microsoft.com/'): fetch(ref)
            for v in x.values(): walk(v)
        elif isinstance(x,list):
            for v in x: walk(v)
    walk(data)
for u in urls: fetch(u)
(root/'schema-store.json').write_text(json.dumps(seen),encoding='utf-8')
print('Downloaded',len(seen),'official schema documents')
