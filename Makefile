# ConvoLab UI  - Development Makefile

# ==================== Frontend ====================

.PHONY: deps-ui run-ui clean-ui

deps-ui:
	@echo "Installing frontend dependencies..."
	npm install

run-ui: deps-ui
	@lsof -ti:3000 | xargs kill -9 2>/dev/null || true
	@echo "Starting frontend on http://localhost:3000..."
	npm run dev

build-ui:
	npm run build
