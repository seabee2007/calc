import readline from 'node:readline';

export async function manualStep(message: string): Promise<void> {
  console.log('\n--- MANUAL STEP REQUIRED ---');
  console.log(message);
  console.log('Press Enter in this terminal to continue...\n');

  if (!process.stdin.isTTY) {
    throw new Error(
      'Manual step required but stdin is not a TTY. Run qa:e2e-gates in an interactive terminal, or fix automated login.',
    );
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  await new Promise<void>((resolve) => {
    rl.question('', () => {
      rl.close();
      resolve();
    });
  });
}
