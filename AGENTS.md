# Indagis Studio — Instructions agent

Atelier de structuration narrative pour le montage vidéo, construit sur le framework
Agent-Native comme **application autonome (standalone)** — pas un multi-app workspace.
Le cœur du produit applique la méthode du **voyage du héros appliqué au montage** :
12 étapes, 3 actes, courbe émotionnelle, carnet de marqueurs, diagnostic de structure.

Le périmètre est volontairement resserré sur Studio seul : pas d'apps voisines (Clips,
Design, Dispatch), pas de captation ni de montage vidéo dans l'app — Studio structure le
récit, il ne produit pas la vidéo.

Ce projet suit le workflow standard décrit dans `~/Documents/dev-tools/AGENTS.md` et
`~/Documents/dev-tools/README.md`. Lire ces deux fichiers avant de modifier l'outillage.

## Méthode de travail : Spec Kit + BMAD, dans cet ordre

1. **`/speckit-constitution`** — poser les principes du projet avant toute spec
2. **`/speckit-specify`** — spécification de référence (le besoin, pas l'implémentation)
3. **`/speckit-clarify`** *(optionnel)* — lever les ambiguïtés avant de planifier
4. **`/speckit-plan`** — plan d'implémentation
5. **`/speckit-tasks`** — découpage en tâches actionnables
6. **`/speckit-analyze`** *(optionnel)* — cohérence entre spec/plan/tâches
7. **`/speckit-checklist`** *(optionnel)* — checklists qualité des exigences
8. **`/speckit-implement`** — exécution
9. **`/speckit-converge`** — évalue le code existant et ajoute les tâches restantes

BMAD (`bmad-*`) intervient en complément pour les phases où un rôle dédié aide :
`bmad-agent-analyst` (recherche/cadrage), `bmad-agent-pm` (PRD), `bmad-agent-architect`
(architecture), `bmad-agent-ux-designer` (UX), `bmad-agent-dev` (implémentation),
`bmad-sprint-planning`, `bmad-code-review`, `bmad-retrospective`. Invoquer `bmad-help`
en cas de doute sur quel agent utiliser.

Ne pas dupliquer un rôle entre les deux outils sur la même tâche : Spec Kit structure le
document de référence, BMAD outille son exécution par rôle.

## Outillage disponible

| Outil | Portée | Statut |
| --- | --- | --- |
| **Spec Kit** | 10 skills `speckit-*` | Installé dans ce projet (`.specify/`, `.claude/skills/`) |
| **BMAD-METHOD** | 29 skills `bmad-*` | Installé dans ce projet (`_bmad/`, `.claude/skills/`) |
| **ECC** (`ecc:*`) | 300+ skills : revue de code par langage, TDD, CI/CD, architecture, sécurité | Plugin Claude Code **global**, déjà actif — rien à installer localement |
| **Superpowers** (`superpowers:*`) | Brainstorming, debugging systématique, TDD, revue de code, git worktrees | Plugin Claude Code **global**, déjà actif |
| **mattpocock-skills** (`mattpocock-skills:*`) | TDD, prototypage, modélisation de domaine, conception de codebase, revue de code, résolution de conflits | Plugin Claude Code **global**, déjà actif |

Les trois derniers sont installés une fois pour toutes au niveau de l'agent (voir
`~/Documents/dev-tools/README.md`, section 5) : aucune action d'installation n'est due
pour ce projet, ils apparaissent directement dans la liste de skills disponibles.

Quand plusieurs skills se recoupent (ex. `superpowers:systematic-debugging` et un
`ecc:*-build-resolver` pour la même erreur), privilégier la plus spécifique au langage ou
au framework en jeu ; utiliser la générique en repli.

## Contrat technique — Agent-Native

- App **standalone** (`--standalone`, pas un workspace) : un seul `package.json`
  applicatif, pas de `packages/shared` ni d'`apps/*` voisines.
- Les cinq règles d'architecture (données en PostgreSQL, actions pour toute écriture, tout
  passe par l'agent, live sync, application state en base) et la checklist des quatre
  zones (UI, action, skill, app-state) s'appliquent à chaque fonctionnalité.
- `move-stage` reste le seul chemin pour changer `videos.stage` — il journalise dans
  `stage_events`, source de la détection de blocage.
- Avant d'implémenter une fonctionnalité du framework : lire
  `node_modules/@agent-native/core/docs/` en local, jamais deviner depuis la mémoire.
- **Imports relatifs dans `actions/`, `server/` et `shared/` : extension `.ts`, pas
  `.js`.** La documentation du framework écrit `../server/db/index.js`, mais le chargeur
  de `agent-native agent` utilise la résolution ESM stricte de Node : il cherche un
  fichier `.js` qui n'existe pas et **ignore silencieusement l'action**. Avec `.js`
  partout, les 26 actions étaient invisibles pour l'agent. `allowImportingTsExtensions`
  est activé dans le tsconfig du framework, donc `.ts` compile et se charge.
  Dans `app/`, laisser `.js` : React Router en dépend, et l'agent n'y charge rien.
- Pas de délégation A2A prévue au périmètre actuel — à reconsidérer seulement si un besoin
  explicite apparaît.

## Comportement attendu de l'agent

- **Ne jamais fabriquer.** Si une action échoue ou qu'une donnée manque, le dire et
  chercher à récupérer — jamais inventer un résultat ni prétendre qu'une écriture a
  réussi sans l'avoir vérifiée par une relecture.
- **Vérifier avant de conclure.** Après une écriture, relire la ligne ou rappeler
  `view-screen`.
- **Ne pas abandonner au premier échec.** Sur une erreur récupérable, réessayer ou
  corriger l'entrée. C'est une règle distincte de la précédente.
- **Appeler `view-screen` en premier** quand l'utilisateur dit « cette vidéo », « cette
  étape » ou « ici ».
- **Ne pas écrire à la place de l'utilisateur.** Le contenu narratif est le sien : on
  l'aide à nommer ce qu'il a dans ses rushes, on n'invente pas de scènes.
- Retour d'interface visé à 100 ms, jamais au-delà de 400 ms ; accuser réception avant
  tout travail réseau.
- Ne jamais coder en dur une clé d'API, un jeton, une URL de webhook ou un secret.
- Aucun binaire en base : seules des URL ou des références externes sont persistées.

## État applicatif

L'agent lit ces clés via `readAppState("navigation")` (et `view-screen` les résout en
données) :

| Clé | Valeurs | Ce que ça dit |
| --- | --- | --- |
| `view` | `list` \| `video` \| `calendar` \| `chat` | l'écran courant |
| `videoId` | identifiant ou absent | la vidéo ouverte |
| `tab` | `map` \| `markers` \| `prep` \| `experiments` \| `publication` | la section ouverte |
| `step` | 1–12 ou absent | l'étape dont le panneau est déplié |
| `view: "library"` | — | l'utilisateur est dans la bibliothèque |

`navigate` déplace l'interface : `{ view, videoId?, tab?, step? }`.

## Les actions

Quarante et une actions métier, plus les deux standard. Toutes définies une seule fois avec
`defineAction()` : outil d'agent, hook React, route HTTP, commande CLI et outil MCP/A2A
d'un même geste. **Aucune route `/api/*` ne double une action**, export CSV compris.

| Action | Rôle |
| --- | --- |
| `list-videos` · lecture | Les vidéos, avec couverture narrative et blocage |
| `get-video` · lecture | Une vidéo : couverture, dernier mouvement, volumes |
| `create-video` | Crée la vidéo **et** son premier `stage_event` |
| `update-video` | Titre, type, échéance. **Refuse `stage`** → `move-stage` |
| `archive-video` | Archivage logique réversible |
| `move-stage` | **Seul chemin** vers `videos.stage` ; journalise |
| `list-blocked` · lecture | Vidéos sans mouvement au-delà du seuil (14 j) |
| `list-stage-events` · lecture | L'historique de production d'une vidéo |
| `get-story-map` · lecture | Les 12 étapes, toujours les 12, avec courbe et couverture |
| `set-beat` | Note et intensité d'une étape ; renvoie `isCovered` |
| `list-markers` · lecture | Le carnet, en ordre narratif ou chronologique |
| `upsert-marker` | Crée ou modifie un marqueur |
| `delete-marker` | Suppression définitive |
| `assign-marker-step` | Rattache/détache une étape sans toucher au reste |
| `reorder-markers` | L'ordre narratif ; refuse une liste partielle |
| `export-markers` · lecture | CSV, EDL d'assemblage, chapitres YouTube — **inline**, sans stockage externe |
| `get-prep-sheet` · lecture | Les 5 questions et leurs réponses |
| `answer-prep-question` | Répond ; refuse une clé inconnue |
| `list-experiments` · lecture | Les essais, avec avertissement si plusieurs en cours |
| `create-experiment` | Ouvre un essai (diagnostic / roasting / self) |
| `resolve-experiment` | Fait avancer ; **exige un verdict** pour clore |
| `diagnose-structure` · lecture | Les règles de la méthode appliquées à la carte |
| `upsert-publication` | Cible de diffusion, plateforme en texte libre |
| `list-publications` · lecture | Les cibles de diffusion, avec leurs relevés |
| `record-metrics` | Relevé manuel, un par jour et par publication |
| `list-brand-kits` · lecture | Les kits de marque |
| `upsert-brand-kit` | Crée ou modifie un kit |
| `delete-brand-kit` | Supprime un kit ; modèles et ressources redeviennent globaux |
| `list-asset-templates` · lecture | Les modèles, plus la taxonomie complète |
| `upsert-asset-template` | Crée ou modifie un modèle ; rejette catégorie ou format inconnus |
| `delete-asset-template` | Supprime un modèle ; les ressources produites restent |
| `duplicate-asset-template` | Copie un modèle dans un kit, sans toucher à l'original |
| `list-assets` · lecture | La bibliothèque, filtrable, avec compteurs et taxonomie |
| `upsert-asset` | Ajoute ou modifie une ressource — **URL seulement** |
| `delete-asset` | Retire la fiche ; le fichier d'origine reste |
| `list-prompts` · lecture | Le catalogue, les prompts du voyage du héros et ceux de l'utilisateur |
| `upsert-prompt` | Crée, modifie, ou copie un prompt livré (`fromBuiltIn` ou `fromCatalog`) |
| `delete-prompt` | Supprime un prompt de l'utilisateur ; les intégrés sont intouchables |
| `install-starter-template` | Copie une ressource de départ dans les modèles de l'utilisateur |
| `view-screen` · lecture | Ce que l'utilisateur regarde |
| `navigate` | Amène l'interface sur un écran |

## Les skills du projet

| Skill | Se déclenche quand |
| --- | --- |
| `voyage-du-heros` | structurer un récit, comprendre ce qui manque dans la carte |
| `diagnostic-timeline` | un symptôme de montage est décrit |
| `roasting` | un retour de spectateur arrive |
| `hyperframes` | produire une vidéo ou un teaser depuis la carte narrative |
| `remotion` | écrire une composition vidéo en React depuis la carte narrative |

Les skills du framework (`actions`, `storing-data`, `sharing`, `real-time-sync`,
`shadcn-ui`, `frontend-design`, `security`, `portability`…) couvrent le reste — ne pas
les réécrire.

## Vidéo : la frontière

Studio **ne rend aucune vidéo**, et ne le fera pas depuis son serveur : rendre demande
FFmpeg, un navigateur sans interface et l'exécution de commandes, or `fs` et
`child_process` sont interdits côté serveur pour que l'app reste déployable sur
n'importe quel hôte Nitro.

Ce que l'agent fait : transformer la carte narrative (12 étapes, courbe d'intensité,
marqueurs en ordre narratif) en **brief de composition**. Ce qu'il ne fait pas : lancer un
rendu, sauf si de vrais outils `mcp__hyperframes__*` figurent dans son registre — à
vérifier avec `tool-search` avant d'annoncer quoi que ce soit, jamais de rendu prétendu
sans identifiant de tâche renvoyé.

### Le pont HyperFrames

`mcp.config.json` déclare un pont local, `tools/hyperframes-bridge/server.mjs`. Il tourne
comme processus séparé — le serveur de l'app, lui, ne lance jamais de commande — et rend
sept outils disponibles à l'agent :

| Outil | Rôle |
| --- | --- |
| `mcp__hyperframes__doctor` | vérifier que Chrome et ffmpeg sont là, **avant** d'annoncer un rendu |
| `mcp__hyperframes__list_projects` | lister les projets de `video/` |
| `mcp__hyperframes__init` | créer un projet de composition |
| `mcp__hyperframes__write_composition` | écrire le `index.html` d'un projet |
| `mcp__hyperframes__read_composition` | le relire — vérifier avant de conclure |
| `mcp__hyperframes__lint` | valider avant de rendre |
| `mcp__hyperframes__render` | rendre en MP4 ou WebM |
| `mcp__hyperframes__preview_start` | ouvrir le studio d'aperçu et renvoyer son adresse |
| `mcp__hyperframes__server_stop` | arrêter cet aperçu |

Aucun compte, aucun jeton : HyperFrames rend en local. Le pont est volontairement étroit
— liste blanche de sous-commandes, jamais de shell, chemins confinés sous `video/`, et
**version épinglée** : `hyperframes@0.8.134`, jamais `@latest`. Les trois premières
garanties ne valent rien si npm peut télécharger et exécuter n'importe quelle version
future. Relever le numéro est un geste délibéré ; `--hyperframes-version=x.y.z` permet
d'essayer sans modifier le dépôt.

Si le pont n'est pas démarré, ces outils sont absents du registre : le vérifier avec
`tool-search` et le dire, plutôt que de promettre un rendu.

### Le pont Remotion

Même principe, `tools/remotion-bridge/server.mjs`, huit outils sous `mcp__remotion__*` :
`license_notice`, `doctor`, `list_projects`, `init`, `write_composition`,
`read_composition`, `compositions`, `render`, `studio_start`, `server_stop`.

`studio_start` ouvre Remotion Studio et renvoie son adresse : c'est là que l'utilisateur
voit sa composition en direct avant de rendre.

Même épinglage que pour HyperFrames : `remotion@4.0.533`, et `create-video` suit la même
version puisque les deux évoluent ensemble. Surcharge par `--remotion-version=x.y.z`.

**Remotion n'est pas open source** : gratuit pour les particuliers, les organisations à
but non lucratif et les entreprises de trois salariés au plus ; licence d'entreprise
au-delà. Il n'est donc **pas** une dépendance d'Indagis Studio — le pont l'installe à la
demande dans le projet vidéo de l'utilisateur. Montrer `license_notice` avant de créer un
premier projet Remotion.

HyperFrames est en Apache-2.0 : à proposer par défaut quand l'utilisateur n'a pas de
préférence.

## La bibliothèque de ressources

Quatrième écran, `/library`, avec sept sections dans **une seule route** : Créer,
Bibliothèque, Prompts, Modèles, Ressources de départ, Kits de marque, Journal. Le Principe V limite l'interface à trois
routes et exige une justification explicite au-delà : celle-ci est la demande de
l'utilisateur d'un espace où ranger son matériel de création.

Trois axes, à ne pas confondre — ils vivent dans `shared/asset-taxonomy.ts` :

| Axe | Question | Valeurs |
| --- | --- | --- |
| **Type** | qu'est-ce que c'est ? | vidéo, image, audio, modèle, document, typographie, palette, autre |
| **Catégorie** | à quoi ça sert ? | hero, page d'atterrissage, produit, logo, diagramme, vidéo, image, réseaux sociaux, campagne, style seul, squelette, autre |
| **Format** | quelle forme ? | 16 rapports, de 9:21 à 21:9 |

Une ressource a **trois états**, qui sont les trois onglets : `draft`, `generated`,
`reference`.

### Prompts et ressources de départ

Deux sections livrées avec l'application, **en lecture seule parce qu'elles vivent dans
le code** — `shared/prompt-library.ts` et `shared/starter-templates.ts`. L'utilisateur en
dispose dès l'installation, sans remplissage, et une mise à jour de l'app les met à jour.

| Section | Contenu | Comment on s'en sert |
| --- | --- | --- |
| **Prompts → Catalogue** | 541 prompts image, 9 cas vidéo | `upsert-prompt --fromCatalog <clé>` en fait une copie modifiable |
| **Prompts → Voyage du héros** | 6 prompts image, 6 prompts vidéo, à `{{variables}}` | `upsert-prompt --fromBuiltIn <clé>` |
| **Ressources de départ** | 10 modèles de génération | `install-starter-template --starterKey <clé>` les copie dans les modèles |

#### Le catalogue

550 prompts dans `shared/prompt-catalog/`, **généré** par
`tools/prompt-catalog/build.mjs` depuis deux dépôts MIT (voir `CREDITS.md`).

Il se trie sur trois axes indépendants, repris du site qui a inspiré l'écran :

| Axe | Question | Valeurs |
| --- | --- | --- |
| **Catégorie** | à quoi ça sert ? | 13 : interfaces, graphiques, affiches, produits, marque, architecture, photographie, illustration, personnages, scènes, histoire, documents, autres |
| **Style** | quel rendu ? | 19 : UI, Realistic, Poster, Character, Illustration, Brand, Infographic, Product, 3D… |
| **Scène** | quel domaine ? | 10 : Tech, Commerce, Fashion, Social, Story, Creative, Travel, Food, Education, History |

Trois règles pour l'agent :

- **Ne jamais importer `shared/prompt-catalog/index.ts` depuis `app/`.** Il pèse
  près de 700 Ko de texte ; seule une action a le droit de le charger. L'interface
  n'importe que `types.ts` (les axes) et `fill.ts` (le remplissage).
- **Les corps ne sont pas traduits.** Seuls les titres le sont. Un corps en chinois
  reste en chinois : c'est le texte éprouvé, et les modèles d'image le comprennent.
  Le dire à l'utilisateur plutôt que de traduire à sa place.
- **Les variables du catalogue s'écrivent `{argument name="x" default="y"}`**, pas
  `{{x}}` — c'est `fillCatalogPrompt()` qui les remplit, pas `fillPrompt()`.

Ne jamais proposer de modifier ou supprimer un élément intégré : en faire une copie est
le seul chemin, et c'est ce qui protège l'original.

**Aucun binaire en base** : `assets.url` stocke un lien, jamais un fichier. Une ressource
supprimée ne supprime que sa fiche.

L'écran **Créer** n'appelle aucun modèle d'image : il assemble modèle + kit de marque +
demande en une consigne, et la passe à l'agent par `sendToAgentChat()`. C'est l'agent,
avec ses outils HyperFrames ou Remotion, qui produit le fichier — ou qui dit qu'il ne
peut pas.

## Le référentiel de la méthode n'est pas en base

Les 12 étapes, les 3 actes, les 5 questions de préparation, les 5 symptômes et les 4
points de relecture finale vivent dans `shared/hero-journey.ts`. C'est du contenu figé,
transcrit de la méthode source. Les tables ne stockent que ce que l'utilisateur en fait.

`shared/coverage.ts` porte la règle de couverture, en un seul endroit : **une étape n'est
couverte que si sa note est non vide après trim.** Ni une intensité seule, ni des
marqueurs rattachés ne suffisent — voir FR-006 dans la spec pour le pourquoi.

Une étape qui porte des marqueurs sans note n'est pas pour autant traitée comme vide :
le diagnostic la signale par la règle `matiere-sans-intention`, qui dit à l'utilisateur
qu'il a le matériel et qu'il lui reste à nommer l'intention.

### Les timecodes sont relatifs à leur rush

**`markers.startMs` et `markers.endMs` se comptent depuis le début du rush, jamais depuis
le début d'un montage.** Un marqueur à 4 s dans `rush-01` et un autre à 4 s dans
`rush-07` ne désignent pas le même instant.

Conséquence pour toute règle future : on peut parler de **durées de matière** (somme des
passages, par acte ou par étape) et de **recouvrements à l'intérieur d'un même rush**. On
ne peut pas parler de position dans la timeline finale — elle n'est pas dérivable. Trois
règles exploitent aujourd'hui ces durées : `acte-ii-sous-dote`, `climax-sans-matiere` et
`marqueurs-superposes`. Un marqueur sans `endMs` est un point : il ne pèse aucune durée.

## Git

- Créer des commits atomiques par étape de spec/plan/tâche, pas un commit global en fin
  de session.
- Ne pousser vers aucun remote sans autorisation explicite.
