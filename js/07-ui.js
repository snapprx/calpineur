"use strict";
/* 07-ui.js — panneau latéral, HUD, messages, saisies. */

const UIx = {

  msg(t){
    $('stMsg').textContent = t;
    clearTimeout(UIx._m); UIx._m = setTimeout(() => { $('stMsg').textContent = ''; }, 2600);
  },
  toast(t){
    const el = $('toast'); el.textContent = t; el.classList.add('show');
    clearTimeout(UIx._t); UIx._t = setTimeout(() => el.classList.remove('show'), 2800);
  },

  /* ---------------- HUD flottant ---------------- */
  hud(){
    const hud = $('hud'), A = $('hudA'), B = $('hudB');
    let a = null, b = null, actA = false, actB = false;

    if(S.mode === 'draw' && !S.closed && S.pts.length && IX.mouse.inside){
      const len = S.typed.len !== '' ? S.typed.len
                : (IX.preview ? fromCm(IX.preview.len).toFixed(S.unit === 'm' ? 2 : 0) : '0');
      const ang = S.typed.ang !== '' ? S.typed.ang
                : (IX.preview ? IX.preview.ang.toFixed(1) : '0');
      a = ['LONG', len + ' ' + S.unit];
      b = ['ANGLE', ang + '°'];
      actA = S.typed.field === 'len'; actB = S.typed.field === 'ang';
    } else if(S.mode === 'pose' && IX.mouse.inside){
      a = ['DÉCAL', S.tile.offx.toFixed(1) + ' ; ' + S.tile.offy.toFixed(1) + ' cm'];
      b = ['ROTATION', S.tile.rot.toFixed(1) + '°'];
    } else if(S.mode === 'measure' && S.pending && IX.mouse.inside){
      const L = G.dist(S.pending.a, S.pending.b);
      const an = mod(deg(Math.atan2(-(S.pending.b.y - S.pending.a.y), S.pending.b.x - S.pending.a.x)), 360);
      a = ['MESURE', fmtLen(L)];
      b = ['ANGLE', an.toFixed(1) + '°'];
    }

    if(!a){ hud.style.display = 'none'; return; }
    hud.style.display = 'flex';
    hud.style.left = (IX.mouse.x + 20) + 'px';
    hud.style.top  = (IX.mouse.y + 18) + 'px';
    A.firstElementChild.textContent = a[0]; A.lastElementChild.textContent = a[1];
    B.firstElementChild.textContent = b[0]; B.lastElementChild.textContent = b[1];
    A.classList.toggle('act', actA); B.classList.toggle('act', actB);
  },

  /* ---------------- chiffres du panneau ---------------- */
  stats(){
    const A = S.closed ? G.area(S.pts) : 0;
    $('sArea').textContent  = A ? fmtM2(A) : '—';
    $('sPerim').textContent = S.pts.length > 1 ? fmtLen(G.perimeter(S.pts, S.closed)) : '—';

    const tc = S.closed ? T.get() : null;
    if(!tc){
      for(const id of ['sFull','sCut','sSrc','sReuse','sTot','sYield']) $(id).textContent = '—';
      $('sBuy').value = '—';
      UIx.plinthStats();
      return;
    }
    $('sFull').textContent = tc.full;
    $('sCut').textContent  = tc.cut;

    /* pendant un glissement on n'exécute pas l'optimisation (trop lourde) */
    if(IX.poseDrag || S.drag >= 0){
      for(const id of ['sSrc','sReuse','sTot','sYield']) $(id).textContent = '…';
      $('sBuy').value = '…';
      return;
    }
    const p = OPT.get();
    if(!p) return;
    $('sSrc').textContent   = p.srcCount;
    $('sReuse').textContent = p.reused + (p.saved > 0 ? '  (−' + p.saved + ' carr.)' : '');
    $('sTot').textContent   = p.total;
    $('sYield').textContent = p.yieldPct.toFixed(1).replace('.', ',') + ' %';
    const buy = Math.ceil(p.total * (1 + S.waste/100));
    $('sBuy').value = buy + ' carr. (' + (buy * tc.tw * tc.th / 10000).toFixed(2).replace('.', ',') + ' m²)';

    UIx.plinthStats();
  },

  /* ---------------- plinthes ---------------- */
  plinthStats(){
    const ids = ['pLin','pDoor','pNet','pFull','pCut','pReuse','pBuy','pPer','pGround','pTiles'];
    $('plBox').classList.toggle('off', !S.plinth.on);

    const show = (id, on) => { const e = $(id); if(e) e.style.display = on ? '' : 'none'; };
    const cut = !S.plinth.stock;
    show('plSrcBox', cut);
    show('pPerK',    cut); show('pPer',    cut);
    show('pTilesK',  cut); show('pTiles',  cut);

    document.querySelectorAll('[data-plmode]').forEach(b =>
      b.classList.toggle('on', b.dataset.plmode === S.plinth.mode));
    $('plModeNote').textContent = S.plinth.mode === 'max'
      ? 'Toutes les bandes sont débitées, milieu du carreau compris. Les bandes centrales n\'ont pas de chant d\'usine : leur arête haute est à poncer ou chanfreiner.'
      : 'Seules les deux bandes en rive sont prises, pour que chaque plinthe garde son chant d\'usine — l\'arête lisse du fabricant, visible une fois posée.';

    const r = S.plinth.on ? PL.get() : null;
    if(!r){
      for(const id of ids) $(id).textContent = '—';
      show('pGroundK', false); show('pGround', false);
      $('plNote').textContent = S.plinth.on ? 'Fermez le contour pour calculer les plinthes.' : '';
      return;
    }
    show('pGroundK', cut && r.ground > 0); show('pGround', cut && r.ground > 0);

    $('pLin').textContent   = fmtLen(r.gross);
    $('pDoor').textContent  = r.doorsLen ? '− ' + fmtLen(r.doorsLen) + '  (' + r.doorsQty + ')' : '—';
    $('pNet').textContent   = fmtLen(r.net);
    $('pFull').textContent  = r.fullCount + (r.spared ? '  (−' + r.spared + ' ouv.)' : '');
    $('pCut').textContent   = r.cutCount;
    $('pReuse').textContent = r.reused;
    $('pBuy').textContent   = r.buy + ' × ' + fmtCm(r.L);
    $('pPer').textContent   = r.impossible ? 'impossible' : String(r.perTile);
    $('pGround').textContent = String(r.ground);
    $('pTiles').textContent = r.impossible ? '—' : String(r.tilesNeeded);

    let note;
    if(r.impossible){
      note = 'Un carreau de ' + fmtCm(r.srcW) + ' × ' + fmtCm(r.srcH) +
             ' ne permet pas de tailler une plinthe de ' + fmtCm(r.L) + ' × ' + fmtCm(r.height) +
             '. Réduisez la longueur ou prenez un carreau plus grand.';
    } else if(cut){
      note = r.perTile + ' plinthes par carreau : ' + r.sense + '.';
      if(r.ground) note += ' ' + r.ground + ' d\'entre elles sortent du milieu et demandent un chant refait.';
      note += ' Ces ' + r.tilesNeeded + ' carreaux s\'ajoutent à ceux du sol.';
      if(r.alt){
        note += ' En mode ' + (r.alt.mode === 'max' ? 'max' : 'mini') + ' : ' +
                r.alt.perTile + ' par carreau, soit ' + r.alt.tiles + ' carreaux (' +
                (r.alt.tiles < r.tilesNeeded ? '−' + (r.tilesNeeded - r.alt.tiles) :
                 '+' + (r.alt.tiles - r.tilesNeeded)) + ').';
      }
      if(r.kerfLoss){
        note += ' Le trait de scie coûte ' + r.kerfLoss + ' plinthe(s) par carreau : ' +
                'une longueur nominale légèrement plus courte les récupérerait.';
      }
    } else {
      note = 'Coupes calées sur les joints du sol, chutes réemployées d\'un mur à l\'autre. ' +
             r.total + ' plinthes nécessaires, ' + r.buy + ' avec la marge de ' + r.waste + ' %.';
    }
    $('plNote').textContent = note;
  },

  doorList(){
    const box = $('doorList');
    box.textContent = '';

    if(!S.doors.length){
      const s = document.createElement('span');
      s.className = 'dim';
      s.style.fontSize = '11px';
      s.textContent = 'Aucune ouverture.';
      box.appendChild(s);
      return;
    }

    const head = document.createElement('div');
    head.className = 'dhead';
    for(const t of ['Largeur (cm)', 'Nombre', '']){
      const c = document.createElement('span'); c.textContent = t; head.appendChild(c);
    }
    box.appendChild(head);

    S.doors.forEach((d, i) => {
      const row = document.createElement('div');
      row.className = 'drow';

      const w = document.createElement('input');
      w.type = 'number'; w.step = '0.5'; w.inputMode = 'decimal'; w.value = d.w;
      w.addEventListener('input', () => {
        const v = parseFloat(String(w.value).replace(',', '.'));
        S.doors[i].w = isFinite(v) ? clamp(v, 0, 2000) : 0;
        markPlinth(); UIx.plinthStats(); ST.save();
      });

      const q = document.createElement('input');
      q.type = 'number'; q.step = '1'; q.min = '0'; q.inputMode = 'numeric'; q.value = d.n;
      q.addEventListener('input', () => {
        const v = parseInt(q.value, 10);
        S.doors[i].n = isFinite(v) ? clamp(v, 0, 999) : 0;
        markPlinth(); UIx.plinthStats(); ST.save();
      });

      const del = document.createElement('button');
      del.textContent = '✕'; del.title = 'Supprimer cette ouverture';
      del.addEventListener('click', () => {
        S.doors.splice(i, 1);
        markPlinth(); UIx.doorList(); UIx.plinthStats(); ST.save();
      });

      row.appendChild(w); row.appendChild(q); row.appendChild(del);
      box.appendChild(row);
    });
  },

  measList(){
    const box = $('measList');
    box.textContent = '';
    if(!S.measures.length){
      const s = document.createElement('span');
      s.className = 'dim'; s.textContent = 'Aucune mesure. Passez en mode 📏.';
      box.appendChild(s); return;
    }
    S.measures.forEach((m,i) => {
      const row = document.createElement('div');
      const lab = document.createElement('span');
      lab.textContent = 'M' + (i+1) + '  ' + fmtLen(G.dist(m.a, m.b));
      const del = document.createElement('button');
      del.textContent = '✕'; del.title = 'Supprimer';
      del.addEventListener('click', () => { S.measures.splice(i,1); UIx.measList(); R.draw(); ST.save(); });
      row.appendChild(lab); row.appendChild(del);
      box.appendChild(row);
    });
  },

  /* ---------------- saisie flottante ---------------- */
  askNumber(sx, sy, label, val, unit, cb){
    const box = $('inline'), inp = $('inlineInput');
    $('inlineLabel').textContent = label;
    $('inlineUnit').textContent = unit;
    box.style.display = 'flex';
    box.style.left = clamp(sx - 80, 4, VW - 210) + 'px';
    box.style.top  = clamp(sy - 18, 4, VH - 60) + 'px';
    inp.value = val; inp.focus(); inp.select();
    const done = ok => {
      box.style.display = 'none'; inp.onkeydown = null; inp.onblur = null;
      if(ok) cb(parseFloat(String(inp.value).replace(',', '.')));
    };
    inp.onkeydown = ev => {
      if(ev.key === 'Enter'){ ev.preventDefault(); done(true); }
      if(ev.key === 'Escape'){ ev.preventDefault(); done(false); }
    };
    inp.onblur = () => done(false);
  },

  editWall(i, sx, sy){
    const n = S.pts.length, a = S.pts[i], b = S.pts[(i+1)%n];
    const cur = G.dist(a,b);
    UIx.askNumber(sx, sy, 'Longueur du mur', fromCm(cur).toFixed(S.unit === 'm' ? 2 : 0), S.unit, v => {
      if(!isFinite(v) || v <= 0) return;
      const L = toCm(v);
      const dx = (b.x-a.x)/cur * (L-cur), dy = (b.y-a.y)/cur * (L-cur);
      for(let k = i+1; k < n; k++){ S.pts[k].x += dx; S.pts[k].y += dy; }
      markDirty(); R.draw(); ST.save();
      UIx.msg('Mur ajusté à ' + fmtLen(L));
    });
  },

  /* ---------------- synchronisation des champs ---------------- */
  sync(){
    $('tw').value = S.tile.w; $('th').value = S.tile.h;
    $('tj').value = +(S.tile.joint*10).toFixed(1);
    $('rot').value = S.tile.rot; $('rotR').value = S.tile.rot > 90 ? 0 : S.tile.rot;
    $('offx').value = S.tile.offx; $('offy').value = S.tile.offy;
    $('pattern').value = S.tile.pattern; $('start').value = S.tile.start;
    $('minUse').value = S.cut.minUse; $('kerf').value = +(S.cut.kerf*10).toFixed(1);
    $('allowRot').checked = S.cut.allowRot;
    $('unit').value = S.unit; $('waste').value = S.waste;
    $('plOn').checked = S.plinth.on; $('plLen').value = S.plinth.len;
    $('plH').value = S.plinth.height; $('plStock').checked = S.plinth.stock;
    $('plSrcW').value = S.plinth.srcW; $('plSrcH').value = S.plinth.srcH;
    $('plWaste').value = S.plinth.waste;
    $('snapOn').checked = S.snap; $('snapStep').value = S.snapStep;
    $('sens').value = S.poseSens; $('sensV').textContent = S.poseSens + ' %';
    $('showTiles').checked = S.show.tiles; $('showCuts').checked = S.show.cuts;
    $('showNums').checked = S.show.nums;  $('showGrid').checked = S.show.grid;
    $('showDims').checked = S.show.dims;
    document.querySelectorAll('.uLbl').forEach(e => { e.textContent = S.unit; });
    document.querySelectorAll('[data-tol]').forEach(b => b.classList.toggle('on', +b.dataset.tol === S.snapTol));
    for(const id of ['rw','rh']) $(id).step = S.unit === 'm' ? 0.01 : 1;
    UIx.measList();
    UIx.doorList();
    UIx.plinthStats();
  },

  /* ---------------- branchement du panneau ---------------- */
  bind(){
    const num = (id, fn) => $(id).addEventListener('input', () => {
      const v = parseFloat(String($(id).value).replace(',', '.'));
      if(isFinite(v)) fn(v);
      markDirty(); R.draw(); ST.save();
    });

    num('tw', v => S.tile.w = clamp(v, 1, 400));
    num('th', v => S.tile.h = clamp(v, 1, 400));
    num('tj', v => S.tile.joint = clamp(v, 0, 100)/10);
    num('offx', v => S.tile.offx = v);
    num('offy', v => S.tile.offy = v);
    num('minUse', v => S.cut.minUse = clamp(v, 0, 200));
    num('kerf', v => S.cut.kerf = clamp(v, 0, 50)/10);
    num('waste', v => S.waste = clamp(v, 0, 100));

    $('rot').addEventListener('input', () => {
      const v = parseFloat(String($('rot').value).replace(',', '.'));
      if(isFinite(v)){ S.tile.rot = mod(v,360); $('rotR').value = S.tile.rot > 90 ? 0 : S.tile.rot; markDirty(); R.draw(); ST.save(); }
    });
    $('rotR').addEventListener('input', () => IX.setRot(+$('rotR').value));
    document.querySelectorAll('[data-rot]').forEach(b => b.addEventListener('click', () => IX.setRot(+b.dataset.rot)));
    $('pattern').addEventListener('change', () => { S.tile.pattern = $('pattern').value; markDirty(); R.draw(); ST.save(); });
    $('start').addEventListener('change', () => { S.tile.start = $('start').value; markDirty(); R.draw(); ST.save(); });
    $('swap').addEventListener('click', () => {
      const w = S.tile.w; S.tile.w = S.tile.h; S.tile.h = w;
      UIx.sync(); markDirty(); R.draw(); ST.save();
    });
    $('allowRot').addEventListener('change', () => { S.cut.allowRot = $('allowRot').checked; markDirty(); R.draw(); ST.save(); });

    $('sens').addEventListener('input', () => {
      S.poseSens = +$('sens').value; $('sensV').textContent = S.poseSens + ' %'; ST.save();
    });
    $('resetPose').addEventListener('click', () => {
      S.tile.rot = 0; S.tile.offx = 0; S.tile.offy = 0;
      UIx.sync(); markDirty(); R.draw(); ST.save(); UIx.msg('Pose réinitialisée');
    });

    $('optPose').addEventListener('click', () => {
      if(OPT.busy) return;
      if(!S.closed || S.pts.length < 3){ UIx.toast('Fermez d\'abord le contour de la surface'); return; }
      const btn = $('optPose'), label = btn.textContent;
      btn.disabled = true;
      OPT.optimize(
        (n, t) => {
          btn.textContent = 'Recherche… ' + Math.min(99, Math.round(n/t*100)) + ' %';
          R.draw();                       // la trame bouge : on voit la recherche
        },
        res => {
          btn.disabled = false; btn.textContent = label;
          if(!res || !res.best){ UIx.toast('Calepinage indisponible'); return; }
          $('undoOpt').disabled = false;
          UIx.sync(); R.draw(); ST.save();
          const g = res.baseline ? res.baseline.total - res.best.total : 0;
          if(g > 0){
            UIx.toast('Pose optimisée : ' + g + ' carreau(x) de moins — ' +
                      res.baseline.total + ' → ' + res.best.total +
                      ' (rendement ' + res.best.yieldPct.toFixed(1).replace('.', ',') + ' %)');
          } else if(res.baseline && res.best.slivers < res.baseline.slivers){
            UIx.toast('Même nombre de carreaux, mais ' +
                      (res.baseline.slivers - res.best.slivers) + ' coupe(s) étroite(s) en moins');
          } else {
            UIx.toast('Aucune pose plus économe trouvée : la position actuelle est déjà la meilleure');
          }
        });
    });

    $('undoOpt').addEventListener('click', () => {
      if(!OPT.lastUndo) return;
      S.tile.offx = OPT.lastUndo.offx; S.tile.offy = OPT.lastUndo.offy;
      OPT.lastUndo = null; $('undoOpt').disabled = true;
      UIx.sync(); markDirty(); R.draw(); ST.save(); UIx.msg('Pose précédente rétablie');
    });

    /* ---- plinthes ---- */
    const plinthChanged = () => { markPlinth(); UIx.plinthStats(); ST.save(); };
    const plNum = (id, fn) => $(id).addEventListener('input', () => {
      const v = parseFloat(String($(id).value).replace(',', '.'));
      if(isFinite(v)) fn(v);
      plinthChanged();
    });
    $('plOn').addEventListener('change', () => { S.plinth.on = $('plOn').checked; plinthChanged(); });
    $('plStock').addEventListener('change', () => { S.plinth.stock = $('plStock').checked; plinthChanged(); });
    plNum('plLen',   v => S.plinth.len    = clamp(v, 1, 1000));
    plNum('plH',     v => S.plinth.height = clamp(v, 1, 200));
    plNum('plSrcW',  v => S.plinth.srcW   = clamp(v, 1, 1000));
    plNum('plSrcH',  v => S.plinth.srcH   = clamp(v, 1, 1000));
    plNum('plWaste', v => S.plinth.waste  = clamp(v, 0, 100));
    $('plSrcSameAsFloor').addEventListener('click', () => {
      S.plinth.srcW = S.tile.w; S.plinth.srcH = S.tile.h;
      $('plSrcW').value = S.plinth.srcW; $('plSrcH').value = S.plinth.srcH;
      plinthChanged();
    });
    document.querySelectorAll('[data-plmode]').forEach(b => b.addEventListener('click', () => {
      S.plinth.mode = b.dataset.plmode === 'max' ? 'max' : 'mini';
      plinthChanged();
    }));
    $('addDoor').addEventListener('click', () => {
      if(S.doors.length >= 30){ UIx.toast('Trop d\'ouvertures'); return; }
      S.doors.push({ w: 83, n: 1 });
      markPlinth(); UIx.doorList(); UIx.plinthStats(); ST.save();
    });

    $('unit').addEventListener('change', () => {
      const old = S.unit; S.unit = $('unit').value;
      if(old !== S.unit){
        for(const id of ['rw','rh']){
          const v = parseFloat(String($(id).value).replace(',', '.')) || 0;
          $(id).value = old === 'm' ? Math.round(v*100) : (v/100).toFixed(2);
          $(id).step = S.unit === 'm' ? 0.01 : 1;
        }
        document.querySelectorAll('.uLbl').forEach(e => { e.textContent = S.unit; });
        S.typed = { len:'', ang:'', field:'len' };
      }
      IX.computePreview(); R.draw(); UIx.measList(); ST.save();
    });

    $('snapOn').addEventListener('change', () => { S.snap = $('snapOn').checked; R.draw(); ST.save(); });
    $('snapStep').addEventListener('change', () => { S.snapStep = +$('snapStep').value; R.draw(); ST.save(); });
    document.querySelectorAll('[data-tol]').forEach(b => b.addEventListener('click', () => {
      S.snapTol = +b.dataset.tol;
      document.querySelectorAll('[data-tol]').forEach(o => o.classList.toggle('on', o === b));
      IX.computePreview(); R.draw(); ST.save();
    }));

    const showMap = { showTiles:'tiles', showCuts:'cuts', showNums:'nums', showGrid:'grid', showDims:'dims' };
    for(const id in showMap) $(id).addEventListener('change', () => {
      S.show[showMap[id]] = $(id).checked; markDirty(); R.draw(); ST.save();
    });

    document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => IX.setMode(b.dataset.mode)));
    $('closeShape').addEventListener('click', () => IX.closeShape());
    $('bClose').addEventListener('click', () => IX.closeShape());
    $('bUndo').addEventListener('click', () => IX.undo());
    $('fit').addEventListener('click', () => R.fitView());
    $('bFit').addEventListener('click', () => R.fitView());
    $('bZoomIn').addEventListener('click', () => R.zoomAt(VW/2, VH/2, 1.25));
    $('bZoomOut').addEventListener('click', () => R.zoomAt(VW/2, VH/2, 0.8));
    $('clrMeas').addEventListener('click', () => { S.measures = []; S.pending = null; UIx.measList(); R.draw(); ST.save(); });

    $('clear').addEventListener('click', () => {
      S.pts = []; S.closed = false; S.measures = []; S.pending = null;
      markDirty(); UIx.measList(); IX.setMode('draw'); R.draw(); ST.save();
      UIx.msg('Nouveau plan');
    });

    $('mkRect').addEventListener('click', () => {
      const w = toCm(parseFloat(String($('rw').value).replace(',', '.')) || 0);
      const h = toCm(parseFloat(String($('rh').value).replace(',', '.')) || 0);
      if(w <= 0 || h <= 0 || w > 100000 || h > 100000){ UIx.toast('Dimensions invalides'); return; }
      S.pts = [{x:0,y:0},{x:w,y:0},{x:w,y:h},{x:0,y:h}];
      S.closed = true; markDirty(); IX.setMode('edit'); R.fitView(); ST.save();
      UIx.msg('Rectangle créé');
    });

    $('exPng').addEventListener('click', () => EX.png());
    $('exSvg').addEventListener('click', () => EX.svgFile());
    $('exJson').addEventListener('click', () => ST.exportJSON());
    $('imJson').addEventListener('click', () => $('file').click());
    $('file').addEventListener('change', e => ST.importJSON(e));
    $('exPdf').addEventListener('click', () => EX.dossier());
  }
};
