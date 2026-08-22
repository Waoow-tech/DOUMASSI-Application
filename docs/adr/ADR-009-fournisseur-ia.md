# ADR-009 — Fournisseur IA : Mistral en primaire, proxy agnostique

- **Statut** : Accepté
- **Date** : 24 juillet 2026
- **Décideur** : Abdou (CTO)
- **Épic concerné** : E5 — Studio AI (18 tickets)
- **Remplace / précise** : cadrage v1.1 §stack IA (« OpenAI GPT-4o, o3-mini, DALL-E 3, Whisper, text-embedding-3-small ; Mistral en fallback »)

---

## Contexte

L'épic E5 est le plus gros trou du produit : l'onglet AI est un placeholder, 18 tickets attendent. Avant d'écrire la première ligne, il fallait trancher le fournisseur.

Le cadrage v1.1 figeait OpenAI en primaire et Mistral en fallback. La question posée était : peut-on démarrer sur une offre gratuite, quitte à sortir de ce cadre ?

Trois pistes ont été examinées : un fournisseur chinois (gratuit ou très bon marché), Groq (offre gratuite, hébergé aux États-Unis), et Ollama (exécution locale).

## Le coût n'est pas le facteur décisif

E5-02 plafonne l'usage à **20 requêtes/jour/utilisateur**. À l'échelle de la bêta fermée :

> 50 testeurs × 20 req/jour × 30 jours = 30 000 requêtes/mois
> Sur un petit modèle : **de l'ordre de 15 €/mois.**

Optimiser 15 €/mois ne justifie aucun compromis structurel. Le coût redeviendra un critère à l'échelle, et sera réévalué à ce moment-là — avec des chiffres d'usage réels plutôt que des estimations.

## Le facteur décisif : où atterrissent les données

Les données qui transitent par l'IA sont parmi les plus sensibles de l'app : devoirs, photos, voix, conversations — **d'utilisateurs de 15 à 17 ans** (cf. ADR-008 et le passage de l'âge minimum à 15 ans).

- **Chine** : il n'existe **aucune décision d'adéquation** de la Commission européenne. Un transfert exige des clauses contractuelles types *et* une analyse d'impact du transfert, que la loi chinoise sur le renseignement national rend très difficile à conclure favorablement. Pour une app hébergeant des mineurs, l'exposition est réelle. **Écarté.**
- **États-Unis** (OpenAI, Groq) : le cadre EU-US Data Privacy Framework existe. Utilisable, sous réserve de vérifier la certification effective du fournisseur retenu.
- **Union européenne** (Mistral) : la question du transfert ne se pose pas.

## Décision

### 1. Mistral est le fournisseur primaire

Mistral est **français, hébergé en UE**, et **déjà présent dans la stack figée** (en fallback) — l'y promouvoir ne sort donc pas du cadrage.

Il couvre l'intégralité des tickets **T1** : chat, vision, embeddings, OCR/PDF.

Il ne couvre pas la génération d'images (E5-11) ni la transcription vocale (E5-12) — deux tickets **T2**, hors périmètre immédiat.

### 2. Le proxy reste agnostique — c'est la vraie décision

L'Edge Function ne code aucun fournisseur en dur. Elle lit **trois variables d'environnement** :

```
AI_BASE_URL
AI_API_KEY
AI_MODEL
```

C'est possible sans effort particulier parce que **Mistral, OpenAI, Groq et Ollama exposent tous `/v1/chat/completions` compatible OpenAI avec streaming SSE**. Un seul adaptateur les couvre tous.

Conséquence : changer de fournisseur est un changement de configuration, pas de code. La décision ci-dessus devient réversible, ce qui est exactement ce qu'on veut sur un marché qui bouge tous les trimestres.

### 3. Par environnement

| Environnement | Fournisseur | Motif |
|---|---|---|
| Dev local | Ollama (optionnel) | gratuit, hors-ligne, aucune donnée ne quitte le poste |
| Bêta fermée | **Mistral** | UE, dans la stack figée, offre gratuite |
| Vocal (E5-12, T2) | Groq | sert Whisper, que Mistral ne couvre pas |
| Production | à trancher | avec des chiffres d'usage réels |

**Ollama ne peut pas servir l'app.** Les Edge Functions tournent sur l'infrastructure Supabase et ne peuvent pas joindre une machine de développeur. C'est un outil de développement, pas une option d'hébergement — la distinction a été source de confusion et mérite d'être écrite.

## Conséquences

### Positives

- Aucun transfert de données de mineurs hors UE pour la bêta.
- Aucun ADR supplémentaire nécessaire : Mistral était déjà dans la stack.
- Coût nul jusqu'à la production (Ollama en dev, offre gratuite Mistral en bêta).
- Le choix du fournisseur cesse d'être une décision structurante.

### Négatives / points de vigilance

- **Les capacités varient d'un fournisseur à l'autre.** L'API de chat est commune, mais la génération d'images, la transcription et les embeddings ne le sont pas. L'agnosticisme du proxy ne vaut **que pour le chat** — c'est une limite à connaître, pas une promesse universelle.
- **`post_embeddings.embedding` est déclarée `vector(1536)`** en base, soit la dimension de `text-embedding-3-small` (OpenAI). Les embeddings Mistral font 1024. Changer de fournisseur d'embeddings imposera **une migration ET la régénération de tous les vecteurs**. Sans effet aujourd'hui (E5-15/16 sont des T2), mais à trancher **avant** toute génération en masse.
- Les offres gratuites évoluent et sont plafonnées en débit. Convenables en dev et en bêta fermée, à réévaluer avant l'ouverture.
- La certification DPF de Groq **reste à vérifier** avant de lui envoyer quoi que ce soit de personnel (E5-12).

## Alternatives écartées

| Option | Raison du rejet |
|---|---|
| Fournisseur chinois | Pas de décision d'adéquation UE ; analyse d'impact du transfert difficilement soutenable pour des données de mineurs. Économie réelle : ~15 €/mois. |
| OpenAI en primaire dès maintenant | Fonctionnerait, mais payant sans nécessité tant que les T2 ne sont pas là, et transfert hors UE à documenter. Reste le repli naturel pour les T2. |
| Groq en primaire | Séduisant (rapide, gratuit, sert Whisper) mais hébergé aux États-Unis et plafonné en débit. Retenu uniquement pour le vocal. |
| Ollama en primaire | Impossible : les Edge Functions ne peuvent pas joindre une machine de dev. |
