export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

function write(
  level: "DEBUG" | "INFO" | "WARN" | "ERROR",
  message: string,
  context?: Record<string, unknown>,
): void {
  const suffix = context ? ` ${JSON.stringify(context)}` : "";
  const line = `[${new Date().toISOString()}] ${level} ${message}${suffix}`;

  if (level === "ERROR") {
    console.error(line);
    return;
  }

  if (level === "WARN") {
    console.warn(line);
    return;
  }

  console.log(line);
}

export const logger: Logger = {
  debug(message, context) {
    write("DEBUG", message, context);
  },
  info(message, context) {
    write("INFO", message, context);
  },
  warn(message, context) {
    write("WARN", message, context);
  },
  error(message, context) {
    write("ERROR", message, context);
  },
};
