import { gql } from "@apollo/client/core";

export const ACTIVE_ANNOUNCEMENTS_QUERY = gql`
  query ActiveAnnouncements($surface: AnnouncementSurface!, $appVersion: String, $locale: String!, $deviceId: String) {
    activeAnnouncements(surface: $surface, appVersion: $appVersion, locale: $locale, deviceId: $deviceId) {
      id
      key
      surface
      category
      priority
      title
      maxWidth
      template {
        format
        html
      }
      actions {
        role
        type
        label
        path
        url
      }
    }
  }
`;

export const RECORD_ANNOUNCEMENT_EVENT_MUTATION = gql`
  mutation RecordAnnouncementEvent($input: RecordAnnouncementEventInput!) {
    recordAnnouncementEvent(input: $input)
  }
`;
