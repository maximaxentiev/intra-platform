import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { mapShiftFulfillmentSearchToCentreUsage } from "@/lib/reports-shift-fulfillment-redirect";

const metricFilterSchema = {
  totalShiftsMin: z.string().optional(),
  totalShiftsMax: z.string().optional(),
  fillRateMin: z.string().optional(),
  fillRateMax: z.string().optional(),
  pendingMin: z.string().optional(),
  pendingMax: z.string().optional(),
  filledMin: z.string().optional(),
  filledMax: z.string().optional(),
  completedMin: z.string().optional(),
  completedMax: z.string().optional(),
  cancelledMin: z.string().optional(),
  cancelledMax: z.string().optional(),
};

const searchSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  centreIds: z.string().optional(),
  centreId: z.string().optional(),
  page: z.coerce.number().optional(),
  pageSize: z.coerce.number().optional(),
  ...metricFilterSchema,
});

export const Route = createFileRoute("/_authenticated/reports/shift-fulfillment")({
  validateSearch: (search) => searchSchema.parse(search),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/reports/centre-usage",
      search: mapShiftFulfillmentSearchToCentreUsage(search),
      replace: true,
    });
  },
});
