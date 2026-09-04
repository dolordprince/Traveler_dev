import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const EDNA_VOICE_ID = process.env.EDNA_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL';
const ELEVEN_KEY   = process.env.ELEVENLABS_API_KEY || '';
const AUDIO_DIR    = path.join(process.cwd(), 'data_memory', 'edna_audio');

function downloadAudio(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', reject);
  });
}

async function speak(text: string): Promise<string> {
  if (!ELEVEN_KEY) throw new Error('ELEVENLABS_API_KEY not set in .env');
  fs.mkdirSync(AUDIO_DIR, { recursive: true });

  const body = JSON.stringify({
    text,
    model_id: 'eleven_monolingual_v1',
    voice_settings: { stability: 0.5, similarity_boost: 0.85 }
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.elevenlabs.io',
      path: `/v1/text-to-speech/${EDNA_VOICE_ID}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': ELEVEN_KEY,
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      if (res.statusCode !== 200) {
        let err = '';
        res.on('data', (d: Buffer) => err += d.toString());
        res.on('end', () => reject(new Error('ElevenLabs ' + res.statusCode + ': ' + err.slice(0, 200))));
        return;
      }

      const outPath = path.join(AUDIO_DIR, 'edna_' + Date.now() + '.mp3');
      const file = fs.createWriteStream(outPath);
      res.pipe(file);
      file.on('finish', async () => {
        file.close();
        // Play audio — try multiple players available in proot/Termux
        const players = ['mpg123', 'ffplay -nodisp -autoexit', 'aplay', 'play'];
        let played = false;
        for (const player of players) {
          try {
            await execAsync(player + ' ' + outPath + ' 2>/dev/null');
            played = true;
            break;
          } catch (_) {}
        }
        if (!played) {
          resolve('Audio saved to ' + outPath + ' (no player found — copy to device to hear)');
        } else {
          resolve('Edna spoke: ' + text.slice(0, 80));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

export const ednaTTSTool = {
  name: 'edna_speak',
  description: 'Edna (AI voice assistant) speaks a message aloud using ElevenLabs TTS. Use this to give spoken reports, confirmations, and status updates.',
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'What Edna should say (max 500 chars)' }
    },
    required: ['text']
  },
  execute: async (args: { text: string }): Promise<string> => {
    try {
      return await speak(args.text.slice(0, 500));
    } catch (e: any) {
      return 'Edna TTS Error: ' + e.message;
    }
  }
};

export { speak as ednaSpeak };
