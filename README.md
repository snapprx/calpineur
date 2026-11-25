# Calpineur

Plan de surface et calepinage de carrelage. Application locale, sans serveur et sans
aucune dépendance externe : ouvrir `index.html` dans un navigateur.

## Fichiers

```
index.html          structure et panneau de commande
css/style.css       thème écran + mise en page A4 pour l'impression
js/01-state.js      état global, unités (interne : centimètres), formatage
js/02-geom.js       polygones, aires, découpe Sutherland–Hodgman, repère de pose
js/03-tiles.js      génération du calepinage, forme exacte de chaque coupe
js/04-optim.js      réemploi des chutes (guillotine best fit), recherche de la pose la plus économe
js/04b-plinthes.js  linéaire de plinthes calé sur les joints, ouvertures, débit des barres
js/05-render.js     rendu canvas (trame, carreaux, cotes, mesures)
js/06-interact.js   souris, clavier, modes (dessiner/modifier/pose/mètre/vue)
js/07-ui.js         panneau latéral, HUD flottant, saisies
js/08-storage.js    mémoire locale et fichiers .json (entrées non fiables filtrées)
js/09-export.js     PNG, SVG, dossier de pose A4
js/10-main.js       démarrage
```

Les scripts sont des scripts classiques chargés dans l'ordre, pas des modules ES :
les modules sont bloqués par CORS quand la page est ouverte en `file://`.

## Modes

| Touche | Mode | Usage |
|---|---|---|
| `1` | Dessiner | clic pour poser un point, ou longueur au clavier + `Entrée` |
| `2` | Modifier | glisser un sommet, cliquer une cote pour la saisir |
| `3` | Pose | maintenir et glisser le calepinage, `Maj`+glisser pour tourner, ou bouton « pose la plus économe » |
| `4` | Mètre | deux clics pour relever une distance |
| `5` | Vue | glisser pour déplacer |

Autres : `Tab` longueur ↔ angle, `Retour` annuler, `C` fermer le contour,
`Maj` désactiver l'aimant, `[` `]` rotation de pose ±5°, molette pour zoomer.

## Plinthes et ouvertures

Section **Plinthes** : longueur et hauteur libres, plus la case « vendues toutes faites
à cette longueur ». Si elle est décochée, deux champs donnent les dimensions du carreau
dans lequel les tailler (souvent 60 × 120, indépendant du carreau de sol) : le nombre de
plinthes par carreau est alors calculé, dans la meilleure des deux orientations, et le
compte de carreaux correspondant s'affiche séparément — il s'ajoute à celui du sol.
Marge de casse propre aux plinthes, distincte de celle du sol.

Section **Ouvertures** (juste sous la surface) : autant de largeurs que nécessaire,
chacune avec sa quantité. Elles ne sont pas dessinées sur le plan, seulement déduites du
linéaire de plinthes.

## Dossier de pose

Bouton **Dossier de pose A4** → boîte d'impression du navigateur →
« Destination : Enregistrer au format PDF ». Trois parties :

1. plan coté, coupes numérotées ;
2. descriptif : surface, murs, quantités, rendement, tableau des coupes ;
3. fiches de débit : un schéma par carreau ouvert, coupes plaquées contre les bords,
chute perdue grisée au milieu, chute encore exploitable en vert.

## Mémoire

Le plan est enregistré automatiquement dans le `localStorage` du navigateur et restauré
à l'ouverture. Si le navigateur refuse le stockage local (mode privé, certains navigateurs
en `file://`), un message le signale : utiliser alors **Sauvegarder .json**.

## Notes

Documentation projet : `Vault/02-Projets/Calpineur/`.
