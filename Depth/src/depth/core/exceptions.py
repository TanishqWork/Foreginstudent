class AuthenticationError(Exception):
    """The supplied credentials or session cannot authenticate a user."""


class LLMError(Exception):
    """Generation failed without exposing provider payloads or credentials."""


class RateLimitError(Exception):
    def __init__(self, retry_after: int):
        self.retry_after = retry_after
        super().__init__("Too many sign-in attempts. Please try again later.")
