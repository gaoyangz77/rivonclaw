export interface Surface {
  id: string;
  name: string;
  allowedToolIds: string[];
  userId: string;
}

export interface RunProfile {
  id: string;
  name: string;
  selectedToolIds: string[];
  surfaceId: string;
  userId: string;
}
