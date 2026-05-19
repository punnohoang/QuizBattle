"""Authentication token models."""
# Refresh tokens are now stateless (JWT-based) and managed via Redis blacklist.
# No database models needed for token management.