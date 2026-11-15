# Browser check of the tutorial: python3 test/tutorial.py  (needs `npm start` running and playwright for Python)
# Follows the coach from the first step to the last by doing what it asks, at phone and desktop size.
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
        js = pg.evaluate
        def tap_hint():
            x, y = js('(()=>{const [x,y]=sgs.view.xy(sgs.g.P[sgs.ui.hint]),r=document.getElementById("map").getBoundingClientRect();return [x+r.left,y+r.top]})()')
            pg.mouse.click(x, y); pg.wait_for_timeout(100)
        pg.goto('http://localhost:8080/?tutorial'); pg.wait_for_timeout(700)
        seen, stuck = [], 0
        for _ in range(200):
            i = js('sgs.ui.tut')
            if i is None: break
            if js('!!sgs.ui.show || sgs.ui.anims.length > 0 || !!sgs.view.goal'): pg.wait_for_timeout(200); continue
            if i not in seen:
                seen.append(i); stuck = 0
                assert pg.is_visible('#coach') or pg.is_visible('#fcoach'), f'no coach at step {i}'
                pg.wait_for_timeout(150); pg.screenshot(path=f'{out}/{name}-tut-{i}.png')
            stuck += 1; assert stuck < 40, f'stuck at step {i}'
            if pg.is_visible('.go[data-a=tnext]'): pg.click('.go[data-a=tnext]')
            elif pg.is_visible('#fight'):                                   # a battle came up: fight it
                if pg.is_visible('[data-a=bclose]'): pg.click('[data-a=bclose]')
                elif pg.is_visible('#fbody [data-a=bplay][data-i="0"]'): pg.click('#fbody [data-a=bplay][data-i="0"]')
                pg.wait_for_timeout(300)
            elif i in (2, 3): tap_hint()                                   # pick the fleet up, then choose where it goes
            elif i == 4: pg.click('[data-a=confirm]')
            elif i == 6: tap_hint(); pg.click('[data-a=build]')
            elif i == 7: pg.click('#commit')
            else: raise AssertionError(f'no script for step {i}')
            pg.wait_for_timeout(150)
        assert js('sgs.ui.tut') is None, 'the tutorial did not finish'
        assert not pg.is_visible('#coach'), 'the coach is still showing'
        print(name, 'steps seen:', seen, '| round', js('sgs.g.round'))
        assert set(range(11)).issubset(set(seen)), 'a step was skipped'
        pg.close()
    br.close()
errs = [e for e in errs if 'ERR_TUNNEL' not in e]
print('errors:', errs or 'none')
sys.exit(1 if errs else 0)
