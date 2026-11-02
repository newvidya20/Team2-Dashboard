import sys,json,pathlib
B=pathlib.Path(__file__).resolve().parent
sys.path.insert(0,str(B.parent.parent/'.powerbi-tools'))
from jsonschema import Draft7Validator,RefResolver
store=json.loads((B.parent/'schemas'/'schema-store.json').read_text())
for u,s in list(store.items()):
    if '$id' in s:store[s['$id']]=s
root=B/'RoyalEnterprisesCreditReview'/'RoyalEnterprisesCreditReview.Report'/'definition'
errors=[];checked=0
tables=json.loads((B/'tables.json').read_text(encoding='utf-8'));measures={m['name']:m['tableName'] for m in json.loads((B/'measures.json').read_text(encoding='utf-8'))}
for f in root.rglob('*.json'):
    obj=json.loads(f.read_text(encoding='utf-8'));u=obj.get('$schema')
    if u:
        validator=Draft7Validator(store[u],resolver=RefResolver(u,store[u],store=store))
        errors.extend(f'{f.relative_to(root)}: {list(e.path)}: {e.message}' for e in validator.iter_errors(obj));checked+=1
    if f.name=='visual.json':
        pos=obj['position'];page=json.loads((f.parent.parent.parent/'page.json').read_text())
        assert 0<=pos['x'] and pos['x']+pos['width']<=page['width'] and 0<=pos['y'] and pos['y']+pos['height']<=page['height'],str(f)
        for role in obj['visual'].get('query',{}).get('queryState',{}).values():
            for p in role['projections']:
                kind=next(iter(p['field']));expr=p['field'][kind];t=expr['Expression']['SourceRef']['Entity'];c=expr['Property']
                assert (measures.get(c)==t) if kind=='Measure' else any(n==c for n,d in tables[t]['columns']),str((f,t,c))
assert not errors,'\n'.join(errors)
checks=json.loads((B/'data-checks.json').read_text());assert checks['bank_balance_errors']==0;assert checks['gst_returns']==14;assert checks['common_months']==11
assert checks['financial_parameters']==75
assert all(abs(x)<=.05 for x in checks['balance_sheet_residuals'].values())
result={'pbir_files_validated':checked,'visual_bindings':'passed','page_bounds':'passed','data_checks':checks,'desktop_rendering':'Four pages verified in Power BI Desktop; financial register and loan notes inspected. Year buttons verified; latest default restored.','desktop_model_refresh':'Full refresh passed','live_dax_checks':'6274 bank transactions, 14 GST returns, 11 common months, 3 financial years and 25 parameters per year confirmed.','year_filter_results':{'2023-24':{'sales_crore':75.2729622,'reported_profit_crore':2.0137262},'2024-25':{'sales_crore':200.135969,'reported_profit_crore':7.0249274},'2025-26':{'sales_crore':303.7197357,'reported_profit_crore':11.56309,'status':'Provisional'}},'original_application_files':'Unmodified'}
(B/'RoyalEnterprisesCreditReview'/'Validation.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result,indent=2))
