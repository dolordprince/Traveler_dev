import { exec } from 'child_process';
import { promisify } from 'util';
import { Tool } from './registry';

const execAsync = promisify(exec);

export const needlePhoneTool: Tool = {
  name: 'needle_phone_control',
  description: 'Control Android phone hardware features (battery, sms, camera, notifications, termux-api).',
  parameters: {
    type: 'object',
    properties: {
      feature: { type: 'string', enum: ['battery', 'sms_send', 'vibrate', 'toast', 'shizuku_exec'] },
      payload: { type: 'string', description: 'JSON string of args like message, recipient, or shell cmd' },
    },
    required: ['feature'],
  },
  execute: async ({ feature, payload }) => {
    try {
      let command = '';
      const parsed = payload ? JSON.parse(payload) : {};
      switch (feature) {
        case 'battery':
          command = 'termux-battery-status';
          break;
        case 'toast':
          command = `termux-toast "${parsed.text || 'Notification'}"`;
          break;
        case 'sms_send':
          command = `termux-sms-send -n ${parsed.number} "${parsed.message}"`;
          break;
        case 'vibrate':
          command = 'termux-vibrate -d 500';
          break;
        case 'shizuku_exec':
          command = `bash ~/Needle/shizuku_runner.sh "${parsed.cmd}"`;
          break;
      }
      const { stdout } = await execAsync(command);
      return JSON.stringify({ output: stdout.trim(), status: 'executed' });
    } catch (err: any) {
      return JSON.stringify({ error: err.message });
    }
  },
};
