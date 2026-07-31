/**
 * mockEmailService — Sprint 9 Part 11.
 *
 * "No external email provider required. Mock email service is acceptable."
 * Simulates sending by logging + returning a delivery receipt; callers
 * (notificationService) persist the payload/receipt on the Notification
 * document itself so the "would-have-been-sent" email is inspectable from
 * the API without any real SMTP integration.
 */
export function sendMockEmail({ to, subject, body }) {
  const sentAt = new Date();
  console.log(`[mock-email] to=${to} subject="${subject}" at=${sentAt.toISOString()}`);
  return { sent: true, mock: true, to, subject, body, sentAt };
}
