"use strict";
/* 04b-plinthes.js — linéaire de plinthes, alignement sur les joints du sol,
   déduction des ouvertures et débit des barres.

   Règle de pose retenue : les coupes de plinthes tombent sur les joints du
   carrelage. Pour chaque mur on relève donc l'endroit exact où la trame du sol
   croise ce mur, puis on pose les plinthes du départ vers l'arrivée en s'arrêtant
   au dernier joint atteignable dans la longueur de barre choisie.

   Les ouvertures ne sont pas positionnées sur le plan : leur largeur cumulée est
   déduite du linéaire, et l'équivalent en barres entières est retiré du besoin.
   Le reliquat n'est pas déduit — le calcul reste donc légèrement prudent.       */

const PL = {

  /* ---- positions, le long d'un mur, où la trame du sol le croise ---- */
  jointsOnWall(a, b, tc){
    const A = tc.F.toLocal(a), B = tc.F.toLocal(b);
    const dx = B.x - A.x, dy = B.y - A.y;
    const wl = G.dist(a, b);
    const ts = [];

    /* joints perpendiculaires aux rangées : y = j·ch + by */
    if(Math.abs(dy) > 1e-9){
      const j0 = Math.floor((Math.min(A.y, B.y) - tc.by)/tc.ch) - 1;
      const j1 = Math.ceil ((Math.max(A.y, B.y) - tc.by)/tc.ch) + 1;
      for(let j = j0; j <= j1; j++){
        const t = ((j*tc.ch + tc.by) - A.y)/dy;
        if(t > 1e-6 && t < 1 - 1e-6) ts.push(t);
      }
    }
    ts.sort((x,y) => x-y);

    /* joints dans le sens des rangées : x = i·cw + bx (+ décalage de rangée).
       Le décalage dépend de la rangée, donc on traite le mur tronçon par
       tronçon, entre deux changements de rangée. */
    const out = ts.slice();
    if(Math.abs(dx) > 1e-9){
      const bounds = [0].concat(ts, [1]);
      for(let k = 0; k < bounds.length - 1; k++){
        const t0 = bounds[k], t1 = bounds[k+1];
        if(t1 - t0 < 1e-9) continue;
        const ym = A.y + dy*(t0 + t1)/2;
        const j = Math.floor((ym - tc.by)/tc.ch);
        let ro = 0;
        if(S.tile.pattern === 'demi')       ro = mod(j,2) * tc.cw/2;
        else if(S.tile.pattern === 'tiers') ro = mod(j,3) * tc.cw/3;
        const x0 = A.x + dx*t0, x1 = A.x + dx*t1;
        const i0 = Math.floor((Math.min(x0,x1) - tc.bx - ro)/tc.cw) - 1;
        const i1 = Math.ceil ((Math.max(x0,x1) - tc.bx - ro)/tc.cw) + 1;
        for(let i = i0; i <= i1; i++){
          const t = ((i*tc.cw + tc.bx + ro) - A.x)/dx;
          if(t > t0 + 1e-9 && t < t1 - 1e-9 && t > 1e-6 && t < 1 - 1e-6) out.push(t);
        }
      }
    }
    return out.map(t => t*wl).sort((x,y) => x-y);
  },

  /* ---- pose des barres sur un mur, coupes calées sur les joints ---- */
  layoutWall(wl, joints, L, out){
    const tol = 0.5;                       // on considère qu'on « tombe » sur le joint
    let cur = 0, guard = 0;
    while(cur < wl - 0.5 && guard++ < 5000){
      const target = cur + L;
      let next = Math.min(target, wl);
      if(target < wl - tol){
        let p = -1;
        for(const j of joints) if(j > cur + 0.5 && j <= target + tol) p = j;
        if(p > 0) next = p;
      }
      const len = next - cur;
      if(len < 0.2){ cur = next + 0.2; continue; }
      out.push({ len, full: Math.abs(len - L) < 0.2 });
      cur = next;
    }
  },

  /* ---- combien de plinthes L × H tirer d'un carreau A × B ----

     Deux modes, selon ce qu'on accepte comme chant supérieur :

     • mode « mini » (par défaut) — chaque plinthe garde une **arête d'usine** :
       le chant lisse fait par le fabricant, qui reste visible en haut une fois
       posée. On ne débite donc que les deux bandes en rive, le long de deux
       arêtes opposées. Deux bandes par carreau au maximum.

     • mode « max » — on exploite aussi les bandes du milieu. Leur chant
       supérieur est un chant de coupe : il faut le poncer ou le chanfreiner
       pour qu'il soit présentable. Rendement bien meilleur sur les grands
       formats, au prix de ce travail de finition.

     Chaque bande fait la longueur de l'arête suivie : c'est là qu'un 60 × 120
     est intéressant, ses grandes arêtes donnant des bandes de 120.          */
  fit(A, B, L, H, kerf, maxMode){
    const raw = Math.floor((B + kerf) / (H + kerf));
    const strips = maxMode ? raw : Math.min(2, raw);
    const factory = Math.min(2, raw);                 // bandes à chant d'usine
    const perStrip = Math.floor((A + kerf) / (L + kerf));
    const ideal = Math.floor(A / L);                  // sans trait de scie
    return {
      n: (strips > 0 && perStrip > 0) ? strips * perStrip : 0,
      strips, factory, perStrip, ideal, edge: A
    };
  },

  perTile(){
    const p = S.plinth;
    const kerf = Math.max(0, S.cut.kerf);
    const maxMode = p.mode === 'max';
    const A = Math.max(0.1, p.srcW), B = Math.max(0.1, p.srcH);
    const f1 = PL.fit(A, B, p.len, p.height, kerf, maxMode);
    const f2 = PL.fit(B, A, p.len, p.height, kerf, maxMode);
    const best = (f1.n >= f2.n) ? f1 : f2;
    const ground = Math.max(0, (best.strips - best.factory)) * best.perStrip;
    return {
      n: best.n,
      strips: best.strips,
      perStrip: best.perStrip,
      edge: best.edge,
      ground,                                          // pièces à rechanter
      kerfLoss: best.ideal > best.perStrip ? best.strips * (best.ideal - best.perStrip) : 0,
      sense: best.strips + ' bande(s) le long des arêtes de ' + fmtCm(best.edge)
    };
  },

  /* ---- calcul complet ---- */
  compute(){
    plinthCache = null;
    if(!S.plinth.on || !S.closed || S.pts.length < 3) return null;

    const L = Math.max(1, S.plinth.len);
    const kerf = Math.max(0, S.cut.kerf);
    const minUse = Math.max(1, S.cut.minUse);
    const tc = T.get();

    const gross = G.perimeter(S.pts, true);
    const doorsLen = S.doors.reduce((s,d) => s + Math.max(0,d.w) * Math.max(0,d.n), 0);
    const doorsQty = S.doors.reduce((s,d) => s + Math.max(0,d.n), 0);
    const net = Math.max(0, gross - doorsLen);

    /* pose alignée sur l'ensemble du périmètre */
    const raw = [];
    const n = S.pts.length;
    for(let i=0;i<n;i++){
      const a = S.pts[i], b = S.pts[(i+1)%n];
      const wl = G.dist(a,b);
      if(wl < 1) continue;
      const joints = tc ? PL.jointsOnWall(a, b, tc) : [];
      PL.layoutWall(wl, joints, L, raw);
    }

    let fullCount = raw.filter(p => p.full).length;
    const cuts = raw.filter(p => !p.full).map(p => p.len).sort((x,y) => y - x);

    /* les ouvertures épargnent d'abord des barres entières */
    const spared = Math.min(fullCount, Math.floor(doorsLen / L));
    fullCount -= spared;

    /* débit des coupes dans des barres neuves, avec réemploi des chutes */
    const bars = [];
    for(const c of cuts){
      let bi = -1, best = Infinity;
      for(let k=0;k<bars.length;k++){
        if(bars[k].rest >= c - 1e-9 && bars[k].rest < best){ best = bars[k].rest; bi = k; }
      }
      if(bi < 0){ bars.push({ rest:L, items:[] }); bi = bars.length - 1; }
      bars[bi].items.push(c);
      bars[bi].rest = bars[bi].rest - c - kerf;
      if(bars[bi].rest < minUse) bars[bi].rest = 0;   // chute trop courte : perdue
    }
    const reused = Math.max(0, cuts.length - bars.length);

    const total = fullCount + bars.length;
    const waste = Math.max(0, S.plinth.waste);
    const buy = Math.ceil(total * (1 + waste/100));

    /* si la longueur n'existe pas dans le commerce : on la débite dans un carreau */
    const per = S.plinth.stock
      ? { n:0, strips:0, perStrip:0, edge:0, ground:0, kerfLoss:0, sense:'' }
      : PL.perTile();
    const tilesNeeded = (!S.plinth.stock && per.n > 0) ? Math.ceil(buy / per.n) : 0;

    /* comparatif : ce que rendrait l'autre mode de débit */
    let alt = null;
    if(!S.plinth.stock && per.n > 0){
      const keep = S.plinth.mode;
      S.plinth.mode = (keep === 'max') ? 'mini' : 'max';
      const o = PL.perTile();
      S.plinth.mode = keep;
      if(o.n > 0 && o.n !== per.n){
        alt = { mode: (keep === 'max') ? 'mini' : 'max', perTile: o.n, tiles: Math.ceil(buy / o.n) };
      }
    }

    plinthCache = {
      L, height: S.plinth.height, gross, doorsLen, doorsQty, net,
      fullCount, cutCount: cuts.length, bars: bars.length, reused,
      spared, total, buy, waste,
      stock: S.plinth.stock, mode: S.plinth.mode,
      srcW: S.plinth.srcW, srcH: S.plinth.srcH,
      perTile: per.n, strips: per.strips, perStrip: per.perStrip,
      edge: per.edge, ground: per.ground, kerfLoss: per.kerfLoss, sense: per.sense,
      tilesNeeded, alt,
      impossible: !S.plinth.stock && per.n === 0,
      barList: bars
    };
    return plinthCache;
  },

  get(){
    if(!plinthCache) PL.compute();
    return plinthCache;
  }
};
