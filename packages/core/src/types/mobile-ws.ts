export interface WsEnvelope<T = any> {
    type: 'msg' | 'ack' | 'sync_req' | 'sync_res' | 'error';
    id: string;
    sender: 'desktop' | 'mobile';
    timestamp: number;
    payload?: T;
}
