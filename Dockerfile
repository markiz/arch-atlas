FROM node:24-bookworm-slim

# Only what the build and local publishing pipeline needs. Codex, the browser
# and research tools live in the separate agent images (Dockerfile.codex and
# Dockerfile.deepseek), not here.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates diffutils git python3 python3-pil tar \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/atlas-deps
COPY package.json package-lock.json ./
RUN npm ci

COPY deploy-pages.sh /usr/local/bin/atlas-deploy
COPY docker-entrypoint.sh /usr/local/bin/atlas-entrypoint
RUN chmod 0755 /usr/local/bin/atlas-deploy /usr/local/bin/atlas-entrypoint

ENV PATH="/opt/atlas-deps/node_modules/.bin:${PATH}" \
    ATLAS_NODE_MODULES=/opt/atlas-deps/node_modules \
    ATLAS_LOCKFILE=/opt/atlas-deps/package-lock.json
WORKDIR /workspace
ENTRYPOINT ["/usr/local/bin/atlas-entrypoint"]
