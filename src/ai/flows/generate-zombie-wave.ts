'use server';

/**
 * @fileOverview Dynamically generates zombie wave configurations based on player performance.
 *
 * This file exports:
 * - `generateZombieWave`: A function to generate a wave of zombies with adjusted difficulty.
 * - `GenerateZombieWaveInput`: The input type for the generateZombieWave function.
 * - `GenerateZombieWaveOutput`: The return type for the generateZombieWave function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateZombieWaveInputSchema = z.object({
  waveNumber: z.number().describe('The current wave number. This will be 0 for the very first "wave", which should result in 0 zombies.'),
  playerScore: z.number().describe("The player's current score."),
  timeSurvived: z.number().describe('The time the player has survived in seconds.'),
  playerHealth: z.number().describe("The player's current health percentage (0-100)."),
});
export type GenerateZombieWaveInput = z.infer<typeof GenerateZombieWaveInputSchema>;

const GenerateZombieWaveOutputSchema = z.object({
  zombieCount: z.number().describe('The number of zombies to spawn in this wave.'),
  zombieSpeedMultiplier: z
    .number()
    .describe('A multiplier to adjust the speed of the zombies (e.g., 1.0 for normal speed, 1.5 for 50% faster).'),
  zombieHealthMultiplier: z
    .number()
    .describe('A multiplier to adjust the health of the zombies (e.g., 1.0 for normal health, 2.0 for double health).'),
  messageToPlayer: z.string().describe('A message to display to the player at the start of the wave.'),
});
export type GenerateZombieWaveOutput = z.infer<typeof GenerateZombieWaveOutputSchema>;

export async function generateZombieWave(input: GenerateZombieWaveInput): Promise<GenerateZombieWaveOutput> {
  return generateZombieWaveFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateZombieWavePrompt',
  input: {schema: GenerateZombieWaveInputSchema},
  output: {schema: GenerateZombieWaveOutputSchema},
  prompt: `You are the AI game director for Zombie Rampage. Your job is to create increasingly challenging waves of zombies based on the player's performance.

  IMPORTANT: For waveNumber 0, you MUST return a zombieCount of 0. This is the start of the game.

  Wave Number: {{{waveNumber}}}
  Player Score: {{{playerScore}}}
  Time Survived: {{{timeSurvived}}} seconds
  Player Health: {{{playerHealth}}}%

  Based on these factors, determine the following:

  - zombieCount: How many zombies should spawn this wave? Start with 0 zombies for wave 0. For wave 1, spawn a small number (e.g., 3-5). Increase it with each subsequent wave. The increase should be more significant in later waves.
  - zombieSpeedMultiplier: How fast should the zombies be? Keep it at 1.0 for the first few waves, then increase it gradually.
  - zombieHealthMultiplier: How much health should the zombies have? Keep it at 1.0 for the first few waves, then increase it gradually.
  - messageToPlayer: For wave 0, the message should be an empty string. For wave 1, it should be something like "Wave 1: Here they come!". For later waves, provide a short, encouraging or taunting message that includes the wave number, like "Wave 2: A few more for you!".

  Ensure the difficulty curve is smooth. The first few waves should be easy, and the challenge should ramp up.

  Output the data as JSON.`,
});

const generateZombieWaveFlow = ai.defineFlow(
  {
    name: 'generateZombieWaveFlow',
    inputSchema: GenerateZombieWaveInputSchema,
    outputSchema: GenerateZombieWaveOutputSchema,
  },
  async input => {
    // If wave number is 0, return a specific hardcoded response to avoid unnecessary API calls.
    if (input.waveNumber === 0) {
      return {
        zombieCount: 0,
        zombieSpeedMultiplier: 1.0,
        zombieHealthMultiplier: 1.0,
        messageToPlayer: "",
      };
    }
    
    const {output} = await prompt(input);
    return output!;
  }
);
