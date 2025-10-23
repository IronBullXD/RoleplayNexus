export type LogType = 'INFO' | 'ERROR' | 'API_REQUEST' | 'API_RESPONSE' | 'STATE' | 'UI_EVENT';

export interface LogEntry {
  timestamp: Date;
  type: LogType;
  message: string;
  data?: unknown;
}

type Listener = () => void;

class Logger {
  private logs: LogEntry[] = [];
  private listeners: Set<Listener> = new Set();

  public addListener(listener: Listener): void {
    this.listeners.add(listener);
  }

  public removeListener(listener: Listener): void {
    this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(cb => cb());
  }

  private addEntry(type: LogType, message: string, data?: unknown): void {
    // Keep logs from growing indefinitely
    if (this.logs.length > 500) {
      this.logs.shift();
    }
    this.logs.push({ timestamp: new Date(), type, message, data });
    this.notifyListeners();
    
    // Add cleanup for old logs
    const now = Date.now();
    const MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
    this.logs = this.logs.filter(log => now - log.timestamp.getTime() < MAX_AGE);
  }

  public log(message: string, data?: unknown): void {
    this.addEntry('INFO', message, data);
  }

  public error(message: string, data?: unknown): void {
    console.error(message, data); // Also log to console for immediate visibility
    this.addEntry('ERROR', message, data);
  }
  
  public apiRequest(message: string, data?: unknown): void {
    this.addEntry('API_REQUEST', message, data);
  }
  
  public apiResponse(message: string, data?: unknown): void {
    this.addEntry('API_RESPONSE', message, data);
  }

  public uiEvent(message: string, data?: unknown): void {
    this.addEntry('UI_EVENT', message, data);
  }

  public getLogs(): Readonly<LogEntry[]> {
    return this.logs;
  }

  public clearLogs(): void {
    this.logs = [];
    this.notifyListeners();
  }
}

export const logger = new Logger();
