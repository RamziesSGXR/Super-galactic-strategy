# Browser check: python3 test/ui.py  (needs `npm start` running and playwright for Python)
# Plays a few rounds by clicking, at phone and desktop size, and fails on any page error.
import sys
from playwright.sync_api import sync_playwright
out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/shots'
errs = []
with sync_playwright() as pw:
    br = pw.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    for name, w, h in [('phone', 390, 844), ('desk', 1280, 800)]:
        pg = br.new_page(viewport={'width': w, 'height': h})
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.goto('http://localhost:8080/?seed=7'); pg.wait_for_timeout(600)
        pg.screenshot(path=f'{out}/{name}-0-help.png')
        pg.click('[data-a=close]')
        pg.click('[data-a=commit]'); pg.wait_for_timeout(300)          # round 1: nothing happening
        assert pg.evaluate('sgs.g.round') == 2, 'round did not advance'
        # round 2: the first enemy is on the map. Plan an operation on the first world in reach.
        tgt = pg.evaluate('sgs.g.targets(0)[0]')
        box = pg.evaluate(f'(()=>{{const v=sgs.g.P[{tgt}];return null}})()')
        pg.evaluate(f'sgs.ui.sel={tgt}'); pg.click('[data-a=log]'); pg.click('[data-a=close]')   # any click redraws
        pg.evaluate('document.querySelector("[data-a=dir]").click()')
        pg.wait_for_timeout(100)
        pg.evaluate('document.querySelector("[data-a=op]").click()')
        for _ in range(3): pg.evaluate('document.querySelector("[data-a=m][data-k=siege][data-d=\\"1\\"]").click()')
        pg.wait_for_timeout(200); pg.screenshot(path=f'{out}/{name}-1-plan.png')
        assert pg.evaluate('sgs.g.count(0)') >= 1, 'no missions were added'
        pg.click('[data-a=commit]'); pg.wait_for_timeout(1500)
        assert pg.evaluate('sgs.g.phase') == 'battle', 'no battle phase'
        pg.screenshot(path=f'{out}/{name}-2-battle.png')
        pg.evaluate('document.querySelector("[data-a=speed]").click()')
        pg.wait_for_function('sgs.g.phase !== "battle"', timeout=30000); pg.wait_for_timeout(300)
        pg.screenshot(path=f'{out}/{name}-3-report.png')
        over = pg.evaluate('document.documentElement.scrollWidth > innerWidth + 1')
        assert not over, 'page is wider than the screen'
        pg.close()
    br.close()
errs = [e for e in errs if 'ERR_TUNNEL' not in e]   # web fonts are blocked in the sandbox; the fallback font is used
print('errors:', errs or 'none')
sys.exit(1 if errs else 0)
