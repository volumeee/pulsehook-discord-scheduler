"""Shared Soft Bento Modern HTML email layout and inline brand logo loader."""

from __future__ import annotations

import base64
import html
import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

BRAND_LOGO_CONTENT_ID = "pulsehook-logo"
_BRAND_LOGO_PATH = Path(__file__).resolve().parents[2] / "assets" / "pulsehook-logo.png"


@lru_cache(maxsize=1)
def load_brand_logo_attachments() -> tuple[dict[str, str], ...]:
    """Load the PulseHook PNG icon once for inline CID embedding."""
    if not _BRAND_LOGO_PATH.exists():
        return ()
    encoded = base64.b64encode(_BRAND_LOGO_PATH.read_bytes()).decode("ascii")
    return (
        {
            "filename": "pulsehook-logo.png",
            "content": encoded,
            "content_type": "image/png",
            "content_id": BRAND_LOGO_CONTENT_ID,
        },
    )


@dataclass(frozen=True)
class RenderedEmail:
    subject: str
    html_body: str
    text_body: str
    attachments: tuple[dict[str, Any], ...] = ()


def _safe_json_ld(payload: dict[str, Any]) -> str:
    return (
        json.dumps(payload, ensure_ascii=True)
        .replace("&", "\\u0026")
        .replace("<", "\\u003c")
        .replace(">", "\\u003e")
    )


_SHELL_CSS = """
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse; }
    .rounded-table { border-collapse: separate !important; border-spacing: 0 !important; overflow: hidden !important; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; height: 100% !important; }
    @media only screen and (max-width: 600px) {
      .outer-pad { padding: 16px 12px 24px 12px !important; }
      .brand-pad { padding: 0 2px 14px 2px !important; }
      .card-shell { border-radius: 16px !important; }
      .card-pad { padding: 22px 18px !important; }
      .hero-title { font-size: 19px !important; line-height: 1.28 !important; }
      .hero-intro { font-size: 13.5px !important; line-height: 1.55 !important; margin-bottom: 18px !important; }
      .otp-box-pad { padding: 16px 12px !important; }
      .otp-code { font-size: 27px !important; letter-spacing: 5px !important; padding-left: 5px !important; }
      .cta-btn { padding: 13px 22px !important; font-size: 13.5px !important; }
      .section-gap { margin-top: 18px !important; }
      .section-pad { padding-top: 14px !important; }
    }
    @media (prefers-color-scheme: dark) {
      body, .bg-canvas { background-color: #0E1015 !important; }
      .bg-card { background-color: #161822 !important; border-color: #262A3B !important; }
      .bg-otp { background-color: #1D2130 !important; border-color: #2E344A !important; }
      .text-primary { color: #F4F5F8 !important; }
      .text-secondary { color: #A6AEC4 !important; }
      .text-muted { color: #8B93AB !important; }
      .eyebrow-badge { background-color: #22263A !important; border-color: #323854 !important; color: #9BA5FF !important; }
      .divider-line { border-top-color: #262A3B !important; }
      .fallback-link { color: #9BA5FF !important; }
    }
"""


def render_bento_shell(
    *,
    preheader: str,
    schema_description: str,
    eyebrow: str,
    heading: str,
    intro: str,
    primary_block_html: str,
    sections_html: tuple[str, ...],
    footer_note: str,
) -> str:
    """Render the responsive Soft Bento email card with pluggable primary block and detail sections."""
    safe_preheader = html.escape(preheader)
    safe_eyebrow = html.escape(eyebrow)
    safe_heading = html.escape(heading)
    safe_intro = html.escape(intro)
    safe_footer = html.escape(footer_note)
    schema_json = _safe_json_ld(
        {
            "@context": "https://schema.org",
            "@type": "EmailMessage",
            "description": schema_description,
        }
    )

    section_blocks = "".join(
        f"""
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="section-gap divider-line" style="width:100%;margin-top:20px;border-top:1px solid #E6E8F0;">
                      <tr>
                        <td class="section-pad" style="padding-top:16px;">{section}</td>
                      </tr>
                    </table>"""
        for section in sections_html
    )

    return f"""<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>{safe_heading}</title>
  <script type="application/ld+json">{schema_json}</script>
  <style type="text/css">{_SHELL_CSS}</style>
</head>
<body class="bg-canvas" style="margin:0;padding:0;background-color:#F4F5F8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:#F4F5F8;">
    {safe_preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="bg-canvas" style="width:100%;background-color:#F4F5F8;">
    <tr>
      <td align="center" class="outer-pad" style="padding:28px 16px 36px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:520px;margin:0 auto;">
          <tr>
            <td class="brand-pad" style="padding:0 4px 16px 4px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td valign="middle" style="padding-right:10px;">
                    <img src="cid:{BRAND_LOGO_CONTENT_ID}" width="32" height="32" alt="PulseHook" style="display:block;width:32px;height:32px;border-radius:9px;" />
                  </td>
                  <td valign="middle">
                    <span class="text-primary" style="font-size:15px;font-weight:700;letter-spacing:-0.02em;color:#111827;">PulseHook</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="rounded-table card-shell bg-card" style="width:100%;border-collapse:separate;border-spacing:0;background-color:#FFFFFF;border:1px solid #E6E8F0;border-radius:20px;overflow:hidden;">
                <tr>
                  <td class="card-pad" style="padding:28px 26px;">
                    <span class="eyebrow-badge" style="display:inline-block;padding:4px 10px;border-radius:999px;background-color:#F2F3FF;border:1px solid #E0E3FF;color:#5865F2;font-size:11px;font-weight:600;letter-spacing:0.03em;text-transform:uppercase;">
                      {safe_eyebrow}
                    </span>
                    <h1 class="hero-title text-primary" style="margin:14px 0 8px 0;font-size:21px;line-height:1.28;font-weight:700;letter-spacing:-0.02em;color:#111827;">
                      {safe_heading}
                    </h1>
                    <p class="hero-intro text-secondary" style="margin:0 0 20px 0;font-size:14px;line-height:1.6;color:#525B70;">
                      {safe_intro}
                    </p>
                    {primary_block_html}
                    {section_blocks}
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="section-gap divider-line" style="width:100%;margin-top:20px;border-top:1px solid #E6E8F0;">
                      <tr>
                        <td class="section-pad text-muted" style="padding-top:16px;font-size:12px;line-height:1.55;color:#6B7280;">
                          {safe_footer}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" class="text-muted" style="padding:18px 8px 0 8px;font-size:11.5px;line-height:1.5;color:#6B7280;">
              PulseHook &middot; Scheduled Discord Webhook Automation
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""
