import pathlib,json,sys
B=pathlib.Path(__file__).resolve().parent; sys.path.insert(0,str(B.parent/'.powerbi-tools'))
from jsonschema import Draft7Validator
from referencing import Registry,Resource
from referencing.jsonschema import DRAFT7
D=B/'redesign';root=D/'FourTabFinal'/'SarangiCreditReview.Report'/'definition'
store=json.loads((B/'schemas'/'schema-store.json').read_text())
for u,s in list(store.items()):
    if '$id' in s:store[s['$id']]=s
models=json.loads((B/'output'/'normalized-data.json').read_text(encoding='utf-8'))
models.update(json.loads((D/'tables.json').read_text(encoding='utf-8')))
measures={m['name']:m['tableName'] for m in json.loads((D/'all-measures.json').read_text())}
errs=[];count=0;datavisuals=0
for f in root.rglob('*.json'):
    obj=json.loads(f.read_text(encoding='utf-8'))
    if '$schema' not in obj:continue
    u=obj['$schema']
    if u not in store:raise RuntimeError('Missing schema: '+u)
    registry=Registry().with_resources((key,Resource.from_contents(schema,default_specification=DRAFT7)) for key,schema in store.items())
    val=Draft7Validator(store[u],registry=registry)
    errs.extend(str(f.relative_to(root))+': '+str(list(e.path))+': '+e.message for e in val.iter_errors(obj));count+=1
    if f.name=='visual.json':
        p=obj['position'];assert 0<=p['x'] and p['x']+p['width']<=1440 and 0<=p['y'] and p['y']+p['height']<=1200
        conf=obj['visual']; q=conf.get('query',{}).get('queryState',{})
        if q:datavisuals+=1
        for role in q.values():
            for proj in role['projections']:
                expr=proj['field'];typ=next(iter(expr));e=expr[typ];t=e['Expression']['SourceRef']['Entity'];n=e['Property']
                assert (measures.get(n)==t) if typ=='Measure' else any(c[0]==n for c in models[t]['columns']),(f,t,n)
pages=json.loads((root/'pages'/'pages.json').read_text())['pageOrder']
assert len(pages)==4
assert len(list((root/'pages').glob('*/page.json')))==4, 'Orphan report pages detected'
assert len(models['Calculation Register']['rows'])==25
if errs: print('\n'.join(errs));raise SystemExit(1)
res={'schema_files_checked':count,'page_count':4,'data_visuals':datavisuals,'PDF_parameters':25,'field_bindings':'valid','page_bounds':'valid'}
(D/'validation-report.json').write_text(json.dumps(res,indent=2));print(json.dumps(res,indent=2))
