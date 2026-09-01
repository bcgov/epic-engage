import { MetDescription } from 'components/shared/common';
import { Palette } from 'styles/Theme';

interface QuestionDescriptionProps {
    // The description staff wrote for this question on the survey's report settings page.
    // Absent for a question they never gave one.
    description?: string;
}

// Context staff wrote for a question, shown between the question and its chart on the public and
// internal dashboards. It belongs to the report, not to the survey - respondents never see it.
export const QuestionDescription = ({ description }: QuestionDescriptionProps) => {
    if (!description) {
        return null;
    }

    return (
        <MetDescription
            data-testid="question-description"
            sx={{ mt: '6px', color: Palette.text.secondary, whiteSpace: 'pre-wrap' }}
        >
            {description}
        </MetDescription>
    );
};

export default QuestionDescription;
