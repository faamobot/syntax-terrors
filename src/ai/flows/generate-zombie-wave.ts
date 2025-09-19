'use server';

/**
 * @fileOverview Dynamically generates zombie wave configurations based on deterministic logic.
 *
 * This file exports:
 * - `generateZombieWave`: A function to generate a wave of zombies with adjusted difficulty.
 * - `GenerateZombieWaveInput`: The input type for the generateZombieWave function.
 * - `GenerateZombieWaveOutput`: The return type for the generateZombiewave function.
 */

import {z} from 'genkit';

const GenerateZombieWaveInputSchema = z.object({
  waveNumber: z.number().describe('The current wave number. This will be 0 for the very first "wave", which should result in 0 zombies.'),
  difficulty: z.enum(['easy', 'normal', 'hard']).default('normal').describe('The game difficulty.'),
});
export type GenerateZombieWaveInput = z.infer<typeof GenerateZombieWaveInputSchema>;

const ZombieSchema = z.object({
    type: z.enum(['walker', 'runner', 'brute']),
    health: z.number(),
    speed: z.number(),
});
export type ZombieData = z.infer<typeof ZombieSchema>;

const GenerateZombieWaveOutputSchema = z.object({
  zombies: z.array(ZombieSchema).describe('An array of zombies to spawn for the current wave.'),
  messageToPlayer: z.string().describe('A message to display to the player at the start of the wave.'),
});
export type GenerateZombieWaveOutput = z.infer<typeof GenerateZombieWaveOutputSchema>;

function pickType(i: number): 'walker' | 'runner' | 'brute' {
    const typeIndex = i % 10; // Creates a repeating pattern
    if (typeIndex < 6) return "walker"; // 60% walkers
    if (typeIndex < 9) return "runner"; // 30% runners
    return "brute"; // 10% brutes
}

export async function generateZombieWave(input: GenerateZombieWaveInput): Promise<GenerateZombieWaveOutput> {
  const { waveNumber, difficulty } = input;

  if (waveNumber === 0) {
    return {
      zombies: [],
      messageToPlayer: "",
    };
  }

  const baseCount = ({ easy: 6, normal: 12, hard: 22 })[difficulty] || 12;
  const count = Math.ceil(baseCount * (1 + (waveNumber - 1) * 0.15));
  
  const zombies = [];
  for (let i = 0; i < count; i++) {
    const type = pickType(i);
    const speedBase = { walker: 0.02, runner: 0.04, brute: 0.01 }[type];
    const speedVariation = ((i % 5) / 5) * 0.15; // Deterministic variation

    zombies.push({
      type,
      health: 100, // Standardized health
      speed: speedBase * (1 + speedVariation + waveNumber * 0.02),
    });
  }

  const messageToPlayer = `Wave ${waveNumber}: Here they come!`;

  return { zombies, messageToPlayer };
}
