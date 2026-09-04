import { readFile } from 'node:fs/promises';
import { QuickJS } from 'quickjs-wasi';
import { CodeModeBridge } from './bridge';
import { CodeModeConfig } from './types';
import { CodeModeError } from './errors';

export interface RuntimeResult {
  value: unknown;
  output: string;
}

interface CatalogOptions {
  limit?: number;
}

async function loadWasm(): Promise<Uint8Array> {
  const packageJson = require.resolve(
    'quickjs-wasi/package.json'
  );

  const packageRoot = packageJson.substring(
    0,
    packageJson.lastIndexOf('/')
  );

  return new Uint8Array(
    await readFile(
      `${packageRoot}/quickjs.wasm`
    )
  );
}

function stringify(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  try {
    const result = JSON.stringify(value);
    return result === undefined
      ? String(value)
      : result;
  } catch {
    return String(value);
  }
}

function dumpHandle(vm: any, handle: any): unknown {
  return vm.dump(handle);
}

function disposeHandle(handle: any): void {
  if (
    handle &&
    typeof handle.dispose === 'function'
  ) {
    handle.dispose();
  }
}

function consumeHandle(
  handle: any,
  vm: any
): unknown {
  if (
    handle &&
    typeof handle.consume === 'function'
  ) {
    return handle.consume(
      (value: any) => vm.dump(value)
    );
  }

  return vm.dump(handle);
}

export class CodeModeRuntime {
  private wasm?: Uint8Array;

  async initialize(): Promise<void> {
    if (!this.wasm) {
      this.wasm = await loadWasm();
    }
  }

  async execute(
    code: string,
    bridge: CodeModeBridge,
    config: CodeModeConfig
  ): Promise<RuntimeResult> {
    if (
      typeof code !== 'string' ||
      code.trim().length === 0
    ) {
      throw new CodeModeError(
        'invalid_input',
        'Code Mode requires JavaScript or TypeScript source code.'
      );
    }

    await this.initialize();

    const started = Date.now();

    const vm: any = await QuickJS.create({
      wasm: this.wasm,
      memoryLimit:
        config.memoryLimitBytes,
      interruptHandler: () =>
        Date.now() - started >=
        config.timeoutMs
    });

    try {
      using catalogHandle =
        vm.newObject();

      using searchFn =
        vm.newFunction(
          'search',
          (
            queryHandle: any,
            optionsHandle: any
          ) => {
            const queryValue =
              queryHandle
                ? vm.dump(queryHandle)
                : '';

            const optionsValue =
              optionsHandle
                ? vm.dump(optionsHandle)
                : {};

            const options =
              (optionsValue || {}) as CatalogOptions;

            const items =
              bridge.catalog
                .search(
                  String(
                    queryValue || ''
                  ),
                  options.limit
                )
                .map(handle => ({
                  callableName:
                    handle.callableName,
                  toolName:
                    handle.toolName,
                  label:
                    handle.label,
                  description:
                    handle.description,
                  source:
                    handle.source,
                  input:
                    handle.input,
                  output:
                    handle.output
                }));

            return vm.hostToHandle(items);
          }
        );

      using allFn =
        vm.newFunction(
          'all',
          () => {
            const items =
              bridge.catalog
                .all()
                .map(handle => ({
                  callableName:
                    handle.callableName,
                  toolName:
                    handle.toolName,
                  label:
                    handle.label,
                  description:
                    handle.description,
                  source:
                    handle.source,
                  input:
                    handle.input,
                  output:
                    handle.output
                }));

            return vm.hostToHandle(items);
          }
        );

      using callFn =
        vm.newFunction(
          '__call_tool',
          (
            nameHandle: any,
            inputHandle: any
          ) => {
            const name =
              String(
                vm.dump(nameHandle)
              );

            const input =
              inputHandle
                ? vm.dump(inputHandle)
                : null;

            const promise =
              vm.newPromise();

            void bridge
              .call(name, input)
              .then(value => {
                using valueHandle =
                  vm.hostToHandle(value);

                promise.resolve(
                  valueHandle
                );

                disposeHandle(
                  valueHandle
                );
              })
              .catch(error => {
                using errorHandle =
                  vm.newError(
                    error instanceof Error
                      ? error
                      : new Error(
                          String(error)
                        )
                  );

                promise.reject(
                  errorHandle
                );

                disposeHandle(
                  errorHandle
                );
              });

            return promise.handle;
          }
        );

      vm.setProp(
        catalogHandle,
        'search',
        searchFn
      );

      vm.setProp(
        catalogHandle,
        'all',
        allFn
      );

      vm.setProp(
        catalogHandle,
        '__call_tool',
        callFn
      );

      using bootstrap =
        vm.evalCode(
          `
            globalThis.catalog = {
              search: catalog.search,
              all: catalog.all
            };

            globalThis.__call_tool =
              catalog.__call_tool;

            globalThis.__bind =
              function(name) {
                return async function(input) {
                  return await __call_tool(
                    name,
                    input
                  );
                };
              };

            globalThis.text =
              function(value) {
                return String(value);
              };

            globalThis.json =
              function(value) {
                return JSON.stringify(value);
              };
          `,
          '<code-mode-bootstrap>'
        );

      if (bootstrap.isError) {
        const error =
          dumpHandle(
            vm,
            bootstrap
          );

        throw new CodeModeError(
          'internal_error',
          stringify(error)
        );
      }

      const executable =
        `
          (async function() {
            ${code}
          })()
        `;

      using result =
        vm.evalCode(
          executable,
          '<code-mode>'
        );

      if (result.isError) {
        const error =
          dumpHandle(
            vm,
            result
          );

        throw new CodeModeError(
          'internal_error',
          stringify(error)
        );
      }

      const resolved =
        await vm.resolvePromise(
          result
        );

      if (resolved.isError) {
        const error =
          dumpHandle(
            vm,
            resolved
          );

        throw new CodeModeError(
          'internal_error',
          stringify(error)
        );
      }

      const value =
        consumeHandle(
          resolved,
          vm
        );

      const output =
        stringify(value);

      if (
        Buffer.byteLength(
          output,
          'utf8'
        ) > config.maxOutputBytes
      ) {
        throw new CodeModeError(
          'output_limit_exceeded',
          `Code Mode output exceeded ${config.maxOutputBytes} bytes`
        );
      }

      return {
        value,
        output
      };
    } catch (error: any) {
      if (
        error instanceof CodeModeError
      ) {
        throw error;
      }

      const message =
        error?.message ||
        String(error);

      const lower =
        message.toLowerCase();

      if (
        lower.includes('interrupt') ||
        lower.includes('timeout')
      ) {
        throw new CodeModeError(
          'timeout',
          `Code Mode execution exceeded ${config.timeoutMs}ms`
        );
      }

      throw new CodeModeError(
        'internal_error',
        message
      );
    } finally {
      vm.dispose();
    }
  }
}
