// Embed the pending notices with their request in the same database document.
// This avoids reporting a saved request while silently losing its notification.
export type PendingRequestNotice = { id: string; audience: "staff" | "customer"; state: "provider-not-configured"; attempts: 0; createdAt: Date };
export function pendingRequestNotices(requestId: string, now: Date): PendingRequestNotice[] {
  return (["staff", "customer"] as const).map((audience) => ({ id: `${requestId}-${audience}`, audience, state: "provider-not-configured", attempts: 0, createdAt: now }));
}
export interface NotificationProvider { readonly enabled: boolean; deliver(input: { notificationId: string; recipient: string; subject: string; body: string }): Promise<{ messageId: string }> }
export const disabledNotificationProvider: NotificationProvider = { enabled: false, async deliver() { throw new Error("Notification provider is not configured"); } };
