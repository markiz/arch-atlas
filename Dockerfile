FROM node:24-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        bash ca-certificates diffutils git tar

WORKDIR /opt/atlas-deps
COPY package.json package-lock.json ./
RUN npm ci

COPY deploy-pages.sh /usr/local/bin/atlas-deploy
COPY docker-entrypoint.sh /usr/local/bin/atlas-entrypoint
RUN chmod 0755 /usr/local/bin/atlas-deploy /usr/local/bin/atlas-entrypoint

ENV ATLAS_NODE_MODULES=/opt/atlas-deps/node_modules \
    ATLAS_LOCKFILE=/opt/atlas-deps/package-lock.json
WORKDIR /workspace
ENTRYPOINT ["/usr/local/bin/atlas-entrypoint"]
