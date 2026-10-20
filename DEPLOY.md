# Mettre iDetector sur GitHub et en ligne (pas à pas)

Objectif : une adresse publique unique (site + API + administration) et un dépôt GitHub propre à montrer à l'équipe MEST Africa.

Durée prévue : 1 h 30 la première fois.

---

## Étape 0 — Avant de commencer (15 min)

1. **Clé API OpenAI** : créez-la sur platform.openai.com et **fixez une limite de dépense mensuelle** (ex. 5 $) dans les réglages de facturation. Votre démo est publique : sans plafond, un tiers pourrait consommer votre crédit.
2. **Mot de passe admin** : 10 caractères minimum, unique. Ne le réutilisez nulle part.
3. **Test local** : dans `backend/`, `npm install`, `cp .env.example .env`, remplissez `OPENAI_API_KEY`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, puis `npm start`. Ouvrez `http://localhost:3000` : analysez le SMS d'exemple, vérifiez la mention « Analysé par iGuard (IA) », puis connectez-vous sur `/admin/`.
4. **Liens réels** : dans `frontend/script.js` (objet `CONFIG.LINKS`), mettez vos vrais liens LinkedIn / X / e-mail. Remplacez aussi `support@idetector.africa` si cette adresse n'existe pas.

> Règle d'or : le fichier `.env` ne va **jamais** sur GitHub (déjà exclu par `.gitignore`). Si une clé fuite, révoquez-la immédiatement chez OpenAI.

---

## Étape 1 — Publier sur GitHub (15 min)

1. Créez un compte sur github.com (si besoin) et activez la double authentification.
2. **New repository** : nom `idetector`, visibilité **Private** pour commencer (vous passerez en Public quand vous serez prêt), **sans** README ni .gitignore (le projet les contient déjà).
3. Dans un terminal, à la racine du projet (le dossier qui contient `backend/`, `frontend/`, `DEPLOY.md`) :

```bash
git init -b main
git add .
git status          # VÉRIFIEZ : aucun .env, aucun node_modules, aucun dossier data/
git commit -m "iDetector : site, API, IA iGuard et administration"
git remote add origin https://github.com/VOTRE-COMPTE/idetector.git
git push -u origin main
```

4. À la demande de mot de passe, GitHub exige un **Personal Access Token** (Settings → Developer settings → Tokens) ou l'outil `gh auth login`.
5. Sur la page du dépôt : ajoutez une description (« Détection d'arnaques Mobile Money en Afrique de l'Ouest »), des topics (`fraud-detection`, `mobile-money`, `west-africa`, `llm`, `nodejs`) et vérifiez que le README s'affiche bien.

Licence : le projet est actuellement « tous droits réservés » (`UNLICENSED`). Si vous voulez qu'il soit open source, choisissez une licence (MIT, Apache-2.0) avant de passer le dépôt en Public.

---

## Étape 2 — Mettre en ligne sur Render (20 min)

Render héberge gratuitement un service Node connecté à GitHub (vérifié sur render.com/docs/free).

1. Créez un compte sur render.com avec votre compte GitHub.
2. **New → Blueprint**, choisissez le dépôt `idetector` : Render lit `render.yaml`.
3. Saisissez les deux secrets demandés : `OPENAI_API_KEY` et `ADMIN_PASSWORD`. (`ADMIN_SESSION_SECRET` est généré automatiquement.)
4. Lancez le déploiement et attendez « Live ». L'adresse sera du type `https://idetector-xxxx.onrender.com`.
5. **Tests à faire dessus** (5 min) :
   - `https://…/api/health` répond `{"status":"ok","llmConfigured":true,…}`
   - la page d'accueil analyse le SMS d'exemple avec « Analysé par iGuard (IA) »
   - le formulaire « Contribuer » envoie un signalement, qui apparaît dans `/admin/` → Signalements
   - la connexion admin refuse un faux mot de passe
6. Votre site est public : n'y collez jamais de vraies données personnelles.

### Limites du plan gratuit à connaître (et à dire à MEST)

- **Mise en veille** après 15 minutes sans visite ; le réveil prend environ 1 minute.
- **Base SQLite effacée** à chaque veille, redémarrage ou redéploiement (pas de disque persistant en gratuit).
- Le script `start:demo` remet alors automatiquement des données fictives marquées **[DÉMO]** pour que l'administration ne soit pas vide. Ce n'est **pas** de la donnée réelle : dites-le clairement pendant la démo.
- Pour conserver les données : plan payant de Render avec disque persistant (vérifiez les tarifs actuels), ou migration vers PostgreSQL (feuille de route).

Alternatives : Railway, Fly.io, ou un petit VPS (le projet fonctionne avec `npm start` derrière un proxy HTTPS, avec `TRUST_PROXY=1`).

---

## Étape 3 — Nom de domaine (facultatif, 20 min)

Un domaine propre (ex. `idetector.africa` ou `idetector.ci`) fait plus sérieux. Dans Render : Settings → Custom Domains, puis ajoutez l'enregistrement DNS indiqué chez votre registrar. Le HTTPS est géré par Render.

---

## Étape 4 — Préparer la présentation MEST (1 h)

**La veille et 10 minutes avant** : ouvrez le site pour le réveiller, puis testez un SMS en français et un en anglais. Gardez un plan B : captures d'écran et courte vidéo de la démo au cas où le réseau tombe.

**Déroulé conseillé (8 à 10 min)**

1. **Problème** : la fraude Mobile Money en Côte d'Ivoire et en Afrique de l'Ouest. Préparez 1 ou 2 chiffres **sourcés** (ne présentez pas de chiffre que vous ne pouvez pas citer).
2. **Démo en direct** : coller le SMS d'exemple → niveau de risque, type d'arnaque, analyse, recommandation.
3. **Un cas limite** : un SMS légitime (pour montrer que l'outil ne crie pas à l'arnaque partout) et une tentative d'injection de prompt (l'IA ne doit pas obéir).
4. **Communauté** : envoyer un signalement depuis « Contribuer ».
5. **Administration** : modération (valider / faux positif / supprimer), journal, paramètres (mode maintenance, seuils).
6. **Confidentialité** : le contenu des messages n'est pas conservé, seules des statistiques le sont.
7. **Feuille de route et besoin** : collecte de données annotées locales (français, nouchi, langues locales), bot WhatsApp, partenariats opérateurs, base persistante, évaluation de la qualité.

**Questions probables, avec une réponse honnête**

- *Quelle précision ?* Pas encore mesurée sur un jeu de test indépendant : les cas limites du dépôt (`npm run eval`) vérifient le comportement, mais ne remplacent pas une évaluation sur des données réelles. C'est la prochaine étape.
- *Et les données personnelles ?* Pas de contenu stocké à l'analyse ; le texte transite par un fournisseur d'IA (OpenAI) : c'est écrit dans la politique de confidentialité. Un avis juridique sur la conformité locale (loi ivoirienne n° 2013-450, autorité de protection ARTCI) reste à faire.
- *Pourquoi un LLM ?* Les règles seules ratent les variantes ; l'IA comprend le contexte. Les règles locales servent de secours.
- *Coût ?* Quelques centimes par analyse avec un petit modèle : à chiffrer à partir de vos volumes.

---

## Étape 5 — Après la présentation

- Révoquez ou renouvelez la clé OpenAI si vous l'avez partagée.
- Passez le dépôt en Public seulement après relecture (aucun secret, licence choisie).
- Ouvrez des **Issues** GitHub pour la feuille de route (base persistante, évaluation, bot WhatsApp, langues locales) : cela montre un projet vivant.

---

## Dépannage

| Symptôme | Cause probable |
|---|---|
| Le déploiement échoue sur `better-sqlite3` | Forcer Node 20 (`NODE_VERSION=20`, déjà dans `render.yaml`) |
| `/admin/` répond « administration non configurée » | `ADMIN_PASSWORD` absent ou de moins de 10 caractères |
| L'analyse affiche « Analyse locale simplifiée » | Clé OpenAI absente/invalide, crédit épuisé, ou mode maintenance activé |
| Erreur « Trop de requêtes » | Limite de 20 analyses/minute par IP (réglable dans Paramètres) |
| Le site est lent au premier chargement | Réveil du plan gratuit (~1 min) |
| La lecture des captures (OCR) échoue | Elle télécharge le moteur Tesseract depuis des CDN : vérifiez la connexion ; sinon collez le texte |
