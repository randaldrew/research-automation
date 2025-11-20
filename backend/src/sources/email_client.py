#!/usr/bin/env python3
"""
Email client for Research Automation
Handles IMAP connection and email processing

Adapted from existing codebase with async support and enhanced error handling
"""

import asyncio
import imaplib
import email
import datetime
import re
from typing import List, Dict, Any, Optional
from email.header import decode_header

from ..core.config import get_settings
from ..core.logging import ProcessingLogger
from ..processing.content_cleaner import ContentCleaner

logger = ProcessingLogger("email", "gmail")


def decode_email_header(header: str) -> str:
    """Decode email header handling various encodings."""
    if not header:
        return ""

    decoded_parts = decode_header(header)
    decoded_header = ""
    for part, encoding in decoded_parts:
        if isinstance(part, bytes):
            decoded_part = part.decode(encoding or 'utf-8', errors='replace')
        else:
            decoded_part = part
        decoded_header += decoded_part
    return decoded_header


def html_to_text(html_content: str) -> str:
    """Convert HTML to plain text."""
    # Remove HTML tags
    text = re.sub(r'<[^>]+>', ' ', html_content)
    # Fix spacing issues
    text = re.sub(r'\s+', ' ', text)
    # Replace HTML entities
    text = text.replace('&nbsp;', ' ').replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
    text = text.replace('&quot;', '"').replace('&apos;', "'")
    return text.strip()


class EmailClient:
    """
    Email client for fetching and processing newsletter emails.

    Handles IMAP connection, email parsing, and content extraction.
    """

    def __init__(self):
        self.settings = get_settings()
        self.content_cleaner = ContentCleaner()
        self._connection: Optional[imaplib.IMAP4_SSL] = None

    async def test_connection(self) -> bool:
        """
        Test email connection and authentication.

        Returns:
            bool: True if connection successful, False otherwise
        """
        try:
            mail = await self._connect()
            if mail:
                await self._disconnect(mail)
                logger.info("Email connection test successful")
                return True
            return False
        except Exception as e:
            logger.error(f"Email connection test failed: {e}")
            return False

    async def _connect(self) -> Optional[imaplib.IMAP4_SSL]:
        """
        Connect to the email server and authenticate.

        Returns:
            IMAP4_SSL connection or None if failed
        """
        try:
            # Run IMAP operations in thread pool since it's blocking I/O
            def _create_connection():
                mail = imaplib.IMAP4_SSL(self.settings.email_server)
                mail.login(self.settings.email_username, self.settings.email_password)
                mail.select(self.settings.email_folder)
                return mail

            mail = await asyncio.get_event_loop().run_in_executor(None, _create_connection)
            logger.info("Email connection established successfully")
            return mail

        except Exception as e:
            logger.error(f"Failed to connect to email server: {e}")
            return None

    async def _disconnect(self, mail: imaplib.IMAP4_SSL):
        """Safely disconnect from email server."""
        try:
            def _close_connection():
                mail.close()
                mail.logout()

            await asyncio.get_event_loop().run_in_executor(None, _close_connection)
            logger.debug("Email connection closed successfully")
        except Exception as e:
            logger.warning(f"Error closing email connection: {e}")

    async def fetch_new_emails(self) -> List[Dict[str, Any]]:
        """
        Fetch unread emails from the configured inbox.

        Returns:
            List of email dictionaries with processed content
        """
        mail = await self._connect()
        if not mail:
            logger.error("Cannot fetch emails: connection failed")
            return []

        try:
            # Search only for unread emails
            search_criteria = '(UNSEEN)'
            logger.info(f"Searching for emails with criteria: {search_criteria}")

            def _search_emails():
                return mail.search(None, search_criteria)

            status, data = await asyncio.get_event_loop().run_in_executor(None, _search_emails)

            if status != 'OK':
                logger.error("Error searching for emails")
                return []

            email_ids = data[0].split()
            if not email_ids:
                logger.info("No unread emails found")
                return []

            logger.info(f"Found {len(email_ids)} unread emails")

            processed_emails = []
            for email_id in email_ids:
                try:
                    email_data = await self._process_single_email(mail, email_id)
                    if email_data:
                        processed_emails.append(email_data)

                        # Mark email as read after successful processing
                        def _mark_read():
                            mail.store(email_id, '+FLAGS', '\\Seen')

                        await asyncio.get_event_loop().run_in_executor(None, _mark_read)

                except Exception as e:
                    logger.error(f"Error processing email {email_id.decode()}: {e}")
                    continue

            logger.info(f"Successfully processed {len(processed_emails)} emails")
            return processed_emails

        except Exception as e:
            logger.error(f"Error fetching emails: {e}")
            return []
        finally:
            await self._disconnect(mail)

    async def _process_single_email(self, mail: imaplib.IMAP4_SSL, email_id: bytes) -> Optional[Dict[str, Any]]:
        """
        Process a single email and extract relevant information.

        Args:
            mail: IMAP connection
            email_id: Email ID to process

        Returns:
            Dictionary with email data or None if processing failed
        """
        try:
            def _fetch_email():
                return mail.fetch(email_id, '(RFC822)')

            status, fetched_data = await asyncio.get_event_loop().run_in_executor(None, _fetch_email)

            if status != 'OK':
                logger.error(f"Error fetching email {email_id.decode()}")
                return None

            raw_email = fetched_data[0][1]
            email_message = email.message_from_bytes(raw_email)

            # Extract headers
            from_header = decode_email_header(email_message.get("From", ""))
            subject = decode_email_header(email_message.get("Subject", ""))
            date_header = email_message.get("Date", "")

            # Parse date
            try:
                email_date = datetime.datetime.fromtimestamp(
                    email.utils.mktime_tz(email.utils.parsedate_tz(date_header))
                ).strftime("%Y-%m-%d")
            except (TypeError, ValueError):
                email_date = datetime.datetime.now().strftime("%Y-%m-%d")

            # Extract sender name
            sender_name = from_header.split('<')[0].strip().strip('"')
            if not sender_name:
                sender_name = from_header

            # Extract content
            content = await self._extract_email_content(email_message)

            # Clean up forwarded email content
            subject, sender_name, content = self._clean_forwarded_email(subject, sender_name, content)

            # Create unique source identifier
            source_id_base = re.sub(r'[^a-zA-Z0-9]', '_', sender_name).lower()
            unique_suffix = f"_{email_id.decode('utf-8')}"
            source_id = source_id_base + unique_suffix

            email_data = {
                "id": source_id,
                "title": subject,
                "source": sender_name,
                "date": email_date,
                "content": content,
                "source_type": "email",
                "raw_sender": from_header,
                "raw_subject": decode_email_header(email_message.get("Subject", "")),
            }

            logger.info(f"Successfully processed email from {sender_name}: {subject[:100]}...")
            return email_data

        except Exception as e:
            logger.error(f"Error processing email {email_id.decode()}: {e}")
            return None

    async def _extract_email_content(self, email_message: email.message.Message) -> str:
        """
        Extract text content from email message.

        Prioritizes HTML content over plain text as newsletters typically have
        richer content in HTML format. Collects both parts before deciding
        which to use, rather than breaking early.

        Args:
            email_message: Email message object

        Returns:
            Extracted text content
        """
        html_content = ""
        text_content = ""

        if email_message.is_multipart():
            for part in email_message.walk():
                content_type = part.get_content_type()
                content_disposition = str(part.get("Content-Disposition", ""))

                # Skip attachments
                if "attachment" in content_disposition:
                    continue

                if content_type == "text/plain":
                    try:
                        payload = part.get_payload(decode=True)
                        if payload:
                            charset = part.get_content_charset() or 'utf-8'
                            decoded_text = payload.decode(charset, errors='replace')
                            if decoded_text.strip():
                                text_content = decoded_text
                    except Exception as e:
                        logger.warning(f"Error decoding text/plain part: {e}")
                        continue

                elif content_type == "text/html":
                    try:
                        payload = part.get_payload(decode=True)
                        if payload:
                            charset = part.get_content_charset() or 'utf-8'
                            decoded_html = payload.decode(charset, errors='replace')
                            if decoded_html.strip():
                                html_content = decoded_html
                    except Exception as e:
                        logger.warning(f"Error decoding text/html part: {e}")
                        continue
        else:
            # Single part message
            try:
                payload = email_message.get_payload(decode=True)
                if payload:
                    charset = email_message.get_content_charset() or 'utf-8'
                    decoded_content = payload.decode(charset, errors='replace')

                    if email_message.get_content_type() == "text/html":
                        html_content = decoded_content
                    else:
                        text_content = decoded_content

            except Exception as e:
                logger.warning(f"Error decoding email content: {e}")
                # Last resort fallback
                content = str(email_message.get_payload())
                return self.content_cleaner.clean_email_content(content)

        # Prefer HTML content (typically more complete in newsletters)
        # Fall back to plain text if HTML not available
        if html_content:
            content = html_to_text(html_content)
        elif text_content:
            content = text_content
        else:
            logger.warning("No text or HTML content found in email")
            return ""

        return self.content_cleaner.clean_email_content(content)

    def _clean_forwarded_email(self, subject: str, sender_name: str, content: str) -> tuple[str, str, str]:
        """
        Clean up forwarded email content to extract original sender and subject.

        Args:
            subject: Original subject line
            sender_name: Original sender name
            content: Email content

        Returns:
            Tuple of (cleaned_subject, cleaned_sender_name, cleaned_content)
        """
        # Remove "Randal Drew:" prefix from subject if present
        if subject.lower().startswith("randal drew:"):
            subject = subject[len("Randal Drew:"):].strip()

        # Remove "Fwd:" prefix
        if subject.lower().startswith("fwd:"):
            subject = subject[4:].strip()

        # Extract original sender from forwarded content
        excluded_senders = [
            "From: Randal Drew <rhd4@georgetown.edu>",
            "From: rhd4@georgetown.edu",
        ]

        # Find all "From:" lines in content
        all_froms = re.findall(r'(?im)^(From:\s*.*)', content)
        valid_froms = [line for line in all_froms if line.strip() not in excluded_senders]

        if valid_froms:
            # Use the last valid "From:" line (likely the original sender)
            raw_forwarded_from = valid_froms[-1]
            # Extract clean name
            forwarded_from_parts = raw_forwarded_from.replace("From:", "").strip()
            extracted_name = forwarded_from_parts.split('<')[0].strip().strip('"')
            if extracted_name and extracted_name != sender_name:
                sender_name = extracted_name

        # Extract original subject from forwarded content
        excluded_subjects = ["fwd:", "re:", "rhd4@georgetown.edu"]
        all_subjects = re.findall(r'(?im)^\s*subject:\s*(.*)', content)
        valid_subjects = [
            subj.strip() for subj in all_subjects
            if not any(excl.lower() in subj.lower() for excl in excluded_subjects)
        ]

        if valid_subjects:
            original_subj = valid_subjects[-1]
            if original_subj.lower().startswith("fwd:"):
                original_subj = original_subj[4:].strip()
            if original_subj and original_subj != subject:
                subject = original_subj

        return subject, sender_name, content

    def get_connection_info(self) -> Dict[str, Any]:
        """
        Get email connection configuration info.

        Returns:
            Dictionary with connection information
        """
        return {
            "server": self.settings.email_server,
            "username": self.settings.email_username,
            "folder": self.settings.email_folder,
            "smtp_server": self.settings.smtp_server,
            "smtp_port": self.settings.smtp_port,
            "notification_email": self.settings.notification_email,
        }