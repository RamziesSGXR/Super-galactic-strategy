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
        def calm(): pg.wait_for_function('!sgs.ui.show && !sgs.ui.anims.length && !sgs.view.goal', timeout=30000); pg.wait_for_timeout(120)
        def tap(pid):
            x, y = js(f'(()=>{{const [x,y]=sgs.view.xy(sgs.g.P[{pid}]),r=document.getElementById("map").getBoundingClientRect();return [x+r.left,y+r.top]}})()')
            pg.mouse.click(x, y); pg.wait_for_timeout(80)
        def battle(shot=None):
            assert pg.is_visible('#fight'), 'no battle screen'
            assert js('sgs.g.battle.you.hand.length') == 3, 'a battle hand should be three cards'
            if shot: pg.wait_for_timeout(200); pg.screenshot(path=f'{out}/{name}-{shot}.png')
            pg.click('#fbody [data-a=bplay][data-i="0"]'); pg.wait_for_timeout(500)
            assert js('sgs.g.battle.round') == 1 and js('sgs.g.battle.lines.length') >= 2, 'playing a card did not play a round'
            if shot: pg.screenshot(path=f'{out}/{name}-{shot}b.png')
            for _ in range(60):
                if js('sgs.g.battle && sgs.g.battle.done'): break
                if pg.is_visible('#fbody [data-a=bplay][data-i="0"]'): pg.click('#fbody [data-a=bplay][data-i="0"]')
                pg.wait_for_timeout(350)
            assert js('sgs.g.battle.done'), 'the battle did not end'
            pg.click('[data-a=bclose]'); pg.wait_for_timeout(150)
        pg.goto('http://localhost:8080/?seed=7'); pg.wait_for_timeout(700)
        assert js('[...document.querySelectorAll("#mins .min")].length === 8 && [...document.querySelectorAll("#mins .min")].every(b => { const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1 && r.width >= 40; })'), 'eight ministry buttons, all on screen'
        for t in ['int', 'def', 'pro', 'exp', 'tru', 'hum', 'emp', 'uni']:
            pg.click(f'.min[data-t={t}]'); assert pg.is_visible('#panel') and js('document.getElementById("panel").textContent.length') > 40, t
        js('sgs.ui.open = false; sgs.refresh()')
        # round 1, no war: pick a fleet up, see its rings, send it outward, confirm
        f = js('(()=>{const g=sgs.g,f=g.fleets.find(f=>f.owner==="fed"&&g.P[f.at].front===0);return {id:f.id,at:f.at,to:g.posts(f).find(n=>g.P[n].front===0&&g.P[n].ring===3)}})()')
        tap(f['at']); assert js('sgs.ui.fleet') == f['id'] and js('sgs.ui.dest.size') > 5, 'tapping a system did not pick its fleet up'
        tap(f['to']); assert js('sgs.ui.pend && sgs.ui.pend.type') == 'move', 'no order to confirm'
        pg.click('[data-a=confirm]'); calm()
        assert js('sgs.g.round') == 2 and js(f'sgs.g.shipsAt({f["to"]}, "fed")') >= 2, 'the fleet did not move'
        # round 2: the first enemy is here; the camera has turned to its front; build, then hold
        assert js('sgs.g.fi') == 0 and abs(js('sgs.view.zoom') - 1) > 0.3 and js('Math.abs(sgs.view.rot)') > 0.2, 'the camera did not go to the front in play'
        pg.screenshot(path=f'{out}/{name}-1-front.png')
        y = js('sgs.g.P.find(p => sgs.g.canBuild(p.id) && p.id).id'); tap(y); pg.click('[data-a=build]')
        assert js(f'sgs.g.P[{y}].built') and js('sgs.g.phase') == 'plan' and js('sgs.g.fi') == 0, 'building should not use up the decision'
        tap(y); pg.click('[data-a=info]'); assert pg.is_visible('#sys'), 'no planet view'; js('sgs.ui.open = false; sgs.refresh()')
        # play on, holding every front, until the enemy attacks; then fight the battle with cards
        fought = False
        for _ in range(40):
            calm()
            if js('!!sgs.g.over'): break
            if js('!!sgs.g.battle'): battle(None if fought else '2-defend'); fought = True; break
            pg.click('[data-a=hold]')
        assert fought, 'the enemy never attacked'
        calm()
        # attack: find a fleet with a target, pick it up, tap the amber ring, confirm, and fight
        for _ in range(12):
            calm()
            if js('!!sgs.g.over'): break
            if js('!!sgs.g.battle'): battle(); continue
            a = js('(()=>{const g=sgs.g,fs=g.fleets.filter(f=>f.owner==="fed"&&g.targets(f).length).sort((a,b)=>g.onFront(b.at)-g.onFront(a.at));if(!fs.length)return null;const f=fs[0];return {at:f.at,here:g.onFront(f.at)&&f.at!==0,to:g.targets(f).sort((a,b)=>g.strength(a)-g.strength(b))[0]}})()')
            if not a: pg.click('[data-a=hold]'); continue
            if not a['here']: pg.click('[data-a=cam]'); pg.wait_for_function('!sgs.view.goal')   # a fleet on another front: pull back to the whole map to reach it
            tap(a['at']); tap(a['to'])
            assert js('sgs.ui.pend && sgs.ui.pend.type') == 'atk', 'tapping an amber ring did not set up an attack'
            pg.screenshot(path=f'{out}/{name}-3-attack.png'); pg.click('[data-a=confirm]'); calm(); battle('4-attack'); break
        else: raise AssertionError('no attack was possible')
        calm()
        if js('!!sgs.g.battle'): battle()
        calm(); pg.click('[data-a=cam]'); pg.wait_for_function('!sgs.view.goal'); assert abs(js('sgs.view.zoom') - 1) < 0.05, 'WHOLE MAP did not pull back'
        pg.screenshot(path=f'{out}/{name}-5-whole.png')
        if not js('!!sgs.g.over') and js('sgs.g.phase') == 'plan':
            rnd = js('[sgs.g.round, sgs.g.fleets.length, sgs.g.fi]')
            pg.goto('http://localhost:8080/'); pg.wait_for_timeout(600)
            if pg.is_visible('[data-a=close]'): pg.click('[data-a=close]')
            assert js('[sgs.g.round, sgs.g.fleets.length, sgs.g.fi]') == rnd and js('sgs.g.seed') == 7, 'the saved war did not load'
        assert not js('document.documentElement.scrollWidth > innerWidth + 1'), 'page is wider than the screen'
        pg.close()
    br.close()
errs = [e for e in errs if 'ERR_TUNNEL' not in e]   # web fonts are blocked in the sandbox; the fallback font is used
print('errors:', errs or 'none')
sys.exit(1 if errs else 0)
