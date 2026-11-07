class AuthenticationError(Exception):
    """The supplied credentials or session cannot authenticate a user."""


class AuthProviderUnavailableError(Exception):
    """Supabase Auth is unavailable; provider responses must not be exposed."""


class AuthInputError(Exception):
    def __init__(self, message: str):
        super().__init__(message)


class EmailConfirmationRequired(Exception):
    """The provider requires email confirmation before issuing a session."""


class LLMError(Exception):
    """Generation failed without exposing provider payloads or credentials."""


class AssessmentError(Exception):
    """A temporary assessment cannot perform the requested state transition."""

    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


class RateLimitError(Exception):
    def __init__(self, retry_after: int):
        self.retry_after = retry_after
        super().__init__("Too many authentication attempts. Please try again later.")
