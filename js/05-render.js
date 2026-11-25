"use strict";
/* 05-render.js — rendu du plan sur le canvas. */

let CV = null, CTX = null, VW = 0, VH = 0, DPR = 1;

function w2s(p){ return { x: S.ox + p.x*S.px, y: S.oy + p.y*S.px }; }
function s2w(x,y){ return { x: (x - S.ox)/S.px, y: (y - S.oy)/S.px }; }

const COL = {
  paper:'#f4f6f8', gridS:'#e0e8ef', gridL:'#c1d1e0',
  joint:'#5c6672', tile:'#eceff2', cut:'#f6dda4',
  ink:'#12161c', dim:'#7b8899', chalk:'#5aa9e6', ochre:'#e0a325', meas:'#1f7a5a'
};

const R = {

  gridStep(){
    const cand = [1,2,5,10,25,50,100,200,500,1000,2000,5000];
    for(const c of cand) if(c * S.px >= 16) return c;
    return 10000;
  },

  resize(){
    const r = $('wrap').getBoundingClientRect();
    VW = r.width; VH = r.height; DPR = window.devicePixelRatio || 1;
    CV.width = VW*DPR; CV.height = VH*DPR;
    CV.style.width = VW+'px'; CV.style.height = VH+'px';
    CTX.setTransform(DPR,0,0,DPR,0,0);
    R.draw();
  },

  fitView(){
    const bb = G.bbox(S.pts.length ? S.pts : [{x:0,y:0},{x:600,y:0},{x:600,y:400},{x:0,y:400}]);
    const pad = 96;
    S.px = clamp(Math.min((VW-2*pad)/bb.w, (VH-2*pad)/bb.h), 0.01, 40);
    S.ox = VW/2 - (bb.x + bb.w/2)*S.px;
    S.oy = VH/2 - (bb.y + bb.h/2)*S.px;
    R.draw();
  },

  zoomAt(sx, sy, f){
    const w = s2w(sx, sy);
    S.px = clamp(S.px*f, 0.01, 40);
    S.ox = sx - w.x*S.px; S.oy = sy - w.y*S.px;
    R.draw();
  },

  draw(){
    R.scene(CTX, VW, VH, { screen:true });
    UIx.hud(); UIx.stats();
    $('stZoom').textContent = '1 cm = ' + S.px.toFixed(2) + ' px';
  },

  /* ---------------- scène complète ---------------- */
  scene(g, w, h, o){
    o = o || {};
    if(o.screen) IX.dimHits = [];

    g.clearRect(0,0,w,h);
    g.fillStyle = COL.paper; g.fillRect(0,0,w,h);

    if(S.show.grid) R.grid(g,w,h);
    if(S.closed && S.pts.length > 2) R.tiles(g, o);
    R.outline(g);
    if(o.screen) R.liveSegment(g);
    R.measures(g, o);
    if(o.screen) R.vertices(g);
    if(S.show.dims && S.pts.length > 1) R.dims(g, o);
    if(o.screen && S.mode === 'pose') R.poseGizmo(g);
  },

  grid(g,w,h){
    const st = R.gridStep(), big = st*5;
    const a = s2w(0,0), b = s2w(w,h);
    g.lineWidth = 1;
    for(let x = Math.floor(a.x/st)*st; x <= b.x; x += st){
      const sx = Math.round(w2s({x,y:0}).x) + .5;
      g.strokeStyle = Math.abs(mod(x,big)) < 1e-6 ? COL.gridL : COL.gridS;
      g.beginPath(); g.moveTo(sx,0); g.lineTo(sx,h); g.stroke();
    }
    for(let y = Math.floor(a.y/st)*st; y <= b.y; y += st){
      const sy = Math.round(w2s({x:0,y}).y) + .5;
      g.strokeStyle = Math.abs(mod(y,big)) < 1e-6 ? COL.gridL : COL.gridS;
      g.beginPath(); g.moveTo(0,sy); g.lineTo(w,sy); g.stroke();
    }
  },

  poly(g, pts){
    const p = pts.map(w2s);
    g.beginPath(); g.moveTo(p[0].x, p[0].y);
    for(let i=1;i<p.length;i++) g.lineTo(p[i].x, p[i].y);
    g.closePath();
  },

  tiles(g, o){
    /* fond couleur joint, puis chaque pièce par-dessus : les joints
       apparaissent naturellement entre les carreaux. */
    R.poly(g, S.pts);
    g.fillStyle = S.show.tiles ? COL.joint : 'rgba(90,169,230,.10)';
    g.fill();
    if(!S.show.tiles) return;

    const tc = T.get();
    if(!tc) return;
    const stroke = S.px > 0.25;
    const nums = (o.numbers !== undefined ? o.numbers : S.show.nums);

    for(const p of tc.pieces){
      R.poly(g, p.world);
      g.fillStyle = p.full ? COL.tile : (S.show.cuts ? COL.cut : COL.tile);
      g.fill();
      if(stroke){ g.strokeStyle = 'rgba(0,0,0,.07)'; g.lineWidth = 1; g.stroke(); }
    }

    if(nums){
      const fs = clamp(Math.min(tc.tw, tc.th) * S.px * 0.30, 6, 15);
      g.font = '600 ' + fs.toFixed(1) + 'px ' + 'ui-monospace, Consolas, monospace';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      for(const p of tc.cuts){
        if(p.area * S.px * S.px < 240) continue;   // trop petit pour être lisible
        const c = w2s({ x:p.cx, y:p.cy });
        g.fillStyle = 'rgba(255,255,255,.82)';
        const tw = g.measureText(p.ref).width;
        g.fillRect(c.x - tw/2 - 3, c.y - fs*0.7, tw + 6, fs*1.4);
        g.fillStyle = '#6b4c05';
        g.fillText(p.ref, c.x, c.y + 0.5);
      }
    }
  },

  outline(g){
    if(!S.pts.length) return;
    const p = S.pts.map(w2s);
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.strokeStyle = COL.ink; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(p[0].x, p[0].y);
    for(let i=1;i<p.length;i++) g.lineTo(p[i].x, p[i].y);
    if(S.closed) g.closePath();
    g.stroke();
  },

  liveSegment(g){
    if(IX.guides.length){
      g.save(); g.setLineDash([5,4]); g.strokeStyle = COL.ochre; g.lineWidth = 1;
      for(const gd of IX.guides){
        const a = w2s(gd.a), b = w2s(gd.b);
        g.beginPath(); g.moveTo(a.x,a.y); g.lineTo(b.x,b.y); g.stroke();
      }
      g.restore();
    }
    if(S.mode !== 'draw' || S.closed || !S.pts.length || !IX.preview || !IX.mouse.inside) return;
    const a = w2s(S.pts[S.pts.length-1]), b = w2s(IX.preview.p);
    g.save(); g.setLineDash([6,4]); g.strokeStyle = COL.chalk; g.lineWidth = 2;
    g.beginPath(); g.moveTo(a.x,a.y); g.lineTo(b.x,b.y); g.stroke(); g.restore();
    g.fillStyle = COL.chalk; g.beginPath(); g.arc(b.x,b.y,4,0,7); g.fill();
    if(IX.preview.snapped){
      g.strokeStyle = COL.ochre; g.lineWidth = 2;
      g.beginPath(); g.arc(a.x, a.y, 16, 0, 7); g.stroke();
    }
  },

  vertices(g){
    const p = S.pts.map(w2s);
    for(let i=0;i<p.length;i++){
      const hov = (i === S.hoverPt || i === S.drag);
      g.beginPath(); g.arc(p[i].x, p[i].y, hov ? 6.5 : 4.5, 0, 7);
      g.fillStyle = hov ? COL.ochre : '#fff'; g.fill();
      g.strokeStyle = COL.ink; g.lineWidth = 2; g.stroke();
    }
  },

  measures(g, o){
    const list = S.measures.slice();
    if(S.pending && S.pending.b) list.push(S.pending);
    if(!list.length) return;
    g.save();
    g.font = '600 12px ui-monospace, Consolas, monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    list.forEach((m, i) => {
      const a = w2s(m.a), b = w2s(m.b);
      g.strokeStyle = COL.meas; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(a.x,a.y); g.lineTo(b.x,b.y); g.stroke();
      for(const q of [a,b]){
        g.beginPath(); g.arc(q.x, q.y, 3.4, 0, 7);
        g.fillStyle = COL.meas; g.fill();
      }
      const L = G.dist(m.a, m.b);
      let ang = Math.atan2(b.y-a.y, b.x-a.x);
      if(ang > Math.PI/2 || ang < -Math.PI/2) ang += Math.PI;
      const txt = (o && o.labels === false ? '' : 'M' + (i+1) + '  ' + fmtLen(L));
      if(txt){
        const tw = g.measureText(txt).width;
        g.save();
        g.translate((a.x+b.x)/2, (a.y+b.y)/2); g.rotate(ang); g.translate(0,-11);
        g.fillStyle = '#e6f3ee'; g.strokeStyle = COL.meas; g.lineWidth = 1;
        g.fillRect(-tw/2-5,-9,tw+10,18); g.strokeRect(-tw/2-5,-9,tw+10,18);
        g.fillStyle = '#0f4f39'; g.fillText(txt, 0, 1);
        g.restore();
      }
    });
    g.restore();
  },

  dims(g, o){
    const p = S.pts, n = p.length, last = S.closed ? n : n-1;
    g.font = '600 12px ui-monospace, Consolas, monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for(let i=0;i<last;i++){
      const a = p[i], b = p[(i+1)%n];
      const L = G.dist(a,b); if(L < 1) continue;
      const nr = G.outward(a, b, S.closed ? p : null);
      const off = 26/S.px, tick = 7/S.px;
      const A  = w2s({ x:a.x+nr.x*off,  y:a.y+nr.y*off });
      const B  = w2s({ x:b.x+nr.x*off,  y:b.y+nr.y*off });
      const A0 = w2s({ x:a.x+nr.x*tick, y:a.y+nr.y*tick });
      const B0 = w2s({ x:b.x+nr.x*tick, y:b.y+nr.y*tick });

      g.strokeStyle = COL.dim; g.lineWidth = 1;
      g.beginPath();
      g.moveTo(A0.x,A0.y); g.lineTo(A.x,A.y);
      g.moveTo(B0.x,B0.y); g.lineTo(B.x,B.y);
      g.moveTo(A.x,A.y);   g.lineTo(B.x,B.y);
      g.stroke();
      const d = { x:B.x-A.x, y:B.y-A.y }, l = Math.hypot(d.x,d.y) || 1;
      for(const q of [A,B]){
        g.beginPath();
        g.moveTo(q.x - d.x/l*4 - d.y/l*4, q.y - d.y/l*4 + d.x/l*4);
        g.lineTo(q.x + d.x/l*4 + d.y/l*4, q.y + d.y/l*4 - d.x/l*4);
        g.stroke();
      }
      const mx = (A.x+B.x)/2, my = (A.y+B.y)/2;
      let ang = Math.atan2(B.y-A.y, B.x-A.x);
      if(ang > Math.PI/2 || ang < -Math.PI/2) ang += Math.PI;
      const txt = fmtLen(L), tw = g.measureText(txt).width;
      g.save();
      g.translate(mx,my); g.rotate(ang);
      g.fillStyle = COL.paper; g.fillRect(-tw/2-5,-9,tw+10,18);
      g.fillStyle = COL.ink;   g.fillText(txt, 0, 1);
      g.restore();
      if(o && o.screen) IX.dimHits.push({ i, x:mx, y:my, w:tw+14, h:20 });
    }
  },

  /* repère de la pose : origine et axes du calepinage */
  poseGizmo(g){
    const tc = T.get(); if(!tc) return;
    const o = tc.F.toWorld({ x: tc.bx, y: tc.by });
    const ex = tc.F.toWorld({ x: tc.bx + tc.cw*1.4, y: tc.by });
    const ey = tc.F.toWorld({ x: tc.bx, y: tc.by + tc.ch*1.4 });
    const O = w2s(o), X = w2s(ex), Y = w2s(ey);
    g.save(); g.lineWidth = 2.4;
    g.strokeStyle = COL.ochre;
    g.beginPath(); g.moveTo(O.x,O.y); g.lineTo(X.x,X.y); g.stroke();
    g.strokeStyle = COL.chalk;
    g.beginPath(); g.moveTo(O.x,O.y); g.lineTo(Y.x,Y.y); g.stroke();
    g.fillStyle = '#fff'; g.strokeStyle = COL.ink; g.lineWidth = 2;
    g.beginPath(); g.arc(O.x,O.y,5.5,0,7); g.fill(); g.stroke();
    g.restore();
  }
};
