import re,os,sys
root=sys.argv[1]
def slug(h):
    h=re.sub(r'\[([^\]]*)\]\([^)]*\)',r'\1',h).strip().lower()
    h=re.sub(r'[^\w\- ]','',h)
    return h.replace(' ','-')
anch={}
files=[]
for d,_,fs in os.walk(root):
    if 'node_modules' in d or '.git' in d: continue
    for f in fs:
        if f.endswith('.md'): files.append(os.path.join(d,f))
for p in files:
    s=set()
    for l in open(p):
        m=re.match(r'#+\s+(.*)',l)
        if m: s.add(slug(m.group(1)))
    anch[os.path.normpath(p)]=s
bad=0
for p in files:
    if '/specs/' in p or '/plans/' in p: continue
    for i,l in enumerate(open(p),1):
        for t in re.findall(r'\]\(([^)\s]+\.md)#([^)]+)\)',l):
            tgt=os.path.normpath(os.path.join(os.path.dirname(p),t[0]))
            if tgt in anch and t[1] not in anch[tgt]:
                print(f"{os.path.relpath(p,root)}:{i} -> {t[0]}#{t[1]}"); bad+=1
            elif tgt not in anch: print(f"{os.path.relpath(p,root)}:{i} MISSING FILE {t[0]}"); bad+=1
print("bad",bad)
