---
name: diagnostic-timeline
description: >-
  Transformer un symptôme de montage (« le milieu traîne », « le climax tombe à plat »)
  en un essai testable. À lire dès que l'utilisateur décrit quelque chose qui ne
  fonctionne pas dans sa timeline, ou demande pourquoi son montage coince.
---

# Diagnostic de timeline

## Règle

Une hypothèse à tester, jamais un verdict. **Chaque symptôme peut avoir plusieurs
causes.** Changer une seule chose à la fois, puis comparer avant de conclure — sinon il
devient impossible de savoir ce qui a réglé le problème.

## Les cinq symptômes

| Ce que l'utilisateur observe | Clé | Ce qu'on peut essayer |
| --- | --- | --- |
| Le début répète le problème | `debut-repete` | Garder la scène la plus claire, puis avancer vers la promesse (étape 2). |
| Le milieu semble répétitif | `milieu-repetitif` | Chercher ce que chaque bloc change vraiment. Si deux séquences racontent la même chose, garder la plus forte. |
| Le climax semble faible | `climax-faible` | Vérifier que l'enjeu et le résultat sont lisibles **même sans musique**. |
| La fin paraît déconnectée | `fin-deconnectee` | Garder les conséquences (étape 10) et une preuve de transformation (étape 11) — pas juste un résumé. |
| Un passage paraît confus | `passage-confus` | Montrer le résultat, puis isoler le détail qui l'explique. |

## Comment procéder

1. Demander de décrire **concrètement** ce qui est observé : à quel endroit, quel effet.
   « Ça ne marche pas » n'est pas un symptôme exploitable.
2. Appeler `diagnose-structure` pour voir ce que la carte dit mécaniquement. L'action
   renvoie des observations, pas des correctifs.
3. Proposer l'hypothèse correspondante **comme point de départ**, pas comme diagnostic
   certain.
4. Ouvrir **un seul** essai avec `create-experiment` (`source: "diagnostic"`, et
   `symptomKey` parmi les cinq clés ci-dessus).
5. Encourager la comparaison avant/après plutôt que l'empilement de changements.

Si plusieurs essais sont déjà `testing` sur la même vidéo, le dire : les actions
renvoient un avertissement, il faut le relayer plutôt que l'ignorer.

## À ne pas faire

- Ne pas enchaîner plusieurs suggestions dans une même réponse : une seule à la fois.
- Ne pas conclure qu'un essai a marché sans que l'utilisateur ait comparé.
- Ne pas attacher un `symptomKey` à un essai qui vient d'un retour de spectateur — c'est
  `source: "roasting"`, et l'action rejette le mélange.
