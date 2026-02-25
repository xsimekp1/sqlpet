import resend
import logging
from src.app.core.config import settings

logger = logging.getLogger(__name__)

resend.api_key = settings.RESEND_API_KEY


class EmailService:
    @staticmethod
    def send_welcome_email(email: str, name: str, organization_name: str) -> dict:
        """Send welcome email to new user after registration."""
        try:
            response = resend.Emails.send(
                {
                    "from": "Petslog <onboarding@resend.dev>",
                    "to": email,
                    "subject": "Vítejte v Petslog!",
                    "html": f"""
                <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h1 style="color: #6366f1;">Vítejte v Petslog!</h1>
                        <p>Ahoj {name},</p>
                        <p>Vaše registrace byla úspěšně dokončena. Vytvořili jste účet pro organizaci:</p>
                        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                            <strong style="font-size: 18px;">{organization_name}</strong>
                        </div>
                        <p>Nyní se můžete přihlásit a začít používat systém pro správu vašeho útulku.</p>
                        <p style="margin-top: 30px;">
                            S pozdravem,<br>
                            Tým Petslog
                        </p>
                        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                        <p style="font-size: 12px; color: #6b7280;">
                            Petslog - Moderní systém pro správu zvířecích útulků
                        </p>
                    </div>
                </body>
                </html>
                """,
                }
            )
            logger.info(f"Welcome email sent to {email}")
            return response
        except Exception as e:
            logger.error(f"Failed to send welcome email to {email}: {e}")
            raise

    @staticmethod
    def send_password_reset_email(email: str, reset_token: str) -> dict:
        """Send password reset email."""
        try:
            reset_url = (
                f"https://pets-log.com/cs/reset-password?token={reset_token}"
            )
            response = resend.Emails.send(
                {
                    "from": "Petslog <onboarding@resend.dev>",
                    "to": email,
                    "subject": "Obnovení hesla - Petslog",
                    "html": f"""
                <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h1 style="color: #6366f1;">Obnovení hesla</h1>
                        <p>Dobrý den,</p>
                        <p>Obdrželi jsme žádost o obnovení hesla pro váš účet.</p>
                        <p style="margin: 20px 0;">
                            <a href="{reset_url}" style="background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                                Obnovit heslo
                            </a>
                        </p>
                        <p>Nebo použijte tento odkaz:</p>
                        <p style="word-break: break-all; font-size: 12px; color: #6b7280;">{reset_url}</p>
                        <p style="color: #dc2626; margin-top: 20px;">
                            ⚠️ Tento odkaz platí pouze 1 hodinu.
                        </p>
                        <p>Pokud jste o obnovení hesla nežádali, můžete tento email ignorovat.</p>
                        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                        <p style="font-size: 12px; color: #6b7280;">
                            Petslog - Moderní systém pro správu zvířecích útulků
                        </p>
                    </div>
                </body>
                </html>
                """,
                }
            )
            logger.info(f"Password reset email sent to {email}")
            return response
        except Exception as e:
            logger.error(f"Failed to send password reset email to {email}: {e}")
            raise
