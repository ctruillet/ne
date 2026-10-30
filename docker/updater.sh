#!/bin/sh
# Lance la mise à jour de l'historique toutes les UPDATE_INTERVAL_MINUTES,
# uniquement pendant les heures UTC UPDATE_HOURS_UTC (ex : 14-18),
# créneau où les préfectures publient les prévisions du lendemain.
set -u

debut=${UPDATE_HOURS_UTC%-*}
fin=${UPDATE_HOURS_UTC#*-}

while true; do
    heure=$(date -u +%H | sed 's/^0//')
    if [ "$heure" -ge "$debut" ] && [ "$heure" -le "$fin" ]; then
        node /app/scripts/update-history.mjs || echo "⚠️ La mise à jour a échoué, nouvelle tentative plus tard."
    fi
    sleep $((UPDATE_INTERVAL_MINUTES * 60))
done
