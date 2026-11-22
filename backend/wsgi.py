"""WSGI entrypoint for Gunicorn production server."""

from app import create_app

app = create_app()
