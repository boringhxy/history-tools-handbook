"""Explicit Playwright acceptance; normal unittest discovery needs no browser package."""
import argparse,json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url',default='http://127.0.0.1:8878')
    parser.add_argument('--screenshots',type=Path)
    args=parser.parse_args()
    from playwright.sync_api import sync_playwright
    if args.screenshots:args.screenshots.mkdir(parents=True,exist_ok=True)
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='chrome',headless=True)
        context=browser.new_context(viewport={'width':1440,'height':1000},permissions=['clipboard-read','clipboard-write'])
        page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        def goto(fragment=''):
            page.goto(args.url.rstrip('/')+'/'+fragment,wait_until='networkidle')
            page.evaluate('document.fonts.ready')
        def cards():return page.locator('#catalog-grid .tool-card:visible').count()
        goto()
        assert page.url.endswith('#home')
        assert page.locator('[data-primary-page]').all_text_contents()==['首页','平台目录','平台对比']
        assert page.locator('.chapter-page').count()==3
        assert page.locator('#home-title').is_visible()
        page.locator('[data-primary-page="catalog"]').click()
        assert cards()==0
        layout=[]
        for width in [320,390,768,1440]:
            page.set_viewport_size({'width':width,'height':844 if width<768 else 1000})
            for fragment,name in [('#home','home'),('#catalog','catalog'),('#compare','comparison')]:
                goto(fragment)
                page.wait_for_function('(name)=>document.body.dataset.currentPage===name',arg=name)
                assert page.locator('.chapter-page:visible').count()==1
                assert page.locator(f'.chapter-page[data-page="{name}"]').is_visible()
                assert page.locator(f'[data-primary-page="{name}"]').get_attribute('aria-current')=='page'
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),(width,name)
                if name=='catalog':
                    assert page.locator('#search-input').is_visible()
                    assert page.locator('#catalog-grid').is_hidden()
                    assert page.locator('#print-button').is_hidden()
                elif name=='comparison':
                    assert page.locator('#cmp-tbody tr[data-dimension]').count()==13
                layout.append({'width':width,'page':name})
                if args.screenshots and width in [390,1440]:
                    page.mouse.move(0,200)
                    page.evaluate('document.activeElement.blur()')
                    page.screenshot(path=str(args.screenshots/f'{name}-{width}.png'),full_page=False)
        goto('#catalog');counts=[]
        assert cards()==0
        page.locator('#clear-filters').click();assert cards()==119
        page.locator('#clear-filters').click();assert cards()==0
        assert page.locator('#clear-filters').get_attribute('aria-expanded')=='false'
        page.locator('#search-input').fill('zotero');assert cards()==0
        page.locator('#catalog-search-submit').click();assert cards()==1
        page.locator('#search-input').fill('不存在xyz');page.locator('#catalog-search-submit').click();assert page.locator('.empty-state').is_visible()
        page.locator('#clear-filters').click();assert cards()==119
        assert page.locator('#catalog-pager').is_hidden()
        page.locator('#search-input').fill('古籍');page.locator('#catalog-search-submit').click()
        assert cards()==int(page.locator('#catalog-count').inner_text())>0
        page.locator('#search-input').press('Enter');assert page.url.endswith('#catalog')
        page.locator('#clear-filters').click()
        goto('#unknown');assert page.url.endswith('#home')
        page.locator('[data-primary-page="comparison"]').click()
        page.wait_for_function("document.body.dataset.currentPage==='comparison'")
        page.go_back(wait_until='networkidle');assert page.locator('#home').is_visible()
        goto('?ca=shidian&cb=dedu#compare')
        page.wait_for_function("!document.querySelector('#cmp-service-status').textContent.includes('正在检查')")
        assert page.locator('#cmp-send').is_disabled()
        assert '未配置' in page.locator('#cmp-service-status').inner_text()
        for option in page.locator('#cmp-task option').evaluate_all('(els)=>els.map(e=>e.value).filter(Boolean)'):
            page.locator('#cmp-task').select_option(option);assert page.locator('#cmp-tbody tr[data-dimension]').count()==1
        page.locator('#cmp-reset-filters').click()
        page.locator('#cmp-search-a').fill('ZOTERO');page.locator('#cmp-search-a').press('Enter')
        assert page.locator('#cmp-search-a').input_value()=='Zotero'
        page.locator('#cmp-swap').click();assert page.locator('#cmp-search-b').input_value()=='Zotero'
        page.locator('#cmp-copy').click();report=page.evaluate('navigator.clipboard.readText()')
        assert 'Zotero' in report and '处理成果与导出方式' in report
        page.locator('#cmp-share').click();assert 'cb=zotero' in page.evaluate('navigator.clipboard.readText()')
        page.route('**/api/status',lambda r:r.fulfill(json={'available':True,'message':'测试夹具','dailyLimit':5,'remaining':5,'webSearchAvailable':False}))
        page.route('**/api/chat',lambda r:r.fulfill(json={'answer':'界面验收夹具，非真实研究回答。','sources':[],'remaining':4,'checkedAt':'2026-10-30','webChecked':False}))
        page.locator('#cmp-reconnect').click();page.wait_for_function("!document.querySelector('#cmp-send').disabled")
        page.locator('#cmp-question').fill('测试保留的研究助手');page.locator('#cmp-send').click()
        page.wait_for_selector('.cmp-answer-meta')
        assert page.locator('#cmp-chat-log .cmp-message').count()==2
        page.unroute('**/api/status');page.unroute('**/api/chat')
        page.set_viewport_size({'width':390,'height':844})
        page.locator('#cmp-tab-chat').click();page.locator('#cmp-goal').fill('版本对读')
        page.locator('#cmp-tab-table').click();page.locator('#cmp-tab-chat').click()
        assert page.locator('#cmp-goal').input_value()=='版本对读'
        if args.screenshots:page.screenshot(path=str(args.screenshots/'assistant-390.png'),full_page=True)
        comparison_details=page.locator('#compare details').evaluate_all('(els)=>els.map(e=>e.open)')
        page.evaluate("window.print=()=>window.dispatchEvent(new Event('beforeprint'))")
        page.locator('#cmp-print').click();page.emulate_media(media='print')
        assert page.locator('#cmp-table-panel').is_visible() and not page.locator('#catalog').is_visible()
        assert page.locator('#compare details:not([open])').count()==0
        page.emulate_media(media='screen');page.evaluate("window.dispatchEvent(new Event('afterprint'))")
        assert 'print-comparison' not in (page.locator('body').get_attribute('class') or '')
        assert page.locator('#compare details').evaluate_all('(els)=>els.map(e=>e.open)')==comparison_details
        goto('#catalog');page.locator('#search-input').fill('OCR');page.locator('#catalog-search-submit').click()
        assert cards()==22
        assert page.locator('#catalog-workspace').is_visible()
        page.locator('#facet-materials-0').check()
        assert 0<cards()<22
        assert page.locator('#catalog-grid .tool-card:visible').evaluate_all('(cards)=>cards.every(card=>card.textContent.includes("古籍"))')
        page.locator('#catalog-reset-facets').click();assert cards()==22
        before={'count':page.locator('#catalog-count').inner_text(),'visible':cards(),'query':page.locator('#search-input').input_value()}
        page.evaluate("window.print=()=>window.dispatchEvent(new Event('beforeprint'))")
        page.locator('#print-button').click();page.emulate_media(media='print')
        assert cards()==int(before['count'])
        page.emulate_media(media='screen');page.evaluate("window.dispatchEvent(new Event('afterprint'))")
        page.locator('#print-all').click();page.emulate_media(media='print');assert cards()==119
        page.emulate_media(media='screen');page.evaluate("window.dispatchEvent(new Event('afterprint'))")
        assert before=={'count':page.locator('#catalog-count').inner_text(),'visible':cards(),'query':page.locator('#search-input').input_value()}
        page.reload(wait_until='networkidle');page.evaluate("window.print=()=>window.dispatchEvent(new Event('beforeprint'))");page.locator('#clear-filters').click()
        detail=page.locator('#catalog-grid .tool-card:visible details').first
        detail.evaluate('(e)=>e.open=true')
        second_page=page.locator('#catalog-pager [data-page-label]').inner_text()
        page.locator('#print-all').click();page.emulate_media(media='print');assert cards()==119
        page.emulate_media(media='screen');page.evaluate("window.dispatchEvent(new Event('afterprint'))")
        assert page.locator('#catalog-pager [data-page-label]').inner_text()==second_page
        assert cards()==119 and detail.evaluate('(e)=>e.open')
        offline=context.new_page();offline.goto(ROOT.as_uri()+'/index.html',wait_until='networkidle')
        assert offline.locator('#home-title').is_visible()
        offline.locator('[data-primary-page="catalog"]').click()
        assert offline.locator('#catalog-grid .tool-card:visible').count()==0
        offline.locator('#clear-filters').click()
        assert offline.locator('#catalog-grid .tool-card:visible').count()==119
        offline.locator('[data-primary-page="comparison"]').click();offline.wait_for_selector('#cmp-tbody tr')
        assert '离线' in offline.locator('#cmp-service-status').inner_text()
        offline.close();assert errors==[],errors
        if args.screenshots:(args.screenshots/'verification.json').write_text(json.dumps({'layouts':layout,'pagination':counts,'scriptErrors':errors,'archiveDocuments':7,'chat':'fixture only'},ensure_ascii=False,indent=2))
        browser.close()
    print('Three-page browser acceptance passed:12 layouts,119-item pagination/filters,comparison/chat/copy/tabs,print restore and file offline.')


if __name__=='__main__':main()
