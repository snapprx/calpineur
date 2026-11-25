"use strict";
/* 03-tiles.js — génération du calepinage.
   Chaque carreau du quadrillage est découpé par le contour de la pièce :
   on obtient soit un carreau entier, soit la forme EXACTE de la coupe. */

const T = {

  build(){
    tilesCache = null;
    if(S.pts.length < 3 || !S.closed) return null;

    const t = S.tile;
    const tw = Math.max(1, t.w), th = Math.max(1, t.h), j = Math.max(0, t.joint);
    const cw = tw + j, ch = th + j;

    const bb = G.bbox(S.pts);
    const O = { x: bb.x, y: bb.y };
    const F = G.frame(O, t.rot);

    const roomL = S.pts.map(F.toLocal);
    const lb = G.bbox(roomL);

    /* origine du quadrillage dans le repère local */
    let bx = t.offx, by = t.offy;
    if(t.start === 'centre'){
      const c = F.toLocal({ x: bb.x + bb.w/2, y: bb.y + bb.h/2 });
      bx += mod(c.x - tw/2, cw);
      by += mod(c.y - th/2, ch);
    }

    const i0 = Math.floor((lb.x  - bx)/cw) - 1, i1 = Math.ceil((lb.x2 - bx)/cw) + 1;
    const j0 = Math.floor((lb.y  - by)/ch) - 1, j1 = Math.ceil((lb.y2 - by)/ch) + 1;
    if((i1-i0+1) * (j1-j0+1) > 60000){
      UIx.toast("Carreau trop petit pour cette surface : calepinage non calculé");
      return null;
    }

    const pieces = [];
    let full = 0, cut = 0, covered = 0;
    const EPS = 0.02;                   // tolérance en cm²/cm

    for(let jj = j0; jj <= j1; jj++){
      let ro = 0;
      if(t.pattern === 'demi')  ro = mod(jj,2) * cw/2;
      else if(t.pattern === 'tiers') ro = mod(jj,3) * cw/3;

      for(let ii = i0; ii <= i1; ii++){
        const x0 = ii*cw + bx + ro, y0 = jj*ch + by;
        const x1 = x0 + tw,        y1 = y0 + th;
        if(x1 < lb.x || x0 > lb.x2 || y1 < lb.y || y0 > lb.y2) continue;

        const clip = G.clipRect(roomL, x0, y0, x1, y1);
        if(clip.length < 3) continue;
        const a = G.area(clip);
        if(a < 0.5) continue;           // moins de 0,5 cm² : négligeable

        const isFull = a >= tw*th - EPS*10;
        covered += a;

        const world = clip.map(F.toWorld);
        const p = { full: isFull, world, area: a, x0, y0, ref: null };

        if(!isFull){
          /* forme de la coupe rapportée au carreau puis à sa boîte */
          const inTile = clip.map(q => ({ x: q.x - x0, y: q.y - y0 }));
          const tb = G.bbox(inTile);
          p.shape = inTile.map(q => ({ x: q.x - tb.x, y: q.y - tb.y }));
          p.bw = tb.w; p.bh = tb.h;     // dimensions à débiter
          p.bx = tb.x; p.by = tb.y;     // position dans le carreau d'origine
          cut++;
        } else full++;

        const c = G.centroid(world);
        p.cx = c.x; p.cy = c.y;
        pieces.push(p);
      }
    }

    /* numérotation des coupes : de haut en bas, de gauche à droite */
    const cuts = pieces.filter(p => !p.full)
      .sort((a,b) => (a.cy - b.cy) || (a.cx - b.cx));
    cuts.forEach((p,i) => { p.ref = 'C' + String(i+1).padStart(2,'0'); });

    tilesCache = {
      pieces, cuts, full, cut, covered,
      tw, th, cw, ch, joint: j, O, F, bx, by,
      lattice: { i0, i1, j0, j1 }
    };
    return tilesCache;
  },

  /* garantit un cache à jour */
  get(){
    if(dirty){ T.build(); dirty = false; }
    return tilesCache;
  }
};
