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
        pg.goto('http://localhost:8080/?tutorial'); pg.wait_for_timeout(600)
        seen, shots, stuck = [], {0, 2, 3, 4, 9, 10, 12}, 0
        for _ in range(120):
            i = js('sgs.ui.tut')
            if i is None: break
            if js('!!sgs.ui.show || sgs.ui.anims.length > 0'): pg.wait_for_timeout(200); continue
            if pg.is_visible('[data-a=take]'): pg.click('[data-a=take]:not([data-i])'); continue
            if i not in seen:
                seen.append(i); stuck = 0
                assert pg.is_visible('#coach'), f'no coach at step {i}'
                if i in shots: pg.wait_for_timeout(200); pg.screenshot(path=f'{out}/{name}-tut-{i}.png')
            stuck += 1; assert stuck < 12, f'stuck at step {i}'
            if pg.query_selector('#coach .go[data-a=tnext]'): pg.click('#coach .go[data-a=tnext]')
            elif i in (2, 3): tap_hint()                                   # pick the fleet up, then send it
            elif i == 4: tap_hint(); pg.click('#play [data-a=build]')      # build a ship
            elif i in (6, 11): pg.click('#commit')
            elif i == 9: pg.click('#hand .card.hl'); tap_hint()            # lay a trap
            elif i == 10: tap_hint(); pg.click('[data-a=thelp]')           # pick the fleet up, let the coach point the attack
            elif i == 12: js('sgs.ui.speed = 3'); pg.wait_for_function('sgs.g.phase !== "battle"', timeout=60000)
            else: raise AssertionError(f'no script for step {i}')
            pg.wait_for_timeout(150)
        assert js('sgs.ui.tut') is None, 'the tutorial did not finish'
        assert not pg.is_visible('#coach'), 'the coach is still showing'
        print(name, 'steps seen:', seen, '| round', js('sgs.g.round'))
        assert {2, 3, 4, 6, 11}.issubset(set(seen)), 'a hands-on step was skipped'
        pg.close()
    br.close()
errs = [e for e in errs if 'ERR_TUNNEL' not in e]
print('errors:', errs or 'none')
sys.exit(1 if errs else 0)
