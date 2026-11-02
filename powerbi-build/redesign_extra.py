import pathlib,json,gzip,base64
B=pathlib.Path(__file__).resolve().parent/'redesign'
tables=json.loads((B/'tables.json').read_text(encoding='utf-8'))
cols=[('Order','Int64'),('Control','String')]
rr=[[1,'Gross outflows'],[2,'Loan disbursements'],[3,'Cash deposits'],[4,'EMI payments'],[5,'Internal transfer debits'],[6,'Internal transfer credits'],[7,'Penal charges · INR'],[8,'EMI / ECS / NACH returns'],[9,'CC utilisation']]
tables['Bank Controls']={'columns':cols,'rows':rr,'description':'Consolidated banking control panel. Amounts in crore unless expressly labelled INR. No inferred sanction limit.'}
p=base64.b64encode(gzip.compress(json.dumps(rr).encode())).decode()
expr='let R=Json.Document(Binary.Decompress(Binary.FromText("'+p+'",BinaryEncoding.Base64),Compression.GZip)),T=Table.FromRows(R,{"Order","Control"}),X=Table.TransformColumnTypes(T,{{"Order",Int64.Type},{"Control",type text}}) in X'
td={'name':'Bank Controls','description':tables['Bank Controls']['description'],'mExpression':expr,'columns':[{'name':n,'sourceColumn':n,'dataType':t,'summarizeBy':'None'} for n,t in cols]}
mm=[{'name':'Bank Control Result','tableName':'Bank Controls','displayFolder':'Credit Review','formatString':'General','expression':"VAR N=SELECTEDVALUE('Bank Controls'[Order]) VAR V=SWITCH(N,1,[Gross Outflows],2,[Loan Disbursements],3,[Cash Deposits],4,[EMI Payments],5,[Internal Debit],6,[Internal Credit]) RETURN SWITCH(TRUE(),N=7,[Source Penal Charges],N=8,[EMI Return Display],N=9,\"Not available\",ISBLANK(V),\"Not reported\",\"₹ \" & FORMAT(V/10000000,\"0.00\") & \" Cr\")"},
{'name':'Register Scope','tableName':'Calculation Register','displayFolder':'Credit Review','formatString':'General','expression':"FORMAT([Calculation Count],\"0\") & \" PDF parameters in view\""},
{'name':'Finance Header','tableName':'Financials','displayFolder':'Credit Review','formatString':'General','expression':"\"KPI year: \" & [Review Financial Year] & \"  |  Trends retain all available years\""},
{'name':'PDF Header','tableName':'Financials','displayFolder':'Credit Review','formatString':'General','expression':"\"Results for FY \" & [Review Financial Year] & \"  |  Currency results in lakh\""}]
(B/'tables.json').write_text(json.dumps(tables,indent=2),encoding='utf-8')
(B/'extra-definitions.json').write_text(json.dumps([td]),encoding='utf-8')
(B/'extra-measures.json').write_text(json.dumps(mm),encoding='utf-8')
allm=json.loads((B/'all-measures.json').read_text()); allm.extend(mm)
(B/'all-measures.json').write_text(json.dumps(allm,indent=2),encoding='utf-8')
