"""Idempotent schema patcher for columns added to existing tables.

`Base.metadata.create_all()` (called in main.py/seed scripts) only creates
missing *tables* — it never alters an existing table to add a new column.
Since production's SQLite file lives on a persistent volume and is never
re-seeded once it exists, new columns need to be added by hand. This script
checks each table's current columns via PRAGMA and adds whatever's missing,
so it's safe to run on every boot.
"""

from sqlalchemy import text

from .database import engine

# table -> [(column_name, column_ddl_type_and_default), ...]
NEW_COLUMNS = {
    "rooms": [
        ("progress_pct", "INTEGER DEFAULT 0"),
        ("status_label", "TEXT DEFAULT ''"),
        ("progress_note", "TEXT DEFAULT ''"),
        ("paint_color", "TEXT DEFAULT '#f2efe6'"),
    ],
    "walls": [
        ("build_status", "TEXT DEFAULT 'planned'"),
    ],
    "resources": [
        ("room_name", "TEXT"),
    ],
    "checklist_items": [
        ("room_name", "TEXT"),
    ],
    "layout_presets": [
        ("room_colors_json", "TEXT"),
    ],
}


def run():
    with engine.connect() as conn:
        tables = {row[0] for row in conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))}
        for table, columns in NEW_COLUMNS.items():
            if table not in tables:
                continue  # fresh DB — create_all()/seed scripts already create it with every current column
            existing = {row[1] for row in conn.execute(text(f"PRAGMA table_info({table})"))}
            for name, ddl_type in columns:
                if name not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl_type}"))
                    print(f"migrate: added {table}.{name}")
            conn.commit()


if __name__ == "__main__":
    run()
