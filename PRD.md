# PRD — Reverse Engineering Produit (basé uniquement sur le code)

## 1. Executive Summary

### Description synthétique
Application web **PWA front-end only** de coaching pour entraînement au poids du corps, focalisée sur **pompes** et **abdominaux**. Elle génère un programme hebdomadaire adaptatif, permet le suivi session par session (feedback + détails d’échec), affiche des analyses textuelles et des graphiques, et persiste localement les données utilisateur. Le démarrage se fait sans build (`index.html` + scripts Vanilla JS). 

### Objectif principal déduit
Permettre à un utilisateur autonome d’**améliorer son max de répétitions** semaine après semaine via un plan ajusté par la performance réelle et le ressenti (RPE/feedback), sans dépendre d’un serveur distant.

---

## 2. Vision Produit & Proposition de Valeur

### Vision déduite
Être un « coach virtuel local » qui transforme un simple carnet d’entraînement en système de progression guidée et réactive.

### Proposition de valeur
- **Personnalisation automatique** à partir d’un max actuel + historique local.
- **Adaptation de charge** (intensité, volume, repos, fractionnement) selon retours utilisateurs.
- **Autonomie offline** visée via service worker + stockage local.
- **Confidentialité by design** (données en localStorage, export/import JSON manuel).

---

## 3. Analyse Fonctionnelle Complète

### 3.1 Fonctionnalités principales

| Fonctionnalité | Statut | Preuve code | Notes |
|---|---|---|---|
| Création de semaine d’entraînement (test + sessions jour/niveau) | Implémenté | `TrainingModel.generateWeek` | Génère 1 jour test + 12 sessions (matin/soir) basées sur distribution de volume. |
| Adaptation selon semaine précédente | Implémenté | `_calculateProgression`, `_getAdaptiveIntensity`, `_calculateSmartSeriesReps`, `_calculateAdaptiveRest` | Ajuste facteur de progression, intensité, repos et fractionnement. |
| Saisie feedback quotidien (trop facile / parfait / difficile fini / trop difficile) | Implémenté | `UIService.renderProgramTable`, `AppController._handleFeedback` | Inputs additionnels si échec. |
| Capture détails d’échec (sets complétés + reps dernière série) | Implémenté | `AppController._handleFailureDetails`, `UIService` inputs | Utilisé pour recalcul volume réel. |
| Minuteur de repos intégré + action « impossible » | Implémenté | `TimerService`, `AppController.startSessionTimer`, `_handleImpossibleFromTimer` | « Impossible » force un feedback échec contextualisé. |
| Historique des semaines (voir/supprimer) | Implémenté | `UIService.showHistory`, `_handleDeleteHistory` | Suppression confirmée. |
| Graphiques de progression (max/volume) | Implémenté | `ChartService.render` | SVG custom avec interactions tooltip. |
| Analyse textuelle (overview/optimization/alerts) | Implémenté | `AnalysisService` | Affichage via toggles UI. |
| Export/Import JSON | Implémenté | `StorageService.exportData/importData` | Validation minimale du format importé. |

### 3.2 Fonctionnalités secondaires
- Filtres persistants d’affichage (stat, analyse, tableau).  
- Prédiction de date d’atteinte d’objectif (croissance fixe 5% hebdo).  
- Badge d’objectif atteint/projection.  
- Effets audio du minuteur (tick + fin).  
- Support PWA (manifest + SW + mode standalone).

### 3.3 Fonctionnalités implicites
- Usage **mono-utilisateur** (aucune notion de compte/auth).  
- Architecture orientée **session browser locale**.  
- Modèle d’entraînement basé sur alternance de journées Léger/Modéré/Intense.  
- Distingue explicitement volume planifié vs volume réellement exécuté en cas d’échec.

---

## 4. Cartographie Modulaire

### Backend
- **Aucun backend** détecté.

### Frontend
- `index.html` : structure complète UI (setup, programme, historique modal, timer overlay).
- CSS modulaire (`css/components/*.css`, `css/layout.css`, etc.).
- JS Vanilla global `window.*`.

### Services (couche applicative)
- `StorageService` : persistance, import/export JSON.
- `FilterService` : état des filtres UI + persistance.
- `TimerService` : minuteur, overlay, callbacks.
- `AudioService` : Web Audio API.
- `ChartService` : rendu SVG progression.
- `AnalysisService` : contenu analytique HTML.
- `UIService` : rendu DOM et interactions visuelles.

### APIs
- Browser APIs : `localStorage`, `FileReader`, `Blob/URL`, `ServiceWorker`, `Cache API`, `AudioContext`, `Intl.DateTimeFormat`.
- **Aucune API réseau métier**.

### Base de données
- **Pas de base de données serveur**.
- Persistance locale : `localStorage` clé `coachProgressionData_v5` + clé filtres `coachProgressionFilters_v6`.

---

## 5. Personas Déduits

1. **Pratiquant autonome débutant/intermédiaire**
   - Veut un plan prêt à l’emploi, sans calculs manuels.
2. **Pratiquant orienté progression mesurable**
   - Suit max/volume, compare les semaines, ajuste selon feedback.
3. **Utilisateur offline / privacy-first**
   - Souhaite conserver ses données localement et exporter manuellement.

> Incertitude : aucun segment B2B/coaching pro n’est visible dans le code.

---

## 6. User Stories Détaillées

### US1 — Génération initiale
En tant que pratiquant, je veux saisir mon max actuel et générer une semaine afin d’avoir un plan calibré.

**Critères d’acceptation techniques**
- Input `maxReps` obligatoire et > 0.
- Création d’un objet semaine avec `weekNumber`, `exerciseType`, `program`, `globalAdvice`, métriques d’adaptation.
- Le jour 1 est un test (`sets:1`, `rest:0`).

### US2 — Suivi des séances
En tant que pratiquant, je veux noter chaque séance (ressenti/échec) afin que la prochaine semaine s’adapte.

**Critères**
- Chaque session (hors test day) expose 4 feedbacks.
- Si `trop_difficile`, affichage inputs `actualSets` + `actualLastReps`.
- Sauvegarde immédiate dans `localStorage`.

### US3 — Gestion d’échec depuis minuteur
En tant que pratiquant, je veux déclarer “impossible” pendant le repos afin d’enregistrer un échec réel rapidement.

**Critères**
- Bouton “Impossible” visible si callback fourni.
- Prompt de reps restantes validé (`0..day.reps`).
- Feedback forcé `trop_difficile` + détails renseignés.

### US4 — Visualiser ma progression
En tant que pratiquant, je veux voir l’évolution max/volume afin d’évaluer ma progression.

**Critères**
- Graphique dispo uniquement si >= 2 semaines pour exercice courant.
- Mode max ou volume sélectionnable.
- Tooltip semaine + variation.

### US5 — Analyse de coaching
En tant que pratiquant, je veux un diagnostic (vue d’ensemble, optimisation, alertes) afin d’ajuster mon entraînement.

**Critères**
- 3 vues d’analyse via toggles.
- Alertes spécifiques : échecs consécutifs, plateau, échec critique.

### US6 — Portabilité des données
En tant que pratiquant, je veux exporter/importer mes données afin de sauvegarder/restaurer mon historique.

**Critères**
- Export JSON téléchargeable.
- Import refuse les formats sans `allWeeks` array.
- Confirmation utilisateur avant écrasement.

---

## 7. Flux Utilisateurs

### Happy path
1. L’utilisateur ouvre l’app.
2. Saisit exercice + max (+ objectif optionnel), génère la semaine.
3. Consulte tableau/analyses/graphique.
4. Lance minuteur sur sessions, donne feedback après séance.
5. Fin de semaine : crée nouvelle semaine avec adaptation automatique.

### Edge cases
- Max invalide (`<1`) => alerte bloquante.
- Objectif <= max => badge “Objectif proche/atteint”.
- Historique insuffisant => graphique “Données insuffisantes”.
- Import annulé ou fichier absent => pas d’action.

### Erreurs possibles
- JSON import invalide => exception affichée via `alert`.
- LocalStorage indisponible/erreur parse => fallback `{allWeeks:[]}`.
- Certaines analyses référencent des champs possiblement absents (ex: `fractionnementApplique` au niveau semaine).

---

## 8. Exigences Techniques

### Architecture
- MVC simplifié + services découplés, dépendances globales `window.*`.
- Rendu sans framework, pas de bundler.

### Stack technologique
- HTML5/CSS3/JavaScript ES6.
- PWA: Manifest + Service Worker.

### Dépendances
- Aucune librairie externe détectée.

### Sécurité
- Pas d’authentification ni chiffrement des données locales.
- Import JSON sans schéma strict (validation minimale structurelle).
- Usage de `innerHTML` pour contenu généré (source interne contrôlée, mais à surveiller si future donnée externe).

### Performance
- App légère, locale, sans appels API.
- Graphique SVG custom potentiellement coûteux si historique très long (pas de virtualisation).

### Scalabilité
- Scalabilité horizontale non pertinente (pas de backend).
- Scalabilité fonctionnelle limitée par architecture globale mutable `window` et persistance localStorage.

---

## 9. Contraintes & Dette Technique

- **Aucune couche backend** : impossible de synchroniser multi-device nativement.
- **Nommage/version clés storage** potentiellement hétérogène (`_v5` vs `_v6`).
- **Service Worker incomplet** : certains scripts chargés par l’app ne sont pas précachés (ex. `analysis.service.js`, `ui.service.js`) → offline partiel probable.
- **Incohérence possible** : `AnalysisService.generateOptimization` lit `currentWeek.fractionnementApplique` (champ de semaine non construit explicitement).
- **Bug probable PR annotation** dans chart (condition de record personnel impossible telle qu’écrite).
- **UI/logic fortement couplées au DOM** (inline handlers + globals) rendant les tests unitaires plus difficiles.

---

## 10. KPIs et Métriques Produits

> Non implémentés explicitement côté analytics externe. KPIs recommandés déduits du modèle disponible :

- Taux de complétion des séances (hors day 1).
- Taux d’échec (`trop_difficile`) par type de jour.
- Variation hebdomadaire du max reps.
- Volume réel / volume planifié (completion rate).
- Nombre de semaines consécutives d’échec.
- Détection plateau (semaines sans gain).

---

## 11. Hypothèses Implicites

- Croissance prédictive fixe à 5%/semaine (pas personnalisée dynamiquement).
- L’utilisateur évalue honnêtement son feedback.
- Un seul profil utilisateur actif.
- Le navigateur supporte APIs modernes nécessaires.
- Le programme générique pompes/abdos est suffisamment transférable aux niveaux utilisateurs ciblés.

---

## 12. Roadmap Recommandée

### Court terme
- Corriger incohérences identifiées (champ `fractionnementApplique` semaine, PR chart condition).
- Compléter la liste SW précachée pour offline robuste.
- Renforcer validation import JSON (schéma minimal détaillé).

### Moyen terme
- Ajouter couche de tests unitaires sur `TrainingModel` et services critiques.
- Introduire migration/versioning de structure de données localStorage.
- Ajouter instrumentation locale KPI (tableau de bord interne).

### Long terme
- Éventuelle sync cloud opt-in (si stratégie produit évolue).
- Multi-profils / segmentation par objectif.
- Moteur d’adaptation plus explicable (journal des décisions algorithmiques).

---

## 13. Risques

### Techniques
- Régression algorithmique sans tests automatisés.
- Risque de corruption data importée mal formée.
- Comportement offline incomplet selon ressources non cachées.

### Produit
- Feedback utilisateur subjectif peut biaiser l’adaptation.
- Complexité perçue (beaucoup d’indicateurs) pour un débutant.

### Business
- Valeur limitée au single-device local sans sync.
- Difficulté à mesurer adoption réelle sans télémétrie.

---

## 14. Opportunités Stratégiques

- Positionnement “coach privé local-first” (privacy différenciante).
- Extension du catalogue d’exercices avec même moteur adaptatif.
- Monétisation potentielle via packs programmes/variantes (si backend futur).
- Différenciation par pédagogie explicative déjà forte (messages contextualisés par scénario).

---

## Annexe — Statut global par type

- **Implémenté** : génération de programme, suivi feedback, adaptation, timer, analyses, graphiques, historique, import/export, PWA de base.
- **Partiellement implémenté** : offline complet (précache partiel), cohérence de certaines métriques de haut niveau.
- **Prévu/latent (indices code/commentaires)** : enrichissement du tracking volume réel au-delà du seul cas échec, durcissement potentiels futurs.
- **Technique uniquement** : architecture MVC/services, filtres persistants, service worker cache-first.
