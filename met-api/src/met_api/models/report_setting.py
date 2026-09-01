"""Report setting model class.

Used to store the setting for each question on the survey. Based on the value for the column display the
questions will either be displayed/hidden on the dashboard
"""
from __future__ import annotations

from sqlalchemy import ForeignKey

from met_api.schemas.report_setting import ReportSettingSchema
from .base_model import BaseModel
from .db import db


class ReportSetting(BaseModel):  # pylint: disable=too-few-public-methods
    """Definition of the report setting entity."""

    __tablename__ = 'report_setting'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    survey_id = db.Column(db.Integer, ForeignKey('survey.id', ondelete='CASCADE'), nullable=False)
    question_id = db.Column(db.Text())
    question_key = db.Column(db.Text())
    question_type = db.Column(db.Text())
    question = db.Column(db.Text())
    display = db.Column(db.Boolean, default=True,
                        comment='Flag to identify if the question needs to be displayed on the dashboard.')
    description = db.Column(db.Text(), nullable=True,
                            comment='Optional admin-authored description shown alongside the question on the '
                                    'public report.')

    @classmethod
    def find_by_survey_id(cls, survey_id):
        """Return report setting by survey id."""
        report_settings = db.session.query(ReportSetting) \
            .filter(ReportSetting.survey_id == survey_id) \
            .all()
        return report_settings

    @classmethod
    def find_excluded_question_keys(cls, survey_id) -> set:
        """Return the question keys staff have excluded from this survey's report.

        Only questions explicitly switched off. A question with no setting at all has not been
        excluded by anyone - it has never been through `refresh_report_setting` - so it is left
        alone rather than silently hidden.
        """
        rows = db.session.query(ReportSetting.question_key) \
            .filter(ReportSetting.survey_id == survey_id, ReportSetting.display.is_(False)) \
            .all()
        return {row.question_key for row in rows}

    @classmethod
    def find_descriptions_by_question_key(cls, survey_id) -> dict:
        """Return the descriptions staff wrote for this survey's questions, keyed by question key.

        Only questions actually given a description are returned - the dashboard renders nothing
        for the rest.
        """
        rows = db.session.query(ReportSetting.question_key, ReportSetting.description) \
            .filter(ReportSetting.survey_id == survey_id,
                    ReportSetting.description.isnot(None),
                    ReportSetting.description != '') \
            .all()
        return {row.question_key: row.description for row in rows}

    @classmethod
    def find_by_question_key(cls, survey_id, question_key):
        """Return report setting by survey id."""
        report_settings = db.session.query(ReportSetting) \
            .filter(ReportSetting.survey_id == survey_id, ReportSetting.question_key == question_key).first()
        return report_settings

    @staticmethod
    def __create_new_report_settings_entity(survey_id, report_setting: ReportSettingSchema):
        """Create new comment entity."""
        return ReportSetting(
            survey_id=survey_id,
            question_id=report_setting.question_id,
            question_key=report_setting.question_key,
            question_type=report_setting.question_type,
            question=report_setting.question,
            display=report_setting.display
        )

    @classmethod
    def add_all_report_settings(cls, survey_id, report_settings: list, session=None) -> list[ReportSetting]:
        """Create report setting."""
        new_report_setting = [cls.__create_new_report_settings_entity(survey_id, report_setting)
                              for report_setting in report_settings]
        if session is None:
            db.session.add_all(survey_id, new_report_setting)
            db.session.commit()
        else:
            session.add_all(new_report_setting)
        return new_report_setting

    @classmethod
    def delete_report_settings(cls, survey_id, question_keys: list) -> ReportSetting:
        """Delete report setting by survey id and question key."""
        db.session\
            .query(ReportSetting)\
            .filter(ReportSetting.survey_id == survey_id,
                    ReportSetting.question_key.in_(question_keys))\
            .delete(synchronize_session='fetch')
        db.session.commit()
        return survey_id, question_keys

    @classmethod
    def update_report_settings_bulk(cls, report_settings: list) -> list[ReportSetting]:
        """Save report settings."""
        db.session.bulk_update_mappings(ReportSetting, report_settings)
        db.session.commit()
        return report_settings
