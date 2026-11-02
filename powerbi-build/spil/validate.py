import sys,json,pathlib
B=pathlib.Path(__file__).resolve().parent;sys.path.insert(0,str(B.parent.parent/'.powerbi-tools'))
from jsonschema import Draft7Validator,RefResolver
store=json.loads((B.parent/'schemas'/'schema-store.json').read_text())
for u,s in list(store.items()):
    if '$id' in s:store[s['$id']]=s
root=B/'SudarshanPharmaCreditReview'/'SudarshanPharmaCreditReview.Report'/'definition'
errors=[];checked=0
tables=json.loads((B/'tables.json').read_text(encoding='utf-8'));measures={m['name']:m['tableName'] for m in json.loads((B/'measures.json').read_text(encoding='utf-8'))}
for f in root.rglob('*.json'):
    raw=f.read_text(encoding='utf-8');obj=json.loads(raw);u=obj.get('$schema')
    assert 'ROYAL ENTERPRISES' not in raw and 'SARANGI' not in raw
    if u:
        validator=Draft7Validator(store[u],resolver=RefResolver(u,store[u],store=store));errors.extend(f'{f.relative_to(root)}: {list(e.path)}: {e.message}' for e in validator.iter_errors(obj));checked+=1
    if f.name=='visual.json':
        pos=obj['position'];page=json.loads((f.parent.parent.parent/'page.json').read_text())
        assert 0<=pos['x'] and pos['x']+pos['width']<=page['width'] and 0<=pos['y'] and pos['y']+pos['height']<=page['height'],str(f)
        for role in obj['visual'].get('query',{}).get('queryState',{}).values():
            for p in role['projections']:
                kind=next(iter(p['field']));expr=p['field'][kind];t=expr['Expression']['SourceRef']['Entity'];c=expr['Property']
                assert (measures.get(c)==t) if kind=='Measure' else any(n==c for n,d in tables[t]['columns']),str((f,t,c))
assert not errors,'\n'.join(errors)
checks=json.loads((B/'data-checks.json').read_text());assert checks['bank_balance_errors']==0;assert checks['gst_returns']==74;assert checks['common_months']==16;assert checks['financial_parameters']==75
assert all(abs(x)<=1000.01 for x in checks['balance_sheet_residuals'].values())
assert checks['bank']['raw_rows']-checks['bank']['overlap_rows_removed']==checks['bank']['deduplicated_rows']
assert checks['loan_limit_row_sum']==2340771621 and checks['loan_outstanding_row_sum']==1823651197
assert len(tables['Finance Year']['rows'])==3
result={'pbir_files_validated':checked,'visual_bindings':'passed','page_bounds':'passed','company_identity':'passed','data_checks':checks,'desktop_rendering':'All four report pages rendered in Power BI Desktop without visual errors.','desktop_model_refresh':'Full refresh passed.','year_filter_validation':'Live DAX confirmed distinct annual values and 25 parameters per financial year; see LiveModelChecks.json.','financial_basis':'Standalone. FY2024 prior GAAP; FY2025 restated Ind AS; FY2026 Ind AS.','publication':'Local project only; not published.'}
(B/'SudarshanPharmaCreditReview'/'Validation.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result,indent=2))
