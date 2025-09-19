// src/ai/flows/generate-zombie-wave.ts
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
  waveNumber: z.number().describe('The current wave number.'),
  playerScore: z.number().describe('The player\'s current score.'),
  timeSurvived: z.number().describe('The time the player has survived in seconds.'),
  playerHealth: z.number().describe('The player\'s current health percentage (0-100).'),
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

  Wave Number: {{{waveNumber}}}
  Player Score: {{{playerScore}}}
  Time Survived: {{{timeSurvived}}} seconds
  Player Health: {{{playerHealth}}}%

  Based on these factors, determine the following:

  - zombieCount: How many zombies should spawn this wave? Start with a small number and increase it as the waves progress.
  - zombieSpeedMultiplier: How fast should the zombies be? Increase this gradually as the game progresses. A value of 1 is normal speed.
  - zombieHealthMultiplier: How much health should the zombies have? Increase this gradually as the game progresses. A value of 1 is normal health.
  - messageToPlayer: A short, encouraging or taunting message to display to the player at the start of the wave. Make it fun and engaging.

  Ensure the wave is challenging but not impossible based on the player's current state.

  Output the data as JSON in the following format:
  {
    "zombieCount": number,
    "zombieSpeedMultiplier": number,
    "zombieHealthMultiplier": number,
    "messageToPlayer": string
  }`,
});

const generateZombieWaveFlow = ai.defineFlow(
  {
    name: 'generateZombieWaveFlow',
    inputSchema: GenerateZombieWaveInputSchema,
    outputSchema: GenerateZombieWaveOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
