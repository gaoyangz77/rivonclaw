export interface WsEnvelope<T = any> {
  type:
    | "msg"
    | "ack"
    | "sync_req"
    | "sync_res"
    | "error"
    | "reaction"
    | "tool_status"
    | "peer_status"
    | "unpair"
    | "reset_req"
    | "reset_ack";
  id: string;
  sender: "desktop" | "mobile";
  timestamp: number;
  payload?: T;
}
