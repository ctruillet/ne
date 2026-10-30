#!/bin/sh
# Lance la mise à jour de l'historique toutes les UPDATE_INTERVAL_MINUTES.
# Le script décide lui-même s'il y a quelque chose à récupérer.
set -u

while true; do
    node /app/scripts/update-history.mjs || echo "⚠️ La mise à jour a échoué, nouvelle tentative plus tard."
    sleep $((UPDATE_INTERVAL_MINUTES * 60))
done
