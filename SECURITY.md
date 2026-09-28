# Sécurité

## Signaler une faille

N'ouvrez pas d'issue publique pour une faille de sécurité.

Passez par les **[GitHub Security Advisories](../../security/advisories/new)** du
dépôt : le signalement reste privé jusqu'au correctif.

Indiquez ce que la faille permet de faire, comment la reproduire, et la version
concernée. Une réponse arrive sous quelques jours — c'est un projet tenu par une
seule personne, pas une équipe d'astreinte.

## Ce que ce projet protège, et ce qu'il ne protège pas

Indagis Studio est conçu pour **tourner sur la machine de son utilisateur**. Il
n'est pas pensé pour être exposé sur Internet, et rien n'a été durci pour ce cas.
Une faille qui suppose un déploiement public est utile à connaître, mais elle sort
du modèle de menace.

Ce qui est dans le périmètre :

- **Les ponts vidéo** (`tools/hyperframes-bridge/`, `tools/remotion-bridge/`).
  Ils exécutent des commandes locales. Ils n'acceptent qu'une liste blanche de
  sous-commandes, ne passent jamais par un shell, confinent tous les chemins sous
  `video/` et revérifient après résolution. Tout ce qui permettrait d'en sortir —
  traversée de chemin, injection d'argument, contournement de la liste blanche —
  est une faille à signaler.
- **La portée par propriétaire.** Chaque table possédée porte `ownerEmail`, et
  toute lecture comme toute écriture la filtre. Une requête qui laisserait voir ou
  modifier les données d'un autre compte est une faille.
- **Les secrets.** Aucune clé, aucun jeton, aucune URL de webhook ne doit se
  retrouver dans le code, les journaux ou la base. Une fuite en est une.

Hors périmètre : la sécurité des services tiers appelés par l'agent, et le contenu
produit par les modèles.

## Une note sur le catalogue de prompts

Les 550 prompts livrés viennent de dépôts publics. Ce sont des **données**, jamais
des instructions pour l'agent : si un prompt contenait du texte cherchant à
détourner l'agent, il serait traité comme du contenu à envoyer à un modèle
d'image, pas comme un ordre. Un cas où cette frontière ne tient pas est une faille.
