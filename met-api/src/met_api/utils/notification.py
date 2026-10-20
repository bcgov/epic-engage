"""Notification Services."""

import json
import re

from flask import current_app
import requests

from met_api.models.tenant import Tenant
from met_api.services.rest_service import RestService


def get_tenant_site_url(tenant_id, path=''):
    """Get the tenant specific site url (domain / tenant / path)."""
    is_single_tenant_environment = current_app.config.get('IS_SINGLE_TENANT_ENVIRONMENT', False)
    site_url = current_app.config.get('SITE_URL', '')
    if not is_single_tenant_environment:
        if tenant_id is None:
            raise ValueError('Missing tenant id.')
        tenant: Tenant = Tenant.find_by_id(tenant_id)
        return site_url + f'/{tenant.short_name}' + path
    else:
        return site_url + path


def send_email(subject, email, html_body, args, template_id, reference=None):
    """Send the email asynchronously, using the given details."""
    if not email or not is_valid_email(email):
        return

    sender = current_app.config.get('MAIL_FROM_ID')
    eagle_notify_endpoint = current_app.config.get('EAGLE_NOTIFY_EMAIL_ENDPOINT')
    if eagle_notify_endpoint:
        service_account_token = _get_epic_service_account_token()
        send_email_endpoint = eagle_notify_endpoint
    else:
        service_account_token = RestService.get_service_account_token()
        send_email_endpoint = current_app.config.get('NOTIFICATIONS_EMAIL_ENDPOINT')
    payload = {
        'bodyType': 'html',
        'body': html_body,
        'from': sender,
        'subject': subject,
        'to': email.split(),
        'args': args,
        'template_id': template_id,
    }
    if reference is not None:
        payload['reference'] = str(reference)
    response = requests.post(send_email_endpoint,
                             headers={
                                 'Content-Type': 'application/json',
                                 'Authorization': f'Bearer {service_account_token}'},
                             data=json.dumps(payload),
                             timeout=current_app.config.get('CONNECT_TIMEOUT', 60))
    response.raise_for_status()


def _get_epic_service_account_token():
    """Get a token for the EPIC account that ENGAGE also uses for eagle-api pushes."""
    return RestService.get_access_token_with_password(
        current_app.config.get('EPIC_KEYCLOAK_SERVICE_ACCOUNT_ID'),
        current_app.config.get('EPIC_KEYCLOAK_SERVICE_ACCOUNT_SECRET'),
        current_app.config.get('EPIC_KC_CLIENT_ID'),
        current_app.config.get('EPIC_JWT_OIDC_ISSUER'))


def is_valid_email(email: str):
    """Return if the email is valid or not."""
    if email:
        return re.match(r'[^@]+@[^@]+\.[^@]+', email) is not None
    return False
