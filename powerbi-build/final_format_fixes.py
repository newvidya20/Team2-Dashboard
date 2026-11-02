import pathlib,json
D=pathlib.Path(__file__).resolve().parent/'redesign'
updates=[]
for filename in ['new-measures.json','all-measures.json']:
    p=D/filename;defs=json.loads(p.read_text(encoding='utf-8'))
    for d in defs:
        if '[Red]' in d.get('formatString',''):
            d['formatString']=d['formatString'].replace('[Red]','')
            if filename=='new-measures.json':updates.append({k:d[k] for k in ['name','tableName','formatString']})
    p.write_text(json.dumps(defs,indent=2,ensure_ascii=False),encoding='utf-8')
(D/'format-updates.json').write_text(json.dumps(updates),encoding='utf-8')
print('Removed unsupported colour tokens from',len(updates),'numeric formats')
