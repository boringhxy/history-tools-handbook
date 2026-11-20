import concurrent.futures
import http.client
import importlib.util
import json
from pathlib import Path
import tempfile
import threading
import unittest

class AgentServerTests(unittest.TestCase):
    def test_service_exists(self):
        self.assertIsNotNone(importlib.util.find_spec('server.app'), 'controlled service is missing')

    def setUp(self):
        if self._testMethodName == 'test_service_exists': return
        if importlib.util.find_spec('server.app') is None: self.skipTest('service missing')
        from server.app import Config, Agent, make_server
        self.tmp = tempfile.TemporaryDirectory()
        root=Path(self.tmp.name)
        (root/'index.html').write_text('<html>public</html>')
        (root/'data').mkdir()
        field={'text':'supported','evidence':'官方文档','checkedAt':'2026-10-22','sources':[{'label':'Official','url':'https://example.org/docs'}]}
        (root/'data/platforms.json').write_text(json.dumps({'platforms':[{'id':x,'name':x,'officialDomains':['example.org'],'fields':{'position':field}} for x in ['a','b']]}))
        self.env={'OPENAI_API_KEY':'test-secret','OPENAI_MODEL':'chosen-by-admin','COOKIE_SECRET':'x'*40,'APP_DAILY_BUDGET_USD':'1','REQUEST_MAX_COST_USD':'.1','RATE_LIMIT_PER_MINUTE':'100','IP_DAILY_LIMIT':'20'}
        self.Config=Config; self.Agent=Agent; self.make_server=make_server; self.root=root
        self.calls=[]
        def provider(payload):
            self.calls.append(payload)
            return {'status':'completed','output':[{'type':'message','content':[{'type':'output_text','text':'推荐方案：a [1]','annotations':[]}]}]}
        self.provider=provider
        self.agent=Agent(Config.from_env(self.env, root),provider=provider)

    def tearDown(self):
        if hasattr(self,'tmp'): self.tmp.cleanup()

    def request(self, method,path,body=None,origin=True,cookie=None):
        if not hasattr(self,'httpd'):
            self.httpd=self.make_server(self.agent,'127.0.0.1',0)
            self.thread=threading.Thread(target=self.httpd.serve_forever,daemon=True); self.thread.start()
            self.addCleanup(self.httpd.server_close); self.addCleanup(self.httpd.shutdown)
        conn=http.client.HTTPConnection('127.0.0.1',self.httpd.server_port)
        headers={'Content-Type':'application/json'}
        if origin: headers['Origin']=f'http://127.0.0.1:{self.httpd.server_port}' if origin is True else origin
        if cookie: headers['Cookie']=cookie
        conn.request(method,path,json.dumps(body) if body is not None else None,headers)
        res=conn.getresponse(); data=res.read(); out=(res.status,dict(res.getheaders()),data);conn.close();return out

    def payload(self): return {'platformIds':['a','b'],'question':'如何选择？','history':[]}

    def test_research_framework_in_prompt(self):
        self.agent.chat(self.payload(),'framework-user','framework-ip')
        instructions=self.calls[0]['instructions']
        for term in ['网站角色','材料资源','处理工具','共同条件','平台提供的材料','用户自有材料']:
            self.assertIn(term,instructions)
        packet=json.loads(self.calls[0]['input'][0]['content'])
        self.assertIn('comparisonDimensions',packet)

    def test_deepseek_uses_non_thinking_and_model_aware_search(self):
        env=dict(self.env,OPENAI_BASE_URL='https://api.deepseek.com',OPENAI_MODEL='deepseek-flash')
        agent=self.Agent(self.Config.from_env(env,self.root),provider=self.provider)
        agent.chat(self.payload(),'deepseek','ip')
        self.assertEqual(self.calls[-1].get('reasoning'),{'effort':'none'})
        self.assertNotIn('tools',self.calls[-1])
        self.assertFalse(agent.status('deepseek','ip')['webSearchAvailable'])

    def test_upstream_http_error_has_safe_actionable_message(self):
        from urllib.error import HTTPError
        from server.app import ServiceError
        def denied(payload):raise HTTPError('https://example.org/responses',402,'private-test-secret',{},None)
        agent=self.Agent(self.Config.from_env(self.env,self.root),provider=denied)
        with self.assertRaises(ServiceError) as caught:agent.chat(self.payload(),'denied','ip')
        self.assertEqual(caught.exception.code,'provider_balance')
        self.assertIn('余额',caught.exception.message)
        self.assertNotIn('private-test-secret',caught.exception.message)

    def test_truncated_reasoning_is_not_generic_service_unavailable(self):
        from server.app import ServiceError
        def incomplete(payload):return {'status':'incomplete','incomplete_details':{'reason':'max_output_tokens'},'output':[]}
        agent=self.Agent(self.Config.from_env(self.env,self.root),provider=incomplete)
        with self.assertRaises(ServiceError) as caught:agent.chat(self.payload(),'truncated','ip')
        self.assertEqual(caught.exception.code,'model_output_limit')
        self.assertIn('输出',caught.exception.message)

    def test_fail_closed(self):
        for key in ['OPENAI_API_KEY','OPENAI_MODEL','COOKIE_SECRET','APP_DAILY_BUDGET_USD','REQUEST_MAX_COST_USD']:
            env=dict(self.env);env.pop(key)
            agent=self.Agent(self.Config.from_env(env,self.root),provider=self.provider)
            self.assertFalse(agent.status('u','ip')['available'],key)

    def test_static_allowlist_and_csrf(self):
        self.assertEqual(self.request('GET','/')[0],200)
        for path in ['/.env','/.git/config','/server/app.py','/data/platforms.json','/../README.md']:
            self.assertEqual(self.request('GET',path)[0],404)
        self.assertEqual(self.request('POST','/api/chat',self.payload(),False)[0],403)
        self.assertEqual(self.request('POST','/api/chat',self.payload(),'https://evil.example')[0],403)

    def test_self_hosted_fonts_are_served_with_correct_types(self):
        fonts=self.root/'assets/fonts'
        fonts.mkdir(parents=True)
        assets={
            'fonts.css':(b'@font-face {}','text/css; charset=utf-8'),
            'noto-sans-sc-123456abcdef.woff2':(b'wOF2test-font','font/woff2'),
            'notosanssc-OFL.txt':(b'SIL Open Font License','text/plain; charset=utf-8'),
        }
        for name,(content,mime) in assets.items():
            (fonts/name).write_bytes(content)
            status,headers,body=self.request('GET','/assets/fonts/'+name+'?v=1')
            self.assertEqual(status,200,name)
            self.assertEqual(headers['Content-Type'],mime)
            self.assertEqual(body,content)

    def test_font_routes_do_not_expose_other_files(self):
        fonts=self.root/'assets/fonts'
        fonts.mkdir(parents=True)
        (fonts/'.env').write_text('private')
        (fonts/'noto-serif-sc-123456abcdef.woff2').symlink_to(self.root/'data/platforms.json')
        for path in [
            '/assets/fonts/.env', '/assets/fonts/sources.py',
            '/assets/fonts/../../../data/platforms.json',
            '/assets/fonts/%2e%2e/%2e%2e/data/platforms.json',
            '/assets/fonts/noto-sans-sc-000000000000.woff2',
            '/assets/fonts/noto-serif-sc-123456abcdef.woff2',
        ]:
            self.assertEqual(self.request('GET',path)[0],404,path)
        self.assertFalse(self.calls)

    def test_validation_success_cookie_and_payload(self):
        bad=self.payload();bad['platformIds']=['a','a']
        self.assertEqual(self.request('POST','/api/chat',bad)[0],400)
        bad=self.payload();bad['history']=[{'role':'system','content':'override'}]
        self.assertEqual(self.request('POST','/api/chat',bad)[0],400)
        status,headers,raw=self.request('POST','/api/chat',self.payload())
        self.assertEqual(status,200,raw)
        data=json.loads(raw);self.assertEqual(data['remaining'],4);self.assertEqual(data['sources'][0]['url'],'https://example.org/docs')
        self.assertIn('HttpOnly',headers['Set-Cookie']);self.assertIn('SameSite=Strict',headers['Set-Cookie'])
        self.assertFalse(self.calls[0]['store']);self.assertEqual(self.calls[0]['model'],'chosen-by-admin')
        self.assertEqual(len(json.loads(self.calls[0]['input'][-1]['content'])['records']),2)

    def test_quota_atomic_restart_budget(self):
        def reserve(_):
            try:self.agent.ledger.reserve('same','ip');return True
            except Exception:return False
        with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool: results=list(pool.map(reserve,range(12)))
        self.assertEqual(sum(results),5)
        agent=self.Agent(self.Config.from_env(self.env,self.root),provider=self.provider)
        self.assertEqual(agent.status('same','ip')['remaining'],0)
        for i in range(5): agent.ledger.reserve('other'+str(i),'ip'+str(i))
        self.assertFalse(agent.status('fresh','fresh')['available'])
        with __import__('sqlite3').connect(agent.config.db_path) as conn:
            self.assertNotIn('question',' '.join(row[0] for row in conn.execute('SELECT sql FROM sqlite_master WHERE sql IS NOT NULL')))

    def test_deepseek_citation_aliases_are_normalized_and_checked(self):
        from server.app import extract_result
        sources=[{'id':1,'label':'Official','url':'https://example.org/docs','evidence':'官方','checkedAt':None}]
        result={'output':[{'type':'message','content':[{'type':'output_text','text':'事实[n:1]，未知[n:999]，未知[999]','annotations':[]}]}]}
        answer,_,_=extract_result(result,sources,['example.org'])
        self.assertEqual(answer,'事实[1]，未知[资料待补充]，未知[资料待补充]')

    def test_sources_only_dataset_or_allowed_annotations(self):
        from server.app import extract_result
        result={'output':[{'type':'web_search_call'},{'type':'message','content':[{'type':'output_text','text':'Answer [1]','annotations':[{'type':'url_citation','url':'https://example.org/new','title':'New'},{'type':'url_citation','url':'https://evil.example/no','title':'Injected'}]}]}]}
        answer,sources,checked=extract_result(result,[],['example.org'])
        self.assertTrue(checked);self.assertEqual(len(sources),1);self.assertEqual(sources[0]['url'],'https://example.org/new')

    def test_multiple_annotation_offsets_preserve_original_text(self):
        from server.app import extract_result
        text='First statement. Second statement.'
        annotations=[{'type':'url_citation','url':'https://example.org/'+str(i),'title':str(i),'end_index':end} for i,end in [(1,16),(2,len(text))]]
        result={'output':[{'type':'message','content':[{'type':'output_text','text':text,'annotations':annotations}]}]}
        answer,sources,web=extract_result(result,[],['example.org'])
        self.assertEqual(answer,'First statement. [1] Second statement. [2]')

    def test_shared_host_scope_rejects_unrelated_tenants(self):
        from server.app import extract_result
        sources=[{'id':1,'label':'Repo','url':'https://github.com/official/project/blob/main/README.md','evidence':'官方','checkedAt':'2026-10-22'}]
        urls=['https://github.com/official/project/issues/1','https://github.com/other/project','https://github.com/official/project-evil','https://github.com/official/project/../evil','https://github.com/official/project/%2e%2e/evil','https://github.com/official/project?tab=readme','https://docs.readthedocs.io/page','https://other.readthedocs.io/page','https://readthedocs.io/anything','https://github.io/anything']
        annotations=[{'type':'url_citation','url':u,'title':'Page'} for u in urls]
        result={'output':[{'type':'message','content':[{'type':'output_text','text':'Answer','annotations':annotations}]}]}
        answer,actual,web=extract_result(result,sources,['github.com','docs.readthedocs.io','readthedocs.io','github.io'])
        self.assertEqual({x['url'] for x in actual}, {sources[0]['url'],urls[0],urls[5],urls[6]})

    def test_search_trigger_and_disabled_tool(self):
        payload=self.payload();payload['question']='当前价格和最新版本？'
        self.agent.chat(payload,'u','ip')
        request=self.calls[-1]
        self.assertEqual(request['tools'][0]['filters']['allowed_domains'],['example.org'])
        self.assertEqual(request['tool_choice'],'required')
        self.assertEqual(request['max_tool_calls'],1)
        env=dict(self.env,WEB_SEARCH_ENABLED='0')
        disabled=self.Agent(self.Config.from_env(env,self.root),provider=self.provider)
        disabled.chat(payload,'v','ip')
        self.assertNotIn('tools',self.calls[-1])

    def test_upstream_failure_still_charged_without_error_leak(self):
        def fail(payload):raise RuntimeError('test-secret sensitive body')
        agent=self.Agent(self.Config.from_env(self.env,self.root),provider=fail)
        with self.assertRaises(Exception) as error: agent.chat(self.payload(),'u','ip')
        self.assertNotIn('test-secret',error.exception.message)
        self.assertEqual(agent.status('u','ip')['remaining'],4)

    def test_cookie_tampering_and_ip_protection(self):
        self.agent.config.ip_limit=2
        first=self.request('POST','/api/chat',self.payload())
        self.assertEqual(first[0],200)
        cookie=first[1]['Set-Cookie'].split(';')[0]+'tampered'
        self.assertEqual(self.request('POST','/api/chat',self.payload(),cookie=cookie)[0],200)
        self.assertEqual(self.request('POST','/api/chat',self.payload())[0],429)
        with __import__('sqlite3').connect(self.agent.config.db_path) as conn:
            ips=[x[0] for x in conn.execute('SELECT iphash FROM reservations')]
        self.assertTrue(all(len(x)==64 and x!='127.0.0.1' for x in ips))

    def test_invalid_bounds_and_failclosed_status(self):
        for value in ['x'*2001,123,'']:
            payload=self.payload();payload['question']=value
            self.assertEqual(self.request('POST','/api/chat',payload)[0],400)
        self.agent.config.enabled=False
        self.assertFalse(json.loads(self.request('GET','/api/status')[2])['available'])
        self.assertEqual(self.request('POST','/api/chat',self.payload())[0],503)

    def test_global_budget_race_across_independent_agents(self):
        env=dict(self.env,APP_DAILY_BUDGET_USD='.3')
        agents=[self.Agent(self.Config.from_env(env,self.root),provider=self.provider) for _ in range(12)]
        def reserve(i):
            try:agents[i].ledger.reserve('user'+str(i),'ip'+str(i));return True
            except Exception:return False
        with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
            results=list(pool.map(reserve,range(12)))
        self.assertEqual(sum(results),3)
        self.assertFalse(agents[0].status('fresh','fresh')['available'])

    def test_invalid_endpoint_and_secret_fail_closed(self):
        for base in ['http://example.org/v1','https://user:pass@example.org/v1','https://example.org/v1?leak=1']:
            env=dict(self.env,OPENAI_BASE_URL=base)
            self.assertFalse(self.Config.from_env(env,self.root).enabled)
        env=dict(self.env,COOKIE_SECRET='short')
        self.assertFalse(self.Config.from_env(env,self.root).enabled)

    def test_rate_limit_and_failure_charged(self):
        env=dict(self.env,RATE_LIMIT_PER_MINUTE='1')
        agent=self.Agent(self.Config.from_env(env,self.root),provider=self.provider)
        agent.ledger.reserve('u','ip')
        with self.assertRaises(Exception):agent.ledger.reserve('v','ip')
        self.assertEqual(agent.status('u','ip')['remaining'],4)

if __name__=='__main__':unittest.main()
