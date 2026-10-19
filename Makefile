.PHONY: help install install-frontend test frontend-build build docker-build run

PYTHON ?= python
NPM ?= npm

help:
	@printf '%s\n' \
		'install         Install locked Python and frontend dependencies' \
		'test            Run the offline Python test suite' \
		'frontend-build  Install locked frontend dependencies and build the frontend' \
		'build           Build the frontend' \
		'docker-build    Build the application Docker image' \
		'run             Run the FastAPI application locally'

install:
	$(PYTHON) -m pip install --requirement requirements.lock
	$(MAKE) install-frontend

install-frontend:
	cd frontend && $(NPM) ci

# This target intentionally performs no dependency installation or network access.
test:
	PYTHON_DOTENV_DISABLED=1 $(PYTHON) -m pytest tests/ -v

frontend-build: install-frontend
	cd frontend && $(NPM) run build

build: frontend-build

docker-build:
	docker build -t clearclick-ai .

run:
	$(PYTHON) -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
