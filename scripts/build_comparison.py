#!/usr/bin/env python3
"""Inline local comparison sources so the published handbook remains offline-readable."""
import argparse
import json
import re
from pathlib import Path
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
    data=json.loads((ROOT/'data/platforms.json').read_text())
    catalog=json.loads((ROOT/'data/catalog.json').read_text())
    style='<style id="comparison-styles">\n'+(ROOT/'comparison/styles.css').read_text()+'\n</style>'
    html=replace_block(html,'COMPARISON_STYLE',style,'</head>')
    catalog_style='<style id="catalog-design-styles">\n'+(ROOT/'catalog.css').read_text()+'\n</style>'
    html=replace_block(html,'CATALOG_STYLE',catalog_style,'</head>')
    html=replace_block(html,'COMPARISON_VIEW',(ROOT/'comparison/view.html').read_text(),'</main>')
    catalog_data='<script type="application/json" id="tool-catalog-data">'+json.dumps(catalog,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')+'</script>'
    html=replace_block(html,'CATALOG_DATA',catalog_data,'</body>')
    search_config=json.loads((ROOT/'data/catalog-search.json').read_text())
    search_data='<script type="application/json" id="catalog-search-data">'+json.dumps(search_config,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')+'</script>'
    html=replace_block(html,'CATALOG_SEARCH_DATA',search_data,'<!-- CATALOG_RUNTIME_BEGIN -->')
    catalog_code=(ROOT/'catalog.js').read_text()
    if re.search(r'</script',catalog_code,re.I):raise ValueError('Unsafe script delimiter in catalog.js')
    html=replace_block(html,'CATALOG_RUNTIME','<script>\n'+catalog_code+'\n</script>','</body>')
    compact=json.dumps(data,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')
    runtime='<script type="application/json" id="comparison-platforms-data">'+compact+'</script>\n'
    for file in ['engine.js','ui.js']:
        code=(ROOT/'comparison'/file).read_text()
        if re.search(r'</script',code,re.I):raise ValueError('Unsafe script delimiter in '+file)
        runtime+='<script>\n'+code+'\n</script>\n'
    html=replace_block(html,'COMPARISON_RUNTIME',runtime,'</body>')
    config='<meta name="comparison-api-base" content="">'
    if 'name="comparison-api-base"' not in html:
        html=html.replace('<meta charset="utf-8">','<meta charset="utf-8">\n  '+config,1)
    if args.check:
        if html != original:
            raise SystemExit('Comparison generated assets are stale; run python3 scripts/build_comparison.py')
        print('Comparison page and 122-object data are up to date')
    else:
        page.write_text(html)
        print('Built single-file comparison workbench with',len(data['platforms']),'objects')

if __name__=='__main__':main()
