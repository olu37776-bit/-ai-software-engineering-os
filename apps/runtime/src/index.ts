import { access } from "node:fs/promises";

import {
  startControlApi,
  type ControlApiRuntime,
  type StartControlApiOptions,
} from "@aseos/platform";

export type RuntimeOptions = StartControlApiOptions;

export interface RunningRuntime {
  readonly controlApi: ControlApiRuntime;
  readonly stopped: Promise<void>;
  stop(): Promise<void>;
}

const descriptorPollIntervalMs = 50;

export async function startRuntime(options: RuntimeOptions): Promise<RunningRuntime> {
  const controlApi = await startControlApi(options);
  let stopped = false;
  let resolveStopped: (() => void) | undefined;
  const stoppedPromise = new Promise<void>((resolve) => {
    resolveStopped = resolve;
  });

  const stop = async (): Promise<void> => {
    if (stopped) return;
    stopped = true;
    clearInterval(descriptorMonitor);
    await controlApi.stop();
    resolveStopped?.();
  };

  const descriptorMonitor = setInterval(() => {
    void access(controlApi.descriptorPath).catch(() => {
      if (stopped) return;
      stopped = true;
      clearInterval(descriptorMonitor);
      resolveStopped?.();
    });
  }, descriptorPollIntervalMs);
  descriptorMonitor.unref();

  return Object.freeze({ controlApi, stopped: stoppedPromise, stop });
}
