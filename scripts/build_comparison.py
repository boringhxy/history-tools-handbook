#!/usr/bin/env python3
"""Inline local comparison sources so the published handbook remains offline-readable."""
import argparse
import json
import re
from pathlib import Path
from build_comparison_data import build
ROOT = Path(__file__).resolve().parents[1]

def replace_block(html, name, content, anchor):
    start, end = f'<!-- {name}_BEGIN -->', f'<!-- {name}_END -->'
    block = start + '\n' + content + '\n' + end
    pattern = re.escape(start) + r'.*?' + re.escape(end)
    if re.search(pattern, html, re.S):
        return re.sub(pattern, lambda _: block, html, flags=re.S)
    if anchor not in html: raise ValueError('Missing integration anchor for ' + name)
    return html.replace(anchor, block + '\n' + anchor, 1)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check',action='store_true',help='Fail if generated page or data is stale')
    args=parser.parse_args()
    page=ROOT/'index.html';original=page.read_text();html=original
    data=build(page)
    dataset=json.dumps(data,ensure_ascii=False,indent=2)+'\n'
    style='<style id="comparison-styles">\n'+(ROOT/'comparison/styles.css').read_text()+'\n</style>'
    html=replace_block(html,'COMPARISON_STYLE',style,'</head>')
    html=replace_block(html,'COMPARISON_VIEW',(ROOT/'comparison/view.html').read_text(),'<section class="section focus-section" data-subpanel id="focus-comparison">')
    compact=json.dumps(data,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')
    runtime='<script type="application/json" id="comparison-platforms-data">'+compact+'</script>\n'
    for file in ['engine.js','ui.js']:
        code=(ROOT/'comparison'/file).read_text()
        if re.search(r'</script',code,re.I):raise ValueError('Unsafe script delimiter in '+file)
        runtime+='<script>\n'+code+'\n</script>\n'
    html=replace_block(html,'COMPARISON_RUNTIME',runtime,'</body>')
    html=html.replace('<a data-primary-page="comparison" href="#matrix">','<a data-primary-page="comparison" href="#compare">')
    html=re.sub(r'(<div class="chapter-page" data-page="comparison" id="page-comparison">)<nav class="page-subnav screen-only".*?</nav>',r'\1',html,count=1,flags=re.S)
    html=html.replace('<a data-primary-page="comparison" href="#compare">核心平台比较</a>','<a data-primary-page="comparison" href="#compare">平台对比</a>')
    html=html.replace("route.page === 'comparison' ? document.getElementById('matrix')", "route.page === 'comparison' ? document.getElementById('compare')")
    html=html.replace('<a href="#matrix"><span>03</span>', '<a href="#compare"><span>03</span>')
    config='<meta name="comparison-api-base" content="">'
    if 'name="comparison-api-base"' not in html:
        html=html.replace('<meta charset="utf-8">','<meta charset="utf-8">\n  '+config,1)
    if args.check:
        if html != original or dataset != (ROOT/'data/platforms.json').read_text():
            raise SystemExit('Comparison generated assets are stale; run python3 scripts/build_comparison.py')
        print('Comparison page and 122-object data are up to date')
    else:
        page.write_text(html);(ROOT/'data/platforms.json').write_text(dataset)
        print('Built single-file comparison workbench with',len(data['platforms']),'objects')

if __name__=='__main__':main()
