import json,re,unittest
from pathlib import Path
HTML=(Path(__file__).resolve().parents[1] / 'index.html').read_text()
def data(name):
    m=re.search(r'id="'+name+r'">(.*?)</script>',HTML,re.S)
    assert m, f'missing data block: {name}'
    return json.loads(m[1])
class HandbookChecks(unittest.TestCase):
    def test_core_and_catalog(self):
        core=data('core-platforms-data'); catalog=data('tool-catalog-data')
        self.assertEqual(len(core),25)
        self.assertEqual(re.search(r'data-core-count="(\d+)"',HTML)[1],'25')
        self.assertEqual(len({p['id'] for p in core}),25)
        self.assertEqual(len(catalog),115)
        self.assertTrue({'docusky','dedu'} <= {p['id'] for p in core})
    def test_comparison_evidence(self):
        topic=data('focus-platforms-data')
        self.assertEqual(len(topic),5)
        for p in topic:
            self.assertEqual(len(p['tasks']),12)
            self.assertTrue(p['sources'])
            for cell in p['tasks']:
                self.assertIn(cell['mode'],['平台内完成','需外部工具','非主要用途','待确认'])
                self.assertIn(cell['evidence'],['官方说明','公开证据不足'])
                self.assertTrue(cell['note'])
                self.assertTrue(cell['source'] < len(p['sources']))
    def test_material_interpretation(self):
        materials=data('material-reading-data')
        self.assertEqual(len(materials),7)
        for item in materials:
            self.assertEqual(len(item['platforms']),5)
            for field in ['unit','question','limit','context']:
                self.assertTrue(item[field])
        self.assertIn('id="material-reading"',HTML)
        self.assertIn('id="reading-example"',HTML)

    def test_chapter_structure(self):
        pages=re.findall(r'<div class="chapter-page" data-page="([^"]+)"',HTML)
        self.assertEqual(set(pages),{'home','intro','comparison','reading','catalog','workflows','methods'})
        self.assertEqual(len(pages),7)
        nav=re.findall(r'data-primary-page="([^"]+)"',HTML)
        self.assertEqual(len(nav),7)
        self.assertEqual(set(nav),set(pages))
        for key in ['print-all','profiles-pager','catalog-pager','profile-search']:
            self.assertTrue('id="'+key+'"' in HTML,key)

    def test_links_and_cases(self):
        ids=re.findall(r'\bid="([^"]+)"',HTML)
        self.assertEqual(len(ids),len(set(ids)))
        for a in re.findall(r'href="#([^"]+)"',HTML):
            self.assertIn(a,ids)
        for case in ['case-edition','case-periodical','case-extraction']:
            self.assertIn(case,ids)
        self.assertNotRegex(HTML,r'<script[^>]+src=')
        self.assertNotRegex(HTML,r'<link[^>]+rel="stylesheet"')
if __name__=='__main__': unittest.main()
