"""request_type_option model class.

Manages the option type questions (radio/checkbox) on a survey
"""
from collections import defaultdict

from sqlalchemy import and_, distinct, func, or_
from sqlalchemy.sql.expression import true

from analytics_api.models.available_response_option import AvailableResponseOption as AvailableResponseOptionModel
from analytics_api.models.survey import Survey as SurveyModel
from analytics_api.models.response_type_option import ResponseTypeOption as ResponseTypeOptionModel
from analytics_api.utils.util import FormIoComponentType
from .base_model import BaseModel
from .db import db
from .request_mixin import RequestMixin

_MATRIX_TYPES = frozenset([FormIoComponentType.SURVEY.value, FormIoComponentType.RANKING.value])


def _fetch_available_by_key(analytics_survey_id):
    """Fetch available responses grouped by request_key, preserving fomrio insertion order."""
    rows = (db.session.query(AvailableResponseOptionModel.request_key, AvailableResponseOptionModel.value)
            .filter(AvailableResponseOptionModel.survey_id.in_(analytics_survey_id),  # pylint: disable=no-member
                    AvailableResponseOptionModel.is_active == true())
            .order_by(AvailableResponseOptionModel.id)
            .all())
    result = defaultdict(list)
    for aro in rows:
        result[aro.request_key].append(aro.value)
    return result


def _fetch_count_map(analytics_survey_id):
    """Fetch response counts keyed by (request_key, value)."""
    rows = (db.session.query(ResponseTypeOptionModel.request_key, ResponseTypeOptionModel.value,
                             func.count(ResponseTypeOptionModel.request_key).label('count'))
            .filter(ResponseTypeOptionModel.survey_id.in_(analytics_survey_id),  # pylint: disable=no-member
                    ResponseTypeOptionModel.is_active == true())
            .group_by(ResponseTypeOptionModel.request_key, ResponseTypeOptionModel.value)
            .all())
    return {(r.request_key, r.value): r.count for r in rows}


def _fetch_respondent_count_by_key(analytics_survey_id):
    """Count the distinct people who answered each question."""
    rows = (db.session.query(ResponseTypeOptionModel.request_key,
                             func.count(distinct(ResponseTypeOptionModel.participant_id)).label('respondents'))
            .filter(and_(ResponseTypeOptionModel.survey_id.in_(analytics_survey_id),  # pylint: disable=no-member
                         ResponseTypeOptionModel.is_active == true()))
            .group_by(ResponseTypeOptionModel.request_key)
            .all())
    return {r.request_key: r.respondents for r in rows}


def _fetch_respondent_count_for_keys(analytics_survey_id, request_keys):
    """Count the distinct people who answered at least one of the given sub-questions."""
    if not request_keys:
        return 0
    count = (db.session.query(func.count(distinct(ResponseTypeOptionModel.participant_id)))
             .filter(and_(ResponseTypeOptionModel.survey_id.in_(analytics_survey_id),  # pylint: disable=no-member
                          ResponseTypeOptionModel.is_active == true(),
                          ResponseTypeOptionModel.request_key.in_(request_keys)))
             .scalar())
    return count or 0


def _drop_hidden(questions):
    """Drop the questions staff excluded from the public report, sub-questions included.

    A matrix (simplesurvey/simpleranking) is excluded through the one report setting held
    against the parent component, so its sub-question rows - which carry no setting of their
    own - have to go with it. Left behind they have no parent to roll up into and would be
    served as orphaned flat entries the dashboard can only render as a warning.
    """
    hidden_rids = {q.request_id for q in questions if q.display is False}
    if not hidden_rids:
        return questions
    return [q for q in questions
            if q.display is not False and
            not any(q.request_id.startswith(hidden_rid + '-') for hidden_rid in hidden_rids)]


def _build_matrix_entry(parent, all_questions, avail_by_key, count_map, analytics_survey_id):
    """Build a grouped matrix result entry for a simplesurvey or simpleranking parent row."""
    is_ranking = parent.type == FormIoComponentType.RANKING.value
    children = sorted(
        [c for c in all_questions if c.request_id.startswith(parent.request_id + '-')],
        key=lambda c: c.position,
    )
    matrix_rows = []
    scale_labels = []
    for child in children:
        scale_values = list(avail_by_key.get(child.key, []))
        if not scale_values:
            continue
        if is_ranking:
            scale_values.sort(key=lambda v: int(v) if v.isdigit() else 0)
        elif not scale_labels:
            scale_labels = scale_values
        counts = [count_map.get((child.key, v), 0) for v in scale_values]
        total = sum(counts)
        pcts = [round(c * 100 / total) if total > 0 else 0 for c in counts]
        matrix_rows.append({'label': child.label, 'pcts': pcts, 'n': total})
    if not matrix_rows:
        return None
    respondent_count = _fetch_respondent_count_for_keys(analytics_survey_id, [c.key for c in children])
    return {'position': parent.position, 'question': parent.label, 'key': parent.key,
            'type': parent.type, 'respondent_count': respondent_count,
            'scale_labels': scale_labels, 'result': matrix_rows}


def _build_flat_entry(q, avail_by_key, count_map, respondent_by_key):
    """Build a flat value/count result entry for a non-matrix or orphaned matrix question."""
    scale_values = avail_by_key.get(q.key)
    if scale_values:
        result = [{'value': v, 'count': count_map.get((q.key, v), 0)} for v in scale_values]
    else:
        result = [{'value': val, 'count': cnt} for (key, val), cnt in count_map.items() if key == q.key]
    if not result:
        return None
    return {'position': q.position, 'question': q.label, 'key': q.key, 'type': q.type,
            'respondent_count': respondent_by_key.get(q.key, 0), 'result': result}


class RequestTypeOption(BaseModel, RequestMixin):  # pylint: disable=too-few-public-methods
    """Definition of the Request Type Option entity."""

    __tablename__ = 'request_type_option'

    @classmethod
    def get_survey_result(
        cls,
        engagement_id,
        can_view_all_survey_results
    ):
        """Get the analytics survey id for an engagement id."""
        analytics_survey_id = (db.session.query(SurveyModel.id)
                               .filter(and_(SurveyModel.engagement_id == engagement_id,
                                            SurveyModel.is_active == true()))
                               .subquery())

        # Get all the survey questions specific to a survey id which are in active status.
        # for users with role to view all surveys fetch all survey questions
        # for all other users exclude questions excluded on report settings
        if can_view_all_survey_results:
            survey_question = (db.session.query(RequestTypeOption.position.label('position'),
                                                RequestTypeOption.label.label('label'),
                                                RequestTypeOption.key)
                               .filter(and_(RequestTypeOption.survey_id.in_(  # pylint: disable=no-member
                                   analytics_survey_id),
                                            RequestTypeOption.is_active == true()))
                               .order_by(RequestTypeOption.position)
                               .subquery())
        else:
            survey_question = (db.session.query(RequestTypeOption.position.label('position'),
                                                RequestTypeOption.label.label('label'),
                                                RequestTypeOption.key)
                               .filter(and_(RequestTypeOption.survey_id.in_(  # pylint: disable=no-member
                                   analytics_survey_id),
                                            RequestTypeOption.is_active == true(),
                                            or_(RequestTypeOption.display == true(),
                                                RequestTypeOption.display.is_(None))))
                               .order_by(RequestTypeOption.position)
                               .subquery())
        result = db.session.query(survey_question).first()

        if result:
            # Get all the available responses for each question within the survey.
            available_response = (db.session.query(AvailableResponseOptionModel.request_key,
                                                   AvailableResponseOptionModel.value)
                                  .filter(and_(AvailableResponseOptionModel.survey_id.in_(  # pylint: disable=no-member
                                      analytics_survey_id), AvailableResponseOptionModel.is_active == true()))
                                  .subquery())
            # Get all the survey responses with the counts for each response specific to a survey id which
            # are in active status.
            survey_response = (db.session.query(ResponseTypeOptionModel.request_key, ResponseTypeOptionModel.value,
                                                func.count(ResponseTypeOptionModel.request_key).label('response'))
                               .filter(and_(ResponseTypeOptionModel.survey_id.in_(  # pylint: disable=no-member
                                   analytics_survey_id),
                                            ResponseTypeOptionModel.is_active == true()))
                               .group_by(ResponseTypeOptionModel.request_key, ResponseTypeOptionModel.value)
                               .subquery())

            survey_response_exists = db.session.query(survey_response.c.request_key).first()
            available_response_exists = db.session.query(available_response.c.request_key).first()

            # Combine the data fetched above such that the result has a format as below
            # - position: is a unique value for each question which helps to get the order of question on the survey
            # - label: is the the survey question
            # - value: user selected response for each question
            # - count: number of time the same value is selected as a response to each question

            # Check if there are records in survey_response and available_response before executing the final query
            # which fetches all the available responses along with the corresponding responses.
            if survey_response_exists and available_response_exists:
                survey_result = (db.session.query((survey_question.c.position).label('position'),
                                                  (survey_question.c.label).label('question'),
                                                  func.json_agg(func.json_build_object(
                                                      'value', available_response.c.value,
                                                      'count', func.coalesce(survey_response.c.response, 0)))
                                 .label('result'))
                                 .outerjoin(
                                     available_response, survey_question.c.key == available_response.c.request_key)
                                 .outerjoin(survey_response,
                                            (available_response.c.value == survey_response.c.value) &
                                            (available_response.c.request_key == survey_response.c.request_key),
                                            full=True)
                                 .filter(survey_question.c.position.isnot(None))
                                 .filter(survey_question.c.label.isnot(None))
                                 .group_by(survey_question.c.position, survey_question.c.label))

                return survey_result.all()
            # Check if there are records in survey_response before executing the final query which fetches responses
            # even if the available_response table is not yet populated.
            if survey_response_exists:
                survey_result = (db.session.query((survey_question.c.position).label('position'),
                                                  (survey_question.c.label).label('question'),
                                                  func.json_agg(func.json_build_object('value',
                                                                                       survey_response.c.value,
                                                                                       'count',
                                                                                       survey_response.c.response))
                                 .label('result'))
                                 .join(survey_response, survey_response.c.request_key == survey_question.c.key)
                                 .group_by(survey_question.c.position, survey_question.c.label))

                return survey_result.all()

        return None  # Return None indicating no records

    @classmethod
    def get_survey_result_with_type(cls, engagement_id, can_view_all_survey_results):
        """Return survey results with question type and page key included.

        Matrix questions (simplesurvey, simpleranking) are returned as a single
        entry with a nested pcts/n result.
        Orphaned sub-question rows (old ETL data with no parent) fall back to flat output.
        """
        analytics_survey_id = (
            db.session.query(SurveyModel.id)
            .filter(and_(SurveyModel.engagement_id == engagement_id, SurveyModel.is_active == true()))
            .subquery()
        )

        base_filter = [
            RequestTypeOption.survey_id.in_(analytics_survey_id),  # pylint: disable=no-member
            RequestTypeOption.is_active == true(),
        ]

        all_questions = (
            db.session.query(RequestTypeOption.position, RequestTypeOption.label,
                             RequestTypeOption.key, RequestTypeOption.type, RequestTypeOption.request_id,
                             RequestTypeOption.display)
            .filter(*base_filter)
            .order_by(RequestTypeOption.position)
            .all()
        )
        if not can_view_all_survey_results:
            all_questions = _drop_hidden(all_questions)

        if not all_questions:
            return None

        matrix_rids = {q.request_id for q in all_questions if q.type in _MATRIX_TYPES}
        parent_rids = {rid for rid in matrix_rids
                       if any(other.startswith(rid + '-') for other in matrix_rids if other != rid)}
        child_rids = matrix_rids - parent_rids

        avail_by_key = _fetch_available_by_key(analytics_survey_id)
        count_map = _fetch_count_map(analytics_survey_id)
        respondent_by_key = _fetch_respondent_count_by_key(analytics_survey_id)

        results = []
        for q in all_questions:
            if q.request_id in child_rids and any(q.request_id.startswith(p + '-') for p in parent_rids):
                continue  # rolled up into parent matrix entry
            if q.request_id in parent_rids:
                entry = _build_matrix_entry(q, all_questions, avail_by_key, count_map, analytics_survey_id)
            else:
                entry = _build_flat_entry(q, avail_by_key, count_map, respondent_by_key)
            if entry:
                results.append(entry)

        results.sort(key=lambda r: r['position'] or 0)
        return results or None
