import { z } from 'zod';

export const parcelSchema = z.object({
  id: z.string().min(1).optional(),
  weight: z.number().nonnegative(),
  value: z.number().nonnegative(),
}).passthrough();

export const batchParcelsSchema = z.object({
  parcels: z.array(parcelSchema).min(1)
});

export type ParcelInput = z.infer<typeof parcelSchema>;
export type BatchParcelsInput = z.infer<typeof batchParcelsSchema>;
