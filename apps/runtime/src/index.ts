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
  let stopPromise: Promise<void> | undefined;
  let resolveStopped: (() => void) | undefined;
  let rejectStopped: ((reason: unknown) => void) | undefined;
  const stoppedPromise = new Promise<void>((resolve, reject) => {
    resolveStopped = resolve;
    rejectStopped = reject;
  });

  const stop = (): Promise<void> => {
    stopPromise ??= (async (): Promise<void> => {
      clearInterval(descriptorMonitor);
      try {
        await controlApi.stop();
        resolveStopped?.();
      } catch (error) {
        rejectStopped?.(error);
        throw error;
      }
    })();
    return stopPromise;
  };

  const descriptorMonitor = setInterval(() => {
    void access(controlApi.descriptorPath).catch(() => {
      void stop().catch(() => {
        // The same failure is observable through stopped and an explicit stop call.
      });
    });
  }, descriptorPollIntervalMs);
  descriptorMonitor.unref();

  return Object.freeze({ controlApi, stopped: stoppedPromise, stop });
}
