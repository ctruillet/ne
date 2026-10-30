# Image « web » : sert le site statique avec nginx.
# Image « updater » : met à jour historique.json à intervalle régulier.
# historique.json est placé dans /data pour être partagé entre les deux
# via un volume (voir docker-compose.yml).

FROM nginx:1.27-alpine AS web
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY *.html *.css *.js *.json *.svg /usr/share/nginx/html/
# Propriétaire 1000 (utilisateur « node » de l'image updater) : le volume
# partagé reste modifiable quel que soit le service qui l'initialise
RUN mkdir /data && chown 1000:1000 /data
COPY --chown=1000:1000 historique.json /data/historique.json
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO /dev/null http://127.0.0.1/ || exit 1

FROM node:24-alpine AS updater
WORKDIR /app
COPY scripts/ scripts/
COPY camps.json regles.json ./
# Le script écrit ../historique.json : on le redirige vers le volume partagé
RUN mkdir /data && chown node:node /data && ln -s /data/historique.json /app/historique.json
COPY --chown=node:node historique.json /data/historique.json
COPY docker/updater.sh /usr/local/bin/updater.sh
ENV UPDATE_INTERVAL_MINUTES=15 \
    TZ=Europe/Paris
USER node
CMD ["sh", "/usr/local/bin/updater.sh"]
