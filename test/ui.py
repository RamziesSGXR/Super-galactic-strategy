# Browser check: python3 test/ui.py  (needs `npm start` running and playwright for Python)
# Plays two rounds by clicking, at phone and desktop size, and fails on any page error.
import sys
from playwright.sync_api import sync_playwright
out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/shots'
errs = []
js = lambda pg, s: pg.evaluate(s)
with sync_playwright() as pw:
    br = pw.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    for name, w, h in [('phone', 390, 844), ('desk', 1280, 800)]:
        pg = br.new_page(viewport={'width': w, 'height': h})
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.goto('http://localhost:8080/?seed=7'); pg.wait_for_timeout(600)
        assert js(pg, 'document.querySelectorAll("#hand .card").length') == 5, 'the opening hand should be five cards'
        assert js(pg, 'document.querySelectorAll("#mins .min").length') == 8, 'eight ministries'
        assert js(pg, '[...document.querySelectorAll("#mins .min")].every(b => { const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1 && r.width >= 40; })'), 'every ministry button is on screen'
        assert pg.is_visible('#turn .trk'), 'no turn strip'
        pg.click('[data-a=commit]'); pg.wait_for_timeout(300)          # round 1: nothing happening
        assert js(pg, 'sgs.g.round') == 2, 'round did not advance'
        # every ministry tab draws
        for t in ['def', 'pro', 'exp', 'tru', 'hum', 'emp', 'uni', 'int']:
            pg.click(f'.min[data-t={t}]'); assert pg.is_visible('#panel') and js(pg, 'document.getElementById("panel").textContent.length') > 40, t
        pg.screenshot(path=f'{out}/{name}-1-intel.png')
        # ministries act
        js(pg, 'sgs.ui.reveal=null'); pg.click('.min[data-t=def]'); assert not pg.query_selector('[data-a=dir][data-m=attack]'), 'offensive offered before mobilising'
        pg.click('[data-a=mob]'); assert js(pg, '!!sgs.g.mob'), 'mobilise did nothing'
        pg.click('.min[data-t=emp]'); pg.click('[data-a=route][data-k="0"]'); assert js(pg, 'sgs.g.route') == 0, 'route'
        pg.click('.min[data-t=hum]'); pg.click('[data-a=pol][data-k=volunteer]'); assert js(pg, 'sgs.g.policy') == 'volunteer', 'policy'
        # play mission cards from the hand onto the softest system in reach: tap the card, then PLAY ON
        tgt = js(pg, 'sgs.g.targets(0).sort((a,b)=>sgs.g.enemyAt(a)-sgs.g.enemyAt(b))[0]')
        js(pg, f'sgs.ui.sel={tgt}; sgs.ui.tab="sys"; sgs.ui.open=true; sgs.refresh()')
        assert pg.is_visible('#sys'), 'no planet view'
        for _ in range(3):
            i = js(pg, f'sgs.g.hand.findIndex((id,i)=>sgs.g.canPlay(i,{tgt}).ok && ["assault","siege","sabotage"].includes(id))')
            if i < 0: break
            js(pg, f'document.querySelector(\'#hand [data-i="{i}"]\').click()'); pg.click('[data-a=play]')
        n = js(pg, 'sgs.g.count(0)')
        assert 1 <= n <= 2, f'a general attack carries one or two cards, got {n}'
        pg.wait_for_timeout(200); pg.screenshot(path=f'{out}/{name}-2-plan.png')
        pg.click('[data-a=commit]'); pg.wait_for_timeout(1500)
        assert js(pg, 'sgs.g.phase') == 'battle', 'no battle phase'
        assert js(pg, 'document.querySelectorAll("[data-bar]").length') >= 2, 'no battle bars'
        pg.screenshot(path=f'{out}/{name}-3-battle.png')
        pg.click('[data-a=speed]')
        pg.wait_for_function('sgs.g.phase !== "battle"', timeout=30000); pg.wait_for_timeout(300)
        assert js(pg, '!!sgs.ui.reveal'), 'the enemy turn was not replayed'
        pg.wait_for_timeout(1200); pg.screenshot(path=f'{out}/{name}-3b-enemy-turn.png')
        assert pg.is_enabled('#commit') is False, 'commit should wait for the enemy turn'
        pg.click('[data-a=skip]'); pg.wait_for_timeout(200)
        if pg.query_selector('[data-a=take]'): pg.click('[data-a=take]')
        assert js(pg, 'sgs.g.deckSize()') >= 12, 'cards went missing from the deck'
        pg.click('[data-a=zin]'); pg.click('[data-a=zin]'); assert js(pg, 'sgs.view.zoom') > 2, 'zoom'
        pg.mouse.move(w * 0.3, 200); pg.mouse.down(); pg.mouse.move(w * 0.3 + 60, 240, steps=4); pg.mouse.up()
        assert js(pg, 'sgs.view.ox') > 30, 'dragging did not move the map'
        rnd = js(pg, 'sgs.g.round')
        pg.goto('http://localhost:8080/'); pg.wait_for_timeout(500)
        assert js(pg, 'sgs.g.round') == rnd and js(pg, 'sgs.g.seed') == 7, 'the saved war did not load'
        pg.screenshot(path=f'{out}/{name}-4-round3.png')
        assert not js(pg, 'document.documentElement.scrollWidth > innerWidth + 1'), 'page is wider than the screen'
        pg.close()
    br.close()
errs = [e for e in errs if 'ERR_TUNNEL' not in e]   # web fonts are blocked in the sandbox; the fallback font is used
print('errors:', errs or 'none')
sys.exit(1 if errs else 0)
