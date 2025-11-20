#!/usr/bin/env python3
"""
Email Source Plugin for Research Automation
Wraps the existing EmailClient to work with the plugin architecture
"""

from typing import Dict, Any, List
from ..base_plugin import BaseSourcePlugin, SourcePluginError
from ..email_client import EmailClient
from ...core.logging import get_logger

logger = get_logger(__name__)


class EmailSourcePlugin(BaseSourcePlugin):
    """
    Email source plugin that wraps the existing EmailClient.

    This maintains backward compatibility while providing the plugin interface.
    """

    def __init__(self, source_id: str, config: Dict[str, Any]):
        """
        Initialize email plugin.

        Args:
            source_id: Unique identifier for this email source
            config: Email configuration dict
        """
        super().__init__(source_id, config)

        # Create EmailClient instance with resolved config
        self.email_client = EmailClient()

        # Override EmailClient settings with plugin config
        self._apply_config_to_client()

    def _apply_config_to_client(self):
        """Apply plugin configuration to the EmailClient instance"""
        try:
            # Map plugin config to EmailClient settings
            if hasattr(self.email_client, 'settings'):
                settings = self.email_client.settings

                # Update settings from config
                if 'server' in self.config:
                    settings.email_server = self.config['server']
                if 'username' in self.config:
                    settings.email_username = self.config['username']
                if 'password' in self.config:
                    settings.email_password = self.config['password']
                if 'folder' in self.config:
                    settings.email_folder = self.config['folder']
                if 'smtp_server' in self.config:
                    settings.smtp_server = self.config['smtp_server']
                if 'smtp_port' in self.config:
                    settings.smtp_port = self.config['smtp_port']
                if 'notification_email' in self.config:
                    settings.notification_email = self.config['notification_email']

            self.logger.debug(f"Applied email configuration for {self.source_id}")

        except Exception as e:
            self.logger.warning(f"Could not apply config to EmailClient: {e}")
            # Continue anyway - EmailClient will use its default settings

    async def fetch_content(self) -> List[Dict[str, Any]]:
        """
        Fetch emails using the existing EmailClient.

        Returns:
            List of email content items
        """
        try:
            self.logger.info(f"Fetching emails from {self.source_id}")

            # Use existing EmailClient functionality
            email_items = await self.email_client.fetch_new_emails()

            # Ensure each item has proper source metadata
            for item in email_items:
                # Only override if source is missing or empty
                if 'source' not in item or not item['source']:
                    item['source'] = self.config.get('name', self.source_id)
                item['source_type'] = 'email'

                # Add plugin-specific metadata if needed
                if 'metadata' not in item:
                    item['metadata'] = {}
                item['metadata']['plugin_source_id'] = self.source_id
                item['metadata']['email_folder'] = self.config.get('folder', 'INBOX')

            self.logger.info(f"Fetched {len(email_items)} emails from {self.source_id}")
            return email_items

        except Exception as e:
            error_msg = f"Failed to fetch emails from {self.source_id}: {str(e)}"
            self.logger.error(error_msg)
            raise SourcePluginError(error_msg, self.source_id, 'email')

    async def test_connection(self) -> Dict[str, Any]:
        """
        Test email connection using existing EmailClient.

        Returns:
            Test result dictionary
        """
        try:
            self.logger.info(f"Testing email connection for {self.source_id}")

            # Use existing EmailClient test functionality
            success = await self.email_client.test_connection()

            if success:
                # Get additional connection info
                connection_info = self.email_client.get_connection_info()

                return {
                    'success': True,
                    'message': f'Email connection successful for {self.source_id}',
                    'details': {
                        'server': connection_info.get('server'),
                        'username': connection_info.get('username'),
                        'folder': connection_info.get('folder'),
                        'source_id': self.source_id
                    }
                }
            else:
                return {
                    'success': False,
                    'error': f'Email connection failed for {self.source_id}',
                    'details': {'source_id': self.source_id}
                }

        except Exception as e:
            error_msg = f"Email connection test failed for {self.source_id}: {str(e)}"
            self.logger.error(error_msg)
            return {
                'success': False,
                'error': error_msg,
                'details': {'source_id': self.source_id}
            }

    def validate_config(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate email configuration.

        Args:
            config: Configuration to validate

        Returns:
            Validation result
        """
        errors = []
        warnings = []

        # Required fields
        required_fields = ['server', 'username', 'password']
        for field in required_fields:
            if field not in config or not config[field]:
                errors.append(f"Missing required field: {field}")

        # Validate server format
        if 'server' in config and config['server']:
            server = config['server']
            if not ('.' in server and len(server) > 3):
                errors.append("Server should be a valid hostname (e.g., imap.gmail.com)")

        # Validate email format for username
        if 'username' in config and config['username']:
            username = config['username']
            if '@' not in username:
                warnings.append("Username should typically be an email address")

        # Validate folder
        if 'folder' not in config:
            warnings.append("No folder specified, will default to INBOX")

        # Validate SMTP settings if provided
        if 'smtp_server' in config and not config.get('smtp_port'):
            warnings.append("SMTP server specified but no SMTP port provided")

        # Validate notification email if provided
        if 'notification_email' in config and config['notification_email']:
            if '@' not in config['notification_email']:
                errors.append("Notification email must be a valid email address")

        return {
            'valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings
        }

    def get_source_info(self) -> Dict[str, Any]:
        """Get detailed information about this email source"""
        base_info = super().get_source_info()

        # Add email-specific information
        base_info.update({
            'server': self.config.get('server', 'Not configured'),
            'username': self.config.get('username', 'Not configured'),
            'folder': self.config.get('folder', 'INBOX'),
            'has_smtp': bool(self.config.get('smtp_server')),
            'has_notifications': bool(self.config.get('notification_email')),
            'connection_status': 'unknown'  # Would need async call to determine
        })

        return base_info

    def get_config_schema(self) -> Dict[str, Any]:
        """Get email plugin configuration schema"""
        return {
            'type': 'object',
            'properties': {
                'server': {
                    'type': 'string',
                    'title': 'IMAP Server',
                    'description': 'IMAP server hostname',
                    'default': 'imap.gmail.com',
                    'examples': ['imap.gmail.com', 'outlook.office365.com']
                },
                'username': {
                    'type': 'string',
                    'title': 'Email Address',
                    'description': 'Email address for login',
                    'format': 'email'
                },
                'password': {
                    'type': 'string',
                    'title': 'Password',
                    'description': 'Email password or app password',
                    'format': 'password'
                },
                'folder': {
                    'type': 'string',
                    'title': 'Folder',
                    'description': 'IMAP folder to monitor',
                    'default': 'INBOX'
                }
            },
            'required': ['server', 'username', 'password']
        }

    def get_config_template(self) -> Dict[str, Any]:
        """
        Get configuration template for this plugin type.
        Useful for UI generation.
        """
        return {
            'server': {
                'type': 'string',
                'required': True,
                'description': 'IMAP server hostname',
                'example': 'imap.gmail.com',
                'default': 'imap.gmail.com'
            },
            'username': {
                'type': 'email',
                'required': True,
                'description': 'Email address for login',
                'example': 'user@gmail.com'
            },
            'password': {
                'type': 'password',
                'required': True,
                'description': 'Email password or app password',
                'sensitive': True
            },
            'folder': {
                'type': 'string',
                'required': False,
                'description': 'IMAP folder to monitor',
                'default': 'INBOX',
                'example': 'INBOX'
            },
            'smtp_server': {
                'type': 'string',
                'required': False,
                'description': 'SMTP server for notifications',
                'example': 'smtp.gmail.com'
            },
            'smtp_port': {
                'type': 'integer',
                'required': False,
                'description': 'SMTP port number',
                'default': 587,
                'example': 587
            },
            'notification_email': {
                'type': 'email',
                'required': False,
                'description': 'Email address for notifications'
            }
        }