#!/usr/bin/env bash
# Vérifie que le projet est opérationnel, et le prouve ligne par ligne.
#
#   bash scripts/verifier.sh
#
# Chaque critère porte la commande qui le démontre. Aucun n'est déclaré acquis sans que
# sa commande ait tourné dans cette exécution — un rapport qui recopie un résultat
# précédent ne vaut rien.
#
# La CI couvre déjà typecheck, tests, doctor et build. Ce script y ajoute ce qu'elle ne
# peut pas faire : exécuter le parcours utilisateur complet contre une vraie base, et
# vérifier les frontières d'architecture que le typecheck ne voit pas.
#
# Sortie : 0 si tous les critères bloquants passent, 1 sinon. Les lignes INFO ne font
# jamais échouer le script — elles disent ce qui est connu comme non prouvé.
set -uo pipefail
cd "$(dirname "$0")/.."

readonly VERT=$'\033[0;32m' ROUGE=$'\033[0;31m' JAUNE=$'\033[0;33m' GRIS=$'\033[0;90m' FIN=$'\033[0m'
echecs=0

titre() { printf '\n%s── %s ──%s\n' "$GRIS" "$1" "$FIN"; }

# critere <libellé> <commande…> — fait échouer le script si la commande échoue.
critere() {
  local libelle="$1"; shift
  if "$@" >/dev/null 2>&1; then
    printf '  %sOK%s    %s\n' "$VERT" "$FIN" "$libelle"
  else
    printf '  %sÉCHEC%s %s\n        %s%s%s\n' "$ROUGE" "$FIN" "$libelle" "$GRIS" "$*" "$FIN"
    echecs=$((echecs + 1))
  fi
}

# info <libellé> <valeur> — affiché, jamais bloquant.
info() { printf '  %sINFO%s  %s : %s\n' "$JAUNE" "$FIN" "$1" "$2"; }

titre "Portes de qualité"
critere "Le typecheck passe"             pnpm typecheck
critere "Les tests passent"              pnpm test
critere "Le doctor ne relève rien"       bash -c 'pnpm agent-native:doctor 2>&1 | grep -q "Clean — no findings."'
critere "Le build de production réussit" pnpm build

titre "Frontières d'architecture"
critere "Aucun import .js relatif dans actions/, server/ et shared/" \
  bash -c '! grep -rqE "from \"\\.{1,2}/[^\"]*\\.js\"" actions/ server/ shared/'
critere "Le catalogue de prompts n'est pas importé par l'interface" \
  bash -c '! grep -rq "prompt-catalog/index" app/'
critere "Aucune route /api/ ne double une action" \
  bash -c '! find app/routes -name "api.*" 2>/dev/null | grep -q .'
# La CI installe en --frozen-lockfile. Deux fois déjà, `agent-native upgrade` a
# ré-épinglé package.json APRÈS la génération du lockfile, et la CI a échoué sur un
# désaccord invisible en local, où pnpm install s'en accommode.
critere "Le lockfile est en accord avec package.json" \
  pnpm install --frozen-lockfile --lockfile-only
critere "Aucun secret dans les fichiers suivis" \
  bash -c '! git ls-files -z | xargs -0 grep -lIE "(sk-[A-Za-z0-9_-]{16,})|(gh[pousr]_[A-Za-z0-9]{20,})|(AKIA[0-9A-Z]{16})|(-----BEGIN [A-Z ]*PRIVATE KEY)" 2>/dev/null | grep -q .'

titre "Parcours utilisateur, de bout en bout"
video=$(pnpm action create-video --title "Vérification automatique" 2>&1 \
  | grep -oE "id: '[0-9a-f-]{36}'" | head -1 | grep -oE "[0-9a-f-]{36}")

if [ -z "$video" ]; then
  printf '  %sÉCHEC%s Créer une vidéo — le reste du parcours est ignoré\n' "$ROUGE" "$FIN"
  echecs=$((echecs + 1))
else
  printf '  %sOK%s    Créer une vidéo\n' "$VERT" "$FIN"
  critere "Écrire une étape, qui devient couverte" \
    bash -c "pnpm action set-beat --videoId $video --step 1 --note 'Le quotidien.' --intensity 20 2>&1 | grep -q 'isCovered: true'"
  critere "Poser un marqueur avec ses timecodes" \
    bash -c "pnpm action upsert-marker --videoId $video --label 'Ouverture' --rushName rush-01.mp4 --startMs 1000 --endMs 9000 --step 1 2>&1 | grep -q 'label:'"
  critere "Lire la carte — toujours les douze étapes" \
    bash -c "pnpm action get-story-map --videoId $video 2>&1 | grep -q 'total: 12'"
  critere "Diagnostiquer la structure" \
    bash -c "pnpm action diagnose-structure --videoId $video 2>&1 | grep -q 'findings'"
  critere "Répondre à une question de préparation" \
    bash -c "pnpm action answer-prep-question --videoId $video --questionKey promesse --answer 'Une promesse.' 2>&1 | grep -q 'promesse'"
  critere "Ouvrir un essai" \
    bash -c "pnpm action create-experiment --videoId $video --source diagnostic --observation 'Le milieu traîne.' 2>&1 | grep -q 'status'"
  critere "Avancer l'étape de production" \
    bash -c "pnpm action move-stage --videoId $video --toStage script 2>&1 | grep -q 'script'"
  critere "Exporter en CSV" \
    bash -c "pnpm action export-markers --videoId $video 2>&1 | grep -q \"format: 'csv'\""
  critere "Exporter en EDL d'assemblage" \
    bash -c "pnpm action export-markers --videoId $video --format edl 2>&1 | grep -q 'FCM: NON-DROP FRAME'"
  critere "Archiver, de façon réversible" \
    bash -c "pnpm action archive-video --videoId $video 2>&1 | grep -q 'archivedAt'"
fi

titre "La bibliothèque"
critere "Les 550 prompts du catalogue répondent" \
  bash -c "pnpm action list-prompts --limit 1 2>&1 | grep -q 'catalog: 550'"
critere "Les modèles et leur taxonomie répondent" \
  bash -c "pnpm action list-asset-templates 2>&1 | grep -q 'templates'"
critere "Les ressources répondent avec leurs compteurs" \
  bash -c "pnpm action list-assets 2>&1 | grep -q 'counts'"

titre "Ce qui reste non prouvé"
info "L'agent en conversation" \
  "jamais démontré de bout en bout — aucun fournisseur LLM connecté ici"
info "L'import EDL dans Resolve ou Premiere" \
  "structure testée, ré-import jamais essayé depuis ce dépôt"
# Mesurer sur app/routes/ gonflerait le compte : database, observability et settings
# viennent du gabarit et sont déjà traduits. Seuls les écrans Studio comptent ici.
info "Les écrans Studio traduits" \
  "$(grep -rl 'useT(' app/components/studio/ 2>/dev/null | wc -l | tr -d ' ') fichier(s) sur $(ls app/components/studio/*.tsx | wc -l | tr -d ' ') passent par useT()"

printf '\n'
if [ "$echecs" -eq 0 ]; then
  printf '%sTous les critères bloquants passent.%s Les lignes INFO disent ce qui reste à prouver.\n' "$VERT" "$FIN"
  exit 0
fi
printf '%s%d critère(s) bloquant(s) en échec.%s\n' "$ROUGE" "$echecs" "$FIN"
exit 1
