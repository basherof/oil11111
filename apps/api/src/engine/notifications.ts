import { DataStore } from './store';
import { AuditService } from './audit';
import { AutomationService } from './automation';
import { ExceptionService } from './exceptions';
import { MessagingProvider } from './providers';
import { Booking } from './state-machine';

/** State-change → WhatsApp template map (doc 13 §13.12). */
export const STATE_TEMPLATES: Record<string, string> = {
  draft: 'welcome',
  ai_planned: 'trip_plan_generated',
  quotation_generated: 'quotation_ready',
  awaiting_payment: 'payment_reference_created',
  payment_received: 'payment_received',
  supplier_confirmation_pending: 'processing_update',
  confirmed: 'booking_confirmed',
  ticket_issued: 'ticket_issued',
  voucher_issued: 'hotel_voucher_issued',
  documents_delivered: 'documents_delivered',
  pre_travel_reminders_active: 'travel_reminder_armed',
  in_travel: 'in_travel_support',
  completed: 'review_request',
  refunded: 'refund_status_update',
};

export class NotificationService {
  constructor(
    private store: DataStore,
    private audit: AuditService,
    private automation: AutomationService,
    private exceptions: ExceptionService,
    private whatsapp: MessagingProvider,
    private email: MessagingProvider,
  ) {}

  /** Bound to StateMachine.onTransition — every state change fires its template automatically. */
  async onStateChange(booking: Booking, _from: string, to: string) {
    const template = STATE_TEMPLATES[to];
    if (!template) return;
    await this.sendWhatsApp(booking, template, { state: to });
  }

  async sendWhatsApp(booking: Booking, template: string, vars: Record<string, any> = {}) {
    const setting = await this.automation.get('whatsapp_messages');
    if (setting.killSwitchActive) {
      await this.audit.log({ actorType: 'system', action: 'whatsapp_skipped_killswitch', bookingId: booking.id, data: { template } });
      return { ok: false, skipped: true };
    }
    const maxRetries = setting.params?.maxRetries ?? 2;
    let last: { ok: boolean; error?: string } = { ok: false };
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      last = await this.whatsapp.send(booking.customerPhone, template, { reference: booking.reference, name: booking.customerName, ...vars });
      await this.store.insert('messages', {
        bookingId: booking.id, channel: 'whatsapp', template, to: booking.customerPhone,
        status: last.ok ? 'sent' : 'failed', attempt: attempt + 1, error: (last as any).error, providerMode: this.whatsapp.mode,
      });
      if (last.ok) break;
    }
    if (!last.ok) {
      // fallback to email, then non-blocking exception (doc 13 §13.10, §13.12)
      const fb = await this.email.send(booking.customerPhone, template, vars);
      await this.store.insert('messages', { bookingId: booking.id, channel: 'email_fallback', template, status: fb.ok ? 'sent' : 'failed', providerMode: this.email.mode });
      await this.audit.log({ actorType: 'system', action: 'whatsapp_fallback_email', bookingId: booking.id, data: { template }, result: fb.ok ? 'ok' : 'failed' });
      await this.exceptions.raise('whatsapp_delivery_failed', booking.id, `WhatsApp delivery failed after ${maxRetries + 1} attempts (template ${template})`, { template, fallbackEmail: fb.ok });
      return { ok: false, fellBack: fb.ok };
    }
    await this.audit.log({ actorType: 'system', action: 'whatsapp_sent', bookingId: booking.id, data: { template }, result: 'ok' });
    return { ok: true };
  }

  async messagesFor(bookingId: string) {
    return this.store.find('messages', { bookingId });
  }
}
