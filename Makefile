IMAGE ?= atlas-deploy
REMOTE ?= origin
BRANCH ?= gh-pages
GIT_NAME ?= $(shell git config user.name)
GIT_EMAIL ?= $(shell git config user.email)

.PHONY: image build push

image:
	docker build -t $(IMAGE) .

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
