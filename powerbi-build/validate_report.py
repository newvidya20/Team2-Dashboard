import sys,pathlib,json
BASE=pathlib.Path(__file__).resolve().parent
sys.path.insert(0,str(BASE.parent/'.powerbi-tools'))
from jsonschema import Draft7Validator,RefResolver
store=json.loads((BASE/'schemas'/'schema-store.json').read_text())
for u,s in list(store.items()):
    if '$id' in s: store[s['$id']]=s
root=BASE/'output'/'SarangiCreditReview'/'SarangiCreditReview.Report'/'definition'
errors=[]; checked=0
for f in root.rglob('*.json'):
    d=json.loads(f.read_text(encoding='utf-8'))
    if '$schema' not in d: continue
    u=d['$schema']; schema=store[u]
    validator=Draft7Validator(schema,resolver=RefResolver(u,schema,store=store))
    errors.extend(f'{f.relative_to(root)}: {list(e.path)}: {e.message}' for e in validator.iter_errors(d))
    checked+=1
    if f.name=='visual.json':
        p=d['position']; assert 0<=p['x'] and p['x']+p['width']<=1600 and 0<=p['y'] and p['y']+p['height']<=1000
measures={m['name']:m['tableName'] for m in json.loads((BASE/'output'/'measure-definitions.json').read_text())}
tables=json.loads((BASE/'output'/'normalized-data.json').read_text())
for f in root.rglob('visual.json'):
    d=json.loads(f.read_text())
    for role in d['visual'].get('query',{}).get('queryState',{}).values():
        for p in role['projections']:
            expr=p['field']; typ=next(iter(expr)); e=expr[typ]; t=e['Expression']['SourceRef']['Entity']; n=e['Property']
            assert (n in measures and measures[n]==t) if typ=='Measure' else any(c[0]==n for c in tables[t]['columns']), (f,t,n)
if errors:
    print('\n'.join(errors)); raise SystemExit(1)
print(f'Validated {checked} PBIR files against official schemas; all visual field bindings and page bounds valid.')
