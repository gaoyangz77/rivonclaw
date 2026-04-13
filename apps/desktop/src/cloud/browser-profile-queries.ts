export const BROWSER_PROFILE_PROXY_POLICY_QUERY = `
  query ($id: ID!) {
    browserProfile(id: $id) {
      id
      proxyPolicy {
        enabled
        baseUrl
      }
    }
  }
`;

export const BROWSER_PROFILE_SESSION_STATE_POLICY_QUERY = `
  query ($id: ID!) {
    browserProfile(id: $id) {
      id
      sessionStatePolicy {
        enabled
        checkpointIntervalSec
        mode
        storage
      }
    }
  }
`;

/**
 * Lightweight variant without the `id` response field.
 * Used by the policy resolver in main.ts where only the policy fields are needed.
 */
export const BROWSER_PROFILE_SESSION_STATE_POLICY_LITE_QUERY = `
  query ($id: ID!) {
    browserProfile(id: $id) {
      sessionStatePolicy {
        enabled
        checkpointIntervalSec
        mode
        storage
      }
    }
  }
`;

export const UPDATE_BROWSER_PROFILE_MUTATION = `
  mutation ($id: ID!, $input: UpdateBrowserProfileInput!) {
    updateBrowserProfile(id: $id, input: $input) {
      id
      sessionStatePolicy {
        enabled
        checkpointIntervalSec
        mode
        storage
      }
    }
  }
`;

export const DELETE_SESSION_STATE_BACKUP_MUTATION = `
  mutation ($profileId: ID!) {
    deleteSessionStateBackup(profileId: $profileId)
  }
`;

export const UPLOAD_SESSION_STATE_BACKUP_MUTATION = `
  mutation ($profileId: ID!, $manifest: SessionStateBackupManifestInput!, $payload: String!) {
    uploadSessionStateBackup(profileId: $profileId, manifest: $manifest, payload: $payload)
  }
`;

export const SESSION_STATE_BACKUP_QUERY = `
  query ($profileId: ID!) {
    sessionStateBackup(profileId: $profileId) {
      manifest {
        profileId
        target
        updatedAt
        hash
        cookieCount
      }
      payload
    }
  }
`;
