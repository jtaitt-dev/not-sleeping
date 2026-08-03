import { z } from "zod";

const compactText = z.string().max(800);

export const aiDecisionOverlaySchema = z.object({
  recommendationId: z.string().max(100).nullable(),
  summary: z.string().min(1).max(1_500),
  adjustment: z.number().min(-8).max(8),
  confidenceDelta: z.number().min(-0.15).max(0.15),
  reasons: z.array(compactText).max(8),
  risks: z.array(compactText).max(8),
});

export type AiDecisionOverlayOutput = z.infer<typeof aiDecisionOverlaySchema>;
