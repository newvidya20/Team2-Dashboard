import pathlib,json,sys,zipfile,datetime
B=pathlib.Path(__file__).resolve().parent
stage=B/'redesign'/'FourTabFinal'/'SarangiCreditReview.Report'/'definition'
roots=[stage]
if '--live' in sys.argv:
    live=pathlib.Path(r'C:\Users\loanb\OneDrive\Desktop\Power BI\SarangiCreditReview_4Tabs\SarangiCreditReview.Report\definition')
    assert live.resolve()==pathlib.Path(r'C:\Users\loanb\OneDrive\Desktop\Power BI\SarangiCreditReview_4Tabs\SarangiCreditReview.Report\definition').resolve()
    backup=B/'backups'/('four-tabs-before-polish-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S')+'.zip')
    with zipfile.ZipFile(backup,'w',zipfile.ZIP_DEFLATED) as z:
        for f in live.rglob('*.json'):z.write(f,f.relative_to(live))
    roots.append(live)
labels={'GST Revenue Cr':'Sales','GST Purchases Cr':'Purchases','Top Buyer Cr':'Buyer sales','Top Supplier Cr':'Supplier purchases','State Revenue Cr':'Revenue','Bank Inflows Cr':'Inflows','Bank Outflows Cr':'Outflows','Finance Revenue Cr':'Revenue','Finance EBITDA Cr':'Operating EBITDA','Finance PAT Cr':'PAT'}
for root in roots:
    count=0
    for f in root.rglob('visual.json'):
        obj=json.loads(f.read_text(encoding='utf-8'));v=obj['visual'];typ=v['visualType'];changed=False
        if typ=='slicer':obj['position']['y']=142;obj['position']['height']=72;changed=True
        if typ=='card' and any(p.get('nativeQueryRef')=='PDF Header' for role in v.get('query',{}).get('queryState',{}).values() for p in role.get('projections',[])):
            obj['position']['y']=356;obj['position']['height']=50;changed=True
        if typ in ['lineChart','clusteredBarChart','clusteredColumnChart']:
            v['visualContainerObjects']['subTitle']=[{'properties':{'show':{'expr':{'Literal':{'Value':'false'}}}}}]
            for role in v.get('query',{}).get('queryState',{}).values():
                for p in role['projections']:
                    n=p.get('nativeQueryRef')
                    if n in labels:p['displayName']=labels[n]
            changed=True
        if changed:f.write_text(json.dumps(obj,indent=2,ensure_ascii=False),encoding='utf-8');count+=1
    print('Polished',count,'visuals:',root)
