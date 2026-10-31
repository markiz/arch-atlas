IMAGE ?= atlas-deploy
REMOTE ?= origin
BRANCH ?= gh-pages
CODEX_VOLUME ?= atlas-codex-home
DEV_PORT ?= 5173
GIT_NAME ?= $(shell git config user.name)
GIT_EMAIL ?= $(shell git config user.email)

.PHONY: image dev build push codex

image:
	docker build -t $(IMAGE) .

dev: image
# Порт открыт только на loopback хоста; внутри контейнера Vite слушает 5173.
# Опрос файлов надёжно замечает изменения через Docker bind mount.
	docker run --rm -it \
		-p 127.0.0.1:$(DEV_PORT):5173 \
		--user "$$(id -u):$$(id -g)" \
		--mount type=bind,src="$$(pwd)",dst=/workspace \
		-e VITE_USE_POLLING=true \
		--entrypoint bash \
		$(IMAGE) scripts/run-dev-server.sh

build:
	docker run \
		--user "$$(id -u):$$(id -g)" \
		--mount type=bind,src="$$(pwd)",dst=/workspace \
		-e HOME=/tmp \
		-e PAGES_REMOTE=$(REMOTE) \
		-e PAGES_BRANCH=$(BRANCH) \
		-e GIT_AUTHOR_NAME="$(GIT_NAME)" \
		-e GIT_AUTHOR_EMAIL="$(GIT_EMAIL)" \
		-e GIT_COMMITTER_NAME="$(GIT_NAME)" \
		-e GIT_COMMITTER_EMAIL="$(GIT_EMAIL)" \
		$(IMAGE)

push:
	git push $(REMOTE) $(BRANCH)

codex:
	docker run -it \
		--read-only \
		--cap-drop=ALL \
		--security-opt=no-new-privileges:true \
		--tmpfs /tmp:rw,nosuid,nodev,size=256m,mode=1777 \
		--user "$$(id -u):$$(id -g)" \
		--mount type=bind,src="$$(pwd)",dst=/workspace \
		--mount type=volume,src="$(CODEX_VOLUME)",dst=/codex \
		-e HOME=/tmp \
		-e CODEX_HOME=/codex \
		-e GIT_AUTHOR_NAME="$(GIT_NAME)" \
		-e GIT_AUTHOR_EMAIL="$(GIT_EMAIL)" \
		-e GIT_COMMITTER_NAME="$(GIT_NAME)" \
		-e GIT_COMMITTER_EMAIL="$(GIT_EMAIL)" \
		--entrypoint codex \
		$(IMAGE) --no-daemon --dangerously-bypass-approvals-and-sandbox $(ARGS)
