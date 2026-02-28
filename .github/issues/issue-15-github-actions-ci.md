# CI/CD — GitHub Actions for linting and tests

**Labels:** infrastructure, devops, good first issue

**Description:**

Set up GitHub Actions workflows for continuous integration: linting, type checking, and tests on every PR.

**Workflows to create:**

### 1. Python CI (`.github/workflows/python-ci.yml`)
- Trigger: push to `main`, all PRs
- Python 3.12
- Install dependencies from `requirements.txt` + `requirements-dev.txt`
- Run `ruff check .` (linting)
- Run `ruff format --check .` (formatting)
- Run `pytest tests/` with coverage report
- Fail if coverage drops below 60%

### 2. Frontend CI (`.github/workflows/frontend-ci.yml`)
- Trigger: push to `main`, all PRs (paths: `frontend/**`)
- Node 20
- `npm ci` in `frontend/`
- `npm run lint`
- `npm run build` (catch type errors)
- `npm test` if tests exist

**Implementation:**
1. Create workflow YAML files
2. Add `ruff` and `pytest` to `requirements-dev.txt` if not already present
3. Add a `pyproject.toml` section for ruff config if not present
4. Verify workflows pass on current codebase

**Acceptance criteria:**
- [ ] Python CI runs on PRs and catches lint errors
- [ ] Tests run and report results
- [ ] Frontend CI runs when frontend code changes
- [ ] Badge in README showing CI status
- [ ] All current code passes CI
