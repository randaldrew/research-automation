.PHONY: help build dev prod clean logs shell test setup

# Default target
help: ## Show this help message
	@echo "Personal Research Automation"
	@echo ""
	@echo "Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# Setup
setup: ## Initial setup - create .env and install dependencies
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "✅ Created .env file from template"; \
		echo "⚠️  Please edit .env with your API keys and configuration"; \
	else \
		echo "✅ .env file already exists"; \
	fi
	@echo "🔧 Run 'make dev' to start development environment"

# Development
dev: ## Start development environment with hot reload
	docker compose -f docker-compose.dev.yml up --build

dev-detached: ## Start development environment in background
	docker compose -f docker-compose.dev.yml up --build -d

dev-logs: ## Show logs from development environment
	docker compose -f docker-compose.dev.yml logs -f

# Production
build-prod: ## Build production container
	docker build -t research-automation:latest -f docker-compose.prod.yml .

prod: build-prod ## Run production container
	docker run -p 8000:8000 \
		-v $(PWD)/data:/app/data \
		--env-file .env \
		research-automation:latest

# Individual services
backend-only: ## Run only backend for API development
	docker compose -f docker-compose.dev.yml up backend --build

frontend-only: ## Run only frontend for UI development
	docker compose -f docker-compose.dev.yml up frontend --build

# Logging and debugging
logs: ## Show logs from all services
	docker compose -f docker-compose.dev.yml logs -f

logs-backend: ## Show backend logs only
	docker compose -f docker-compose.dev.yml logs -f backend

logs-frontend: ## Show frontend logs only
	docker compose -f docker-compose.dev.yml logs -f frontend

shell-backend: ## Get shell access to backend container
	docker compose -f docker-compose.dev.yml exec backend bash

shell-frontend: ## Get shell access to frontend container
	docker compose -f docker-compose.dev.yml exec frontend sh

# Database management
db-shell: ## Access SQLite database
	docker compose -f docker-compose.dev.yml exec backend python -c "import sqlite3; import os; db_path = os.getenv('DATA_DIR', '/app/data') + '/insights.db'; print(f'Connecting to: {db_path}'); conn = sqlite3.connect(db_path); conn.execute('.help')" 2>/dev/null || echo "Database not found. Run processing first to create it."

db-backup: ## Backup database
	@mkdir -p backups
	@timestamp=$$(date +%Y%m%d_%H%M%S); \
	docker compose -f docker-compose.dev.yml exec -T backend cat /app/data/insights.db > backups/insights_$$timestamp.db; \
	echo "✅ Database backed up to backups/insights_$$timestamp.db"

# Testing
test: ## Run tests
	docker compose -f docker-compose.dev.yml exec backend python -m pytest tests/ -v

test-watch: ## Run tests in watch mode
	docker compose -f docker-compose.dev.yml exec backend python -m pytest tests/ -v --watch

# Linting and formatting
lint: ## Run linting on backend code
	docker compose -f docker-compose.dev.yml exec backend black src/
	docker compose -f docker-compose.dev.yml exec backend isort src/
	docker compose -f docker-compose.dev.yml exec backend flake8 src/

lint-frontend: ## Run linting on frontend code
	docker compose -f docker-compose.dev.yml exec frontend npm run lint
	docker compose -f docker-compose.dev.yml exec frontend npm run format

# Data management
backup: ## Backup all data
	@mkdir -p backups
	@timestamp=$$(date +%Y%m%d_%H%M%S); \
	tar -czf backups/data_backup_$$timestamp.tar.gz data/ 2>/dev/null || echo "No data directory found"; \
	echo "✅ Data backed up to backups/data_backup_$$timestamp.tar.gz"

# Cleanup
clean: ## Stop containers and remove volumes
	docker compose -f docker-compose.dev.yml down -v
	docker system prune -f

clean-all: ## Remove everything including images and data
	docker compose -f docker-compose.dev.yml down -v --rmi all
	docker system prune -af
	@echo "⚠️  This removed all images. Run 'make dev' to rebuild."

reset-data: ## Reset all data (WARNING: destructive)
	@echo "⚠️  This will delete ALL your data!"
	@echo "Are you sure? Type 'yes' to continue: "; read confirm; \
	if [ "$$confirm" = "yes" ]; then \
		rm -rf data/; \
		echo "✅ Data reset complete"; \
	else \
		echo "❌ Data reset cancelled"; \
	fi

# Health checks
check: ## Verify installation and dependencies
	@echo "🔍 Checking system dependencies..."
	@docker --version || (echo "❌ Docker not found" && exit 1)
	@docker compose version || (echo "❌ Docker Compose not found" && exit 1)
	@echo "✅ Docker and Docker Compose found"
	@echo ""
	@echo "🔍 Checking configuration..."
	@test -f .env && echo "✅ .env file exists" || echo "⚠️  .env file missing - run 'make setup'"
	@echo ""
	@echo "🔍 Checking data directory..."
	@test -d data && echo "✅ Data directory exists" || echo "ℹ️  Data directory will be created on first run"

status: ## Show current status
	@echo "📊 Personal Research Automation"
	@echo ""
	@echo "Containers:"
	@docker compose -f docker-compose.dev.yml ps 2>/dev/null || echo "No containers running"
	@echo ""
	@echo "Data directory:"
	@ls -la data/ 2>/dev/null || echo "No data directory found"
	@echo ""
	@echo "Recent logs (last 10 lines):"
	@docker compose -f docker-compose.dev.yml logs --tail=10 2>/dev/null || echo "No recent logs"