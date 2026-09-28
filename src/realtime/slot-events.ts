// Socket.IO event names and payloads. No customer data is ever included.
export const SlotEvent = {
  BOOKED: 'slot.booked',
  RELEASED: 'slot.released',
} as const;

export interface SlotEventPayload {
  slotId: string;
  bookingId: string;
  available: boolean;
}
