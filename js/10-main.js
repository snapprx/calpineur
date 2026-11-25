"use strict";
/* 10-main.js — démarrage. */

(function init(){
  CV = $('cv');
  CTX = CV.getContext('2d');

  UIx.bind();
  IX.bind();

  const restored = ST.load();
  if(!restored){
    /* pièce d'exemple en L, pour comprendre l'outil en un coup d'œil */
    S.pts = [{x:0,y:0},{x:500,y:0},{x:500,y:250},{x:320,y:250},{x:320,y:400},{x:0,y:400}];
    S.closed = true;
    markDirty();
  }

  UIx.sync();
  R.resize();
  if(!restored) R.fitView();
  IX.setMode(restored ? 'edit' : 'draw');
  ST.note();

  UIx.msg(restored ? 'Plan restauré depuis la mémoire locale'
                   : 'Exemple chargé — « Nouveau plan » pour partir d\'une feuille blanche');
})();
