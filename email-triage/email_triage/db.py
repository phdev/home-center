"""SQLite database for tracking processed emails and daily stats."""

import sqlite3
from datetime import datetime, date


class TriageDB:
    def __init__(self, db_path="email_triage.db"):
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row
        self._init_tables()

    def _init_tables(self):
        self.conn.executescript("""
            CREATE TABLE IF NOT EXISTS processed_emails (
                email_id TEXT PRIMARY KEY,
                processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                category TEXT NOT NULL,
                summary TEXT,
                confidence REAL,
                routing TEXT,
                from_addr TEXT,
                subject TEXT
            );

            CREATE TABLE IF NOT EXISTS daily_stats (
                date TEXT PRIMARY KEY,
                total_processed INTEGER DEFAULT 0,
                relevant INTEGER DEFAULT 0,
                cloud_escalations INTEGER DEFAULT 0,
                estimated_cost REAL DEFAULT 0.0
            );

            CREATE INDEX IF NOT EXISTS idx_processed_at
                ON processed_emails(processed_at);
        """)
        self.conn.commit()

    def is_processed(self, email_id):
        row = self.conn.execute(
            "SELECT 1 FROM processed_emails WHERE email_id = ?", (email_id,)
        ).fetchone()
        return row is not None

    def mark_processed(self, email_id, category, summary, confidence, routing, from_addr="", subject=""):
        self.conn.execute(
            """INSERT OR REPLACE INTO processed_emails
               (email_id, category, summary, confidence, routing, from_addr, subject)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (email_id, category, summary, confidence, routing, from_addr, subject),
        )
        self.conn.commit()

    def update_daily_stats(self, relevant=False, cloud_escalation=False, cost=0.0):
        today = date.today().isoformat()
        self.conn.execute(
            """INSERT INTO daily_stats (date, total_processed, relevant, cloud_escalations, estimated_cost)
               VALUES (?, 1, ?, ?, ?)
               ON CONFLICT(date) DO UPDATE SET
                 total_processed = total_processed + 1,
                 relevant = relevant + ?,
                 cloud_escalations = cloud_escalations + ?,
                 estimated_cost = estimated_cost + ?""",
            (today, int(relevant), int(cloud_escalation), cost,
             int(relevant), int(cloud_escalation), cost),
        )
        self.conn.commit()

    def get_daily_stats(self, day=None):
        day = day or date.today().isoformat()
        row = self.conn.execute(
            "SELECT * FROM daily_stats WHERE date = ?", (day,)
        ).fetchone()
        return dict(row) if row else None

    def get_cloud_count_last_hour(self):
        row = self.conn.execute(
            """SELECT COUNT(*) as cnt FROM processed_emails
               WHERE routing = 'cloud'
               AND processed_at > datetime('now', '-1 hour')"""
        ).fetchone()
        return row["cnt"] if row else 0

    def close(self):
        self.conn.close()
