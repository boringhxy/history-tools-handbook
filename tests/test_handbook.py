import json,re,unittest
from pathlib import Path
from urllib.parse import unquote

ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'index.html').read_text()


class HandbookChecks(unittest.TestCase):
    def test_catalogue_records_and_added_platforms(self):
        catalog=json.loads((ROOT/'data/catalog.json').read_text())
        self.assertEqual(len(catalog),119)
        self.assertEqual(len({tool['id'] for tool in catalog}),119)
        for name in ['MARKUS','COMPARATIVUS','Scrivener','Palladio','Epsilon','EMLO']:
            self.assertEqual(sum(tool['name']==name for tool in catalog),1,name)
        self.assertTrue(all(tool['layer']=='核心平台' for tool in catalog if tool['name'] in ['MARKUS','COMPARATIVUS']))

    def test_internal_links_and_unique_ids(self):
        ids=re.findall(r'\bid="([^"]+)"',HTML)
        self.assertEqual(len(ids),len(set(ids)))
        for target in re.findall(r'href="#([^"]+)"',HTML):self.assertIn(target,ids)
        self.assertIn('id="print-all"',HTML)
        self.assertIn('id="catalog-pager"',HTML)
        self.assertNotRegex(HTML,r'<script[^>]+src=')

    def test_font_assets_are_local_and_complete(self):
        styles=re.findall(r'<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"',HTML)
        self.assertEqual(styles,['assets/fonts/fonts.css'])
        css=(ROOT/styles[0]).read_text()
        for url in re.findall(r'url\(([^)]+)\)',css):
            self.assertNotRegex(url,r'^(?:https?:)?//')
            self.assertEqual((ROOT/'assets/fonts'/url).read_bytes()[:4],b'wOF2')

    def test_archive_local_links_and_anchors_resolve(self):
        for file in (ROOT/'docs/reference').glob('*.md'):
            for target in re.findall(r'\]\(([^)]+)\)',file.read_text()):
                if re.match(r'^[a-z]+:',target):continue
                path,_,fragment=unquote(target).partition('#')
                destination=(file.parent/path).resolve() if path else file
                self.assertTrue(destination.is_file(),(file.name,target))
                if fragment and destination.suffix=='.md':
                    self.assertIn('id="'+fragment+'"',destination.read_text(),(file.name,target))


if __name__=='__main__':unittest.main()
