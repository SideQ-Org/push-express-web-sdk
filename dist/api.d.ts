export interface CreateInstanceRequest {
    ic_token: string;
    ext_id?: string;
}
export interface CreateInstanceResponse {
    id: string;
    just_created: boolean;
}
export interface UpdateInfoRequest {
    transport_type: string;
    transport_token: string;
    platform_type: string;
    platform_name: string;
    ext_id?: string;
    lang: string;
    country: string;
    tz_sec: number;
    tags?: Record<string, string>;
    onscreen_count: number;
    onscreen_sec: number;
    agent_name: string;
}
export interface UpdateInfoResponse {
    id: string;
    update_interval_sec: number;
}
export declare class PushExpressApiClient {
    private readonly normalizedBaseURL;
    constructor(baseURL: string);
    createInstance(appId: string, request: CreateInstanceRequest): Promise<CreateInstanceResponse>;
    updateInfo(appId: string, icId: string, request: UpdateInfoRequest): Promise<UpdateInfoResponse>;
    notificationEvent(appId: string, icId: string, msgId: string, event: 'delivered' | 'clicked'): Promise<void>;
    lifecycleEvent(appId: string, icId: string, event: string): Promise<void>;
    private post;
    /** POST без парсинга тела ответа — для void endpoints (notification, lifecycle). */
    private postVoid;
    private put;
}
