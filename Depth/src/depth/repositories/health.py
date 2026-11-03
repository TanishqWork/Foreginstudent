from sqlalchemy import text
from sqlalchemy.orm import Session


class HealthRepository:
    def __init__(self, db: Session):
        self.db = db

    def check_connection(self) -> None:
        self.db.execute(text("SELECT 1"))
