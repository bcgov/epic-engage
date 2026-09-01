"""Service for report setting management."""

from met_api.constants.membership_type import MembershipType
from met_api.constants.report_setting_type import FormIoComponentType
from met_api.models.report_setting import ReportSetting as ReportSettingModel
from met_api.models.survey import Survey as SurveyModel
from met_api.schemas.report_setting import ReportSettingSchema
from met_api.services import authorization
from met_api.utils.form_components import flatten_components
from met_api.utils.roles import Role


class ReportSettingService:
    """Report setting management service."""

    @classmethod
    def get_report_setting(cls, survey_id):
        """Get report setting by survey id, creating lazily if none exist."""
        report_setting = ReportSettingModel.find_by_survey_id(survey_id)

        if not report_setting:
            # Lazy create: fetch survey and generate settings if form_json exists
            survey = SurveyModel.find_by_id(survey_id)
            if not survey:
                raise KeyError(f'Survey with id {survey_id} not found')
            if survey and survey.form_json and survey.form_json.get('display'):
                cls.refresh_report_setting({
                    'id': survey_id,
                    'form_json': survey.form_json,
                })
                report_setting = ReportSettingModel.find_by_survey_id(survey_id)

        settings = ReportSettingSchema(many=True).dump(report_setting)
        return settings

    @classmethod
    def refresh_report_setting(cls, report_setting_data):
        """Refresh report setting."""
        if report_setting_data.get('form_json', None) is None:
            raise ValueError('No question available on survey to access settings')

        survey_id = report_setting_data.get('id', None)

        form_json = report_setting_data.get('form_json', None)
        form_type = form_json.get('display', None)

        survey_question_keys = []

        if form_type in ('form', 'wizard'):
            # Every question in the form, however deeply the builder nested it. A question with no
            # setting is left out of the report
            cls._extract_form_component(survey_id, flatten_components(form_json), survey_question_keys)

        cls._delete_questions_removed_from_form(survey_id, survey_question_keys)

        return report_setting_data

    @classmethod
    def _extract_form_component(cls, survey_id, form_components, survey_question_keys):
        """Loop through the form json to extract each form component.

        Every question type gets one setting per component, matrix (simplesurvey) included: its
        rows are one question asked of several statements and the dashboard draws them as a
        single chart, so they share one visibility toggle and one description - as a ranking's
        statements already do.
        """
        for component in form_components:
            component_type = component.get('type', None)
            has_valid_question_type = cls._validate_component_type(component_type)
            if has_valid_question_type:
                cls._create_or_update_data(survey_id, component, survey_question_keys)

    @staticmethod
    def _validate_component_type(component_type):
        """Check if the component type is among the type that will be displayed on the dashboard."""
        component_type = component_type.lower()

        if component_type in (FormIoComponentType.RADIO.value, FormIoComponentType.CHECKBOX.value,
                              FormIoComponentType.SELECTLIST.value, FormIoComponentType.SURVEY.value,
                              FormIoComponentType.TEXTAREA.value, FormIoComponentType.TEXTFIELD.value,
                              FormIoComponentType.RANKING.value):
            return True

        return False

    @staticmethod
    def _create_or_update_data(survey_id, component, survey_question_keys) -> ReportSettingModel:
        report_setting = ReportSettingModel.find_by_question_key(survey_id, component['key'])
        survey_question_keys.append(component['key'])

        # Update the record if its existing
        if report_setting:
            report_setting.question_id = component['id']
            report_setting.question = component['label']
        else:
            # Create the record if its not existing
            report_setting = ReportSettingModel(survey_id=survey_id,
                                                question_id=component['id'],
                                                question_key=component['key'],
                                                question_type=component['type'],
                                                question=component['label'],
                                                display=True
                                                )

        report_setting.save()

    @classmethod
    def _delete_questions_removed_from_form(cls, survey_id, survey_question_keys):
        # Loop through the data from report setting and delete any record which does not exist on
        # survey form. This will happen if a existing survey question is deleted from the survey
        # Use model directly to avoid recursion with get_report_setting's lazy creation
        report_setting_records = ReportSettingModel.find_by_survey_id(survey_id)
        report_settings = ReportSettingSchema(many=True).dump(report_setting_records)

        report_setting_keys_to_delete = [report_setting['question_key'] for report_setting in report_settings
                                         if report_setting['question_key'] not in survey_question_keys]
        if len(report_setting_keys_to_delete) > 0:
            ReportSettingModel.delete_report_settings(survey_id, report_setting_keys_to_delete)

        return report_setting_keys_to_delete

    @classmethod
    def update_report_setting(cls, survey_id, new_report_settings):
        """Update report setting."""
        survey = SurveyModel.find_by_id(survey_id)
        if not survey:
            raise KeyError(f'No survey found for {survey_id}')

        one_of_roles = (
            MembershipType.TEAM_MEMBER.name,
            Role.EDIT_SURVEY.value
        )
        authorization.check_auth(one_of_roles=one_of_roles, engagement_id=survey.engagement_id)

        # Only include keys the caller sent - bulk_update_mappings treats a present key with a
        # None value as "set to NULL", so a display-only update mustn't also null the description.
        report_settings_update_mapping = []
        for setting in new_report_settings:
            mapping = {'id': setting.get('id', None)}
            if 'display' in setting:
                mapping['display'] = setting.get('display')
            if 'description' in setting:
                mapping['description'] = setting.get('description')
            report_settings_update_mapping.append(mapping)

        updated_report_settings = ReportSettingModel.update_report_settings_bulk(report_settings_update_mapping)
        return updated_report_settings
