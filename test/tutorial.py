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
        pg.goto('http://localhost:8080/?tutorial&seed=7'); pg.wait_for_timeout(600)
        seen, shots = [], {0, 5, 6, 8, 10}
        for _ in range(60):
            i = js('sgs.ui.tut')
            if i is None: break
            if i not in seen:
                seen.append(i)
                assert pg.is_visible('#coach'), f'no coach at step {i}'
                if i in shots: pg.wait_for_timeout(150); pg.screenshot(path=f'{out}/{name}-tut-{i}.png')
            if pg.query_selector('[data-a=take]'): pg.click('[data-a=take]'); continue
            if pg.query_selector('#coach .go[data-a=tnext]'): pg.click('#coach .go[data-a=tnext]'); continue
            if i == 2 or i == 9: pg.click('#commit')
            elif i == 5:   # tap the ringed system on the map itself
                x, y = js('(()=>{const p=sgs.g.P[sgs.ui.hint],[x,y]=sgs.view.xy(p),r=document.getElementById("map").getBoundingClientRect();return [x+r.left,y+r.top]})()')
                pg.mouse.click(x, y)
            elif i == 6: pg.click('#hand .card.hl'); pg.click('[data-a=play]')
            elif i == 8: pg.click('[data-a=mob]')
            elif i == 10: js('sgs.ui.speed=3'); pg.wait_for_function('sgs.g.phase !== "battle"', timeout=40000); pg.wait_for_timeout(300)
            elif i == 12: pg.click('[data-a=dir][data-m=attack]')
            else: raise AssertionError(f'stuck at step {i}')
            pg.wait_for_timeout(120)
        assert js('sgs.ui.tut') is None, 'the tutorial did not finish'
        assert not pg.is_visible('#coach'), 'the coach is still showing'
        print(name, 'steps seen:', seen, '| round', js('sgs.g.round'))
        assert {2, 5, 6, 8, 9, 10}.issubset(set(seen)), 'a hands-on step was skipped'
        pg.close()
    br.close()
errs = [e for e in errs if 'ERR_TUNNEL' not in e]
print('errors:', errs or 'none')
sys.exit(1 if errs else 0)
