"""Thread-safe bounded in-memory sliding window rate limiter."""

from __future__ import annotations

import math
import threading
import time
from collections import OrderedDict, deque


class SlidingWindowRateLimiter:
    """Thread-safe bounded in-memory sliding window rate limiter.

    ponytail: process-local memory; swap for Upstash Redis if GUNICORN_WORKERS > 1 needs global limits.
    """

    def __init__(self, *, enabled: bool = True, max_buckets: int = 4096) -> None:
        self._enabled = enabled
        self._lock = threading.Lock()
        self._buckets: OrderedDict[str, tuple[deque[float], int]] = OrderedDict()
        self._max_buckets = max(1, max_buckets)
        self._last_sweep = time.monotonic()

    def _sweep_stale(self, now: float) -> None:
        if now - self._last_sweep < 60.0 and len(self._buckets) < self._max_buckets:
            return
        self._last_sweep = now
        stale = [
            key
            for key, (entries, window) in self._buckets.items()
            if not entries or entries[-1] <= now - window
        ]
        for key in stale:
            self._buckets.pop(key, None)

    def check(self, key: str, *, limit: int, window_seconds: int) -> tuple[bool, int]:
        """Return (allowed, retry_after_seconds)."""
        if not self._enabled:
            return True, 0
        if limit <= 0:
            return False, max(1, int(window_seconds))

        now = time.monotonic()
        cutoff = now - window_seconds
        with self._lock:
            self._sweep_stale(now)
            entry = self._buckets.get(key)
            bucket = deque() if entry is None else entry[0]
            if entry is not None:
                self._buckets.move_to_end(key)

            while bucket and bucket[0] <= cutoff:
                bucket.popleft()

            if len(bucket) >= limit:
                retry_after = max(1, math.ceil(window_seconds - (now - bucket[0])))
                self._buckets[key] = (bucket, window_seconds)
                return False, retry_after

            bucket.append(now)
            self._buckets[key] = (bucket, window_seconds)
            while len(self._buckets) > self._max_buckets:
                self._buckets.popitem(last=False)
            return True, 0

    def reset(self) -> None:
        with self._lock:
            self._buckets.clear()
            self._last_sweep = time.monotonic()
