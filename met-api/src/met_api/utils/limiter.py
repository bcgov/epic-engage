# Copyright © 2021 Province of British Columbia
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
"""Bring in the common rate limiter."""
from flask import current_app
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address


# Per-IP limits for public (unauthenticated) endpoints. The values live in the
# Flask config (see _Config) so they can be tuned per environment via the
# OpenShift ConfigMap; these callables are resolved on each request, so a change
# needs a pod restart, not a code change. Endpoints that relay email through
# GC Notify get the tightest limits.
def email_sending_limit():
    """Return the limit for endpoints that send email."""
    return current_app.config['RATELIMIT_EMAIL_SENDING']


def public_write_limit():
    """Return the limit for public write endpoints."""
    return current_app.config['RATELIMIT_PUBLIC_WRITE']


def public_read_limit():
    """Return the limit for public read endpoints."""
    return current_app.config['RATELIMIT_PUBLIC_READ']


# lower case name as used by convention in most Flask apps
limiter = Limiter(key_func=get_remote_address)  # pylint: disable=invalid-name
