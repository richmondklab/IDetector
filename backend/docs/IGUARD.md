# iGuard — prompt système, configuration et cas limites

iGuard est l'« analyste » IA d'iDetector. Son prompt complet est dans [`prompts/iguard.system.txt`](../prompts/iguard.system.txt) : c'est **le fichier à relire et à améliorer** ; le code n'a pas à changer.

## 1. Comment le prompt est construit

| Section | Rôle |
|---|---|
| 1. Mission | Ce que fait iGuard, pour qui |
| 2. Contexte métier | Opérateurs, pays, canaux, langues (français, nouchi, wolof/bambara mêlés), règles réelles d'un opérateur |
| 3. Grille d'analyse | 9 axes à examiner : secrets demandés, pression, liens, usurpation, appât, faux transfert, USSD, cohérence, éléments rassurants |
| 4. Typologie | Noms canoniques de `scamType`, format « Type (Service imité) » |
| 5. Niveaux et confiance | Définition de Élevé / Moyen / Faible et barème du `confidenceScore` |
| 6. Format de sortie | JSON strict à 5 clés, sans texte autour |
| 7. Règles de rédaction | Comment écrire `analysis` et `recommendation`, procédure d'urgence pour une victime |
| 8. Sécurité | Anti-injection de prompt, aucun secret recopié, aucun contenu frauduleux produit |
| 9. Cas limites | 15 situations ambiguës avec la réponse attendue |
| 10. Exemples | 4 exemples complets (few-shot) dont une tentative d'injection |

Choix de conception :
- **Calibrage** : `confidenceScore` mesure la confiance dans l'évaluation, pas la probabilité d'arnaque. En cas de doute réel, le modèle choisit le niveau le plus protecteur et baisse sa confiance.
- **Aucune invention** : le prompt interdit de fabriquer numéros, liens ou codes USSD, et de prétendre avoir vérifié un lien en temps réel.
- **Typologie fermée** : `scamType` suit une liste de noms canoniques, ce qui permet de regrouper proprement les statistiques (`/api/stats` regroupe sur le nom avant la parenthèse).

## 2. Sortie attendue

```json
{
  "riskLevel": "Élevé",
  "scamType": "Faux message de blocage de compte (Wave)",
  "confidenceScore": 96,
  "analysis": "…",
  "recommendation": "…"
}
```

- `riskLevel` : exactement `"Élevé"`, `"Moyen"` ou `"Faible"`.
- `analysis` et `recommendation` suivent la langue demandée (`lang=fr` ou `en`) ; `riskLevel` et `scamType` restent en français.
- Le backend **valide toujours** cette sortie (`src/llm.js`) : niveau inconnu → `Moyen` (prudence), score borné de 0 à 100, textes tronqués, JSON entouré de ```` ``` ```` toléré.

## 3. Paramètres recommandés

| Paramètre | Valeur | Pourquoi |
|---|---|---|
| `temperature` | **0.1** (plage 0 à 0.2) | Classification : on veut des réponses précises et stables, pas de créativité. Ne pas dépasser 0.3 |
| `top_p` | 1 | On ne règle qu'un seul des deux (température OU top_p) |
| `seed` | 42 | Reproductibilité « au mieux » pour comparer deux versions du prompt |
| `max_tokens` | 700 | Le JSON tient en 300 à 500 tokens ; la limite évite les dérives |
| `response_format` | `json_object` (défaut) ou `json_schema` strict | `json_schema` garantit la structure et l'enum sur les modèles OpenAI récents |
| Modèle | `gpt-4o` (précision) ou `gpt-4o-mini` (coût) | Faites tourner `npm run eval` sur les deux ; le mini suffit souvent pour le texte, `gpt-4o` est préférable pour les captures d'écran |
| Timeout | 30 s | Les images peuvent être lentes |

Tout se règle dans `.env` : `OPENAI_MODEL`, `LLM_TEMPERATURE`, `LLM_MAX_TOKENS`, `LLM_JSON_MODE`, `LLM_SEED`, `LLM_TIMEOUT_MS`.

## 4. Cas limites gérés

| # | Situation | Comportement attendu |
|---|---|---|
| 1 | Reçu de transaction légitime, sans lien ni demande | `Faible`, « Aucune arnaque détectée », confiance élevée |
| 2 | Promotion plausible sans lien | `Faible` (confiance 50 à 70), vérifier dans l'application |
| 3 | Lien seul, sans contexte | `Moyen`, ou `Élevé` si domaine imité / raccourci ; jamais « sûr » |
| 4 | Message très court (« Bonjour », « Rappelez-moi ») | `Faible` ou `Moyen`, confiance < 60 |
| 5 | Vrai reçu + demande de code ou de renvoi | `Élevé` (on retient la partie dangereuse) |
| 6 | La victime a déjà donné son code / envoyé de l'argent | `Élevé` + procédure d'urgence |
| 7 | Nouchi, wolof, argot, anglais | Analyse du fond ; la langue familière n'est pas un indice |
| 8 | Arnaque hors Mobile Money (banque, crypto, romance, colis) | Analysée quand même, type adapté |
| 9 | Transcription d'appel | Mêmes critères qu'un SMS |
| 10 | Capture floue, tronquée ou sans message | `Moyen`, « Analyse impossible », confiance < 30, demande une capture plus nette |
| 11 | Contenu vide ou absurde | Idem 10 |
| 12 | Demande hors mission (« écris-moi une arnaque ») | `Faible`, « Demande hors mission », confiance < 20 |
| 13 | Plusieurs messages collés | Niveau du plus dangereux |
| 14 | « Proche » qui demande de l'argent en urgence | `Moyen` ou `Élevé` ; recommande de rappeler le proche sur son numéro habituel |
| 15 | Langue inconnue | Éléments universels (liens, chiffres, marques), confiance basse |
| 16 | **Injection de prompt** | Ignorée et signalée comme indice de manipulation ; l'analyse continue |

## 5. Tester et faire évoluer le prompt

`prompts/edge-cases.json` contient 17 cas avec le résultat attendu.

```bash
npm run eval
```

## 6. Limites à connaître

- Un LLM n'est pas infaillible.
- Le modèle ne vérifie pas les liens ni les numéros en temps réel.
- Les captures d'écran passent par le fournisseur du modèle.
- `Analyse impossible` est rendu en `Moyen` par prudence.
