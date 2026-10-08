"""Service for project management."""
from datetime import datetime, timezone
from http import HTTPStatus
import logging

from flask import current_app
import requests

from met_api.constants.engagement_status import Status
from met_api.models.db import db
from met_api.models.engagement import Engagement as EngagementModel
from met_api.models.engagement_metadata import EngagementMetadataModel
from met_api.services.email_verification_service import EmailVerificationService
from met_api.services.object_storage_service import ObjectStorageService
from met_api.services.rest_service import RestService, RestServiceConnectionError
from met_api.utils import notification
from met_api.utils.datetime import convert_and_format_to_utc_str, local_datetime

logger = logging.getLogger(__name__)

# Statuses where the engagement should not be publicly visible in EPIC.
_NON_PUBLIC_STATUSES = {Status.Draft.value, Status.Unpublished.value}

_SYNC_TARGETS = ('eagle', 'both', 'demi')
_warned_sync_targets = set()


def _response_ok(response, request_line, engagement_id, engagement_metadata, warn_statuses=()) -> bool:
    """Return True on a 2xx response; otherwise log the failure with the ids needed to trace it."""
    if HTTPStatus.OK <= response.status_code < HTTPStatus.MULTIPLE_CHOICES:
        return True
    logger.log(
        logging.WARNING if response.status_code in warn_statuses else logging.ERROR,
        'EPIC sync %s failed: status=%s engagement_id=%s project_id=%s tracking_id=%s response=%s',
        request_line, response.status_code, engagement_id,
        getattr(engagement_metadata, 'project_id', None),
        getattr(engagement_metadata, 'project_tracking_id', None),
        (response.text or '')[:500],
    )
    return False


def _json_object(response):
    """Return the response body when it is a JSON object; None when it is empty, not JSON, or not an object."""
    if not response.content:
        return None
    try:
        body = response.json()
    except ValueError:
        return None
    return body if isinstance(body, dict) else None


def _sync_targets():
    """Return (to_eagle, to_demi) from EPIC_SYNC_TARGET; unknown values fall back to Eagle only."""
    target = str(current_app.config.get('EPIC_SYNC_TARGET') or 'eagle').strip().lower()
    if target not in _SYNC_TARGETS:
        if target not in _warned_sync_targets:
            _warned_sync_targets.add(target)
            logger.warning('Unknown EPIC_SYNC_TARGET %r: pushing to Eagle only.', target)
        target = 'eagle'
    return target != 'demi', target != 'eagle'


def _epic_url_set(engagement_id) -> bool:
    """Return True when EPIC_URL is set; every target needs it to tell projects from notifications."""
    if current_app.config.get('EPIC_URL'):
        return True
    logger.error('EPIC sync skipped: EPIC_URL is not set. engagement_id=%s', engagement_id)
    return False


def _rollback():
    """Drop a failed transaction so later work on the same session (the next cron engagement) can commit."""
    try:
        db.session.rollback()
    except Exception:  # NOQA # pylint:disable=broad-except
        logger.exception('EPIC sync: session rollback failed')


class ProjectService:
    """Project management service."""

    @staticmethod
    def _get_project_type(project_id: str, token: str) -> str:
        """Determine whether the project_id is a standard Project or a ProjectNotification."""
        epic_url = current_app.config.get('EPIC_URL')
        base_url = epic_url.rsplit('/', 1)[0]

        headers = {'Authorization': f'Bearer {token}'}

        # Check standard project
        project_url = f'{base_url}/project/{project_id}'
        try:
            response = requests.get(project_url, headers=headers, timeout=10)
            if response.status_code == HTTPStatus.OK:
                return 'project'
        except Exception as e:  # noqa: B902 # pylint:disable=broad-except
            logger.warning('EPIC project lookup GET %s failed: %s', project_url, e)

        # Check project notification
        notification_url = f'{base_url}/projectNotification/{project_id}'
        try:
            response = requests.get(notification_url, headers=headers, timeout=10)
            if response.status_code == HTTPStatus.OK:
                return 'notification'
        except Exception as e:  # noqa: B902 # pylint:disable=broad-except
            logger.warning('EPIC project notification lookup GET %s failed: %s', notification_url, e)

        return 'project'  # Default to project for backward compatibility

    @staticmethod
    def _update_project_notification(engagement, project_id, token, engagement_metadata) -> bool:
        base_url = current_app.config.get('EPIC_URL').rsplit('/', 1)[0]

        notification_url = f'{base_url}/projectNotification/{project_id}'
        response = requests.get(notification_url, headers={'Authorization': f'Bearer {token}'}, timeout=10)
        if not _response_ok(response, f'GET {notification_url}', engagement.id, engagement_metadata,
                            warn_statuses=(HTTPStatus.NOT_FOUND,)):
            return False

        notification_data = response.json()
        is_pub = engagement.status_id not in _NON_PUBLIC_STATUSES

        now = local_datetime().replace(tzinfo=None)
        if not is_pub:
            pcp = 'none'
        elif engagement.start_date and now < engagement.start_date:
            pcp = 'pending'
        elif engagement.end_date and now > engagement.end_date:
            pcp = 'closed'
        else:
            pcp = 'open'

        notification_data.update({
            'dateStarted': convert_and_format_to_utc_str(engagement.start_date) if engagement.start_date else None,
            'dateCompleted': convert_and_format_to_utc_str(engagement.end_date) if engagement.end_date else None,
            'pcp': pcp,
            'isMet': True,
            'metURL': (
                f'{notification.get_tenant_site_url(engagement.tenant_id)}'
                f'{EmailVerificationService.get_engagement_path(engagement, is_public_url=True)}'
            )
        })

        put_url = f'{notification_url}?publish={"true" if is_pub else "false"}'
        response = RestService.put(endpoint=put_url, token=token, data=notification_data, raise_for_status=False)
        ok = _response_ok(response, f'PUT {put_url}', engagement.id, engagement_metadata,
                          warn_statuses=(HTTPStatus.NOT_FOUND,))

        if not engagement_metadata.project_tracking_id:
            engagement_metadata.project_tracking_id = project_id
            engagement_metadata.commit()
        return ok

    @staticmethod
    def _delete_project_notification(project_id, token, eng_id, engagement_metadata) -> bool:
        base_url = current_app.config.get('EPIC_URL').rsplit('/', 1)[0]

        notification_url = f'{base_url}/projectNotification/{project_id}'
        response = requests.get(notification_url, headers={'Authorization': f'Bearer {token}'}, timeout=10)
        if not _response_ok(response, f'GET {notification_url}', eng_id, engagement_metadata,
                            warn_statuses=(HTTPStatus.NOT_FOUND,)):
            return False
        notification_data = response.json()
        notification_data.update({
            'dateStarted': None,
            'dateCompleted': None,
            'pcp': 'none',
            'isMet': False,
            'metURL': ''
        })
        put_url = f'{notification_url}?publish=false'
        response = RestService.put(endpoint=put_url, token=token, data=notification_data, raise_for_status=False)
        return _response_ok(response, f'PUT {put_url}', eng_id, engagement_metadata,
                            warn_statuses=(HTTPStatus.NOT_FOUND,))

    @staticmethod
    def update_project_info(eng_id: str, targets=None):
        """Create or update a CommentPeriod in the EPIC/EAO system for the given engagement.

        targets: iterable of 'eagle'/'demi' overriding EPIC_SYNC_TARGET; None reads the config.
        Never raises. Returns False when any push failed (already logged), True otherwise, skips included.
        Returns None for a project notification when targets exclude Eagle, the only place notifications go.
        """
        engagement_metadata = None
        try:
            is_eao_environment = current_app.config.get('IS_EAO_ENVIRONMENT')
            if not is_eao_environment:
                return True

            engagement, engagement_metadata = ProjectService._get_engagement_and_metadata(eng_id)

            if not engagement_metadata or not (project_id := engagement_metadata.project_id):
                # EPIC is not interested in the data without project Id. Skip.
                logger.debug('No project Id, skipping EPIC update.')
                return True

            if not _epic_url_set(eng_id):
                return False

            eao_service_account_token = ProjectService._get_eao_service_account_token()
            project_type = ProjectService._get_project_type(project_id, eao_service_account_token)

            if project_type == 'notification':
                # Every configured target sends notifications to Eagle; only an explicit DEMI-only call skips them.
                if targets is not None and 'eagle' not in targets:
                    return None
                return ProjectService._update_project_notification(
                    engagement, project_id, eao_service_account_token, engagement_metadata
                )

            to_eagle, to_demi = _sync_targets() if targets is None else ('eagle' in targets, 'demi' in targets)
            ok = True
            # Eagle goes first so a newly created tracking id reaches DEMI in the same run.
            if to_eagle:
                ok = ProjectService._run_leg('Eagle', eng_id, engagement_metadata, ProjectService._push_to_eagle,
                                             engagement, engagement_metadata, eao_service_account_token)
            if to_demi:
                ok = ProjectService._run_leg('DEMI', eng_id, engagement_metadata, ProjectService._push_to_demi,
                                             engagement, engagement_metadata) and ok
            return ok

        except RestServiceConnectionError as exc:
            _rollback()
            logger.error('Error in update_project_info: %s engagement_id=%s project_id=%s',
                         type(exc).__name__, eng_id, getattr(engagement_metadata, 'project_id', None))
        except Exception:  # NOQA # pylint:disable=broad-except
            _rollback()
            logger.exception('Error in update_project_info: engagement_id=%s project_id=%s',
                             eng_id, getattr(engagement_metadata, 'project_id', None))
        return False

    @staticmethod
    def _run_leg(target, eng_id, engagement_metadata, push, *args) -> bool:
        """Run one target's push so an exception there never skips the other target."""
        try:
            return push(*args)
        except RestServiceConnectionError as exc:
            # RestService has already logged the connection error itself.
            logger.error('EPIC sync to %s failed: %s engagement_id=%s project_id=%s',
                         target, type(exc).__name__, eng_id, getattr(engagement_metadata, 'project_id', None))
        except Exception:  # NOQA # pylint:disable=broad-except
            _rollback()
            logger.exception('EPIC sync to %s failed: engagement_id=%s project_id=%s',
                             target, eng_id, getattr(engagement_metadata, 'project_id', None))
        return False

    @staticmethod
    def _push_to_eagle(engagement, engagement_metadata, token) -> bool:
        payload = ProjectService._construct_epic_payload(engagement, engagement_metadata.project_id)
        epic_url = current_app.config.get('EPIC_URL')

        if engagement_metadata.project_tracking_id:
            update_url = f'{epic_url}/{engagement_metadata.project_tracking_id}'
            response = RestService.put(endpoint=update_url, token=token, data=payload, raise_for_status=False)
            return _response_ok(response, f'PUT {update_url}', engagement.id, engagement_metadata)

        response = RestService.post(endpoint=epic_url, token=token, data=payload, raise_for_status=False)
        if not _response_ok(response, f'POST {epic_url}', engagement.id, engagement_metadata):
            return False
        # Eagle-API returns the created MongoDB document; the PK field is '_id'.
        tracking_number = str(response.json().get('_id', ''))
        if tracking_number:
            engagement_metadata.project_tracking_id = tracking_number
            engagement_metadata.commit()
        return True

    @staticmethod
    def _push_to_demi(engagement, engagement_metadata, is_deleted=False) -> bool:
        missing = [name for name in ('DEMI_API_URL', 'DEMI_API_KEY') if not current_app.config.get(name)]
        if missing:
            logger.error('DEMI sync skipped: %s is not set. engagement_id=%s', ' and '.join(missing), engagement.id)
            return False
        url = f'{current_app.config.get("DEMI_API_URL").rstrip("/")}/engage/engagements/{engagement.id}'
        payload = ProjectService._construct_demi_payload(engagement, engagement_metadata, is_deleted)
        try:
            response = RestService.put(
                endpoint=url,
                data=payload,
                additional_headers={'Ocp-Apim-Subscription-Key': current_app.config.get('DEMI_API_KEY')},
                # Never forward the caller's bearer token to DEMI; the subscription key is the credential.
                generate_token=False,
                raise_for_status=False,
            )
        except Exception as exc:  # NOQA # pylint:disable=broad-except
            # Send errors (InvalidHeader, http.client ValueError) can quote the key, so only the class name is logged.
            logger.error('EPIC sync PUT %s failed: %s engagement_id=%s project_id=%s',
                         url, type(exc).__name__, engagement.id, engagement_metadata.project_id)
            return False

        body = _json_object(response) or {}
        if response.status_code == HTTPStatus.CONFLICT and body.get('code') == 'STALE_PUSH':
            logger.warning('EPIC sync PUT %s already current: DEMI holds this push or a newer one. '
                           'engagement_id=%s project_id=%s', url, engagement.id, engagement_metadata.project_id)
            return True
        if not _response_ok(response, f'PUT {url}', engagement.id, engagement_metadata):
            return False
        # Keeping DEMI's Eagle id lets a rollback to eagle mode PUT the existing period instead of POSTing a copy.
        eagle_id = body.get('eagleId')
        if eagle_id and not engagement_metadata.project_tracking_id:
            engagement_metadata.project_tracking_id = str(eagle_id)
            engagement_metadata.commit()
        return True

    @staticmethod
    def delete_from_epic(eng_id: str) -> bool:
        """Delete the CommentPeriod in EPIC that corresponds to the given engagement.

        Never raises. Returns False when any delete failed (already logged), True otherwise.
        """
        engagement_metadata = None
        try:
            is_eao_environment = current_app.config.get('IS_EAO_ENVIRONMENT')
            if not is_eao_environment:
                return True

            engagement_metadata = EngagementMetadataModel.find_by_engagement_id(eng_id)
            to_eagle, to_demi = _sync_targets()
            tracking_id = getattr(engagement_metadata, 'project_tracking_id', None)
            # DEMI keys rows by engagement id, so it needs a tombstone even before an Eagle id exists.
            if not (tracking_id or (to_demi and getattr(engagement_metadata, 'project_id', None))):
                return True

            if not _epic_url_set(eng_id):
                return False

            eao_service_account_token = ProjectService._get_eao_service_account_token()
            project_id = engagement_metadata.project_id or tracking_id

            project_type = ProjectService._get_project_type(project_id, eao_service_account_token)

            if project_type == 'notification':
                if not tracking_id:
                    return True
                return ProjectService._delete_project_notification(project_id, eao_service_account_token,
                                                                   eng_id, engagement_metadata)

            ok = True
            if to_eagle and tracking_id:
                ok = ProjectService._run_leg('Eagle', eng_id, engagement_metadata, ProjectService._delete_from_eagle,
                                             eng_id, engagement_metadata, eao_service_account_token)
            if to_demi:
                ok = ProjectService._run_leg('DEMI', eng_id, engagement_metadata, ProjectService._push_to_demi,
                                             EngagementModel.find_by_id(eng_id), engagement_metadata, True) and ok
            return ok

        except RestServiceConnectionError as exc:
            _rollback()
            logger.error('Error in delete_from_epic: %s engagement_id=%s project_id=%s',
                         type(exc).__name__, eng_id, getattr(engagement_metadata, 'project_id', None))
        except Exception:  # NOQA # pylint:disable=broad-except
            _rollback()
            logger.exception('Error in delete_from_epic: engagement_id=%s project_id=%s',
                             eng_id, getattr(engagement_metadata, 'project_id', None))
        return False

    @staticmethod
    def _delete_from_eagle(eng_id, engagement_metadata, token) -> bool:
        delete_url = f'{current_app.config.get("EPIC_URL")}/{engagement_metadata.project_tracking_id}'
        response = RestService.delete(endpoint=delete_url, token=token, raise_for_status=False)
        return _response_ok(response, f'DELETE {delete_url}', eng_id, engagement_metadata,
                            warn_statuses=(HTTPStatus.NOT_FOUND,))

    @staticmethod
    def _get_engagement_and_metadata(eng_id: str):
        engagement = EngagementModel.find_by_id(eng_id)
        engagement_metadata = EngagementMetadataModel.find_by_engagement_id(eng_id)
        return engagement, engagement_metadata

    @staticmethod
    def _engagement_fields(engagement):
        """Values both the Eagle and DEMI payloads carry."""
        site_url = notification.get_tenant_site_url(engagement.tenant_id)
        return {
            'metURL': f'{site_url}{EmailVerificationService.get_engagement_path(engagement, is_public_url=True)}',
            'metURLAdmin': f'{site_url}{EmailVerificationService.get_engagement_path(engagement, is_public_url=False)}',
            'bannerUrl': ObjectStorageService().get_url(engagement.banner_filename),
            # Dates converted to UTC — EPIC accepts UTC and converts to PST for display.
            'start': convert_and_format_to_utc_str(engagement.start_date) if engagement.start_date else None,
            'end': convert_and_format_to_utc_str(engagement.end_date) if engagement.end_date else None,
            # Only mark the CP as published when the engagement itself is publicly visible.
            'isPublished': engagement.status_id not in _NON_PUBLIC_STATUSES,
        }

    @staticmethod
    def _construct_epic_payload(engagement, project_id):
        fields = ProjectService._engagement_fields(engagement)
        return {
            'isMet': True,
            'metURL': fields['metURL'],
            'metURLAdmin': fields['metURLAdmin'],
            'metBannerImageUrl': fields['bannerUrl'],
            # Converted here, not from fields, so a missing date still fails the Eagle push as it always has.
            'dateCompleted': convert_and_format_to_utc_str(engagement.end_date),
            'dateStarted': convert_and_format_to_utc_str(engagement.start_date),
            'instructions': engagement.description,
            'informationLabel': engagement.name,
            'commentTip': '',
            'milestone': current_app.config.get('EPIC_MILESTONE'),
            'openHouse': '',
            'relatedDocuments': '',
            'project': project_id,
            'isPublished': fields['isPublished'],
        }

    @staticmethod
    def _pushed_at(engagement, engagement_metadata):
        """Return the last ENGAGE change as UTC ISO, so DEMI can refuse a push older than what it holds."""
        # updated_date columns hold naive UTC (datetime.utcnow).
        stamps = [stamp for stamp in (engagement.updated_date, getattr(engagement_metadata, 'updated_date', None))
                  if isinstance(stamp, datetime)]
        if not stamps:
            return datetime.now(timezone.utc).isoformat()
        return max(stamps).replace(tzinfo=timezone.utc).isoformat()

    @staticmethod
    def _construct_demi_payload(engagement, engagement_metadata, is_deleted=False):
        return {
            'engagement': {
                'id': engagement.id,
                'name': engagement.name,
                'description': engagement.description,
                'status': engagement.status_id,
                **ProjectService._engagement_fields(engagement),
                'projectId': engagement_metadata.project_id,
                'trackingId': engagement_metadata.project_tracking_id or None,
                'isDeleted': is_deleted,
            },
            'pushedAt': ProjectService._pushed_at(engagement, engagement_metadata),
        }

    @staticmethod
    def _get_eao_service_account_token():
        kc_service_id = current_app.config.get('EPIC_KEYCLOAK_SERVICE_ACCOUNT_ID')
        kc_secret = current_app.config.get('EPIC_KEYCLOAK_SERVICE_ACCOUNT_SECRET')
        issuer_url = current_app.config.get('EPIC_JWT_OIDC_ISSUER')
        client_id = current_app.config.get('EPIC_KC_CLIENT_ID')
        return RestService.get_access_token_with_password(kc_service_id, kc_secret, client_id, issuer_url)
