from logging.config import fileConfig
import os

from sqlalchemy import engine_from_config, pool
from alembic import context

from src.app.core.config import settings
from src.app.models import Base  # noqa: F401 — registers all models

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Use MIGRATION_DATABASE_URL if set (for direct connections bypassing pooler)
# Otherwise fall back to DATABASE_URL_SYNC
migration_url = os.getenv("MIGRATION_DATABASE_URL")
if migration_url:
    print("Using MIGRATION_DATABASE_URL for direct database connection (bypassing pooler)")
    database_url = migration_url
else:
    database_url = settings.DATABASE_URL_SYNC

# Escape % for configparser interpolation
config.set_main_option(
    "sqlalchemy.url",
    database_url.replace("%", "%%"),
)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args={
            "server_settings": {
                "application_name": "alembic_migration",
                "statement_timeout": "300000",  # 5 minutes
            },
            "connect_timeout": 10,
        },
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
