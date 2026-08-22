// Wrapper de logging — règle CLAUDE.md §6 : pas de console.log en prod.
// En dev : log dans la console.
// En prod : forward vers Sentry (no-op si Sentry n'est pas initialisé).

import { Sentry } from './sentry';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const isDev = __DEV__;

function format(level: LogLevel, message: string, context?: unknown): string {
  const ctx = context ? ` ${JSON.stringify(context)}` : '';
  return `[${level.toUpperCase()}] ${message}${ctx}`;
}

export const logger = {
  debug(message: string, context?: unknown) {
    if (isDev) {
      console.warn(format('debug', message, context));
    }
  },

  info(message: string, context?: unknown) {
    if (isDev) {
      console.warn(format('info', message, context));
    }
    Sentry.addBreadcrumb({
      category: 'info',
      message,
      level: 'info',
      data: context as Record<string, unknown> | undefined,
    });
  },

  warn(message: string, context?: unknown) {
    console.warn(format('warn', message, context));
    Sentry.captureMessage(message, {
      level: 'warning',
      extra: { context },
    });
  },

  error(message: string, error?: unknown) {
    console.error(format('error', message), error);
    if (error instanceof Error) {
      Sentry.captureException(error);
    } else {
      Sentry.captureMessage(message, {
        level: 'error',
        extra: { error },
      });
    }
  },
};
