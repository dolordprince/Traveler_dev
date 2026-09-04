import { buildProject } from './build';
import {
  startPreview,
  stopPreview,
} from './preview';

const stringify = (
  value: unknown,
): string =>
  JSON.stringify(
    value,
    null,
    2,
  );

export const buildTool = {
  name: 'build_project',

  description:
    'Detect and compile a real project using its actual build system. Supports web, Node, Rust, WASM, Dioxus, Leptos, Yew, Bevy, wgpu and Tauri projects.',

  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
      },
    },
    required: ['path'],
    additionalProperties: false,
  },

  async execute(
    args: { path: string },
  ): Promise<string> {
    return stringify(
      await buildProject(
        args.path,
      ),
    );
  },
};

export const previewTool = {
  name: 'preview_project',

  description:
    'Start a real local HTTP preview and verify it with an actual HTTP request.',

  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
      },
    },
    required: ['path'],
    additionalProperties: false,
  },

  async execute(
    args: { path: string },
  ): Promise<string> {
    return stringify(
      await startPreview(
        args.path,
      ),
    );
  },
};

export const stopPreviewTool = {
  name: 'stop_preview',

  description:
    'Stop a real local preview process by its port.',

  parameters: {
    type: 'object',
    properties: {
      port: {
        type: 'number',
      },
    },
    required: ['port'],
    additionalProperties: false,
  },

  async execute(
    args: { port: number },
  ): Promise<string> {
    return stringify({
      success:
        stopPreview(
          args.port,
        ),
      port: args.port,
    });
  },
};
