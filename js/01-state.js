"use strict";
/* 01-state.js — état global, constantes et conversions d'unités.
   Toutes les longueurs sont stockées en CENTIMÈTRES en interne.
   L'unité affichée (m ou cm) n'est qu'une couche de présentation. */

const APP_VERSION = "2.0";

const S = {
  /* contour */
  pts: [],            // [{x,y}] en cm
  closed: false,

  /* vue */
  mode: 'draw',       // draw | edit | pose | measure | pan
  px: 0.5,            // pixels par cm
  ox: 0, oy: 0,       // position écran de l'origine monde

  /* saisie */
  unit: 'm',
  snap: true, snapStep: 45, snapTol: 8,

  /* carreau et pose */
  tile: { w:60, h:60, joint:0.3, rot:0, offx:0, offy:0, pattern:'droit', start:'coin' },

  /* plinthes — longueur libre ; si elles ne sont pas vendues toutes faites,
     elles sont taillées dans un carreau srcW × srcH (souvent 60 × 120).
     mode : 'mini' = seulement les bandes à chant d'usine (2 par carreau),
            'max'  = toutes les bandes, celles du milieu étant à rechanter.  */
  plinth: { on:false, len:60, height:8, stock:true, srcW:120, srcH:60, waste:5, mode:'mini' },

  /* ouvertures : largeurs déduites du linéaire de plinthes, non dessinées */
  doors: [],

  /* débit des coupes */
  cut: { minUse:5, kerf:0.3, allowRot:true },

  /* affichage */
  show: { tiles:true, cuts:true, grid:true, dims:true, nums:false },

  waste: 5,           // % de casse ajouté à l'achat
  poseSens: 100,      // sensibilité du glissement de pose, en %

  measures: [],       // [{a:{x,y}, b:{x,y}}]

  /* transitoires (non sauvegardés) */
  typed: { len:'', ang:'', field:'len' },
  drag: -1, hoverPt: -1, panning: false, pending: null
};

/* caches recalculés à la demande */
let tilesCache  = null;   // { pieces, full, cut }
let planCache   = null;   // résultat de l'optimisation des chutes
let plinthCache = null;   // résultat du calcul des plinthes
let dirty = true;         // le calepinage doit être régénéré

function markDirty(){ dirty = true; planCache = null; plinthCache = null; }
function markPlinth(){ plinthCache = null; }

/* ---------- unités ---------- */
const toCm   = v => S.unit === 'm' ? v * 100 : v;
const fromCm = v => S.unit === 'm' ? v / 100 : v;

function fmtLen(cm){
  if(S.unit === 'm') return (cm/100).toFixed(2).replace('.', ',') + ' m';
  const r = Math.abs(cm - Math.round(cm)) < 0.05 ? String(Math.round(cm)) : cm.toFixed(1).replace('.', ',');
  return r + ' cm';
}
/* toujours en cm : utilisé pour les dimensions de carreaux */
function fmtCm(cm){
  return (Math.abs(cm - Math.round(cm)) < 0.05 ? String(Math.round(cm)) : cm.toFixed(1).replace('.', ',')) + ' cm';
}
function fmtM2(cm2){ return (cm2/10000).toFixed(2).replace('.', ',') + ' m²'; }

const $ = id => document.getElementById(id);
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const mod = (a,n) => ((a % n) + n) % n;
const rad = d => d * Math.PI / 180;
const deg = r => r * 180 / Math.PI;
