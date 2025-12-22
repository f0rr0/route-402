export type LogFields = Record<string, unknown>;

export function logInfo(message: string, fields: LogFields = {}) {
  console.info(message, fields);
}

export function logWarn(message: string, fields: LogFields = {}) {
  console.warn(message, fields);
}

export function logError(message: string, fields: LogFields = {}) {
  console.error(message, fields);
}
