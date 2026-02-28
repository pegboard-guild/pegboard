.PHONY: setup test lint ingest load-graph serve docker-up docker-down clean

# Create virtual environment and install all dependencies
setup:
	python -m venv .venv
	.venv/bin/pip install --upgrade pip
	.venv/bin/pip install -r requirements.txt -r requirements-dev.txt
	@echo "\n✅ Run: source .venv/bin/activate"

# Run the test suite
test:
	python -m pytest tests/ -v

# Lint and format check with ruff
lint:
	ruff check .
	ruff format --check .

# Run all data ingestors
ingest:
	python -m ingestors.run_all

# Load ingested data into Neo4j
load-graph:
	python -m graph.loader

# Start the FastAPI dev server
serve:
	uvicorn api.main:app --reload --host 0.0.0.0 --port 8000

# Start all services with Docker Compose
docker-up:
	docker compose up -d

# Stop Docker Compose services
docker-down:
	docker compose down

# Remove generated data, caches, and build artifacts
clean:
	rm -rf data/ .pytest_cache __pycache__ **/__pycache__ .ruff_cache .mypy_cache
	find . -name "*.pyc" -delete
