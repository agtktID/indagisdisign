# Phase 0 — Recherche : Atelier narratif vidéo

**Branche** : `001-atelier-narratif-video` | **Date** : 2026-09-28 | **Plan** : [plan.md](./plan.md)

Le `Technical Context` du plan ne portait aucun marqueur `NEEDS CLARIFICATION`. Cette
phase ne lève donc pas d'inconnues bloquantes : elle **fonde en documentation** les six
choix techniques que le plan présuppose, pour qu'aucun d'eux ne repose sur une déduction.

Toutes les citations renvoient à la documentation embarquée dans le paquet installé,
`node_modules/@agent-native/core/docs/content/`, et non à une source réécrite de mémoire.

---

## Décision 1 — Scaffolding : template `chat`, mode standalone

**Décision** : générer l'application avec

```bash
npx --yes @agent-native/core@latest create indagis-studio --standalone --template chat
```

puis **fusionner** l'arborescence produite à la racine du dépôt existant, plutôt que de
lancer la commande dans le dépôt lui-même.

**Rationale** : `getting-started.mdx` donne cette commande exacte comme point d'entrée
officiel et décrit ce que le template livre : « a browser UI, authentication, durable
conversations, live sync, application context, and an `actions/` directory ». Ces cinq
briques couvrent des besoins que la spec pose sans les nommer (FR-019 — aucun compte
externe requis, satisfait par le mode *Continue as local dev* documenté dans la même
page). Les régénérer à la main serait du travail déjà fait, et moins bien fait.

La fusion plutôt que la génération sur place est une contrainte opérationnelle, pas un
choix d'architecture : le dépôt contient déjà `AGENTS.md`, `specs/`, `.specify/`,
`_bmad/` et `.claude/`. Le scaffold est donc produit dans un dossier temporaire puis
déplacé, en vérifiant qu'aucun fichier existant n'est écrasé.

**Alternatives écartées** :
- *Template `minimal` ou aucun template* — obligerait à recâbler auth, chat et live sync
  à la main ; aucun gain, puisque Studio a besoin des trois.
- *Mode workspace multi-apps* — exclu par la constitution (section « Contraintes
  techniques Agent-Native » : un seul `package.json` applicatif) et par le périmètre acté
  avec l'utilisateur (ni Clips, ni Design, ni Content).
- *Génération sur place dans le dépôt* — risque d'écrasement silencieux de `AGENTS.md`,
  qui est déjà rédigé et fait autorité.

---

## Décision 2 — Migrations : `runMigrations()` manuscrites, pas Drizzle Kit

**Décision** : un seul propriétaire de schéma, `runMigrations()` dans
`server/plugins/db.ts`, avec des entrées manuscrites portant chacune un `name:` unique.
Pas de `pnpm db:generate` / `runDrizzleMigrations()`.

**Rationale** : `server-database.mdx` documente les deux chemins et pose la règle qui
tranche — « Do not give one schema two independent migration owners. » Il faut donc
choisir, et deux éléments désignent le chemin manuscrit :

1. Le chargeur Drizzle lit ses fichiers `.sql` depuis le disque. La doc le dit
   explicitement : « The filesystem-backed loader is not available in filesystem-free
   edge runtimes. » Or le plan garde ouvertes les onze cibles Nitro, et la constitution
   interdit `fs` côté serveur. Le chemin manuscrit n'a pas cette dépendance.
2. La doc confirme la règle déjà inscrite dans la constitution : « Give new entries a
   stable `name`; named migrations are tracked independently of their version number. »
   C'est ce qui rend deux branches parallèles réconciliables.

La même page impose aussi la table de versions dédiée à l'app —
`{ table: "indagis_studio_migrations" }` — pour ne pas entrer en collision avec les
migrations du framework.

**Alternatives écartées** :
- *Drizzle Kit généré* — meilleure ergonomie de rédaction, mais dépendance disque et
  perte de portabilité d'hôte. À reconsidérer seulement si l'hôte est figé sur Node.
- *Mélanger les deux* — interdit par la doc, sans ambiguïté.

**Réserve** : en production, `server-database.mdx` avertit de ne pas migrer à la première
requête mais dans une étape de release (`pnpm migrate:production`, fourni par le template
`chat`). Le plugin de démarrage reste le chemin de développement local.

---

## Décision 3 — Courbe émotionnelle : Recharts, déjà dans le noyau

**Décision** : tracer la courbe avec **Recharts**, qui est une dépendance directe de
`@agent-native/core` (`recharts: ^3.9.2` dans son `package.json`). Aucune bibliothèque de
graphiques supplémentaire n'est ajoutée au projet.

Deux surfaces, un seul jeu de données :
- **Dans l'écran *Carte*** — un composant React de l'app qui lit les douze `intensity`
  et trace la courbe à côté des douze cases.
- **Dans le chat** — quand l'agent restitue la courbe, l'action la renvoie via
  `createDataChartWidgetResult()` importé de `@agent-native/core/data-widgets`, et le
  runtime choisit lui-même le rendu natif. `components.mdx` est explicite sur le fait
  qu'on n'importe ni ne monte le composant soi-même.

**Rationale** : la courbe est une série de douze points entiers. Recharts est déjà
installé transitivement, donc l'utiliser n'ajoute aucun poids ; et le chemin chat existe
déjà en natif, ce qui évite de rendre la même donnée deux fois de deux façons
divergentes.

**Alternatives écartées** :
- *SVG tracé à la main* — douze points, c'est faisable, mais il faudrait réimplémenter
  axes, survol et accessibilité que Recharts fournit.
- *Une bibliothèque de graphiques tierce* — ajouterait une dépendance là où le noyau en
  porte déjà une.

**Piège relevé** : `DataChartWidget` est un **type de forme de résultat**, pas un
composant à monter — `components.mdx` le souligne. Confondre les deux produirait une
erreur de compilation difficile à lire.

---

## Décision 4 — Export CSV : contenu rendu par l'action, fichier assemblé côté client

**Décision** : `export-markers` renvoie une chaîne CSV inline dans son résultat —
`{ content, rowCount, truncated, format }` — et le navigateur en fait un fichier via un
`Blob`. Aucun fournisseur de stockage de fichiers n'est requis.

**Rationale** : le framework contient les deux patrons, et l'un des deux est éliminé par
une exigence de la spec.

- Le patron *Forms* (`template-forms-developers.mdx`, action `export-responses`) écrit
  l'export « uploaded to configured file storage (never written to local disk),
  returning the file URL » et « throws with a clear message if no file storage provider
  is configured ». Il **viole FR-019** : l'utilisateur devrait connecter un compte de
  stockage pour exporter ses propres marqueurs.
- Le patron *Audit log* (`audit-log.mdx`, action `export-audit-events`) renvoie
  `{ content, rowCount, truncated, format }` directement dans le résultat de l'action.
  Aucun service externe. C'est ce patron qu'on reprend, y compris le nom des champs.

Ce choix préserve aussi le Principe II : pas de route `/api/*` d'export en parallèle de
l'action.

**Alternatives écartées** :
- *Upload vers un stockage puis URL* — exclu par FR-019, comme montré ci-dessus.
- *Route HTTP dédiée renvoyant `text/csv`* — doublonnerait l'action, contre le Principe II.

**Garde-fou repris de la doc** : `template-forms-features.mdx` note que toute valeur
ressemblant à une formule de tableur est neutralisée avant export, « which protects you
from a submission that tries to run code when you open the file ». Les marqueurs
contiennent du texte libre saisi par l'utilisateur ; on applique la même neutralisation
(préfixer d'une apostrophe toute cellule commençant par `=`, `+`, `-` ou `@`).

**Plafond** : `maxRows` par défaut 5000, comme `export-audit-events`. Un carnet de
marqueurs réaliste tient dans deux ordres de grandeur en dessous.

---

## Décision 5 — Seuil de blocage : 14 jours sans changement d'étape, configurable

**Décision** : une vidéo est signalée « bloquée » quand aucun `stage_event` n'a été
enregistré pour elle depuis **14 jours**, et qu'elle n'est ni publiée ni archivée. La
valeur est une constante nommée dans `shared/`, pas un littéral disséminé.

**Rationale** : aucune source documentaire ne fixe ce nombre — ni le PDF, ni le
framework. C'est une **hypothèse produit**, et elle est déclarée comme telle plutôt que
présentée comme un fait. Quatorze jours correspond à deux semaines pleines : assez long
pour ne pas alerter sur une pause normale de week-end ou de tournage, assez court pour
que le signal arrive avant qu'un projet soit oublié.

Le seuil est isolé dans une constante pour qu'un ajustement après usage réel soit un
changement d'une ligne, et non une chasse aux occurrences.

**Alternatives écartées** :
- *7 jours* — bruyant : un tournage étalé sur deux week-ends déclencherait l'alerte.
- *Seuil par étape* (montage plus long que script) — plus juste en théorie, mais impose à
  l'utilisateur de calibrer cinq valeurs avant d'avoir la moindre donnée. À reconsidérer
  quand il y aura de l'historique réel à observer.
- *Seuil réglable dans l'interface* — un écran de réglages de plus, contre le Principe V.

---

## Décision 6 — Partage : `registerShareableResource` sur la vidéo, et seulement elle

**Décision** : une seule ressource partageable, `type: "studio-video"`, adossée à
`videos` et `video_shares`. Les marqueurs, les beats, les réponses de préparation et les
essais héritent de l'accès à leur vidéo ; ils ne sont pas partageables séparément.

L'enregistrement suit la forme documentée dans `sharing.mdx` :

```ts
registerShareableResource({
  type: "studio-video",
  resourceTable: schema.videos,
  sharesTable: schema.videoShares,
  displayName: "Vidéo",
  titleColumn: "title",
  getResourcePath: (video) => `/video/${video.id}`,
  getDb,
});
```

**Rationale** : `sharing.mdx` décrit précisément l'effet obtenu — « After that,
list/read queries pass through `accessFilter()` and write actions use `assertAccess()`
to enforce roles. » Une seule inscription suffit donc à couvrir les vingt-trois actions,
à condition que toutes les tables filles portent `video_id` et soient lues à travers leur
vidéo.

Un seul point d'entrée de partage est aussi la lecture la plus simple pour l'utilisateur :
on partage *un récit*, pas un marqueur isolé.

**Alternatives écartées** :
- *Rendre chaque table partageable* — quatre tables de partage supplémentaires, une
  matrice de droits que personne ne saurait raisonner, et un gain nul.
- *Aucun partage au départ* — repousserait une migration de schéma à plus tard sur toutes
  les tables concernées ; la constitution impose des migrations rétrocompatibles, ce qui
  rend l'ajout tardif faisable mais inutilement coûteux.

**Non retenu à ce stade** : les deux drapeaux de durcissement
`allowPublic: false` et `requireOrgMemberForUserShares: true`. `sharing.mdx` les réserve
aux ressources « that execute code or carry elevated trust » — une vidéo Studio ne stocke
que du texte et des timecodes, aucun code exécutable. Le partage public d'une carte
narrative est au contraire un usage légitime (montrer sa structure à un pair).

---

## Ce que cette phase n'a pas tranché

Deux points restent ouverts sans bloquer la conception, et sont notés ici pour ne pas
être découverts en cours d'implémentation :

1. **Origine des opérateurs Drizzle** (`eq`, `and`, `inArray`…). La page
   `context-awareness.mdx` les importe de `drizzle-orm` dans son exemple `view-screen`,
   alors que la skill `storing-data` du framework prescrit `@agent-native/core/db/schema`.
   Un import direct de `drizzle-orm` a déjà échoué à la compilation dans un essai
   antérieur. On suit la skill, et on le vérifiera au premier `pnpm typecheck`.
2. **Hôte de déploiement**. Le plan le laisse ouvert volontairement. Le seul effet de la
   décision 2 est de garder cette porte ouverte ; aucune autre décision n'en dépend.
