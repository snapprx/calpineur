"use strict";
/* 08-storage.js — mémoire locale et fichiers de projet.

   Sécurité : tout ce qui entre (localStorage ou fichier .json) est traité
   comme non fiable. On ne fait JAMAIS Object.assign() sur l'objet analysé
   (une clé « __proto__ » polluerait le prototype) : on reconstruit un objet
   neuf champ par champ, avec bornes et listes blanches. Aucune valeur venue
   d'un fichier n'est injectée en HTML. */

const KEY = 'calpineur.plan.v1';

const N = (v, def, min, max) => { const n = Number(v); return Number.isFinite(n) ? clamp(n, min, max) : def; };
const B = (v, def) => typeof v === 'boolean' ? v : def;
const E = (v, list, def) => list.indexOf(v) >= 0 ? v : def;
const PT = q => ({ x: N(q && q.x, 0, -1e6, 1e6), y: N(q && q.y, 0, -1e6, 1e6) });

const ST = {

  available: (() => {
    try { const k = '__t'; localStorage.setItem(k,'1'); localStorage.removeItem(k); return true; }
    catch(e){ return false; }
  })(),

  snapshot(){
    return {
      app: 'calpineur', version: APP_VERSION, saved: new Date().toISOString(),
      pts: S.pts, closed: S.closed,
      tile: S.tile, cut: S.cut, show: S.show,
      plinth: S.plinth, doors: S.doors,
      unit: S.unit, snap: S.snap, snapStep: S.snapStep, snapTol: S.snapTol,
      waste: S.waste, poseSens: S.poseSens,
      measures: S.measures,
      view: { px: S.px, ox: S.ox, oy: S.oy }
    };
  },

  /* reconstruction contrôlée — aucune donnée n'est copiée telle quelle */
  apply(d){
    if(!d || typeof d !== 'object') return false;
    const pts = Array.isArray(d.pts) ? d.pts.slice(0, 2000).map(PT) : [];
    const t = d.tile && typeof d.tile === 'object' ? d.tile : {};
    const c = d.cut  && typeof d.cut  === 'object' ? d.cut  : {};
    const s = d.show && typeof d.show === 'object' ? d.show : {};
    const pl = d.plinth && typeof d.plinth === 'object' ? d.plinth : {};
    const v = d.view && typeof d.view === 'object' ? d.view : {};

    S.pts = pts;
    S.closed = B(d.closed, false) && pts.length > 2;
    S.tile = {
      w: N(t.w, 60, 1, 400), h: N(t.h, 60, 1, 400),
      joint: N(t.joint, 0.3, 0, 10),
      rot: mod(N(t.rot, 0, -3600, 3600), 360),
      offx: N(t.offx, 0, -1e5, 1e5), offy: N(t.offy, 0, -1e5, 1e5),
      pattern: E(t.pattern, ['droit','demi','tiers'], 'droit'),
      start: E(t.start, ['coin','centre'], 'coin')
    };
    S.cut = {
      minUse: N(c.minUse, 5, 0, 200),
      kerf: N(c.kerf, 0.3, 0, 5),
      allowRot: B(c.allowRot, true)
    };
    S.show = {
      tiles: B(s.tiles, true), cuts: B(s.cuts, true), nums: B(s.nums, false),
      grid: B(s.grid, true), dims: B(s.dims, true)
    };
    S.unit = E(d.unit, ['m','cm'], 'm');
    S.plinth = {
      on: B(pl.on, false),
      len: N(pl.len, 60, 1, 1000),
      height: N(pl.height, 8, 1, 200),
      stock: B(pl.stock, true),
      srcW: N(pl.srcW, 120, 1, 1000),
      srcH: N(pl.srcH, 60, 1, 1000),
      waste: N(pl.waste, 5, 0, 100),
      mode: E(pl.mode, ['mini','max'], 'mini')
    };
    S.doors = Array.isArray(d.doors)
      ? d.doors.slice(0, 30).filter(x => x && typeof x === 'object')
          .map(x => ({ w: N(x.w, 0, 0, 2000), n: Math.round(N(x.n, 0, 0, 999)) }))
      : [];
    S.snap = B(d.snap, true);
    S.snapStep = E(N(d.snapStep, 45, 0, 90), [0,5,15,45,90], 45);
    S.snapTol = E(N(d.snapTol, 8, 0, 45), [4,8,15], 8);
    S.waste = N(d.waste, 5, 0, 100);
    S.poseSens = N(d.poseSens, 100, 10, 200);
    S.measures = Array.isArray(d.measures)
      ? d.measures.slice(0, 500).filter(m => m && m.a && m.b).map(m => ({ a: PT(m.a), b: PT(m.b) }))
      : [];
    S.px = N(v.px, 0.5, 0.01, 40);
    S.ox = N(v.ox, 0, -1e6, 1e6);
    S.oy = N(v.oy, 0, -1e6, 1e6);
    markDirty();
    return true;
  },

  /* ---------------- mémoire du navigateur ---------------- */
  save(){
    if(!ST.available) return;
    clearTimeout(ST._d);
    ST._d = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(ST.snapshot())); ST.note(); }
      catch(e){ /* quota ou accès refusé : on continue sans mémoire */ }
    }, 500);
  },

  load(){
    if(!ST.available) return false;
    let raw;
    try { raw = localStorage.getItem(KEY); } catch(e){ return false; }
    if(!raw) return false;
    try { return ST.apply(JSON.parse(raw)); }
    catch(e){ return false; }
  },

  note(){
    const el = $('memInfo');
    if(!ST.available){ el.textContent = "Mémoire indisponible dans ce navigateur : pensez à sauvegarder en .json."; return; }
    const d = new Date();
    el.textContent = 'Mémoire locale active — dernier enregistrement ' +
      String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0') + '.';
  },

  /* ---------------- fichiers ---------------- */
  exportJSON(){
    const blob = new Blob([JSON.stringify(ST.snapshot(), null, 1)], { type:'application/json' });
    EX.download(URL.createObjectURL(blob), 'calpineur-plan.json', true);
    UIx.msg('Projet sauvegardé');
  },

  importJSON(e){
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if(!f) return;
    if(f.size > 4 * 1024 * 1024){ UIx.toast('Fichier trop volumineux'); return; }
    const r = new FileReader();
    r.onload = () => {
      let d;
      try { d = JSON.parse(String(r.result)); }
      catch(err){ UIx.toast('Fichier illisible'); return; }
      if(!ST.apply(d)){ UIx.toast('Contenu inattendu'); return; }
      UIx.sync(); R.fitView(); ST.save();
      UIx.msg('Projet chargé');
    };
    r.onerror = () => UIx.toast('Lecture impossible');
    r.readAsText(f);
  }
};
