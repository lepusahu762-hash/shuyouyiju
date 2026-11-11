from sqlalchemy import event
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from .config import Settings


class Database:
    def __init__(self, settings: Settings):
        self.engine = create_async_engine(settings.database_url, connect_args={"timeout": 30})
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)

        @event.listens_for(self.engine.sync_engine, "connect")
        def sqlite_options(connection, _):
            cursor = connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA busy_timeout=30000")
            cursor.close()

    async def session(self):
        async with self.sessions() as session:
            yield session
