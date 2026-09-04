import { AgentOrchestrator } from '../core/agent';

async function main() {
  const args = process.argv.slice(2);
  const prompt = args.join(' ') || 'Check workspace status and summarize active tools.';

  console.log(`[CLI] Initializing Agent with GLM via tokenrouter.com...`);
  const agent = new AgentOrchestrator();

  try {
    const response = await agent.run(prompt);
    console.log(`\n[Agent Output]:\n${response}`);
  } catch (err: any) {
    console.error(`[Agent Error]: ${err.message}`);
    process.exit(1);
  }
}

main();
