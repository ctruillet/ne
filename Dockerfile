# Image « web » : sert le site statique avec nginx.
# Image « updater » : met à jour historique.json à intervalle régulier.
# historique.json est placé dans /data pour être partagé entre les deux
# via un volume (voir docker-compose.yml).

FROM nginx:1.27-alpine AS web
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html style.css app.js sw.js manifest.json icon.svg camps.json regles.json /usr/share/nginx/html/
# Propriétaire 1000 (utilisateur « node » de l'image updater) : le volume
# partagé reste modifiable quel que soit le service qui l'initialise
RUN mkdir /data && chown 1000:1000 /data
COPY --chown=1000:1000 historique.json /data/historique.json
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO /dev/null http://127.0.0.1/ || exit 1

FROM node:24-alpine AS updater
WORKDIR /app
COPY scripts/update-history.mjs scripts/
COPY camps.json ./
RUN mkdir /data && chown node:node /data
COPY --chown=node:node historique.json /data/historique.json
COPY docker/updater.sh /usr/local/bin/updater.sh
ENV HISTORY_PATH=/data/historique.json \
    CAMPS_PATH=/app/camps.json \
    UPDATE_INTERVAL_MINUTES=15 \
    SEASON=06-01:09-30 \
    START_HOUR=17 \
    TZ=Europe/Paris
USER node
CMD ["sh", "/usr/local/bin/updater.sh"]
