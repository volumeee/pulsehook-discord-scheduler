"""Production Gunicorn configuration for PulseHook Flask API."""

import os

bind = f"0.0.0.0:{os.getenv('BACKEND_PORT', '5001')}"

# Use a single worker process with multiple threads by default so the in-process
# APScheduler cron engine does not execute duplicate scheduled tasks across forked workers.
workers = int(os.getenv("GUNICORN_WORKERS", "1"))
threads = int(os.getenv("GUNICORN_THREADS", "4"))
worker_class = "gthread"

timeout = 60
graceful_timeout = 30
keepalive = 5

accesslog = "-"
errorlog = "-"
loglevel = os.getenv("LOG_LEVEL", "info")
