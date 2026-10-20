# iDetector

Détection des arnaques Mobile Money pour l'Afrique de l'Ouest, avec analyse de SMS, captures d'écran et signalements communautaires.

## Ce que fait le projet

iDetector aide les utilisateurs à vérifier rapidement un message ou une capture d'écran avant qu'il ne leur coûte de l'argent.

Le projet couvre notamment :
- Wave
- Orange Money
- MTN MoMo
- Moov Money
- messages SMS, WhatsApp et appels vocaux

## Stack

- Frontend : HTML, CSS, JavaScript
- Backend : Node.js + Express
- Base de données : SQLite
- IA : OpenAI API compatible
- Déploiement : Render

## Structure du projet

```bash
.
├── backend/
│   ├── server.js
│   ├── src/
│   ├── prompts/
│   ├── scripts/
│   ├── docs/
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── index.html
│   ├── style.css
│   ├── script.js
│   ├── logo.png
│   └── favicon.png
├── README.md
├── DEPLOY.md
├── render.yaml
├── .gitignore
└── LICENSE
```

## Prérequis

- Node.js 18.17+
- npm
- clé API OpenAI valide

## Installation locale

```bash
cd backend
npm install
cp .env.example .env
```

Puis complétez votre fichier `.env` avec au minimum :

```env
OPENAI_API_KEY=your_key_here
ADMIN_PASSWORD=your_admin_password
ADMIN_SESSION_SECRET=your_secure_secret
```

Lancer le backend :

```bash
npm start
```

Le site est accessible sur :

```text
http://localhost:3000
```

## Déploiement

Le projet est configuré pour Render avec `render.yaml`.

Voir aussi : `DEPLOY.md`.

## Sécurité et confidentialité

- le contenu analysé n'est pas conservé dans la base de données
- seules des métadonnées sont enregistrées
- les fichiers sensibles comme `.env` sont ignorés par Git
- l'administration nécessite un mot de passe valide

## Contact

- Email : supportidetectorai@gmail.com
- LinkedIn : https://www.linkedin.com/company/idetector_ai
- X : https://x.com/idetector_ai

## Licence

Le projet est actuellement en mode de développement. Vous pouvez choisir une licence plus adaptée avant la publication publique.

