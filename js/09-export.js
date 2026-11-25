"use strict";
/* 09-export.js — PNG, SVG et dossier de pose A4 (impression / PDF).

   Le dossier est monté dans #printRoot puis imprimé par le navigateur :
   « Destination : Enregistrer au format PDF » produit le fichier A4.
   Aucune bibliothèque externe n'est chargée (rien à mettre à jour, rien à
   faire fuiter). */

const EX = {

  download(url, name, revoke){
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    if(revoke) setTimeout(() => URL.revokeObjectURL(url), 4000);
  },

  esc(s){
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  },
  n(v){ return (Math.round(v*100)/100).toString(); },

  /* ---------------- PNG (vue courante) ---------------- */
  png(){
    const k = 3;
    const c = document.createElement('canvas');
    c.width = VW*k; c.height = VH*k;
    const g = c.getContext('2d');
    g.scale(k,k);
    R.scene(g, VW, VH, { screen:false });
    EX.download(c.toDataURL('image/png'), 'calpineur-vue.png');
    UIx.msg('PNG exporté');
  },

  /* ---------------- plan vectoriel ---------------- */
  planSVG(o){
    o = o || {};
    const numbers = !!o.numbers;
    if(S.pts.length < 3) return '';
    const tc = S.closed ? T.get() : null;

    const bb = G.bbox(S.pts);
    const m = Math.max(bb.w, bb.h) * 0.16 + 50;
    const fs = Math.max(bb.w, bb.h) / 40;
    const sw = Math.max(bb.w, bb.h) / 900;
    const poly = S.pts.map(p => EX.n(p.x) + ',' + EX.n(p.y)).join(' ');

    let s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' +
      EX.n(bb.x-m) + ' ' + EX.n(bb.y-m*1.25) + ' ' + EX.n(bb.w+2*m) + ' ' + EX.n(bb.h+2.25*m) +
      '" preserveAspectRatio="xMidYMid meet">';
    s += '<rect x="' + EX.n(bb.x-m) + '" y="' + EX.n(bb.y-m*1.25) + '" width="' + EX.n(bb.w+2*m) +
         '" height="' + EX.n(bb.h+2.25*m) + '" fill="#ffffff"/>';

    if(tc && S.show.tiles){
      s += '<polygon points="' + poly + '" fill="#5c6672"/>';
      for(const p of tc.pieces){
        const pts = p.world.map(q => EX.n(q.x) + ',' + EX.n(q.y)).join(' ');
        s += '<polygon points="' + pts + '" fill="' + (p.full ? '#eceff2' : '#f6dda4') +
             '" stroke="#00000012" stroke-width="' + EX.n(sw) + '"/>';
      }
    }
    s += '<polygon points="' + poly + '" fill="none" stroke="#12161c" stroke-width="' +
         EX.n(sw*3) + '" stroke-linejoin="round"/>';

    /* numéros de coupe */
    if(tc && numbers){
      for(const p of tc.cuts){
        if(p.area < tc.tw*tc.th*0.035) continue;
        s += '<text x="' + EX.n(p.cx) + '" y="' + EX.n(p.cy) + '" text-anchor="middle" ' +
             'dominant-baseline="central" font-family="monospace" font-size="' + EX.n(fs*0.62) +
             '" fill="#6b4c05">' + EX.esc(p.ref) + '</text>';
      }
    }

    /* cotes extérieures */
    const p = S.pts, n = p.length;
    for(let i=0;i<n;i++){
      const a = p[i], b = p[(i+1)%n];
      const L = G.dist(a,b); if(L < 1) continue;
      const nr = G.outward(a, b, p);
      const off = fs*2.2, tick = fs*0.5;
      const A = { x:a.x+nr.x*off, y:a.y+nr.y*off }, B = { x:b.x+nr.x*off, y:b.y+nr.y*off };
      const A0 = { x:a.x+nr.x*tick, y:a.y+nr.y*tick }, B0 = { x:b.x+nr.x*tick, y:b.y+nr.y*tick };
      s += '<path d="M' + EX.n(A0.x) + ',' + EX.n(A0.y) + 'L' + EX.n(A.x) + ',' + EX.n(A.y) +
           'M' + EX.n(B0.x) + ',' + EX.n(B0.y) + 'L' + EX.n(B.x) + ',' + EX.n(B.y) +
           'M' + EX.n(A.x) + ',' + EX.n(A.y) + 'L' + EX.n(B.x) + ',' + EX.n(B.y) +
           '" stroke="#5a6675" stroke-width="' + EX.n(sw*1.2) + '" fill="none"/>';
      let ang = deg(Math.atan2(B.y-A.y, B.x-A.x));
      if(ang > 90 || ang < -90) ang += 180;
      s += '<text transform="translate(' + EX.n((A.x+B.x)/2) + ',' + EX.n((A.y+B.y)/2) +
           ') rotate(' + EX.n(ang) + ') translate(0,' + EX.n(-fs*0.35) + ')" text-anchor="middle" ' +
           'font-family="monospace" font-size="' + EX.n(fs) + '" fill="#12161c">' +
           EX.esc('M' + (i+1) + ' · ' + fmtLen(L)) + '</text>';
    }

    /* relevés au mètre */
    S.measures.forEach((mm, i) => {
      s += '<line x1="' + EX.n(mm.a.x) + '" y1="' + EX.n(mm.a.y) + '" x2="' + EX.n(mm.b.x) +
           '" y2="' + EX.n(mm.b.y) + '" stroke="#1f7a5a" stroke-width="' + EX.n(sw*2) +
           '" stroke-dasharray="' + EX.n(fs*0.4) + ',' + EX.n(fs*0.25) + '"/>';
      let ang = deg(Math.atan2(mm.b.y-mm.a.y, mm.b.x-mm.a.x));
      if(ang > 90 || ang < -90) ang += 180;
      s += '<text transform="translate(' + EX.n((mm.a.x+mm.b.x)/2) + ',' + EX.n((mm.a.y+mm.b.y)/2) +
           ') rotate(' + EX.n(ang) + ') translate(0,' + EX.n(-fs*0.35) + ')" text-anchor="middle" ' +
           'font-family="monospace" font-size="' + EX.n(fs*0.8) + '" fill="#1f7a5a">' +
           EX.esc('R' + (i+1) + ' ' + fmtLen(G.dist(mm.a, mm.b))) + '</text>';
    });

    s += '</svg>';
    return s;
  },

  svgFile(){
    if(S.pts.length < 3){ UIx.toast('Dessinez d\'abord une surface'); return; }
    const svg = '<?xml version="1.0" encoding="UTF-8"?>\n' + EX.planSVG({ numbers: S.show.nums });
    const blob = new Blob([svg], { type:'image/svg+xml;charset=utf-8' });
    EX.download(URL.createObjectURL(blob), 'calpineur-plan.svg', true);
    UIx.msg('SVG exporté');
  },

  /* ---------------- fiche d'un carreau débité ---------------- */
  sheetSVG(tile, W, H){
    const pad = Math.max(W,H) * 0.06;
    const fs = Math.max(W,H) * 0.075;
    let s = '<svg viewBox="' + EX.n(-pad) + ' ' + EX.n(-pad) + ' ' + EX.n(W+2*pad) + ' ' + EX.n(H+2*pad) +
            '" width="100%" preserveAspectRatio="xMidYMid meet">';
    /* le carreau entier : tout ce qui n'est pas repris est chute perdue */
    s += '<rect x="0" y="0" width="' + EX.n(W) + '" height="' + EX.n(H) +
         '" fill="#d8dde2" stroke="#12161c" stroke-width="' + EX.n(Math.max(W,H)/160) + '"/>';

    /* chutes encore exploitables */
    for(const r of (tile.free || [])){
      s += '<rect x="' + EX.n(r.x) + '" y="' + EX.n(r.y) + '" width="' + EX.n(r.w) + '" height="' + EX.n(r.h) +
           '" fill="#dff0e6" stroke="#5fbf8f" stroke-dasharray="2,2" stroke-width="' + EX.n(Math.max(W,H)/220) + '"/>';
      if(r.w > W*0.22 && r.h > H*0.16){
        s += '<text x="' + EX.n(r.x+r.w/2) + '" y="' + EX.n(r.y+r.h/2) + '" text-anchor="middle" ' +
             'dominant-baseline="central" font-family="monospace" font-size="' + EX.n(fs*0.62) +
             '" fill="#2f6b51">' + EX.esc(Math.round(r.w) + '×' + Math.round(r.h)) + '</text>';
      }
    }

    /* pièces débitées, à leur forme réelle */
    for(const pl of tile.placed){
      const sh = pl.piece.shape, bw = pl.piece.bw, bh = pl.piece.bh;
      const pts = sh.map(q => {
        const x = pl.rot ? (bh - q.y) : q.x;
        const y = pl.rot ? q.x        : q.y;
        return EX.n(pl.x + x) + ',' + EX.n(pl.y + y);
      }).join(' ');
      s += '<polygon points="' + pts + '" fill="#ffffff" stroke="#12161c" stroke-width="' +
           EX.n(Math.max(W,H)/200) + '"/>';
      s += '<text x="' + EX.n(pl.x + pl.w/2) + '" y="' + EX.n(pl.y + pl.h/2) + '" text-anchor="middle" ' +
           'dominant-baseline="central" font-family="monospace" font-weight="600" font-size="' + EX.n(fs) +
           '" fill="#12161c">' + EX.esc(pl.ref) + '</text>';
    }
    s += '</svg>';
    return s;
  },

  /* ---------------- bloc plinthes et ouvertures ---------------- */
  plinthBlock(){
    if(!S.plinth.on) return '';
    const r = PL.get();
    if(!r) return '';

    let doors = '';
    if(S.doors.length){
      doors = '<h3 style="font-size:10pt;margin:10px 0 4px">Ouvertures</h3><table class="rep">' +
              '<tr><th>Largeur</th><th>Nombre</th><th>Linéaire déduit</th></tr>';
      for(const d of S.doors){
        doors += '<tr><td class="n">' + EX.esc(fmtCm(d.w)) + '</td><td class="n">' + EX.esc(String(d.n)) +
                 '</td><td class="n">' + EX.esc(fmtLen(d.w * d.n)) + '</td></tr>';
      }
      doors += '<tr><td><b>Total</b></td><td class="n"><b>' + r.doorsQty +
               '</b></td><td class="n"><b>' + EX.esc(fmtLen(r.doorsLen)) + '</b></td></tr></table>';
    }

    const achat = r.stock
      ? '<tr><td><b>Plinthes à acheter</b></td><td class="n"><b>' + r.buy +
        '</b></td><td>barres de ' + EX.esc(fmtCm(r.L)) + ' × ' + EX.esc(fmtCm(r.height)) +
        ', marge de casse ' + EX.esc(String(r.waste)) + ' %</td></tr>'
      : '<tr><td><b>Carreaux à acheter pour les plinthes</b></td><td class="n"><b>' +
        (r.impossible ? '—' : r.tilesNeeded) + '</b></td><td>' +
        (r.impossible
          ? 'un carreau de ' + EX.esc(fmtCm(r.srcW)) + ' × ' + EX.esc(fmtCm(r.srcH)) +
            ' ne permet pas cette plinthe avec une arête d\'usine'
          : r.buy + ' plinthes à ' + r.perTile + ' par carreau de ' +
            EX.esc(fmtCm(r.srcW)) + ' × ' + EX.esc(fmtCm(r.srcH)) + ' — ' + EX.esc(r.sense) +
            (r.ground ? ', dont ' + r.ground + ' à rechanter' : '') +
            ' — <b>en plus</b> des carreaux du sol') + '</td></tr>';

    return '<h3 style="font-size:10pt;margin:10px 0 4px">Plinthes</h3>' +
      '<table class="rep">' +
        '<tr><th>Poste</th><th>Quantité</th><th>Détail</th></tr>' +
        '<tr><td>Linéaire brut</td><td class="n">' + EX.esc(fmtLen(r.gross)) + '</td><td>périmètre de la pièce</td></tr>' +
        '<tr><td>Ouvertures</td><td class="n">− ' + EX.esc(fmtLen(r.doorsLen)) + '</td><td>' +
          r.doorsQty + ' ouverture(s)</td></tr>' +
        '<tr><td>Linéaire net</td><td class="n"><b>' + EX.esc(fmtLen(r.net)) + '</b></td><td>à habiller</td></tr>' +
        '<tr><td>Barres entières</td><td class="n">' + r.fullCount + '</td><td>posées sans découpe</td></tr>' +
        '<tr><td>Pièces coupées</td><td class="n">' + r.cutCount + '</td><td>débitées dans ' + r.bars +
          ' barre(s), ' + r.reused + ' chute(s) réemployée(s)</td></tr>' +
        '<tr><td>Plinthes nécessaires</td><td class="n">' + r.total + '</td><td>avant marge de casse</td></tr>' +
        achat +
      '</table>' +
      '<p class="psub">Plinthes de ' + EX.esc(fmtCm(r.L)) + ' × ' + EX.esc(fmtCm(r.height)) +
      ' de hauteur, coupes calées sur les joints du carrelage. La largeur des ouvertures est déduite du ' +
      'linéaire ; leur position n\'étant pas connue, le besoin en barres est arrondi à l\'avantage du chantier.' +
      (r.stock ? '' : (r.mode === 'max'
        ? ' Débit en mode max : toutes les bandes du carreau sont exploitées, milieu compris. ' +
          'Les ' + r.ground + ' pièce(s) issues du milieu n\'ont pas de chant d\'usine : ' +
          'leur arête haute est à poncer ou chanfreiner avant pose.'
        : ' Débit en mode mini : seules les deux bandes en rive sont prises, ' +
          'pour que chaque plinthe conserve le chant lisse d\'usine visible en partie haute.')) + '</p>' +
      doors;
  },

  /* ---------------- dossier de pose ---------------- */
  dossier(){
    if(S.pts.length < 3 || !S.closed){ UIx.toast('Fermez d\'abord le contour de la surface'); return; }
    const tc = T.get(), pl = OPT.get();
    if(!tc || !pl){ UIx.toast('Calepinage indisponible'); return; }

    const date = new Date().toLocaleDateString('fr-FR');
    const A = G.area(S.pts);
    const t = S.tile;
    const buy = Math.ceil(pl.total * (1 + S.waste/100));

    const head = (title, sub) =>
      '<div class="ptitle"><h1>' + EX.esc(title) + '</h1><span>' + EX.esc(sub) + '</span></div>';

    let h = '';

    /* ---- page 1 : le plan ---- */
    h += '<div class="page">' + head('Plan de calepinage', 'Calpineur · ' + date) +
         '<p class="psub">Surface ' + EX.esc(fmtM2(A)) + ' · carreau ' + EX.esc(fmtCm(t.w) + ' × ' + fmtCm(t.h)) +
         ' · joint ' + EX.esc((t.joint*10).toFixed(0)) + ' mm · pose à ' + EX.esc(t.rot.toFixed(1)) + '°' +
         ' · motif ' + EX.esc({droit:'droit', demi:'décalé 1/2', tiers:'décalé 1/3'}[t.pattern]) +
         '. Les coupes portent leur numéro de référence.</p>' +
         '<div class="planbox">' + EX.planSVG({ numbers:true }) + '</div></div>';

    /* ---- page 2 : le descriptif ---- */
    let walls = '<table class="rep"><tr><th>Mur</th><th>Longueur</th><th>Angle</th></tr>';
    const n = S.pts.length;
    for(let i=0;i<n;i++){
      const a = S.pts[i], b = S.pts[(i+1)%n];
      const ang = mod(deg(Math.atan2(-(b.y-a.y), b.x-a.x)), 360);
      walls += '<tr><td>M' + (i+1) + '</td><td class="n">' + EX.esc(fmtLen(G.dist(a,b))) +
               '</td><td class="n">' + EX.esc(ang.toFixed(1)) + '°</td></tr>';
    }
    walls += '</table>';

    let meas = '';
    if(S.measures.length){
      meas = '<h3 style="font-size:10pt;margin:10px 0 4px">Relevés au mètre</h3><table class="rep">' +
             '<tr><th>Repère</th><th>Longueur</th></tr>';
      S.measures.forEach((m,i) => {
        meas += '<tr><td>R' + (i+1) + '</td><td class="n">' + EX.esc(fmtLen(G.dist(m.a,m.b))) + '</td></tr>';
      });
      meas += '</table>';
    }

    let cuts = '<table class="rep"><tr><th>Coupe</th><th>À débiter</th><th>Prise dans</th><th>Sens</th></tr>';
    const byRef = [];
    pl.tiles.forEach(tl => tl.placed.forEach(p => byRef.push({ ref:p.ref, w:p.piece.bw, h:p.piece.bh, t:tl.n, rot:p.rot })));
    byRef.sort((a,b) => a.ref.localeCompare(b.ref));
    for(const c of byRef){
      cuts += '<tr><td>' + EX.esc(c.ref) + '</td><td class="n">' +
              EX.esc(fmtCm(c.w) + ' × ' + fmtCm(c.h)) + '</td><td class="n">carreau n°' + c.t +
              '</td><td>' + (c.rot ? 'retourné 90°' : 'droit') + '</td></tr>';
    }
    cuts += '</table>';

    h += '<div class="page">' + head('Descriptif', 'Calpineur · ' + date) +
      '<div class="kv">' +
        '<span>Surface</span><b>' + EX.esc(fmtM2(A)) + '</b>' +
        '<span>Périmètre</span><b>' + EX.esc(fmtLen(G.perimeter(S.pts, true))) + '</b>' +
        '<span>Carreau</span><b>' + EX.esc(fmtCm(t.w) + ' × ' + fmtCm(t.h)) + '</b>' +
        '<span>Joint</span><b>' + EX.esc((t.joint*10).toFixed(0)) + ' mm</b>' +
        '<span>Motif</span><b>' + EX.esc({droit:'droit', demi:'décalé 1/2', tiers:'décalé 1/3'}[t.pattern]) + '</b>' +
        '<span>Angle de pose</span><b>' + EX.esc(t.rot.toFixed(1)) + '°</b>' +
        '<span>Départ</span><b>' + EX.esc(t.start === 'centre' ? 'centré' : 'coin') + '</b>' +
        '<span>Décalage</span><b>' + EX.esc(t.offx.toFixed(1) + ' ; ' + t.offy.toFixed(1)) + ' cm</b>' +
      '</div>' +
      '<table class="rep">' +
        '<tr><th>Poste</th><th>Quantité</th><th>Détail</th></tr>' +
        '<tr><td>Carreaux entiers</td><td class="n">' + pl.fullCount + '</td><td>posés sans découpe</td></tr>' +
        '<tr><td>Coupes à réaliser</td><td class="n">' + tc.cut + '</td><td>numérotées C01 à C' +
          String(tc.cut).padStart(2,'0') + '</td></tr>' +
        '<tr><td>Carreaux ouverts pour les coupes</td><td class="n">' + pl.srcCount +
          '</td><td>après réemploi de ' + pl.reused + ' chute(s)</td></tr>' +
        '<tr><td>Économie du réemploi</td><td class="n">' + pl.saved +
          '</td><td>par rapport à un carreau neuf par coupe (' + pl.naive + ')</td></tr>' +
        '<tr><td><b>Total posé</b></td><td class="n"><b>' + pl.total + '</b></td><td>rendement matière ' +
          EX.esc(pl.yieldPct.toFixed(1)) + ' %</td></tr>' +
        '<tr><td>À acheter</td><td class="n"><b>' + buy + '</b></td><td>marge de casse ' +
          EX.esc(String(S.waste)) + ' % · ' + EX.esc((buy*t.w*t.h/10000).toFixed(2)) + ' m²</td></tr>' +
      '</table>' +
      '<h3 style="font-size:10pt;margin:10px 0 4px">Murs</h3>' + walls + meas + EX.plinthBlock() +
      '<h3 style="font-size:10pt;margin:10px 0 4px">Coupes</h3>' + cuts +
      '<p class="psub">Débit calculé avec un trait de scie de ' + EX.esc((S.cut.kerf*10).toFixed(0)) +
      ' mm et une chute exploitable à partir de ' + EX.esc(fmtCm(S.cut.minUse)) +
      (S.cut.allowRot ? ', chutes réutilisables dans les deux sens.' : ', carreau directionnel : chutes non retournées.') +
      '</p></div>';

    /* ---- pages 3+ : fiches de débit ---- */
    let sheets = '';
    for(const tl of pl.tiles){
      const refs = tl.placed.map(p => p.ref).join(', ');
      const free = (tl.free || []).map(r => Math.round(r.w) + '×' + Math.round(r.h)).join(' · ');
      sheets += '<div class="sheet"><h3>Carreau n°' + tl.n + '</h3>' +
                EX.sheetSVG(tl, pl.W, pl.H) +
                '<p><b>' + EX.esc(refs) + '</b>' +
                (free ? '<br>chutes réutilisables : ' + EX.esc(free) + ' cm' : '<br>aucune chute exploitable') +
                '</p></div>';
    }
    h += '<div class="page">' + head('Fiches de débit', pl.tiles.length + ' carreau(x) à ouvrir · ' + date) +
         '<div class="legend">' +
           '<span><i style="background:#fff"></i>pièce posée</span>' +
           '<span><i style="background:#dff0e6;border-color:#5fbf8f"></i>chute réutilisable</span>' +
           '<span><i style="background:#d8dde2"></i>chute perdue</span>' +
         '</div>' +
         '<div class="sheets">' + (sheets || '<p>Aucune coupe.</p>') + '</div></div>';

    const root = $('printRoot');
    root.innerHTML = h;
    const clean = () => { root.innerHTML = ''; window.removeEventListener('afterprint', clean); };
    window.addEventListener('afterprint', clean);
    UIx.msg('Choisissez « Enregistrer au format PDF » dans la boîte d\'impression');
    setTimeout(() => window.print(), 120);
  }
};
