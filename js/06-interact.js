"use strict";
/* 06-interact.js — souris, clavier, modes. */

const IX = {
  mouse: { x:0, y:0, inside:false },
  shift: false, space: false,
  preview: null, guides: [], dimHits: [],
  poseDrag: null,

  /* ---------------- modes ---------------- */
  setMode(m){
    S.mode = m;
    document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
    CV.style.cursor = m === 'draw' ? 'crosshair'
                    : m === 'pan'  ? 'grab'
                    : m === 'pose' ? 'move'
                    : m === 'measure' ? 'crosshair' : 'default';
    const help = {
      draw:    "Cliquez pour poser un point, ou tapez la longueur au clavier puis Entrée.",
      edit:    "Glissez un sommet. Cliquez une cote pour saisir la longueur exacte.",
      pose:    "Maintenez et glissez pour déplacer le calepinage. Maj+glisser ou clic droit pour le faire tourner.",
      measure: "Cliquez deux points pour relever une distance. Les sommets et les angles de carreaux sont aimantés.",
      pan:     "Glissez pour déplacer la vue."
    };
    $('modeHelp').textContent = help[m] || '';
    $('modeLabel').textContent = help[m] || '';
    S.pending = null;
    R.draw();
  },

  /* ---------------- aperçu du tracé ---------------- */
  computePreview(){
    IX.guides = [];
    if(!S.pts.length || S.closed){ IX.preview = null; return; }
    const p0 = S.pts[S.pts.length-1];
    const m = s2w(IX.mouse.x, IX.mouse.y);
    let len = Math.hypot(m.x-p0.x, m.y-p0.y);
    let ang = deg(Math.atan2(-(m.y-p0.y), m.x-p0.x));
    const magnet = (S.snap !== IX.shift) && S.snapStep > 0;
    let snapped = false;

    if(S.typed.ang !== ''){ ang = parseFloat(S.typed.ang) || 0; snapped = true; }
    else if(magnet){
      /* aimantation douce : on ne corrige que dans la zone d'attraction */
      const sa = Math.round(ang/S.snapStep) * S.snapStep;
      if(Math.abs(mod(ang - sa + 180, 360) - 180) < S.snapTol){ ang = sa; snapped = true; }
    }
    if(S.typed.len !== '') len = toCm(parseFloat(S.typed.len.replace(',','.')) || 0);

    const dir = { x: Math.cos(rad(ang)), y: -Math.sin(rad(ang)) };
    let p = { x: p0.x + dir.x*len, y: p0.y + dir.y*len };

    if(S.typed.len === ''){
      /* alignement sur l'abscisse ou l'ordonnée d'un sommet existant */
      for(const q of S.pts){
        for(const ax of ['x','y']){
          if(Math.abs(dir[ax]) < 1e-6) continue;
          const t = (q[ax] - p0[ax]) / dir[ax];
          if(t <= 1) continue;
          const cand = { x: p0.x + dir.x*t, y: p0.y + dir.y*t };
          if(G.dist(cand, p) * S.px < 9){ len = t; p = cand; IX.guides.push({ a:q, b:cand }); }
        }
      }
      if(!IX.guides.length){ len = Math.round(len); p = { x: p0.x + dir.x*len, y: p0.y + dir.y*len }; }
    }

    let closing = false;
    if(S.pts.length > 2 && S.typed.len === '' && G.dist(p, S.pts[0]) * S.px < 12){
      p = { x:S.pts[0].x, y:S.pts[0].y }; len = G.dist(p0,p); closing = true;
    }
    IX.preview = { p, len, ang: mod(ang,360), snapped, closing };
  },

  /* ---------------- accrochage pour le mètre ---------------- */
  snapPoint(sx, sy){
    const w = s2w(sx, sy);
    let best = null, bd = 12;                    // rayon d'accrochage en px

    for(const q of S.pts){                       // sommets du contour
      const d = G.dist(w,q) * S.px;
      if(d < bd){ bd = d; best = { x:q.x, y:q.y, kind:'sommet' }; }
    }
    const tc = S.closed ? T.get() : null;
    if(tc && S.show.tiles){                      // angles de carreaux
      const L = tc.F.toLocal(w);
      const jj = Math.round((L.y - tc.by) / tc.ch);
      let ro = 0;
      if(S.tile.pattern === 'demi')  ro = mod(jj,2) * tc.cw/2;
      else if(S.tile.pattern === 'tiers') ro = mod(jj,3) * tc.cw/3;
      const ii = Math.round((L.x - tc.bx - ro) / tc.cw);
      for(const dx of [0, tc.tw]) for(const dy of [0, tc.th]){
        const c = tc.F.toWorld({ x: ii*tc.cw + tc.bx + ro + dx, y: jj*tc.ch + tc.by + dy });
        const d = G.dist(w,c) * S.px;
        if(d < bd){ bd = d; best = { x:c.x, y:c.y, kind:'carreau' }; }
      }
    }
    if(!best && S.pts.length > 1){               // projection sur un mur
      const n = S.pts.length, last = S.closed ? n : n-1;
      for(let i=0;i<last;i++){
        const a = S.pts[i], b = S.pts[(i+1)%n];
        const dx = b.x-a.x, dy = b.y-a.y, l2 = dx*dx + dy*dy || 1;
        let t = clamp(((w.x-a.x)*dx + (w.y-a.y)*dy)/l2, 0, 1);
        const c = { x:a.x + dx*t, y:a.y + dy*t };
        const d = G.dist(w,c) * S.px;
        if(d < bd){ bd = d; best = { x:c.x, y:c.y, kind:'mur' }; }
      }
    }
    return best || { x: Math.round(w.x), y: Math.round(w.y), kind:'libre' };
  },

  /* ---------------- tests de survol ---------------- */
  hitVertex(sx, sy){
    for(let i=0;i<S.pts.length;i++){
      const q = w2s(S.pts[i]);
      if(Math.hypot(q.x-sx, q.y-sy) < 9) return i;
    }
    return -1;
  },
  hitDim(sx, sy){
    for(const d of IX.dimHits)
      if(Math.abs(sx-d.x) < d.w/2 && Math.abs(sy-d.y) < d.h/2) return d.i;
    return -1;
  },
  hitEdge(sx, sy){
    const p = S.pts, n = p.length, last = S.closed ? n : n-1;
    for(let i=0;i<last;i++){
      const a = w2s(p[i]), b = w2s(p[(i+1)%n]);
      const dx = b.x-a.x, dy = b.y-a.y, l2 = dx*dx + dy*dy || 1;
      const t = clamp(((sx-a.x)*dx + (sy-a.y)*dy)/l2, 0, 1);
      if(Math.hypot(a.x + dx*t - sx, a.y + dy*t - sy) < 7) return { i, t };
    }
    return null;
  },

  /* ---------------- actions ---------------- */
  undo(){
    if(S.closed) S.closed = false;
    else if(S.pts.length) S.pts.pop();
    markDirty(); IX.computePreview(); R.draw(); ST.save();
  },
  closeShape(){
    if(S.pts.length > 2 && !S.closed){
      S.closed = true; markDirty(); R.draw(); ST.save();
      UIx.msg('Contour fermé');
    }
  },
  setRot(v){
    S.tile.rot = mod(v, 360);
    $('rot').value = S.tile.rot.toFixed(1).replace(/\.0$/,'');
    $('rotR').value = S.tile.rot > 90 ? 0 : S.tile.rot;
    markDirty(); R.draw(); ST.save();
  },
  nudgePose(dx, dy){
    S.tile.offx = +(S.tile.offx + dx).toFixed(2);
    S.tile.offy = +(S.tile.offy + dy).toFixed(2);
    $('offx').value = S.tile.offx; $('offy').value = S.tile.offy;
    markDirty(); R.draw(); ST.save();
  },

  /* ---------------- branchement ---------------- */
  bind(){
    const cv = CV;

    cv.addEventListener('mousemove', e => {
      const r = cv.getBoundingClientRect();
      const nx = e.clientX - r.left, ny = e.clientY - r.top;
      const dx = nx - IX.mouse.x, dy = ny - IX.mouse.y;

      if(S.panning){ S.ox += dx; S.oy += dy; }
      IX.mouse.x = nx; IX.mouse.y = ny; IX.mouse.inside = true;

      const w = s2w(nx, ny);
      $('stPos').textContent = fmtLen(w.x) + '  ;  ' + fmtLen(w.y);

      if(IX.poseDrag){
        const k = S.poseSens/100;
        if(IX.poseDrag.rotate){
          IX.setRot(S.tile.rot + dx * 0.12 * k);
        } else {
          const a = rad(S.tile.rot), ca = Math.cos(a), sa = Math.sin(a);
          const wx = dx/S.px * k, wy = dy/S.px * k;
          S.tile.offx += wx*ca + wy*sa;
          S.tile.offy += -wx*sa + wy*ca;
          $('offx').value = S.tile.offx.toFixed(1);
          $('offy').value = S.tile.offy.toFixed(1);
          markDirty();
        }
      } else if(S.drag >= 0){
        let np = { x:w.x, y:w.y };
        if((S.snap !== IX.shift) && S.snapStep > 0){
          const n = S.pts.length;
          for(const q of [S.pts[(S.drag-1+n)%n], S.pts[(S.drag+1)%n]]){
            if(!q || q === S.pts[S.drag]) continue;
            const a = deg(Math.atan2(-(np.y-q.y), np.x-q.x));
            const sa = Math.round(a/S.snapStep) * S.snapStep;
            if(Math.abs(mod(a - sa + 180, 360) - 180) < S.snapTol){
              const L = G.dist(np,q);
              np = { x: q.x + L*Math.cos(rad(sa)), y: q.y - L*Math.sin(rad(sa)) };
            }
          }
        }
        S.pts[S.drag] = { x: Math.round(np.x*10)/10, y: Math.round(np.y*10)/10 };
        markDirty();
      } else if(S.mode === 'edit'){
        S.hoverPt = IX.hitVertex(nx, ny);
        cv.style.cursor = S.hoverPt >= 0 ? 'grab' : (IX.hitDim(nx,ny) >= 0 ? 'text' : 'default');
      } else if(S.mode === 'measure' && S.pending){
        S.pending.b = IX.snapPoint(nx, ny);
      }

      if(S.mode === 'draw') IX.computePreview();
      R.draw();
    });

    cv.addEventListener('mouseleave', () => { IX.mouse.inside = false; R.draw(); });

    cv.addEventListener('mousedown', e => {
      const r = cv.getBoundingClientRect();
      const sx = e.clientX - r.left, sy = e.clientY - r.top;

      if(e.button === 1 || S.mode === 'pan' || IX.space){
        S.panning = true; cv.style.cursor = 'grabbing'; e.preventDefault(); return;
      }
      if(S.mode === 'pose'){
        if(e.button === 0 || e.button === 2){
          IX.poseDrag = { rotate: (e.button === 2) || IX.shift };
          cv.style.cursor = IX.poseDrag.rotate ? 'ew-resize' : 'grabbing';
          e.preventDefault();
        }
        return;
      }
      if(e.button !== 0) return;

      if(S.mode === 'draw'){
        if(S.closed) return;
        IX.computePreview();
        if(!S.pts.length){
          const w = s2w(sx, sy);
          S.pts.push({ x: Math.round(w.x), y: Math.round(w.y) });
        } else if(IX.preview){
          if(IX.preview.closing){ S.closed = true; UIx.msg('Contour fermé'); }
          else S.pts.push({ x: IX.preview.p.x, y: IX.preview.p.y });
        }
        S.typed = { len:'', ang:'', field:'len' };
        markDirty(); IX.computePreview(); R.draw(); ST.save();
        return;
      }

      if(S.mode === 'measure'){
        const p = IX.snapPoint(sx, sy);
        if(!S.pending) S.pending = { a:p, b:p };
        else { S.measures.push({ a:S.pending.a, b:p }); S.pending = null; UIx.measList(); ST.save(); }
        R.draw();
        return;
      }

      if(S.mode === 'edit'){
        const v = IX.hitVertex(sx, sy);
        if(v >= 0){ S.drag = v; cv.style.cursor = 'grabbing'; return; }
        const d = IX.hitDim(sx, sy);
        if(d >= 0) UIx.editWall(d, sx, sy);
      }
    });

    window.addEventListener('mouseup', () => {
      if(S.drag >= 0){ S.drag = -1; markDirty(); ST.save(); }
      if(IX.poseDrag){ IX.poseDrag = null; ST.save(); }
      S.panning = false;
      CV.style.cursor = S.mode === 'draw' ? 'crosshair' : (S.mode === 'pose' ? 'move' : 'default');
      R.draw();
    });

    cv.addEventListener('dblclick', e => {
      if(S.mode !== 'edit') return;
      const r = cv.getBoundingClientRect();
      const h = IX.hitEdge(e.clientX - r.left, e.clientY - r.top);
      if(h){
        const a = S.pts[h.i], b = S.pts[(h.i+1)%S.pts.length];
        S.pts.splice(h.i+1, 0, { x: Math.round(a.x + (b.x-a.x)*h.t), y: Math.round(a.y + (b.y-a.y)*h.t) });
        markDirty(); R.draw(); ST.save(); UIx.msg('Point ajouté');
      }
    });

    cv.addEventListener('contextmenu', e => {
      e.preventDefault();
      if(S.mode !== 'edit') return;
      const r = cv.getBoundingClientRect();
      const v = IX.hitVertex(e.clientX - r.left, e.clientY - r.top);
      if(v >= 0 && S.pts.length > 3){
        S.pts.splice(v,1); markDirty(); R.draw(); ST.save(); UIx.msg('Point supprimé');
      }
    });

    cv.addEventListener('wheel', e => {
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      R.zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.12 : 1/1.12);
    }, { passive:false });

    window.addEventListener('keydown', e => {
      const tag = e.target.tagName;
      if(tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA'){
        if(e.key === 'Escape') e.target.blur();
        return;
      }
      if(e.key === 'Shift'){ IX.shift = true; if(S.mode==='draw'){ IX.computePreview(); R.draw(); } return; }
      if(e.key === ' '){ IX.space = true; CV.style.cursor = 'grab'; e.preventDefault(); return; }

      const typing = (S.mode === 'draw' && !S.closed && S.pts.length);

      if(typing){
        if(/^[0-9]$/.test(e.key) || e.key === '.' || e.key === ','){
          const k = (e.key === ',' ? '.' : e.key);
          if(S.typed.field === 'len') S.typed.len += k; else S.typed.ang += k;
          IX.computePreview(); R.draw(); e.preventDefault(); return;
        }
        if(e.key === '-' && S.typed.field === 'ang'){
          S.typed.ang = S.typed.ang.startsWith('-') ? S.typed.ang.slice(1) : '-' + S.typed.ang;
          IX.computePreview(); R.draw(); return;
        }
        if(e.key === 'Tab'){
          S.typed.field = S.typed.field === 'len' ? 'ang' : 'len';
          IX.computePreview(); R.draw(); e.preventDefault(); return;
        }
        if(e.key === 'Enter'){
          IX.computePreview();
          if(IX.preview){
            if(IX.preview.closing) S.closed = true;
            else S.pts.push({ x: IX.preview.p.x, y: IX.preview.p.y });
            S.typed = { len:'', ang:'', field:'len' };
            markDirty(); IX.computePreview(); R.draw(); ST.save();
          }
          e.preventDefault(); return;
        }
        if(e.key === 'Backspace'){
          if(S.typed.field === 'len' && S.typed.len) S.typed.len = S.typed.len.slice(0,-1);
          else if(S.typed.field === 'ang' && S.typed.ang) S.typed.ang = S.typed.ang.slice(0,-1);
          else IX.undo();
          IX.computePreview(); R.draw(); e.preventDefault(); return;
        }
        if(e.key === 'Escape'){ S.typed = { len:'', ang:'', field:'len' }; IX.computePreview(); R.draw(); return; }
      } else {
        const modes = { '1':'draw', '2':'edit', '3':'pose', '4':'measure', '5':'pan' };
        if(modes[e.key]){ IX.setMode(modes[e.key]); return; }
      }

      if(e.key === 'Escape' && S.mode === 'measure'){ S.pending = null; R.draw(); return; }
      if(e.key === 'Backspace'){ IX.undo(); e.preventDefault(); return; }
      if(e.key.toLowerCase() === 'c'){ IX.closeShape(); return; }
      if(e.key === '['){ IX.setRot(S.tile.rot - 5); return; }
      if(e.key === ']'){ IX.setRot(S.tile.rot + 5); return; }

      if(S.mode === 'pose'){
        const st = e.shiftKey ? 5 : 0.5;
        if(e.key === 'ArrowLeft'){  IX.nudgePose(-st, 0); e.preventDefault(); }
        if(e.key === 'ArrowRight'){ IX.nudgePose( st, 0); e.preventDefault(); }
        if(e.key === 'ArrowUp'){    IX.nudgePose(0, -st); e.preventDefault(); }
        if(e.key === 'ArrowDown'){  IX.nudgePose(0,  st); e.preventDefault(); }
      }
    });

    window.addEventListener('keyup', e => {
      if(e.key === 'Shift'){ IX.shift = false; if(S.mode==='draw'){ IX.computePreview(); R.draw(); } }
      if(e.key === ' '){ IX.space = false; CV.style.cursor = S.mode === 'draw' ? 'crosshair' : 'default'; }
    });

    window.addEventListener('resize', () => R.resize());
  }
};
