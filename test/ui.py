# Browser check: python3 test/ui.py  (needs `npm start` running and playwright for Python)
# Plays the opening by tapping the map and the buttons, at phone and desktop size, and fails on any page error.
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
        def tap(pid):
            x, y = js(f'(()=>{{const [x,y]=sgs.view.xy(sgs.g.P[{pid}]),r=document.getElementById("map").getBoundingClientRect();return [x+r.left,y+r.top]}})()')
            pg.mouse.click(x, y); pg.wait_for_timeout(80)
        def settle():
            pg.wait_for_function('sgs.g.phase === "plan" && !sgs.ui.show && !sgs.ui.anims.length || !!sgs.g.over', timeout=60000); pg.wait_for_timeout(150)
            if pg.is_visible('[data-a=take]'): pg.click('[data-a=take]:not([data-i])')
        pg.goto('http://localhost:8080/?seed=7'); pg.wait_for_timeout(600)
        assert js('document.querySelectorAll("#hand .card").length') == 5, 'the opening hand should be five cards'
        assert js('[...document.querySelectorAll("#mins .min")].length === 8 && [...document.querySelectorAll("#mins .min")].every(b => { const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1 && r.width >= 40; })'), 'eight ministry buttons, all on screen'
        assert js('sgs.g.P.length') > 55 and js('sgs.g.P.filter(p => p.adj.length === 1).length') >= 3, 'the map should be large and have dead ends'
        # round 1: pick a fleet up by tapping its system, send it to a neighbour of yours, build a ship
        f = js('(()=>{const f=sgs.g.fleets.find(f=>f.owner==="fed"&&f.at!==0);return {id:f.id,at:f.at,to:sgs.g.P[f.at].adj.find(n=>sgs.g.P[n].owner==="fed"&&n!==0)}})()')
        tap(f['at']); assert js('sgs.ui.fleet') == f['id'], 'tapping a system did not pick its fleet up'
        assert js('sgs.ui.dest && sgs.ui.dest.size') >= 1, 'no destinations ringed'
        pg.screenshot(path=f'{out}/{name}-1-picked.png')
        tap(f['to']); assert js(f'sgs.g.fleets.find(f=>f.id==={f["id"]}).order') == f['to'], 'the fleet was not ordered'
        tap(0); pg.click('#play [data-a=build]'); assert js('sgs.g.P[0].built'), 'no ship was built'
        for t in ['int', 'def', 'pro', 'exp', 'tru', 'hum', 'emp', 'uni']:
            pg.click(f'.min[data-t={t}]'); assert pg.is_visible('#panel') and js('document.getElementById("panel").textContent.length') > 40, t
        pg.click('.min[data-t=emp]'); pg.click('[data-a=prio][data-k="1"]'); assert js('sgs.g.priority') == 1, 'priority front'
        js('sgs.ui.open = false; sgs.refresh()'); pg.click('#commit'); settle()
        assert js('sgs.g.round') == 2 and js(f'sgs.g.fleets.find(f=>f.id==={f["id"]}).at') == f['to'], 'the fleet did not move'
        assert js('sgs.g.fi') >= 0 and pg.is_visible('#turn .trk .on'), 'no front is in play'
        # round 2: lay a trap, then keep ending turns until a battle is seen
        i = js('sgs.g.hand.findIndex(id => ["mines","ambush"].includes(id))')
        if i >= 0:
            pg.click(f'#hand [data-i="{i}"]'); site = js('[...sgs.ui.valid][0]'); tap(site)
            assert js(f'!!sgs.g.P[{site}].trap'), 'the trap was not laid'
        pg.screenshot(path=f'{out}/{name}-2-front.png')
        seen = False
        for _ in range(14):
            if js('!!sgs.g.over'): break
            pg.click('#commit'); pg.wait_for_timeout(500)
            if js('sgs.g.phase') == 'battle' and not seen:
                seen = True; pg.wait_for_timeout(1500); pg.screenshot(path=f'{out}/{name}-3-battle.png')
                pg.click('.min[data-t=def]'); assert js('document.querySelectorAll("[data-bar]").length') >= 1, 'no battle bar'; js('sgs.ui.open = false; sgs.refresh()')
            js('sgs.ui.speed = 3'); settle()
            if seen: break
        assert seen, 'no battle in the first rounds'
        t0 = js('sgs.g.P.findIndex(p => p.owner === "fed" && p.id)')
        tap(t0); pg.click('[data-a=info]'); assert pg.is_visible('#sys'), 'no planet view'
        pg.wait_for_timeout(300); pg.screenshot(path=f'{out}/{name}-4-planet.png'); js('sgs.ui.open = false; sgs.refresh()')
        pg.click('[data-a=zin]'); pg.click('[data-a=zin]'); assert js('sgs.view.zoom') > 2, 'zoom'
        rnd = js('[sgs.g.round, sgs.g.fleets.length]')
        pg.goto('http://localhost:8080/'); pg.wait_for_timeout(500)
        if pg.is_visible('[data-a=close]'): pg.click('[data-a=close]')
        assert js('[sgs.g.round, sgs.g.fleets.length]') == rnd and js('sgs.g.seed') == 7, 'the saved war did not load'
        assert not js('document.documentElement.scrollWidth > innerWidth + 1'), 'page is wider than the screen'
        pg.close()
    br.close()
errs = [e for e in errs if 'ERR_TUNNEL' not in e]   # web fonts are blocked in the sandbox; the fallback font is used
print('errors:', errs or 'none')
sys.exit(1 if errs else 0)
