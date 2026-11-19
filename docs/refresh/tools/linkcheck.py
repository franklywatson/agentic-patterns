import re,os,sys,glob
root=sys.argv[1]
def slug(h):
    h=re.sub(r"\[([^\]]*)\]\([^)]*\)",r"\1",h).strip().lower()
    h=re.sub(r'[^\w\- ]','',h)
    return h.replace(' ','-')
anchors={}
files=glob.glob(root+'/**/*.md',recursive=True)
# Skip node_modules and the verbatim review records, which quote broken references as findings.
files=[f for f in files if 'node_modules' not in f and '/docs/refresh/reviews/' not in os.path.abspath(f)]
for f in files:
    s=set()
    for line in open(f):
        m=re.match(r'^(#+)\s+(.*)',line)
        if m: s.add(slug(m.group(2)))
    anchors[os.path.abspath(f)]=s
bad=0
for f in files:
    txt=open(f).read()
    txt=re.sub(r'```.*?```','',txt,flags=re.S)
    txt=re.sub(r'`[^`\n]*`','',txt)
    for m in re.finditer(r'\]\(([^)\s]+)\)',txt):
        l=m.group(1)
        if l.startswith('http') or l.startswith('mailto'): continue
        path,_,anc=l.partition('#')
        tgt=os.path.abspath(os.path.join(os.path.dirname(f),path)) if path else os.path.abspath(f)
        if not os.path.exists(tgt):
            print('MISSING',os.path.relpath(f,root),l); bad+=1; continue
        if anc and tgt.endswith('.md') and anc not in anchors.get(tgt,set()):
            print('ANCHOR',os.path.relpath(f,root),l); bad+=1
    for m in re.finditer(r'@([\w./-]+\.md)(#[\w-]+)?',txt):
        p=m.group(1); anc=(m.group(2) or '')[1:]
        cands=[os.path.join(root,p),os.path.join(os.path.dirname(f),p),os.path.join(root,'docs',p)]
        t=[c for c in cands if os.path.exists(c)]
        if not t: print('ATMISSING',os.path.relpath(f,root),m.group(0)); bad+=1; continue
        if anc and anc not in anchors.get(os.path.abspath(t[0]),set()):
            print('ATANCHOR',os.path.relpath(f,root),m.group(0)); bad+=1
print('total issues',bad)
