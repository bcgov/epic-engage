import '@testing-library/jest-dom';
import { createDefaultSurvey, Survey } from 'models/survey';
import {
    createDefaultEngagement,
    createDefaultEngagementMetadata,
    createDefaultEngagementSettings,
    Engagement,
    EngagementMetadata,
    EngagementSettings,
} from 'models/engagement';
import { EngagementStatus, SubmissionStatus } from 'constants/engagementStatus';
import { WidgetType, Widget, WidgetItem } from 'models/widget';
import { Event, EventItem } from 'models/event';
import { WidgetMap } from 'models/widgetMap';
import { Tenant } from 'models/tenant';

const tenant: Tenant = {
    name: 'Tenant 1',
    title: 'Tenant Title',
    description: 'Tenant Description',
};

const survey: Survey = {
    ...createDefaultSurvey(),
    id: 1,
    name: 'Survey 1',
    engagement_id: 1,
};

const surveys = [survey];

const draftEngagement: Engagement = {
    ...createDefaultEngagement(),
    id: 1,
    name: 'Test Engagement',
    created_date: '2022-09-14 20:16:29.846877',
    rich_content:
        '{"blocks":[{"key":"29p4m","text":"Test content","type":"unstyled","depth":0,"inlineStyleRanges":[],"entityRanges":[],"data":{}}],"entityMap":{}}',
    content: 'Test content',
    rich_description:
        '{"blocks":[{"key":"bqupg","text":"Test description","type":"unstyled","depth":0,"inlineStyleRanges":[],"entityRanges":[],"data":{}}],"entityMap":{}}',
    description: 'Test description',
    start_date: '2022-09-01',
    end_date: '2022-09-30',
    surveys: surveys,
    engagement_status: {
        id: EngagementStatus.Draft,
        status_name: 'Draft',
    },
};

const closedEngagement = {
    ...draftEngagement,
    id: 3,
    name: 'Closed Engagement',
    submission_status: SubmissionStatus.Closed,
    engagement_status: {
        id: EngagementStatus.Closed,
        status_name: 'Closed',
    },
    start_date: '2022-09-01',
    end_date: '2023-03-30',
    created_date: '2022-09-15 10:00:00',
    published_date: '2022-09-19 10:00:00',
    surveys: surveys,
    submissions_meta_data: {
        total: 1,
        pending: 0,
        needs_further_review: 0,
        rejected: 0,
        approved: 1,
    },
};

const openEngagement = {
    ...draftEngagement,
    id: 2,
    name: 'Open Engagement',
    engagement_status: {
        id: EngagementStatus.Published,
        status_name: 'Open',
    },
    start_date: '2022-09-01',
    end_date: '2025-09-30',
    created_date: '2022-09-15 10:00:00',
    published_date: '2022-09-19 10:00:00',
    surveys: surveys,
    submissions_meta_data: {
        total: 1,
        pending: 0,
        needs_further_review: 0,
        rejected: 0,
        approved: 1,
    },
};

const mockEventItem: EventItem = {
    id: 1,
    description: 'description',
    location_name: 'location name',
    location_address: 'location address',
    start_date: 'start date',
    end_date: 'end date',
    url: 'link',
    url_label: 'link label',
    sort_index: 1,
    widget_events_id: 0,
    created_by: 'test',
    updated_by: 'test',
    created_date: 'test date',
    updated_date: 'test date',
    timezone: 'America/Vancouver',
};

const mockEvent: Event = {
    id: 1,
    title: 'Events',
    type: 'OPENHOUSE',
    sort_index: 1,
    widget_id: 1,
    created_by: 'test',
    updated_by: 'test',
    event_items: [mockEventItem],
};

const eventWidgetItem: WidgetItem = {
    id: 1,
    widget_id: 1,
    widget_data_id: 1,
    sort_index: 1,
};

const eventWidget: Widget = {
    id: 1,
    title: 'Events',
    widget_type_id: WidgetType.Events,
    engagement_id: 1,
    items: [eventWidgetItem],
};

const mapWidgetItem: WidgetItem = {
    id: 1,
    widget_id: 1,
    widget_data_id: 1,
    sort_index: 1,
};

const mapWidget: Widget = {
    id: 1,
    title: 'Map',
    widget_type_id: WidgetType.Map,
    engagement_id: 1,
    items: [mapWidgetItem],
};

const mockMap: WidgetMap = {
    id: 1,
    widget_id: 1,
    engagement_id: 1,
    longitude: 0,
    latitude: 0,
    marker_label: 'test',
    geojson: '',
    file_name: 'test.zip',
};

const engagementMetadata: EngagementMetadata = {
    ...createDefaultEngagementMetadata(),
    engagement_id: 1,
};

const engagementSetting: EngagementSettings = {
    ...createDefaultEngagementSettings(),
    engagement_id: 1,
};

const engagementSlugData = {
    slug: 'test-engagement-slug',
};

// Engagement with full status_block for testing SurveyBlock states
const openEngagementWithStatusBlock = {
    ...openEngagement,
    status_block: [
        {
            id: 1,
            survey_status: 'Upcoming',
            block_text: '{"blocks":[{"key":"upcoming","text":"This engagement is coming soon.","type":"unstyled","depth":0,"inlineStyleRanges":[],"entityRanges":[],"data":{}}],"entityMap":{}}',
        },
        {
            id: 2,
            survey_status: 'Open',
            block_text: '{"blocks":[{"key":"open","text":"Share your thoughts with us!","type":"unstyled","depth":0,"inlineStyleRanges":[],"entityRanges":[],"data":{}}],"entityMap":{}}',
        },
        {
            id: 3,
            survey_status: 'Closed',
            block_text: '{"blocks":[{"key":"closed","text":"This engagement is now closed.","type":"unstyled","depth":0,"inlineStyleRanges":[],"entityRanges":[],"data":{}}],"entityMap":{}}',
        },
    ],
};

// Upcoming engagement for dashboard tests
const upcomingEngagement = {
    ...draftEngagement,
    id: 4,
    name: 'Upcoming Engagement',
    engagement_status: {
        id: 4, // Scheduled
        status_name: 'Scheduled',
    },
    submission_status: 1, // Upcoming
    start_date: '2025-12-01',
    end_date: '2025-12-31',
};

// Email verification mock data
const mockEmailVerification = {
    id: 1,
    email_address: 'test@example.com',
    survey_id: 1,
    engagement_id: 1,
    verification_token: 'test-token-123',
    is_active: true,
};

// Widget mock data for testing
const whoIsListeningWidget = {
    id: 2,
    title: 'Who is Listening',
    widget_type_id: 2, // WhoIsListening
    engagement_id: 1,
    items: [],
};

const subscribeWidget = {
    id: 3,
    title: 'Subscribe',
    widget_type_id: 7, // Subscribe
    engagement_id: 1,
    items: [],
};

const documentWidget = {
    id: 4,
    title: 'Documents',
    widget_type_id: 5, // Document
    engagement_id: 1,
    items: [],
};

const videoWidget = {
    id: 5,
    title: 'Video',
    widget_type_id: 8, // Video
    engagement_id: 1,
    items: [],
};

const allWidgets = [eventWidget, mapWidget, whoIsListeningWidget, subscribeWidget, documentWidget, videoWidget];

export {
    tenant,
    draftEngagement,
    openEngagement,
    closedEngagement,
    upcomingEngagement,
    openEngagementWithStatusBlock,
    surveys,
    mockEvent,
    mockEventItem,
    mapWidget,
    mockMap,
    eventWidgetItem,
    eventWidget,
    whoIsListeningWidget,
    subscribeWidget,
    documentWidget,
    videoWidget,
    allWidgets,
    engagementMetadata,
    engagementSlugData,
    engagementSetting,
    mockEmailVerification,
};
