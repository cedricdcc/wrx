

export interface LogEvent {
  level: string;
  msg: string;
  time: number;
  source?: string;
  stage?: number;
  extraction?: string;
  uri?: string;
  [key: string]: any;
}

export type LogListener = (event: LogEvent) => void;
const listeners: Set<LogListener> = new Set();

export function addLogListener(callback: LogListener) {
  listeners.add(callback);
}

export function removeLogListener(callback: LogListener) {
  listeners.delete(callback);
}

const PINO_LEVELS: Record<number, string> = {
  10: 'trace',
  20: 'debug',
  30: 'info',
  40: 'warn',
  50: 'error',
  60: 'fatal',
};

const LEVEL_SEVERITY: Record<string, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

const isBrowser = typeof window !== 'undefined' || typeof document !== 'undefined';

// Get default level
let currentLevel = 'debug';
if (typeof process !== 'undefined' && process.env) {
  currentLevel = process.env.WRX_LOG_LEVEL || process.env.LOG_LEVEL || 'debug';
}

// Ensure the level is valid
if (!LEVEL_SEVERITY[currentLevel]) {
  currentLevel = 'debug';
}

function triggerListeners(event: LogEvent) {
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch {
      // ignore listener failures
    }
  });
}

// We will construct the logger. If it fails or we want custom behavior, we wrap it.
let pinoLogger: any = null;

if (!isBrowser) {
  import(/* @vite-ignore */ 'pino')
    .then((pinoModule) => {
      const pino = pinoModule.default || pinoModule.pino || pinoModule;
      pinoLogger = pino({
        level: currentLevel,
      }, {
        write(str: string) {
          try {
            const obj = JSON.parse(str);
            const levelNum = obj.level;
            const level = PINO_LEVELS[levelNum] || 'info';
            
            const event: LogEvent = {
              ...obj,
              level,
              msg: obj.msg,
              time: obj.time || Date.now(),
            };
            delete (event as any).v;
            
            triggerListeners(event);

            // Pretty-print to stderr in Node/Bun TTY
            const timeStr = new Date(event.time).toISOString().split('T')[1].slice(0, -1);
            let colorStart = '';
            let colorEnd = '\x1b[0m';
            switch (level) {
              case 'debug': colorStart = '\x1b[36m'; break; // cyan
              case 'info': colorStart = '\x1b[32m'; break; // green
              case 'warn': colorStart = '\x1b[33m'; break; // yellow
              case 'error': colorStart = '\x1b[31m'; break; // red
              case 'fatal': colorStart = '\x1b[35m'; break; // magenta
            }
            
            let extra = '';
            const keysToSkip = ['level', 'msg', 'time', 'v'];
            const meta: Record<string, any> = {};
            for (const k of Object.keys(event)) {
              if (!keysToSkip.includes(k)) {
                meta[k] = event[k];
              }
            }
            if (Object.keys(meta).length > 0) {
              extra = ' ' + JSON.stringify(meta);
            }

            const formatted = `[${timeStr}] ${colorStart}${level.toUpperCase()}${colorEnd}: ${event.msg}${extra}`;
            console.error(formatted);
          } catch {
            console.error(str.trim());
          }
        }
      });
    })
    .catch(() => {
      // Defensive fallback in case Pino loading has issues
    });
}

// Wrapper interface to match Pino
export interface Logger {
  trace(msg: string, ...args: any[]): void;
  trace(obj: object, msg?: string, ...args: any[]): void;
  debug(msg: string, ...args: any[]): void;
  debug(obj: object, msg?: string, ...args: any[]): void;
  info(msg: string, ...args: any[]): void;
  info(obj: object, msg?: string, ...args: any[]): void;
  warn(msg: string, ...args: any[]): void;
  warn(obj: object, msg?: string, ...args: any[]): void;
  error(msg: string, ...args: any[]): void;
  error(obj: object, msg?: string, ...args: any[]): void;
  fatal(msg: string, ...args: any[]): void;
  fatal(obj: object, msg?: string, ...args: any[]): void;
}

function formatMsg(msg: string, args: any[]): string {
  if (args.length === 0) return msg;
  let formatted = msg;
  for (const arg of args) {
    const str = typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
    if (formatted.includes('%s')) {
      formatted = formatted.replace('%s', str);
    } else if (formatted.includes('%o') || formatted.includes('%O')) {
      formatted = formatted.replace(/%[oO]/, str);
    } else if (formatted.includes('%d')) {
      formatted = formatted.replace('%d', str);
    } else {
      formatted += ' ' + str;
    }
  }
  return formatted;
}

function logToFallback(level: string, first: any, second?: any, ...args: any[]) {
  const severity = LEVEL_SEVERITY[level] || 30;
  const currentSeverity = LEVEL_SEVERITY[currentLevel] || 30;
  if (severity < currentSeverity) return;

  let obj: any = {};
  let msg = '';
  if (typeof first === 'object' && first !== null) {
    obj = first;
    msg = second ? formatMsg(second, args) : '';
  } else {
    msg = first ? formatMsg(first, [second, ...args].filter(x => x !== undefined)) : '';
  }

  const event: LogEvent = {
    ...obj,
    level,
    msg,
    time: Date.now(),
  };

  triggerListeners(event);

  if (isBrowser) {
    const method = level === 'warn' ? 'warn' : level === 'error' ? 'error' : 'log';
    console[method](`[WRX ${level.toUpperCase()}] ${msg}`, event);
  } else {
    const timeStr = new Date(event.time).toISOString().split('T')[1].slice(0, -1);
    let colorStart = '';
    let colorEnd = '\x1b[0m';
    switch (level) {
      case 'debug': colorStart = '\x1b[36m'; break;
      case 'info': colorStart = '\x1b[32m'; break;
      case 'warn': colorStart = '\x1b[33m'; break;
      case 'error': colorStart = '\x1b[31m'; break;
      case 'fatal': colorStart = '\x1b[35m'; break;
    }
    let extra = '';
    const keysToSkip = ['level', 'msg', 'time'];
    const meta: Record<string, any> = {};
    for (const k of Object.keys(event)) {
      if (!keysToSkip.includes(k)) {
        meta[k] = event[k];
      }
    }
    if (Object.keys(meta).length > 0) {
      extra = ' ' + JSON.stringify(meta);
    }
    const formatted = `[${timeStr}] ${colorStart}${level.toUpperCase()}${colorEnd}: ${msg}${extra}`;
    console.error(formatted);
  }
}

export const logger: Logger = {
  trace(first: any, ...args: any[]) {
    if (pinoLogger) {
      pinoLogger.trace(first, ...args);
    } else {
      logToFallback('trace', first, ...args);
    }
  },
  debug(first: any, ...args: any[]) {
    if (pinoLogger) {
      pinoLogger.debug(first, ...args);
    } else {
      logToFallback('debug', first, ...args);
    }
  },
  info(first: any, ...args: any[]) {
    if (pinoLogger) {
      pinoLogger.info(first, ...args);
    } else {
      logToFallback('info', first, ...args);
    }
  },
  warn(first: any, ...args: any[]) {
    if (pinoLogger) {
      pinoLogger.warn(first, ...args);
    } else {
      logToFallback('warn', first, ...args);
    }
  },
  error(first: any, ...args: any[]) {
    if (pinoLogger) {
      pinoLogger.error(first, ...args);
    } else {
      logToFallback('error', first, ...args);
    }
  },
  fatal(first: any, ...args: any[]) {
    if (pinoLogger) {
      pinoLogger.fatal(first, ...args);
    } else {
      logToFallback('fatal', first, ...args);
    }
  }
};

export function setLogLevel(level: string) {
  const normalizedLevel = level.toLowerCase();
  if (LEVEL_SEVERITY[normalizedLevel]) {
    currentLevel = normalizedLevel;
    if (pinoLogger) {
      pinoLogger.level = normalizedLevel;
    }
  }
}
