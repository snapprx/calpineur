"use strict";
/* 02-geom.js — géométrie de base : vecteurs, polygones, découpe. */

const G = {

  dist: (a,b) => Math.hypot(a.x-b.x, a.y-b.y),

  /* aire absolue d'un polygone (formule des lacets) */
  area(p){
    if(!p || p.length < 3) return 0;
    let s = 0;
    for(let i=0, j=p.length-1; i<p.length; j=i++) s += p[j].x*p[i].y - p[i].x*p[j].y;
    return Math.abs(s/2);
  },

  perimeter(p, closed){
    if(!p || p.length < 2) return 0;
    let s = 0;
    const n = closed ? p.length : p.length - 1;
    for(let i=0;i<n;i++) s += G.dist(p[i], p[(i+1)%p.length]);
    return s;
  },

  centroid(p){
    let x=0, y=0;
    for(const q of p){ x += q.x; y += q.y; }
    return { x:x/p.length, y:y/p.length };
  },

  bbox(p){
    if(!p || !p.length) return { x:0, y:0, w:600, h:400, x2:600, y2:400 };
    let x1=Infinity, y1=Infinity, x2=-Infinity, y2=-Infinity;
    for(const q of p){
      if(q.x<x1) x1=q.x; if(q.y<y1) y1=q.y;
      if(q.x>x2) x2=q.x; if(q.y>y2) y2=q.y;
    }
    return { x:x1, y:y1, x2, y2, w:Math.max(x2-x1, 0.001), h:Math.max(y2-y1, 0.001) };
  },

  inPoly(pt, poly){
    let c = false;
    for(let i=0, j=poly.length-1; i<poly.length; j=i++){
      const a = poly[i], b = poly[j];
      if(((a.y > pt.y) !== (b.y > pt.y)) &&
         (pt.x < (b.x-a.x)*(pt.y-a.y)/(b.y-a.y) + a.x)) c = !c;
    }
    return c;
  },

  segInter(a,b,c,d){
    const d1 = (b.x-a.x)*(c.y-a.y) - (b.y-a.y)*(c.x-a.x);
    const d2 = (b.x-a.x)*(d.y-a.y) - (b.y-a.y)*(d.x-a.x);
    const d3 = (d.x-c.x)*(a.y-c.y) - (d.y-c.y)*(a.x-c.x);
    const d4 = (d.x-c.x)*(b.y-c.y) - (d.y-c.y)*(b.x-c.x);
    return ((d1>0) !== (d2>0)) && ((d3>0) !== (d4>0));
  },

  /* normale unitaire sortante d'un mur a->b du polygone poly */
  outward(a, b, poly){
    const dx = b.x-a.x, dy = b.y-a.y, l = Math.hypot(dx,dy) || 1;
    let n = { x: dy/l, y: -dx/l };
    const mid = { x:(a.x+b.x)/2, y:(a.y+b.y)/2 };
    if(poly && poly.length > 2 && G.inPoly({ x:mid.x+n.x*0.8, y:mid.y+n.y*0.8 }, poly)) n = { x:-n.x, y:-n.y };
    return n;
  },

  /* --- découpe d'un polygone par un rectangle aligné (Sutherland–Hodgman) ---
     Le sujet peut être concave ; la fenêtre de découpe est convexe, donc le
     résultat est correct. Retourne [] si l'intersection est vide.            */
  clipRect(poly, x1, y1, x2, y2){
    let p = poly;
    p = G._half(p, q => q.x >= x1, (a,b) => G._ix(a,b,x1)); if(p.length < 3) return [];
    p = G._half(p, q => q.x <= x2, (a,b) => G._ix(a,b,x2)); if(p.length < 3) return [];
    p = G._half(p, q => q.y >= y1, (a,b) => G._iy(a,b,y1)); if(p.length < 3) return [];
    p = G._half(p, q => q.y <= y2, (a,b) => G._iy(a,b,y2)); if(p.length < 3) return [];
    return p;
  },
  _half(poly, inside, inter){
    const res = [], n = poly.length;
    for(let i=0;i<n;i++){
      const a = poly[i], b = poly[(i+1)%n];
      const ia = inside(a), ib = inside(b);
      if(ia){ res.push(a); if(!ib) res.push(inter(a,b)); }
      else if(ib){ res.push(inter(a,b)); }
    }
    return res;
  },
  _ix: (a,b,x) => ({ x, y: a.y + (b.y-a.y)*(x-a.x)/(b.x-a.x) }),
  _iy: (a,b,y) => ({ x: a.x + (b.x-a.x)*(y-a.y)/(b.y-a.y), y }),

  /* repère local de la pose : rotation d'angle rot autour de l'origine O */
  frame(O, rotDeg){
    const a = rad(rotDeg), ca = Math.cos(a), sa = Math.sin(a);
    return {
      toLocal: p => { const dx = p.x-O.x, dy = p.y-O.y; return { x: dx*ca + dy*sa, y: -dx*sa + dy*ca }; },
      toWorld: p => ({ x: O.x + p.x*ca - p.y*sa, y: O.y + p.x*sa + p.y*ca })
    };
  }
};
