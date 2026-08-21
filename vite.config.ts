import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, '../..');
const WEB = __dirname;
const WEB_CORE = path.resolve(WEB, '../web-core');
const SHARED = path.resolve(ROOT, 'shared');
const PUBLIC = path.resolve(WEB, 'public');

function executorSchemasPlugin(): Plugin {
  const VIRTUAL_ID = 'virtual:executor-schemas';
  const RESOLVED_VIRTUAL_ID = `\0${VIRTUAL_ID}`;

  return {
    name: 'executor-schemas-plugin',

    resolveId(id) {
      if (id === VIRTUAL_ID) {
        return RESOLVED_VIRTUAL_ID;
      }

      return null;
    },

    load(id) {
      if (id !== RESOLVED_VIRTUAL_ID) {
        return null;
      }

      const schemasDir = path.resolve(ROOT, 'shared/schemas');

      if (!fs.existsSync(schemasDir)) {
        throw new Error(
          `Executor schema directory does not exist: ${schemasDir}`,
        );
      }

      const files = fs
        .readdirSync(schemasDir)
        .filter((file) => file.endsWith('.json'))
        .sort();

      if (files.length === 0) {
        throw new Error(
          `No executor schema JSON files found in ${schemasDir}`,
        );
      }

      const imports: string[] = [];
      const entries: string[] = [];

      files.forEach((file, index) => {
        const variable = `__schema_${index}`;
        const absolutePath = path.resolve(schemasDir, file);

        imports.push(
          `import ${variable} from ${JSON.stringify(absolutePath)};`,
        );

        const key = file
          .replace(/\.json$/i, '')
          .toUpperCase();

        entries.push(`  ${JSON.stringify(key)}: ${variable}`);
      });

      return `
${imports.join('\n')}

const schemas = {
${entries.join(',\n')}
};

export { schemas };
export default schemas;
`;
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    executorSchemasPlugin(),
  ],

  base: '/',

  publicDir: PUBLIC,

  resolve: {
    alias: [
      {
        find: '@web',
        replacement: path.resolve(WEB, 'src'),
      },
      {
        find: '@',
        replacement: path.resolve(WEB_CORE, 'src'),
      },
      {
        find: /^shared$/,
        replacement: SHARED,
      },
      {
        find: /^shared\/(.*)$/,
        replacement: path.resolve(SHARED, '$1'),
      },
    ],
  },

  server: {
    port: 10000,
    fs: {
      allow: [
        WEB,
        WEB_CORE,
        SHARED,
        ROOT,
      ],
    },
  },

  build: {
    outDir: path.resolve(WEB, 'dist'),
    sourcemap: false,
    chunkSizeWarningLimit: 1600,
  },
});
