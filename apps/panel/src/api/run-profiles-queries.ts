import { gql } from "@apollo/client/core";

export const RUN_PROFILES_QUERY = gql`
  query RunProfiles($surfaceId: ID) {
    runProfiles(surfaceId: $surfaceId) {
      id
      userId
      name
      selectedToolIds
      surfaceId
      moduleId
      createdAt
      updatedAt
    }
  }
`;

export const CREATE_RUN_PROFILE_MUTATION = gql`
  mutation CreateRunProfile($input: CreateRunProfileInput!) {
    createRunProfile(input: $input) {
      id
      userId
      name
      selectedToolIds
      surfaceId
      moduleId
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_RUN_PROFILE_MUTATION = gql`
  mutation UpdateRunProfile($id: ID!, $input: UpdateRunProfileInput!) {
    updateRunProfile(id: $id, input: $input) {
      id
      userId
      name
      selectedToolIds
      surfaceId
      moduleId
      createdAt
      updatedAt
    }
  }
`;

export const DELETE_RUN_PROFILE_MUTATION = gql`
  mutation DeleteRunProfile($id: ID!) {
    deleteRunProfile(id: $id)
  }
`;
