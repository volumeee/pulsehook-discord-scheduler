"""Transactional email builders (verification OTP, 2FA login OTP, password reset)."""

from __future__ import annotations

import html
from datetime import datetime

from app.extensions import utc_now
from app.services.email.layout import (
    RenderedEmail,
    load_brand_logo_attachments,
    render_bento_shell,
)


def _otp_block(code_label: str, code: str, expires_minutes: int) -> str:
    safe_label = html.escape(code_label)
    safe_code = html.escape(code)
    return f"""
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="rounded-table bg-otp" style="width:100%;border-collapse:separate;border-spacing:0;background-color:#F6F7FB;border:1px solid #E6E8F0;border-radius:14px;overflow:hidden;">
                      <tr>
                        <td align="center" class="otp-box-pad" style="padding:20px 16px;">
                          <p class="text-secondary" style="margin:0 0 8px 0;font-size:12px;line-height:1.4;font-weight:500;color:#525B70;">{safe_label}</p>
                          <div style="margin:0;padding:0;text-align:center;">
                            <span class="otp-code text-primary" style="display:inline-block;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,Courier,monospace;font-size:32px;line-height:1.2;font-weight:700;letter-spacing:7px;padding-left:7px;color:#111827;white-space:nowrap;word-break:keep-all;user-select:all;-webkit-user-select:all;">{safe_code}</span>
                          </div>
                          <p class="text-muted" style="margin:10px 0 0 0;font-size:12px;line-height:1.4;color:#6B7280;">
                            Valid for <strong class="text-primary" style="color:#111827;font-weight:600;">{expires_minutes} minutes</strong> &middot; Single use &middot; Tap code to select
                          </p>
                        </td>
                      </tr>
                    </table>"""


def _context_table(username: str, ts_label: str, client_summary: str) -> str:
    safe_user = html.escape(username)
    safe_client = html.escape(client_summary[:120] or "Web browser")
    return f"""
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;font-size:12.5px;line-height:1.55;">
                            <tr>
                              <td class="text-muted" style="padding:3px 0;color:#6B7280;width:88px;vertical-align:top;">Account</td>
                              <td class="text-primary" style="padding:3px 0;color:#111827;font-weight:600;word-break:break-word;">@{safe_user}</td>
                            </tr>
                            <tr>
                              <td class="text-muted" style="padding:3px 0;color:#6B7280;vertical-align:top;">Requested</td>
                              <td class="text-primary" style="padding:3px 0;color:#111827;font-family:'SFMono-Regular',Consolas,Menlo,monospace;font-size:12px;">{html.escape(ts_label)}</td>
                            </tr>
                            <tr>
                              <td class="text-muted" style="padding:3px 0;color:#6B7280;vertical-align:top;">Device</td>
                              <td class="text-primary" style="padding:3px 0;color:#111827;word-break:break-word;">{safe_client}</td>
                            </tr>
                          </table>"""


def build_verification_email(
    *,
    username: str,
    code: str,
    expires_minutes: int = 5,
) -> RenderedEmail:
    """Build mobile-responsive, Gmail copy-code friendly email verification template."""
    clean_code = code.strip()
    highlights = """
      <p class="text-primary" style="margin:0 0 8px 0;font-size:12px;font-weight:600;color:#111827;">
        What&rsquo;s ready inside your workspace
      </p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="text-secondary" style="width:100%;font-size:12.5px;line-height:1.55;color:#525B70;">
        <tr><td style="padding:3px 0;"><strong class="text-primary" style="color:#111827;">Cron schedules</strong> &mdash; Automate Discord webhooks with live next-run forecasts.</td></tr>
        <tr><td style="padding:3px 0;"><strong class="text-primary" style="color:#111827;">Live embed preview</strong> &mdash; Inspect Discord JSON payloads side-by-side before sending.</td></tr>
        <tr><td style="padding:3px 0;"><strong class="text-primary" style="color:#111827;">Retries &amp; logs</strong> &mdash; Track every HTTP status, retry backoff, and response trace.</td></tr>
      </table>"""

    html_body = render_bento_shell(
        preheader=f"Your PulseHook verification code is {clean_code}. Expires in {expires_minutes} minutes.",
        schema_description=f"Your PulseHook email verification code is {clean_code}.",
        eyebrow="Email Verification",
        heading="Verify your email address",
        intro=f"Hi @{username}, enter the 6-digit verification code below to confirm your inbox and open your PulseHook workspace.",
        primary_block_html=_otp_block("Your verification code is", clean_code, expires_minutes),
        sections_html=(highlights,),
        footer_note=(
            "Never share this code with anyone. PulseHook will never ask for it over chat or phone. "
            "If you didn't create a PulseHook account, you can safely ignore this email."
        ),
    )
    text_body = (
        f"Your PulseHook verification code is: {clean_code}\n\n"
        f"Hi @{username},\n"
        "Enter this 6-digit code in PulseHook to verify your email address.\n"
        f"It expires in {expires_minutes} minutes and can only be used once.\n\n"
        "Never share this code with anyone. If you didn't create a PulseHook account, "
        "you can safely ignore this email.\n\n"
        "— PulseHook"
    )
    return RenderedEmail(
        subject=f"{clean_code} is your PulseHook verification code",
        html_body=html_body,
        text_body=text_body,
        attachments=load_brand_logo_attachments(),
    )


def build_login_otp_email(
    *,
    username: str,
    code: str,
    client_summary: str = "Web browser",
    expires_minutes: int = 5,
    requested_at: datetime | None = None,
) -> RenderedEmail:
    """Build mobile-responsive, Gmail copy-code friendly 2FA sign-in OTP email."""
    clean_code = code.strip()
    ts_label = (requested_at or utc_now()).strftime("%b %d, %Y · %H:%M UTC")
    html_body = render_bento_shell(
        preheader=f"Your PulseHook sign-in code is {clean_code}. Expires in {expires_minutes} minutes.",
        schema_description=f"Your PulseHook sign-in verification code is {clean_code}.",
        eyebrow="Two-Step Sign-In",
        heading="Confirm your sign-in",
        intro=f"Hi @{username}, enter this 6-digit security code to finish signing in to your PulseHook workspace.",
        primary_block_html=_otp_block("Your sign-in code is", clean_code, expires_minutes),
        sections_html=(_context_table(username, ts_label, client_summary),),
        footer_note=(
            "Didn't try to sign in? You can safely ignore this email—no one can enter your workspace "
            "without this code, though we recommend updating your password if this wasn't you."
        ),
    )
    text_body = (
        f"Your PulseHook sign-in code is: {clean_code}\n\n"
        f"Hi @{username},\n"
        "Use this 6-digit code to finish signing in to PulseHook.\n"
        f"It expires in {expires_minutes} minutes and can only be used once.\n\n"
        f"Requested: {ts_label}\n"
        f"Device: {client_summary[:120] or 'Web browser'}\n\n"
        "Didn't try to sign in? You can safely ignore this email.\n\n"
        "— PulseHook"
    )
    return RenderedEmail(
        subject=f"{clean_code} is your PulseHook sign-in code",
        html_body=html_body,
        text_body=text_body,
        attachments=load_brand_logo_attachments(),
    )


def build_password_reset_email(
    *,
    username: str,
    reset_url: str,
    client_summary: str = "Web browser",
    expires_minutes: int = 15,
    requested_at: datetime | None = None,
) -> RenderedEmail:
    """Build mobile-responsive Soft Bento password reset link email."""
    clean_url = reset_url.strip()
    safe_url = html.escape(clean_url, quote=True)
    ts_label = (requested_at or utc_now()).strftime("%b %d, %Y · %H:%M UTC")

    cta_block = f"""
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="rounded-table bg-otp" style="width:100%;border-collapse:separate;border-spacing:0;background-color:#F6F7FB;border:1px solid #E6E8F0;border-radius:14px;overflow:hidden;">
                      <tr>
                        <td align="center" class="otp-box-pad" style="padding:22px 16px;">
                          <a href="{safe_url}" target="_blank" rel="noopener noreferrer" class="cta-btn" style="display:inline-block;padding:13px 26px;border-radius:12px;background-color:#5865F2;color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none;letter-spacing:-0.01em;">
                            Reset Password
                          </a>
                          <p class="text-muted" style="margin:12px 0 0 0;font-size:12px;line-height:1.4;color:#6B7280;">
                            Valid for <strong class="text-primary" style="color:#111827;font-weight:600;">{expires_minutes} minutes</strong> &middot; Single use &middot; Signs out all active devices
                          </p>
                        </td>
                      </tr>
                    </table>"""

    fallback_section = f"""
                          <p class="text-muted" style="margin:0 0 6px 0;font-size:11.5px;line-height:1.45;color:#6B7280;">
                            Button not working? Copy and paste this secure link into your browser:
                          </p>
                          <p style="margin:0;font-family:'SFMono-Regular',Consolas,Menlo,monospace;font-size:11px;line-height:1.5;word-break:break-all;">
                            <a href="{safe_url}" target="_blank" rel="noopener noreferrer" class="fallback-link" style="color:#5865F2;text-decoration:underline;">{safe_url}</a>
                          </p>"""

    html_body = render_bento_shell(
        preheader=f"Reset your PulseHook password. This secure single-use link expires in {expires_minutes} minutes.",
        schema_description="Reset your PulseHook account password using this single-use link.",
        eyebrow="Password Recovery",
        heading="Reset your password",
        intro=f"Hi @{username}, we received a request to reset your PulseHook workspace password. Click the button below to choose a new password.",
        primary_block_html=cta_block,
        sections_html=(_context_table(username, ts_label, client_summary), fallback_section),
        footer_note=(
            "Didn't request a password reset? You can safely ignore this email—your current password "
            "remains unchanged and this link will expire automatically."
        ),
    )
    text_body = (
        "Reset your PulseHook password\n\n"
        f"Hi @{username},\n"
        "We received a request to reset your PulseHook workspace password.\n"
        f"Open this secure single-use link (valid for {expires_minutes} minutes):\n\n"
        f"{clean_url}\n\n"
        f"Requested: {ts_label}\n"
        f"Device: {client_summary[:120] or 'Web browser'}\n\n"
        "Completing a password reset automatically signs out all existing sessions.\n"
        "Didn't request this? You can safely ignore this email.\n\n"
        "— PulseHook"
    )
    return RenderedEmail(
        subject="Reset your PulseHook password",
        html_body=html_body,
        text_body=text_body,
        attachments=load_brand_logo_attachments(),
    )
