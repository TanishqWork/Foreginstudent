from pwdlib import PasswordHash
from pwdlib.exceptions import UnknownHashError

_password_hash = PasswordHash.recommended()
_dummy_hash = _password_hash.hash("timing-only-not-an-account-password")


def hash_password(password: str) -> str:
    """Return a salted Argon2id hash. Passwords are never encrypted or decrypted."""
    return _password_hash.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    """Perform a hash verification even for preserved accounts without a password."""
    try:
        valid = _password_hash.verify(password, password_hash or _dummy_hash)
    except (UnknownHashError, ValueError):
        return False
    return password_hash is not None and valid
