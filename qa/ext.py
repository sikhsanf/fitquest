import sys,json,os
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg=b.new_page(); pg.goto('http://localhost:8766/harness.html'); pg.wait_for_timeout(500)
    for d in sys.argv[1:]:
        n=len(os.listdir('/tmp/q/'+d)); r=pg.evaluate(f"run('{d}',{n})",)
        json.dump(r,open('/tmp/q/'+d+'.json','w')); print(d,n,sum(1 for x in r if x),flush=True)
