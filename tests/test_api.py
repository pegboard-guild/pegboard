"""Tests for API endpoints with mocked Neo4j driver."""
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).parent.parent))


@pytest.fixture
def mock_driver():
    driver = MagicMock()
    driver.verify_connectivity = MagicMock()
    session = MagicMock()
    driver.session.return_value.__enter__ = MagicMock(return_value=session)
    driver.session.return_value.__exit__ = MagicMock(return_value=False)
    session.run.return_value = []
    return driver, session


@pytest.fixture
def client(mock_driver):
    driver, session = mock_driver
    with patch("api.main.GraphDatabase") as mock_gdb:
        mock_gdb.driver.return_value = driver
        from api.main import app
        app.state.neo4j_driver = driver
        with TestClient(app) as c:
            yield c, session


class TestHealth:
    def test_health_ok(self, client):
        c, _ = client
        resp = c.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"


class TestOfficials:
    def test_list_officials(self, client):
        c, session = client
        mock_result = MagicMock()
        mock_result.__iter__ = MagicMock(return_value=iter([]))
        session.run.return_value = mock_result
        resp = c.get("/officials")
        assert resp.status_code == 200

    def test_get_official_not_found(self, client):
        c, session = client
        with patch("graph.queries._run", return_value=[]):
            resp = c.get("/officials/NONEXISTENT")
            assert resp.status_code == 404

    def test_get_official_found(self, client):
        c, session = client
        mock_data = {
            "official": {"bioguide_id": "T000123", "name": "Test"},
            "committees": [],
            "bills": [],
            "donors": [],
        }
        with patch("graph.queries._run", return_value=[mock_data]):
            with patch("api.routes.officials.q.get_official", return_value=mock_data):
                resp = c.get("/officials/T000123")
                assert resp.status_code == 200


class TestBills:
    def test_list_bills(self, client):
        c, session = client
        mock_result = MagicMock()
        mock_result.__iter__ = MagicMock(return_value=iter([]))
        session.run.return_value = mock_result
        resp = c.get("/bills")
        assert resp.status_code == 200

    def test_get_bill_not_found(self, client):
        c, _ = client
        with patch("api.routes.bills.q.get_bill", return_value=None):
            resp = c.get("/bills/119/HR1")
            assert resp.status_code == 404


class TestContracts:
    def test_list_contracts(self, client):
        c, session = client
        mock_result = MagicMock()
        mock_result.__iter__ = MagicMock(return_value=iter([]))
        session.run.return_value = mock_result
        resp = c.get("/contracts")
        assert resp.status_code == 200


class TestSearch:
    def test_search(self, client):
        c, session = client
        mock_result = MagicMock()
        mock_result.__iter__ = MagicMock(return_value=iter([]))
        session.run.return_value = mock_result
        resp = c.get("/search?q=test")
        assert resp.status_code == 200
        data = resp.json()
        assert "query" in data
        assert data["query"] == "test"

    def test_search_empty_query(self, client):
        c, _ = client
        resp = c.get("/search?q=")
        assert resp.status_code == 422  # validation error


class TestGraph:
    def test_connections_endpoint(self, client):
        c, session = client
        mock_result = MagicMock()
        mock_result.__iter__ = MagicMock(return_value=iter([]))
        session.run.return_value = mock_result
        resp = c.get("/graph/connections/T000123")
        assert resp.status_code == 200
        data = resp.json()
        assert "nodes" in data
        assert "edges" in data

    def test_money_flow_endpoint(self, client):
        c, session = client
        mock_result = MagicMock()
        mock_result.__iter__ = MagicMock(return_value=iter([]))
        session.run.return_value = mock_result
        resp = c.get("/graph/money-flow/T000123")
        assert resp.status_code == 200
