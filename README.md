# Coach Progression 🚀

> Une application intelligente pour votre progression en Pompes & Abdominaux.
> *A smart tracking application for your Push-ups & Sit-ups progress.*

[![PWA Ready](https://img.shields.io/badge/PWA-Ready-success?style=flat-square)](manifest.json)
[![Vanilla JS](https://img.shields.io/badge/JS-Vanilla-yellow?style=flat-square)](js/app.js)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)

---

## 🇫🇷 Français

### À propos
**Coach Progression** est une application web progressive (PWA) conçue pour vous accompagner dans votre entraînement au poids du corps. Loin d'être un simple carnet de notes, elle agit comme un véritable coach virtuel en adaptant la charge de travail chaque semaine en fonction de vos performances réelles et de votre ressenti (RPE).

### Fonctionnalités Clés
- **Génération Intelligente** : Crée automatiquement une semaine d'entraînement basée sur votre maximum actuel (AMRAP).
- **Adaptation Dynamique** : Analyse vos échecs et réussites pour ajuster l'intensité (volume, fractionnement).
- **Feedback Quotidien** : Système d'évaluation de la difficulté pour chaque séance (Trop facile, Parfait, Difficile, Impossible).
- **Analyse Détaillée** : 
  - Graphiques de progression (Max, Volume).
  - Analyse de la performance par type de séance (Léger, Modéré, Intense).
  - Détection de plateaux et alertes de surentraînement.
- **Mode Hors-ligne** : Fonctionne parfaitement sans connexion internet.
- **Sauvegarde Locale & Export** : Vos données restent privées (localStorage) et sont exportables en JSON.

### Utilisation
1.  **Configuration** : Entrez votre nombre max de répétitions actuel.
2.  **Entraînement** : Suivez le programme généré jour après jour. Utilisez le minuteur intégré pour vos temps de repos.
3.  **Feedback** : Après chaque séance, notez votre ressenti. Si vous échouez, l'application vous demandera les détails pour adapter la suite.
4.  **Bilan** : À la fin de la semaine, visualisez votre progression et générez la semaine suivante.


### Algorithmes adaptatifs utilisés (sélection hebdomadaire)
Suite à une veille web sur les approches d'optimisation online (bandits multi-bras), l'application intègre désormais 5 algorithmes reconnus :
- **Epsilon-Greedy**
- **UCB1 (Upper Confidence Bound)**
- **Thompson Sampling**
- **EXP3**
- **Softmax / Boltzmann**

Chaque semaine, l'application compare les performances passées (progression, complétion du volume, échecs) et sélectionne automatiquement l'algorithme le plus pertinent pour générer la semaine suivante.

### Architecture Technique
Le projet est construit en **Vanilla JavaScript (ES6+)** sans aucun framework lourd, garantissant des performances maximales et une maintenabilité exemplaire.
L'architecture suit strictement le pattern **MVC (Modèle-Vue-Contrôleur)** avec une séparation forte des responsabilités via des services dédiés :

- **`js/app.js` (Contrôleur)** : Orchestre l'application et gère les événements utilisateurs.
- **`js/models/` (Modèle)** : Contient la logique métier pure (génération des semaines, calculs de progression).
- **`js/services/` (Services)** :
  - `UIService` : Gère toute la manipulation du DOM et l'affichage.
  - `AnalysisService` : Génère les rapports d'analyse textuelle et le coaching.
  - `StorageService` : Gère la persistance des données (LocalStorage).
  - `ChartService` : Gère le rendu des graphiques (SVG/Canvas).
  - `AudioService` : Gère les effets sonores.

---

## 🇺🇸 English

### Overview
**Coach Progression** is a Progressive Web App (PWA) designed to guide your bodyweight training (Push-ups & Sit-ups). More than just a logbook, it acts as a virtual coach by adapting the workload weekly based on your actual performance and Perceived Exertion (RPE).

### Key Features
- **Smart Generation**: Automatically creates a training week based on your current max reps (AMRAP).
- **Dynamic Adaptation**: Analyzes failures and successes to adjust intensity (volume, fractioning strategies).
- **Daily Feedback**: Rating system for each session difficulty (Too Easy, Perfect, Hard, Impossible).
- **Detailed Analytics**:
  - Progression charts (Max reps, Volume).
  - Performance analysis by session type (Light, Moderate, Intense).
  - Plateau detection and overtraining alerts.
- **Offline Mode**: Fully functional without an internet connection.
- **Local Storage & Export**: Your data stays private (localStorage) and can be exported as JSON.

### How to Use
1.  **Setup**: Enter your current max repetitions.
2.  **Train**: Follow the generated program day by day. Use the built-in timer for rest periods.
3.  **Feedback**: After each session, rate how it felt. If you failed, the app will ask for details to adapt future sessions.
4.  **Review**: At the end of the week, view your progress analytics and generate the next week.

### Technical Architecture
The project is built with **Vanilla JavaScript (ES6+)** without any heavy frameworks, ensuring maximum performance and maintainability.
It strictly follows the **MVC (Model-View-Controller)** pattern with strong separation of concerns via dedicated services:

- **`js/app.js` (Controller)**: Orchestrates the app and handles user events.
- **`js/models/` (Model)**: Contains pure business logic (week generation, progress calculations).
- **`js/services/` (Services)**:
  - `UIService`: Handles all DOM manipulation and rendering.
  - `AnalysisService`: Generates text analysis reports and coaching advice.
  - `StorageService`: Manages data persistence (LocalStorage).
  - `ChartService`: Handles chart rendering.
  - `AudioService`: Manages sound effects.

---

### Installation / Dev
Clone the repository and open `index.html` in your browser. No build step required.
```bash
git clone https://github.com/yourusername/coach-progression.git
# Serve locally (e.g., using Python or VS Code Live Server)
python -m http.server 8000
```

### Authors
Built with ❤️ by [Jonathan] & Gemini.

---
*v6.0 - Refactored Architecture*