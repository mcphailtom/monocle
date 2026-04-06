.PHONY: build run build-desktop dev-desktop frontend-deps frontend-dist install uninstall test vet lint sync-skills skills-tarball

VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo dev)

build:
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

install:
	go install -ldflags "-X main.version=$(VERSION)" ./cmd/monocle

uninstall:
	rm -f $(shell go env GOPATH)/bin/monocle

test:
	go test ./internal/...

vet:
	go vet ./...

lint: vet
	go build ./...

SKILL_NAMES := $(notdir $(patsubst %/SKILL.md,%,$(wildcard skills/*/SKILL.md)))
SKILLS_AGENTS := codex gemini

sync-skills:
	@for agent in $(SKILLS_AGENTS); do \
		rm -rf plugins/$$agent/skills; \
		mkdir -p plugins/$$agent/skills; \
		for skill in $(SKILL_NAMES); do \
			cp -r skills/$$skill plugins/$$agent/skills/$$skill; \
		done; \
	done
	@rm -rf plugins/claude/skills
	@mkdir -p plugins/claude/commands
	@cp .claude/commands/*.md plugins/claude/commands/

skills-tarball:
	mkdir -p dist
	tar -czf dist/skills.tar.gz --exclude='*.go' -C skills .
