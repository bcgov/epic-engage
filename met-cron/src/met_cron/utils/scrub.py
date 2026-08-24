# Copyright © 2019 Province of British Columbia
#
# Licensed under the Apache License, Version 2.0 (the 'License');
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an 'AS IS' BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
"""Strip participant data out of text before it reaches a log file or the job_run_log table."""
import re


# Participant email addresses.
EMAIL_PATTERN = re.compile(r'[\w.+-]+@[\w-]+\.[\w.-]+')
# SQLAlchemy appends the statement and its bound parameters to every DBAPI error.
# That block is where submission ids and comment text leak into tracebacks.
# Deliberately greedy: a statement can span lines, so everything from the marker on is cut
# rather than guessing where the parameter dump ends. That also drops the trailing
# "ExceptionType: message" line of a traceback, which is why job_run_log stores error_type
# in its own column. Narrow this only if a real failure proves hard to diagnose without it.
SQL_DUMP_PATTERN = re.compile(r'\[SQL:.*', re.DOTALL)

REDACTED_EMAIL = '[redacted-email]'
REDACTED_SQL = '[redacted-sql]'


def scrub_sensitive(text, max_chars=4000):
    """Return text with participant data removed and the middle trimmed out if it is oversized.

    The head and the tail are both kept: a traceback carries its call site at the top and the
    exception type and message at the bottom, and both are needed to investigate a failure.
    """
    if not text:
        return ''
    scrubbed = SQL_DUMP_PATTERN.sub(REDACTED_SQL, str(text))
    scrubbed = EMAIL_PATTERN.sub(REDACTED_EMAIL, scrubbed)
    if max_chars and len(scrubbed) > max_chars:
        half = max_chars // 2
        trimmed = len(scrubbed) - (half * 2)
        scrubbed = f'{scrubbed[:half]}\n...[{trimmed} chars trimmed]...\n{scrubbed[-half:]}'
    return scrubbed
