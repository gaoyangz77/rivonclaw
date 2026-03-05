export interface PairingRequest {
    pairingCode: string;
    mobileDeviceId: string;
}

export interface PairingResponse {
    accessToken: string;
    relayUrl: string;
    desktopDeviceId: string;
}

export interface RelayAuthRequest {
    accessToken: string;
}

export interface RelayAuthResponse {
    valid: boolean;
    desktopDeviceId?: string;
    mobileDeviceId?: string;
}
