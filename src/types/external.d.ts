declare module "node-cron" {
  export function schedule(
    expression: string,
    task: () => void,
    options?: {
      timezone?: string;
    },
  ): {
    stop(): void;
    start(): void;
  };

  const cron: {
    schedule: typeof schedule;
  };

  export default cron;
}

declare module "yaml" {
  export function parse(input: string): any;

  const YAML: {
    parse: typeof parse;
  };

  export default YAML;
}
