import math, random, sys
random.seed(7)
W, H = 1200, 470
X0, X1 = 150, 910
L = 20000
def gx(p): return X0 + p / L * (X1 - X0)
INK, MUTED, CARD, BOX, BOXS = '#1f2328', '#59636e', '#ffffff', '#eef1f4', '#c3cad3'
REF, A, B, C = '#8c959f', '#cf222e', '#0969da', '#bf8700'
DEL, INS, INV = (3000, 9000), (12000, 3000), (15000, 17000)
rows = {'B': 0, 'ref': 10, 'C': 20, 'A': 30}
col = {'B': B, 'ref': REF, 'C': C, 'A': A}
out = []
def t(x, y, s, size=14, fill=INK, w='400', anchor='start', style=''):
    out.append(f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" fill="{fill}" font-weight="{w}" text-anchor="{anchor}" {style}>{s}</text>')

def small_diffs():
    ds = []
    for tr in 'BCA':
        mine = []
        for _ in range(60):
            p = random.uniform(400, L - 400)
            if any(lo - 300 < p < hi + 300 for lo, hi in [DEL, (INS[0] - 200, INS[0] + 2000), INV]):
                continue
            if any(abs(p - q) < 400 for q in mine) or len(mine) >= 14:
                continue
            mine.append(p)
            size = 1 if random.random() < .4 else round(10 ** random.uniform(0.3, 2.85))
            ds.append((p, tr, size))
    ds.sort()
    return ds
diffs = small_diffs()

def backbone(y0, cuts):
    cuts = [0] + sorted(cuts) + [L]
    for a, b in zip(cuts, cuts[1:]):
        xa, xb = gx(a) + 1.2, gx(b) - 1.2
        if xb > xa:
            out.append(f'<rect x="{xa:.1f}" y="{y0-8}" width="{xb-xa:.1f}" height="46" rx="3" fill="{BOX}" stroke="{BOXS}" stroke-width="1"/>')

def track(y0, tr, before):
    y = y0 + rows[tr]
    c = col[tr]
    d = [f'M{X0-6},{y}']
    events = []
    if before:
        events += [(p, 'bump') for p, t2, s in diffs if t2 == tr]
    if tr == 'A': events.append((DEL[0], 'del'))
    if tr == 'B': events.append((INS[0], 'ins'))
    events.sort()
    for p, kind in events:
        x = gx(p)
        if kind == 'bump':
            dy = -6 if tr == 'B' else 6
            d.append(f'L{x-5:.1f},{y} Q{x:.1f},{y+dy*1.8} {x+5:.1f},{y}')
        elif kind == 'del':
            x2 = gx(DEL[1])
            d.append(f'L{x:.1f},{y} C{x+30:.1f},{y+46} {x2-30:.1f},{y+46} {x2:.1f},{y}')
        elif kind == 'ins':
            bx = x + 12
            d.append(f'L{x-14:.1f},{y} C{x-2:.1f},{y} {x-6:.1f},{y0-48} {bx:.1f},{y0-48} L{bx+64:.1f},{y0-48} C{bx+80:.1f},{y0-48} {x+70:.1f},{y} {x+86:.1f},{y}')
    d.append(f'L{X1+6},{y}')
    out.append(f'<path d="{" ".join(d)}" fill="none" stroke="{c}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>')
    if tr == 'C':
        xa, xb = gx(INV[0]), gx(INV[1])
        out.append(f'<line x1="{xa+3:.1f}" y1="{y}" x2="{xb-3:.1f}" y2="{y}" stroke="{BOX}" stroke-width="4"/>')
        n = 4
        for i in range(n):
            cx = xa + (i + .5) * (xb - xa) / n
            out.append(f'<path d="M{cx+5:.1f},{y-5} L{cx-5:.1f},{y} L{cx+5:.1f},{y+5} Z" fill="{c}"/>')

def ins_box(y0):
    x = gx(INS[0]) + 12
    out.append(f'<rect x="{x-6:.1f}" y="{y0-58}" width="76" height="20" rx="3" fill="#ddeaff" stroke="{B}" stroke-width="1"/>')

def panel(y0, before):
    cuts = [p for p, _, _ in diffs] if before else []
    cuts += [DEL[0], DEL[1], INS[0], INV[0], INV[1]]
    backbone(y0, cuts)
    ins_box(y0)
    for tr in ['ref', 'B', 'C', 'A']:
        track(y0, tr, before)

out.append(f'<rect width="{W}" height="{H}" rx="12" fill="{CARD}"/>')
t(40, 46, 'graph-fold hides the tiny differences between genomes and keeps the big ones', 21, w='600')
t(40, 70, 'Each colored line is one person’s DNA, read left to right along the genome. The gray line is the reference genome they are all compared to.', 13.5, MUTED)
t(40, 262, '▼ fold', 15, '#9a6700', w='600')
t(40, 280, 'by the rule', 12.5, MUTED)
t(40, 295, 'on the right', 12.5, MUTED)

y1 = 140
t(40, y1 + 10, 'Before', 17, w='600')
t(40, y1 + 29, 'every difference,', 12.5, MUTED)
t(40, y1 + 44, 'even one letter,', 12.5, MUTED)
t(40, y1 + 59, 'is a branch', 12.5, MUTED)
panel(y1, True)
t(X1, y1 + 92, 'a real 21 kb stretch: 1,655 pieces, drawn 86,000 px wide', 12.5, MUTED, anchor='end')

RX = 960
out.append(f'<rect x="{RX - 14}" y="96" width="{W - RX - 16}" height="{H - 120}" rx="10" fill="#f6f8fa" stroke="{BOXS}" stroke-width="1"/>')
t(RX + 4, 126, 'The rule', 17, w='600')
t(RX + 4, 145, 'every difference, sorted', 12.5, MUTED)
t(RX + 4, 160, 'by size in letters', 12.5, MUTED)
YT, YB, AX = 190, H - 50, RX + 54
def sy(bp): return YB - math.log10(bp) / 5 * (YB - YT)
thr = sy(1000)
out.append(f'<rect x="{AX - 4}" y="{YT - 8}" width="{W - 30 - AX + 4}" height="{thr - YT + 8:.1f}" rx="6" fill="#fff4e5"/>')
out.append(f'<line x1="{AX}" y1="{YT}" x2="{AX}" y2="{YB}" stroke="{BOXS}" stroke-width="1.5"/>')
for bp, lab in [(1, '1'), (10, '10'), (100, '100'), (10000, '10,000'), (100000, '100,000')]:
    y = sy(bp)
    out.append(f'<line x1="{AX - 4}" y1="{y:.1f}" x2="{AX + 4}" y2="{y:.1f}" stroke="{BOXS}" stroke-width="1.5"/>')
    t(AX - 8, y + 4, lab, 11.5, MUTED, anchor='end')
stacks = {}
for p, tr, s in sorted(diffs, key=lambda d: d[2]):
    k = round(sy(s) / 8)
    n = stacks.get(k, 0); stacks[k] = n + 1
    out.append(f'<circle cx="{AX + 10 + (n % 11) * 8:.1f}" cy="{k * 8 - (n // 11) * 8:.1f}" r="3.3" fill="{col[tr]}"/>')
for i, (bp, tr) in enumerate([(6000, 'A'), (3000, 'B'), (2000, 'C')]):
    out.append(f'<circle cx="{AX + 14 + i * 14}" cy="{sy(bp):.1f}" r="5.5" fill="{col[tr]}"/>')
out.append(f'<line x1="{AX - 10}" y1="{thr:.1f}" x2="{W - 30}" y2="{thr:.1f}" stroke="{INK}" stroke-width="2" stroke-dasharray="5 4"/>')
t(AX - 8, thr + 4, '1,000', 11.5, INK, w='600', anchor='end')
t(W - 34, thr + 16, 'you pick this line', 11.5, INK, w='600', anchor='end')
t(AX + 10, sy(30000) + 4, 'bigger: kept', 13, '#9a6700', w='600')
t(AX + 44, sy(40), 'smaller: merged', 13, MUTED)
t(AX + 44, sy(40) + 16, 'into the reference', 13, MUTED)

y2 = 320
t(40, y2 + 10, 'After', 17, w='600')
t(40, y2 + 29, 'only the big', 12.5, MUTED)
t(40, y2 + 44, 'changes remain', 12.5, MUTED)
panel(y2, False)
t(gx(INS[0]) + 88, y2 - 44, 'insertion: 3,000 extra letters', 12.5, B, w='600')
t((gx(DEL[0]) + gx(DEL[1])) / 2, y2 + 82, 'deletion: skips 6,000 letters', 12.5, A, w='600', anchor='middle')
t((gx(INV[0]) + gx(INV[1])) / 2, y2 + 60, 'inversion: read backwards', 12.5, '#9a6700', w='600', anchor='middle')
t(X1, y2 + 100, 'the same real stretch: 3 pieces, 504 px wide', 12.5, MUTED, anchor='end')

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif">
<title>graph-fold: before and after</title>
{chr(10).join(out)}
</svg>
'''
open(sys.argv[1], 'w').write(svg)
