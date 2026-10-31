IMAGE ?= atlas-deploy
REMOTE ?= origin
BRANCH ?= gh-pages
CODEX_VOLUME ?= atlas-codex-home
DEEPSEEK_IMAGE ?= atlas-deepseek
DEEPSEEK_VOLUME ?= atlas-deepseek-home
DEV_PORT ?= 5173
DEEPSEEK_PORT ?= 3080
ENV_FILE ?= .env
ENV_FILE_ARGS = $(if $(wildcard $(ENV_FILE)),--env-file "$(ENV_FILE)")
GIT_NAME ?= $(shell git config user.name)
GIT_EMAIL ?= $(shell git config user.email)
TZ ?= Asia/Tbilisi
ROOT ?= $(patsubst %/,%,$(dir $(abspath $(lastword $(MAKEFILE_LIST)))))

.PHONY: image dev build push codex deepseek-image deepseek

image:
	docker build -t $(IMAGE) .

dev: image
# Порт открыт только на loopback хоста; внутри контейнера Vite слушает 5173.
# Опрос файлов надёжно замечает изменения через Docker bind mount.
	docker run --rm -it \
		$(ENV_FILE_ARGS) \
		-p 127.0.0.1:$(DEV_PORT):5173 \
		--user "$$(id -u):$$(id -g)" \
		--mount type=bind,src="$$(pwd)",dst=/workspace \
		-e VITE_USE_POLLING=true \
		--entrypoint bash \
		$(IMAGE) scripts/run-dev-server.sh

build:
	docker run \
		$(ENV_FILE_ARGS) \
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

codex: image
	docker run -it \
		$(ENV_FILE_ARGS) \
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

deepseek-image:
	docker build -f Dockerfile.deepseek -t $(DEEPSEEK_IMAGE) .

deepseek: deepseek-image
	docker build -f Dockerfile.deepseek -t $(DEEPSEEK_IMAGE) .
	docker run --rm -it \
		--init \
		--name atlas-deepseek \
		$(ENV_FILE_ARGS) \
		--read-only \
		--cap-drop=ALL \
		--security-opt=no-new-privileges:true \
		--pids-limit=1024 \
		--memory=4g \
		--tmpfs /tmp:rw,nosuid,nodev,size=512m,mode=1777 \
		--user "$$(id -u):$$(id -g)" \
		-p 127.0.0.1:$(DEEPSEEK_PORT):$(DEEPSEEK_PORT) \
		--mount type=bind,src="$(ROOT)",dst=/workspace \
		--mount type=volume,src="$(DEEPSEEK_VOLUME)",dst=/dsh \
		-w /workspace \
		-e HOME=/dsh/home \
		-e DSH_HOME=/dsh \
		-e NARB_NATIVE_CACHE_DIR=/dsh/native-cache \
		-e DSH_WEB_PORT=$(DEEPSEEK_PORT) \
		-e TZ=$(TZ) \
		-e GIT_AUTHOR_NAME="$(GIT_NAME)" \
		-e GIT_AUTHOR_EMAIL="$(GIT_EMAIL)" \
		-e GIT_COMMITTER_NAME="$(GIT_NAME)" \
		-e GIT_COMMITTER_EMAIL="$(GIT_EMAIL)" \
		$(DEEPSEEK_IMAGE) $(ARGS)
