"""Static sample tasks for first-time workspaces."""

from __future__ import annotations

from typing import Any

STARTER_SAMPLE_TASKS: list[dict[str, Any]] = [
    {
        "name": "Daily Engineering Standup",
        "schedule": "0 9 * * 1-5",
        "webhook_url": "https://discord.com/api/webhooks/1200000000000000001/replace_with_your_discord_webhook_token_1",
        "payload": {
            "content": "Good morning team — time to drop your quick standup update!",
            "username": "Standup Reminder",
            "embeds": [
                {
                    "title": "Daily Engineering Sync",
                    "description": "Share what you shipped yesterday, what is up next today, and any blockers.",
                    "color": 5793266,
                    "fields": [
                        {
                            "name": "Format",
                            "value": "Yesterday · Today · Blockers",
                            "inline": False,
                        },
                        {
                            "name": "Due by",
                            "value": "09:30 local time",
                            "inline": True,
                        },
                    ],
                    "footer": {"text": "Keep it concise — 3 bullet points max"},
                }
            ],
        },
        "max_retry": 3,
        "retry_delay_ms": 1000,
        "status": "paused",
    },
    {
        "name": "Production Release Confirmation",
        "schedule": "0 17 * * 5",
        "webhook_url": "https://discord.com/api/webhooks/1200000000000000002/replace_with_your_discord_webhook_token_2",
        "payload": {
            "content": "Task executed successfully!",
            "username": "PulseHook Bot",
            "embeds": [
                {
                    "title": "Task Completed",
                    "description": "Scheduled pipeline #123 finished cleanly with all checks passing.",
                    "color": 3066993,
                    "fields": [
                        {"name": "Environment", "value": "Production", "inline": True},
                        {"name": "Latency", "value": "142 ms", "inline": True},
                    ],
                    "footer": {"text": "PulseHook Automated Dispatch"},
                }
            ],
        },
        "max_retry": 4,
        "retry_delay_ms": 1500,
        "status": "paused",
    },
    {
        "name": "Hourly Gateway Health Digest",
        "schedule": "0 * * * *",
        "webhook_url": "https://discord.com/api/webhooks/1200000000000000003/replace_with_your_discord_webhook_token_3",
        "payload": {
            "content": "Scheduled service health check report ready for review.",
            "username": "Ops Monitor",
            "embeds": [
                {
                    "title": "API Gateway Latency Watch",
                    "description": "Periodic heartbeat completed. Review queue depth and error budgets below.",
                    "color": 16096779,
                    "fields": [
                        {"name": "Uptime (24h)", "value": "99.98%", "inline": True},
                        {"name": "P95 Response", "value": "184 ms", "inline": True},
                    ],
                    "footer": {"text": "PulseHook Ops Digest"},
                }
            ],
        },
        "max_retry": 2,
        "retry_delay_ms": 1000,
        "status": "paused",
    },
]
