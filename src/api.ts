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

export class PushExpressApiClient {
  private readonly normalizedBaseURL: string;

  constructor(baseURL: string) {
    // Убираем trailing slash для предотвращения двойного слэша в URL
    this.normalizedBaseURL = baseURL.replace(/\/+$/, '');
  }

  async createInstance(appId: string, request: CreateInstanceRequest): Promise<CreateInstanceResponse> {
    return this.post<CreateInstanceResponse>(`apps/${appId}/instances`, request);
  }

  async updateInfo(appId: string, icId: string, request: UpdateInfoRequest): Promise<UpdateInfoResponse> {
    return this.put<UpdateInfoResponse>(`apps/${appId}/instances/${icId}/info`, request);
  }

  async notificationEvent(appId: string, icId: string, msgId: string, event: 'delivered' | 'clicked'): Promise<void> {
    await this.postVoid(`apps/${appId}/instances/${icId}/events/notification`, { msg_id: msgId, event });
  }

  async lifecycleEvent(appId: string, icId: string, event: string): Promise<void> {
    await this.postVoid(`apps/${appId}/instances/${icId}/events/lifecycle`, { event });
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.normalizedBaseURL}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`PushExpress API error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  /** POST без парсинга тела ответа — для void endpoints (notification, lifecycle). */
  private async postVoid(path: string, body: unknown): Promise<void> {
    const response = await fetch(`${this.normalizedBaseURL}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`PushExpress API error: ${response.status} ${response.statusText}`);
    }
  }

  private async put<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.normalizedBaseURL}/${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`PushExpress API error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }
}
