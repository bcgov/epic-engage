"""Tests for the database maintenance service."""
from types import SimpleNamespace

from met_cron.services import database_service
from met_cron.services.database_service import DatabaseService


class _Recorder:
    """Stands in for db.engine and records every statement run through it."""

    def __init__(self):
        self.statements = []

    def begin(self):
        return self

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def execute(self, statement):
        self.statements.append(str(statement))


def test_purge_truncates_event_logs(monkeypatch):
    """The purge empties the table with TRUNCATE, cascading to asset_event_tags."""
    engine = _Recorder()
    monkeypatch.setattr(database_service, 'db', SimpleNamespace(engine=engine))

    DatabaseService.purge_event_logs()

    assert engine.statements == ['TRUNCATE dagster.event_logs CASCADE;']
