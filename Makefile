.PHONY: build run build-desktop dev-desktop frontend-deps frontend-dist test vet lint bundle sync-skills skills-tarball

VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo dev)

bundle:
	cd channel && bun install && bun run build.mjs

build: bundle
	go build -ldflags "-X main.version=$(VERSION)" -o bin/monocle ./cmd/monocle

run: build
	./bin/monocle

build-desktop: frontend-deps
	wails build -ldflags "-X main.version=$(VERSION)"

dev-desktop: frontend-dist
	MONOCLE_DB=$(CURDIR)/.monocle-dev.db wails dev

frontend-deps:
	cd desktop/frontend && bun install

frontend-dist: frontend-deps
	@if [ ! -d desktop/frontend/dist ] || [ -z "$$(ls -A desktop/frontend/dist 2>/dev/null)" ]; then \
		echo "Building frontend dist..."; \
		cd desktop/frontend && bun run build; \
	fi

install: bundle
	go install ./cmd/monocle

test:
	go test ./internal/...

vet: frontend-dist
	go vet ./...

lint: vet
	go build ./...

SKILL_NAMES := $(notdir $(patsubst %/SKILL.md,%,$(wildcard skills/*/SKILL.md)))
PLUGIN_AGENTS := claude codex gemini

sync-skills:
	@for agent in $(PLUGIN_AGENTS); do \
		rm -rf plugins/$$agent/skills; \
		mkdir -p plugins/$$agent/skills; \
		for skill in $(SKILL_NAMES); do \
			cp -r skills/$$skill plugins/$$agent/skills/$$skill; \
		done; \
	done

skills-tarball:
	mkdir -p dist
	tar -czf dist/skills.tar.gz --exclude='*.go' -C skills .
