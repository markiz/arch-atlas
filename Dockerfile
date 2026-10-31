FROM node:24-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        bash bubblewrap ca-certificates diffutils git procps tar

WORKDIR /opt/atlas-deps
COPY package.json package-lock.json ./
RUN npm ci
RUN npm install --global @openai/codex@latest
RUN mkdir -p /codex && chmod 1777 /codex

COPY deploy-pages.sh /usr/local/bin/atlas-deploy
COPY docker-entrypoint.sh /usr/local/bin/atlas-entrypoint
RUN chmod 0755 /usr/local/bin/atlas-deploy /usr/local/bin/atlas-entrypoint

ENV ATLAS_NODE_MODULES=/opt/atlas-deps/node_modules \
    ATLAS_LOCKFILE=/opt/atlas-deps/package-lock.json
WORKDIR /workspace
ENTRYPOINT ["/usr/local/bin/atlas-entrypoint"]
