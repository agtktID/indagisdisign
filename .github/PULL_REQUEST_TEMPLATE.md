## Ce que ça change

<!-- En une ou deux phrases : le problème, puis la solution. -->

## Pourquoi

<!-- Le contexte qu'un relecteur n'a pas. S'il y a une issue, la lier : Closes #… -->

## Vérifié

- [ ] `pnpm typecheck` — exit 0
- [ ] `pnpm test`
- [ ] `pnpm agent-native:doctor` — **Clean**
- [ ] Testé dans l'application, pas seulement en test unitaire

## Les quatre zones

Pour une nouvelle fonctionnalité — cocher, ou dire pourquoi ce n'est pas applicable :

- [ ] **Interface** — l'utilisateur peut le faire à l'écran
- [ ] **Action** — l'agent peut le faire aussi
- [ ] **Documentation** — `AGENTS.md` à jour
- [ ] **État applicatif** — `view-screen` sait décrire l'écran

## Migration

- [ ] Aucune
- [ ] Rétrocompatible, `name:` unique, aucune colonne supprimée
