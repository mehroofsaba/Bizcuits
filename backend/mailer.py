"""Transactional email. Render's free plan blocks SMTP ports, so an HTTPS email API (Resend) is preferred; SMTP is a fallback."""
import json, os, smtplib, ssl, urllib.request, urllib.error
from email.message import EmailMessage


class MailUnavailable(Exception):
    pass


def configured():
    return bool(os.environ.get("RESEND_API_KEY") or os.environ.get("SMTP_HOST"))


def send(to, subject, text):
    sender = os.environ.get("MAIL_FROM", "Bizcuits <onboarding@resend.dev>")
    try:
        if os.environ.get("RESEND_API_KEY"):
            req = urllib.request.Request("https://api.resend.com/emails", json.dumps({"from": sender, "to": [to], "subject": subject, "text": text}).encode(),
                                         {"Authorization": "Bearer " + os.environ["RESEND_API_KEY"], "Content-Type": "application/json"})
            urllib.request.urlopen(req, timeout=20).read()
        elif os.environ.get("SMTP_HOST"):
            m = EmailMessage()
            m["From"], m["To"], m["Subject"] = sender, to, subject
            m.set_content(text)
            port = int(os.environ.get("SMTP_PORT", 587))
            with smtplib.SMTP(os.environ["SMTP_HOST"], port, timeout=20) as s:
                s.starttls(context=ssl.create_default_context())
                if os.environ.get("SMTP_USER"):
                    s.login(os.environ["SMTP_USER"], os.environ.get("SMTP_PASSWORD", ""))
                s.send_message(m)
        else:
            raise MailUnavailable("Email is not set up on this server.")
    except (urllib.error.URLError, smtplib.SMTPException, OSError):
        raise MailUnavailable("The email could not be sent. Try again later.")
