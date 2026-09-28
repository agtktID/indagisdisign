# Feature Specification: Atelier narratif vidéo

**Feature Branch**: `001-atelier-narratif-video`

**Created**: 2026-09-28

**Status**: Draft

**Input**: User description : construire Indagis Studio comme application autonome de
structuration narrative pour le montage vidéo, fondée sur la méthode du voyage du héros
appliqué au montage (12 étapes, 3 actes, courbe émotionnelle, carnet de marqueurs, fiche
de préparation, diagnostic de structure), avec un suivi de production secondaire
(échéances, étapes de fabrication), sans application voisine (Clips, Design, Dispatch) et
sans captation ni montage vidéo dans l'app elle-même.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Structurer le récit d'une vidéo sur la carte narrative (Priority: P1)

Un créateur ouvre une vidéo et retrouve les 12 étapes du voyage du héros, groupées en
3 actes, avec pour chaque étape la définition, le conseil de montage et un exemple tiré
de films connus. Il renseigne une note et une intensité ressentie pour les étapes qui
s'appliquent à son récit, et voit la courbe émotionnelle se dessiner à mesure qu'il
avance.

**Why this priority** : c'est le cœur du produit — la seule chose que cette application
fait que les outils de suivi de projet génériques ne font pas. Elle doit être utilisable
seule, sans aucune autre fonctionnalité.

**Independent Test** : créer une vidéo, renseigner note et intensité sur plusieurs
étapes réparties dans les 3 actes, constater que la courbe et la couverture par acte se
mettent à jour sans qu'aucune autre fonctionnalité (marqueurs, fiche, diagnostic) ne soit
nécessaire.

**Acceptance Scenarios**:

1. **Given** une vidéo tout juste créée, **When** le créateur ouvre sa carte narrative,
   **Then** les 12 étapes s'affichent groupées en 3 actes, toutes marquées comme non
   couvertes.
2. **Given** une étape sans note ni marqueur, **When** le créateur y ajoute une note et
   une intensité, **Then** l'étape passe à couverte et la courbe émotionnelle affiche le
   nouveau point.
3. **Given** un acte dont une seule étape sur quatre est couverte, **When** le créateur
   regarde le résumé par acte, **Then** il voit "1 sur 4" pour cet acte, pas un simple
   pourcentage global de la vidéo.

---

### User Story 2 - Tenir le carnet de marqueurs (Priority: P2)

Le créateur note les passages de ses rushes qui comptent : un intitulé, le nom du rush,
un timecode de début et de fin, la sensation visée, un essai de montage à tester, et
éventuellement l'étape narrative à laquelle le passage se rattache. Il peut ensuite
réordonner ses marqueurs selon la logique du récit — un ordre qui peut différer de
l'ordre chronologique des timecodes — et exporter le carnet.

**Why this priority** : c'est l'outil de travail quotidien pendant le dérushage et le
remontage ; il dépend de la carte narrative (US1) pour se rattacher à une étape mais
reste utilisable même sans rattachement.

**Independent Test** : ajouter trois marqueurs à des timecodes croissants, les
réordonner dans un ordre différent du chronologique, exporter le carnet et vérifier que
l'ordre exporté est bien l'ordre narratif choisi, pas l'ordre des timecodes.

**Acceptance Scenarios**:

1. **Given** une vidéo sans marqueur, **When** le créateur ajoute un marqueur avec un
   intitulé et un timecode, **Then** le marqueur apparaît dans le carnet et, si une
   étape lui est assignée, l'étape correspondante passe à couverte.
2. **Given** plusieurs marqueurs classés par timecode, **When** le créateur les
   réordonne manuellement, **Then** l'ordre narratif est conservé indépendamment des
   timecodes, qui eux ne changent pas.
3. **Given** un marqueur sans étape assignée, **When** le créateur consulte le carnet,
   **Then** ce marqueur reste visible et exportable, signalé comme non rattaché.

---

### User Story 3 - Remplir la fiche de préparation avant de monter (Priority: P3)

Avant de commencer le montage, le créateur répond à cinq questions fixes qui cadrent le
récit : quel problème l'ouvre, ce qui doit changer, quelle scène rend ce changement
visible, ce qu'il faut comprendre avant cette scène, et quelle sera la première
modification à tester. Les réponses restent attachées à la vidéo et consultables à tout
moment.

**Why this priority** : utile en amont du travail sur la carte et les marqueurs, mais la
vidéo reste exploitable sans elle — elle cadre plutôt qu'elle ne bloque.

**Independent Test** : répondre aux cinq questions d'une vidéo, quitter puis revenir sur
la fiche, vérifier que les réponses ont persisté telles quelles.

**Acceptance Scenarios**:

1. **Given** une vidéo sans fiche remplie, **When** le créateur ouvre la fiche de
   préparation, **Then** les cinq questions fixes s'affichent, vides.
2. **Given** une réponse partiellement remplie, **When** le créateur revient plus tard,
   **Then** les réponses déjà données sont conservées et modifiables individuellement.

---

### User Story 4 - Diagnostiquer la structure et transformer un retour en essai (Priority: P4)

Le créateur constate un symptôme de montage (début qui répète le problème, milieu
répétitif, climax faible, fin déconnectée, passage confus) ou reçoit un retour de
spectateur. Dans les deux cas, il enregistre une observation, en tire une hypothèse, note
la modification qu'il va tester, puis marque le résultat comme conservé ou abandonné une
fois l'essai fait.

**Why this priority** : ferme la boucle d'amélioration itérative, mais suppose que la
carte narrative (US1) existe déjà pour donner du sens au diagnostic.

**Independent Test** : choisir un symptôme prédéfini, constater qu'un essai est créé avec
une observation et une tentative pré-remplies, changer son statut en "conservé" avec une
note de verdict, vérifier que l'essai précédent reste consultable dans l'historique.

**Acceptance Scenarios**:

1. **Given** une vidéo dont le climax semble faible, **When** le créateur sélectionne ce
   symptôme prédéfini, **Then** un essai est créé avec une observation et une tentative
   suggérée déjà renseignées, modifiables.
2. **Given** un retour de spectateur en mots libres, **When** le créateur le saisit comme
   observation, **Then** il peut lui associer une hypothèse et une tentative de son choix,
   sans passer par un symptôme prédéfini.
3. **Given** un essai marqué "abandonné", **When** le créateur en crée un nouveau sur la
   même observation, **Then** l'essai précédent reste visible dans l'historique plutôt que
   d'être remplacé silencieusement.

---

### User Story 5 - Suivre l'avancement de production et les échéances (Priority: P5)

En complément de la structuration narrative, le créateur suit où en est chaque vidéo dans
sa fabrication (idée, script, tournage, montage, miniature, prête, publiée, archivée),
fixe une échéance, et repère les vidéos bloquées trop longtemps à la même étape. Une fois
la vidéo prête, il note où elle doit être publiée, ses métadonnées de référencement, et
saisit manuellement les chiffres de performance une fois publiée.

**Why this priority** : utile pour ne rien perdre de vue, mais reste secondaire par
rapport à la structuration narrative — un suivi de production existe déjà dans des
outils génériques, ce n'est pas ce qui distingue ce produit.

**Independent Test** : créer une vidéo, la faire avancer d'étape en étape, lui fixer une
échéance dépassée, vérifier qu'elle apparaît comme en retard dans la vue calendrier sans
qu'aucune fonctionnalité narrative ne soit nécessaire pour cela.

**Acceptance Scenarios**:

1. **Given** une vidéo à l'étape "montage" depuis plus longtemps que le seuil défini,
   **When** le créateur consulte la liste des vidéos, **Then** elle est signalée comme
   bloquée.
2. **Given** une vidéo prête à être publiée, **When** le créateur renseigne une
   plateforme cible et des métadonnées de référencement, **Then** ces informations sont
   conservées et consultables séparément de la carte narrative.
3. **Given** une vidéo publiée, **When** le créateur saisit des chiffres de performance
   à deux dates différentes, **Then** les deux relevés restent consultables comme un
   historique, pas seulement le dernier.

---

### Edge Cases

- Une étape narrative jamais touchée (ni note, ni marqueur, ni intensité) doit rester
  visiblement "non couverte" — elle ne doit jamais être comptée comme couverte par
  erreur ni masquée silencieusement.
- Une intensité renseignée seule, sans note ni marqueur, ne doit pas suffire à faire
  passer une étape à couverte : le contenu doit exister pour que la couverture ait un
  sens.
- Plusieurs marqueurs peuvent être assignés à la même étape narrative ; l'application ne
  doit pas limiter à un seul marqueur par étape.
- Un marqueur peut n'avoir aucune étape assignée ; il reste visible, réordonnable et
  exportable comme les autres.
- Réordonner les marqueurs ne doit jamais modifier leurs timecodes de début et de fin.
- Un diagnostic ou un roasting appliqué sur une vidéo dont la carte narrative est
  entièrement vide doit rester utilisable : l'application propose la tentative
  suggérée sans exiger que la carte soit déjà remplie.
- Un essai marqué "abandonné" puis retesté sur la même observation doit conserver la
  trace du premier essai plutôt que de l'écraser.
- Une vidéo bloquée depuis longtemps à une étape de production doit rester signalée même
  si elle n'a aucune activité narrative associée.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Le système DOIT permettre de créer, renommer et archiver une vidéo.
- **FR-002**: Le système DOIT présenter, pour chaque vidéo, les 12 étapes du voyage du
  héros groupées en 3 actes, avec leur définition, leur conseil de montage et un exemple
  de référence.
- **FR-003**: Les utilisateurs DOIVENT pouvoir enregistrer une note libre et une
  intensité émotionnelle (sur une échelle de 0 à 100) pour chaque étape narrative d'une
  vidéo.
- **FR-004**: Le système DOIT afficher visuellement, sous forme de courbe, l'intensité
  émotionnelle renseignée sur l'ensemble des 12 étapes.
- **FR-005**: Le système DOIT calculer et afficher, par acte, le nombre d'étapes
  couvertes sur le nombre total d'étapes de cet acte.
- **FR-006**: Une étape narrative NE DOIT être considérée couverte que si elle porte une
  note ou au moins un marqueur qui lui est assigné ; une intensité seule ne doit pas
  suffire.
- **FR-007**: Les utilisateurs DOIVENT pouvoir créer des marqueurs avec un intitulé, un
  nom de rush optionnel, des timecodes de début et de fin optionnels, une étape
  narrative optionnelle, une sensation visée et un essai de montage envisagé.
- **FR-008**: Les utilisateurs DOIVENT pouvoir réordonner les marqueurs selon une
  séquence narrative indépendante de leurs timecodes chronologiques.
- **FR-009**: Le système DOIT permettre d'exporter le carnet de marqueurs vers un
  fichier exploitable en dehors de l'application.
- **FR-010**: Le système DOIT permettre de répondre à cinq questions de préparation
  fixes par vidéo et de conserver ces réponses.
- **FR-011**: Le système DOIT proposer un ensemble fixe de symptômes de structure
  courants, chacun pré-rempli avec une tentative corrective suggérée.
- **FR-012**: Les utilisateurs DOIVENT pouvoir enregistrer une observation libre (par
  exemple les mots exacts d'un spectateur) et la faire évoluer en hypothèse puis en
  tentative planifiée.
- **FR-013**: Chaque essai DOIT porter un statut (à tester / en cours / conservé /
  abandonné) modifiable par l'utilisateur, et un essai abandonné DOIT rester consultable
  plutôt que d'être supprimé.
- **FR-014**: Le système DOIT rappeler la règle de la méthode source : ne changer qu'une
  seule chose à la fois entre deux essais, et comparer.
- **FR-015**: Le système DOIT suivre l'étape de production de chaque vidéo à travers une
  séquence fixe d'étapes et enregistrer chaque changement d'étape avec sa date.
- **FR-016**: Le système DOIT signaler une vidéo comme bloquée lorsqu'elle n'a pas changé
  d'étape de production depuis plus longtemps qu'un seuil défini.
- **FR-017**: Les utilisateurs DOIVENT pouvoir fixer une échéance par vidéo et la
  retrouver dans une vue calendrier des échéances à venir ou dépassées.
- **FR-018**: Le système DOIT permettre d'enregistrer, par vidéo, une ou plusieurs
  cibles de publication (plateforme, titre et description de référencement, mots-clés)
  ainsi que des chiffres de performance saisis manuellement après publication.
- **FR-019**: Les utilisateurs DOIVENT pouvoir utiliser l'intégralité des
  fonctionnalités ci-dessus sans connecter aucun compte tiers ni configurer de clé
  d'accès externe.
- **FR-020**: L'interface DOIT rester organisée en trois écrans — la liste des vidéos, la
  fiche d'une vidéo avec ses sections, et le calendrier des échéances. L'ajout d'un
  quatrième écran de premier niveau nécessite une justification explicite plutôt qu'une
  décision implicite.

### Key Entities *(include if feature involves data)*

- **Vidéo** : un projet vidéo suivi par l'application — titre, type (vidéo longue ou
  dérivé court), vidéo parente le cas échéant, étape de production courante, échéance.
- **Étape de récit (beat narratif)** : l'état d'une des 12 étapes du voyage du héros pour
  une vidéo donnée — note, intensité, statut de couverture.
- **Marqueur** : un passage identifié dans les rushes — intitulé, timecodes, étape
  narrative associée (optionnelle), position dans l'ordre narratif, sensation visée,
  essai de montage.
- **Réponse de préparation** : la réponse à l'une des cinq questions fixes de la fiche de
  préparation, par vidéo.
- **Essai (expérimentation)** : une itération de la boucle observation → hypothèse →
  tentative → verdict, rattachée à une vidéo et, si pertinent, à une étape narrative.
- **Publication** : une cible de diffusion pour une vidéo — plateforme, statut,
  métadonnées de référencement.
- **Relevé de performance** : une mesure manuelle (vues, rétention, mentions J'aime,
  commentaires) rattachée à une publication, à une date donnée.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001** : un créateur peut passer d'une vidéo vide à une carte narrative
  entièrement renseignée (les 12 étapes touchées) en restant sur un seul écran, sans en
  sortir.
- **SC-002** : un créateur peut identifier, en quelques secondes après avoir ouvert une
  vidéo, quel acte du récit est sous-renseigné par rapport aux deux autres.
- **SC-003** : réordonner des marqueurs selon une logique narrative ne demande pas plus
  d'actions que réordonner des éléments dans une simple liste.
- **SC-004** : l'intégralité des cinq questions de préparation et des cinq symptômes de
  diagnostic de la méthode source sont représentés et utilisables sans avoir besoin de
  consulter le document d'origine.
- **SC-005** : un créateur peut exporter un carnet de marqueurs utilisable dans un
  logiciel de montage courant, sans reformatage manuel préalable.
- **SC-006** : l'application reste utilisable de bout en bout — créer une vidéo, la
  structurer, exporter ses marqueurs — sans configurer aucun compte ni service externe.
- **SC-007** : une vidéo bloquée à la même étape de production au-delà du seuil défini
  apparaît signalée sans action manuelle de la part du créateur.

## Assumptions

- Le contenu et le nombre des 12 étapes du voyage du héros restent fixes dans cette
  version — non configurables par l'utilisateur.
- Un créateur ou une petite équipe travaille sur un récit à la fois ; la coédition en
  temps réel de la même carte narrative par plusieurs personnes n'est pas un objectif de
  cette version.
- Le seuil définissant une vidéo "bloquée" en production a une valeur par défaut
  raisonnable, ajustable ultérieurement sans changer le comportement attendu ci-dessus.
- Aucune intégration spécifique à un logiciel de montage (Premiere, Resolve, Final Cut)
  n'est requise au-delà d'un export dans un format générique et largement compatible.
- La captation, le montage effectif et la lecture de fichiers vidéo restent hors
  périmètre : cette application structure le récit, elle ne produit pas la vidéo
  elle-même.
- Les cibles de publication et les relevés de performance sont saisis manuellement ; aucune
  publication ni récupération automatique de statistiques depuis une plateforme externe
  n'est requise.
