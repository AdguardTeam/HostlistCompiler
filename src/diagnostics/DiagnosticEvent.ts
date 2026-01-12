export interface DiagnosticEvent {
  eventId: string;
  correlationId: string;
  timestamp: number;
  category?: string;
  severity?: string;
  operation?: string;
  durationMs?: number;
  errorType?: string;
  errorMessage?: string;
  stack?: string;
  metric?: string;
  value?: number;
  unit?: string;
  dimensions?: Record<string, unknown>;
  key?: string;
  size?: number;
  method?: string;
  url?: string;
  statusCode?: number;
  responseSize?: number;
  // Add any other properties referenced in your test cases
}
