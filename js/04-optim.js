"use strict";
/* 04-optim.js — débit des coupes avec réemploi des chutes.

   Principe : une coupe n'oblige pas à sacrifier un carreau entier. On modélise
   chaque carreau ouvert comme un stock de rectangles (découpe « guillotine »),
   et chaque nouvelle coupe cherche d'abord une chute existante assez grande.

   - tri des coupes de la plus grande à la plus petite (meilleur rendement) ;
   - placement « best fit » : la plus petite chute qui convient ;
   - la chute peut être retournée à 90° si le carreau n'est pas directionnel ;
   - chaque découpe consomme l'épaisseur du trait de scie ;
   - en dessous de la taille mini réutilisable, la chute part au rebut.        */

const OPT = {

  run(){
    const tc = T.get();
    if(!tc) return (planCache = null);

    const W = tc.tw, H = tc.th;
    const minUse = Math.max(0, S.cut.minUse);
    const kerf   = Math.max(0, S.cut.kerf);
    const allowRot = !!S.cut.allowRot;

    /* les plus encombrantes d'abord */
    const order = tc.cuts.slice().sort((a,b) =>
      (Math.max(b.bw,b.bh) - Math.max(a.bw,a.bh)) || (b.bw*b.bh - a.bw*a.bh));

    const tiles = [];   // carreaux ouverts : {n, placed:[], lost:[]}
    let stock = [];     // chutes disponibles : {t,x,y,w,h}
    let reused = 0;

    for(const pc of order){
      let idx = -1, best = Infinity, useRot = false;

      for(let k=0;k<stock.length;k++){
        const f = stock[k];
        const fit  = pc.bw <= f.w + 1e-9 && pc.bh <= f.h + 1e-9;
        const fitR = allowRot && pc.bh <= f.w + 1e-9 && pc.bw <= f.h + 1e-9;
        if(!fit && !fitR) continue;
        const score = f.w * f.h;
        if(score < best){ best = score; idx = k; useRot = !fit && fitR; }
      }

      let f, tile;
      if(idx >= 0){
        f = stock.splice(idx,1)[0];
        tile = tiles[f.t - 1];
        reused++;
      } else {
        tile = { n: tiles.length + 1, placed: [], lost: [] };
        tiles.push(tile);
        f = { t: tile.n, x:0, y:0, w:W, h:H };
        useRot = false;
      }

      const pw = useRot ? pc.bh : pc.bw;
      const ph = useRot ? pc.bw : pc.bh;

      /* On plaque la pièce contre le bord du carreau le plus proche, jamais au
         milieu : deux coupes prises dans le même carreau se retrouvent donc de
         part et d'autre, et la chute reste d'un seul tenant entre les deux au
         lieu d'être repoussée sur un côté. C'est aussi la façon dont on scie
         réellement : on entame par les bords. */
      const toRight = (W - (f.x + f.w)) < f.x;
      const toBottom = (H - (f.y + f.h)) < f.y;
      const px = toRight  ? f.x + f.w - pw : f.x;
      const py = toBottom ? f.y + f.h - ph : f.y;

      tile.placed.push({ ref: pc.ref, x: px, y: py, w: pw, h: ph, rot: useRot, piece: pc });

      /* découpe guillotine : deux découpes possibles, on garde celle qui
         laisse le plus grand morceau exploitable */
      const rw = f.w - pw - kerf, rh = f.h - ph - kerf;
      const rx = toRight  ? f.x : f.x + pw + kerf;   // bande restante en largeur
      const ry = toBottom ? f.y : f.y + ph + kerf;   // bande restante en hauteur
      const A = [ { x:rx,  y:py,  w:rw,  h:ph  },
                  { x:f.x, y:ry,  w:f.w, h:rh  } ];
      const B = [ { x:rx,  y:f.y, w:rw,  h:f.h },
                  { x:px,  y:ry,  w:pw,  h:rh  } ];
      const big = arr => Math.max.apply(null, arr.map(r => Math.max(0,r.w) * Math.max(0,r.h)));
      const keep = big(A) >= big(B) ? A : B;

      for(const r of keep){
        r.t = f.t;
        if(r.w >= minUse && r.h >= minUse) stock.push(r);
        else if(r.w > 0.3 && r.h > 0.3)    tile.lost.push(r);
      }
    }

    /* chutes jamais réemployées : elles restent exploitables sur le chantier */
    for(const r of stock) if(tiles[r.t-1]) tiles[r.t-1].free = (tiles[r.t-1].free||[]).concat([r]);

    const fullCount = tc.full;
    const srcCount  = tiles.length;
    const total     = fullCount + srcCount;
    const bought    = total * tc.tw * tc.th;
    const yieldPct  = bought > 0 ? (tc.covered / bought) * 100 : 0;
    const naive     = fullCount + tc.cut;     // 1 carreau par coupe, sans réemploi

    planCache = {
      tiles, stock, reused,
      fullCount, srcCount, total, yieldPct, naive,
      saved: naive - total,
      W, H
    };
    return planCache;
  },

  get(){
    if(!planCache) OPT.run();
    return planCache;
  },

  /* ================= recherche de la pose la plus économe =================

     À format, motif et angle fixés, seul le décalage de la trame reste libre.
     Il est périodique : tout décalage utile tient dans un rectangle cw × ch.
     On balaye ce rectangle en trois passes de plus en plus fines, en gardant
     le meilleur point trouvé — un balayage direct assez fin coûterait des
     milliers d'évaluations pour le même résultat.                          */

  busy: false,
  lastUndo: null,

  /* évalue la pose courante : force la reconstruction du calepinage */
  evaluate(){
    dirty = true; planCache = null;
    const tc = T.build();
    dirty = false;
    if(!tc) return null;
    const p = OPT.run();
    if(!p) return null;
    /* une coupe très étroite est fragile à poser : on la compte pour départager */
    const lim = Math.min(tc.tw, tc.th) / 3;
    let slivers = 0;
    for(const c of tc.cuts) if(Math.min(c.bw, c.bh) < lim) slivers++;
    return { total:p.total, cuts:tc.cut, slivers, yieldPct:p.yieldPct };
  },

  /* moins de carreaux d'abord, puis moins de coupes fragiles, puis moins de coupes */
  better(a, b){
    if(a.total !== b.total) return a.total < b.total;
    if(a.slivers !== b.slivers) return a.slivers < b.slivers;
    return a.cuts < b.cuts;
  },

  optimize(progress, done){
    if(OPT.busy) return;
    const tc0 = T.get();
    if(!tc0){ done(null); return; }
    OPT.busy = true;

    const cw = tc0.cw, ch = tc0.ch;
    const nPieces = tc0.pieces.length;
    const before = { offx: S.tile.offx, offy: S.tile.offy };

    /* grille d'autant plus grossière que la pièce contient de carreaux */
    const g = nPieces > 4000 ? 5 : nPieces > 1200 ? 7 : nPieces > 400 ? 9 : 12;
    let step = { x: cw/g, y: ch/g };

    const baseline = OPT.evaluate();
    let best = baseline, bestAt = { x: before.offx, y: before.offy };

    const queue = [];
    for(let i=0;i<g;i++) for(let j=0;j<g;j++) queue.push({ x: i*step.x, y: j*step.y });

    let phase = 0, tested = 0;
    const estimate = g*g + 48;

    function chunk(){
      const t0 = (window.performance ? performance.now() : Date.now());
      while(queue.length && ((window.performance ? performance.now() : Date.now()) - t0) < 24){
        const c = queue.shift();
        S.tile.offx = c.x; S.tile.offy = c.y;
        const r = OPT.evaluate();
        tested++;
        if(r && (!best || OPT.better(r, best))){ best = r; bestAt = c; }
      }
      if(progress) progress(tested, estimate);

      if(!queue.length && phase < 2){
        phase++;
        const f = phase === 1 ? 2.5 : 6;
        const sx = step.x/f, sy = step.y/f;
        for(let i=-2;i<=2;i++) for(let j=-2;j<=2;j++)
          if(i || j) queue.push({ x: bestAt.x + i*sx, y: bestAt.y + j*sy });
        step = { x:sx, y:sy };
      }

      if(queue.length){ setTimeout(chunk, 0); return; }

      /* on repose la meilleure solution trouvée */
      S.tile.offx = Math.round(bestAt.x*100)/100;
      S.tile.offy = Math.round(bestAt.y*100)/100;
      markDirty();
      OPT.busy = false;
      OPT.lastUndo = before;
      done({ best, baseline, before });
    }

    setTimeout(chunk, 0);
  }
};
