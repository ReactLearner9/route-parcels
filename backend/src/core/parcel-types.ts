import { z } from 'zod';

export const parcelSchema = z.object({
  id: z.string().min(1),
  weight: z.number().nonnegative(),
  value: z.number().nonnegative(),
  destinationCountry: z.string().min(1).optional(),
  isFragile: z.boolean().optional()
}).passthrough();

export const batchParcelsSchema = z.object({
  parcels: z.array(parcelSchema).min(1)
});

export type ParcelInput = z.infer<typeof parcelSchema>;
export type BatchParcelsInput = z.infer<typeof batchParcelsSchema>;
