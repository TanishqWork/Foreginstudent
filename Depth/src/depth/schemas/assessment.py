from typing import Literal

from pydantic import BaseModel, Field, field_validator


class AssessmentRequest(BaseModel):
    statement_text: str = Field(min_length=1, max_length=60_000)
    statement_type: Literal[
        "statement_of_purpose", "personal_statement", "personal_history",
        "research_statement", "scholarship_essay", "leadership_essay", "career_goals",
        "combined_degree", "motivation_letter", "supplemental_essay", "other",
    ]
    pathway: Literal["health", "business", "stem", "policy"]
    degree: str = Field(min_length=1, max_length=150)
    field: str = Field(max_length=300)
    applicant_type: str = Field(default="unsure", max_length=100)
    target_institution: str | None = Field(default=None, max_length=300)
    target_program: str | None = Field(default=None, max_length=300)
    application_prompt: str | None = Field(default=None, max_length=20_000)
    word_limit: int | None = Field(default=None, gt=0, le=20_000)
    review_goal: str | None = Field(default=None, max_length=150)

    @field_validator("statement_text", "degree")
    @classmethod
    def require_text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("This field must contain text")
        return value
