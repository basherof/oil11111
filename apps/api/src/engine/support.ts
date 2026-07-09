import { DataStore } from './store';
import { AuditService } from './audit';
import { BookingService } from './booking';
import { StateMachine } from './state-machine';

export interface Ticket {
  id: string; number: string; customerId?: string; customerName: string; customerPhone?: string;
  bookingId?: string; bookingReference?: string;
  category: 'flight' | 'hotel' | 'payment' | 'visa_docs' | 'medical' | 'change_cancel' | 'refund' | 'technical' | 'general';
  subject: string; priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'open' | 'pending_customer' | 'pending_staff' | 'resolved' | 'closed';
  assignedTo?: string; channel: 'app' | 'web' | 'whatsapp' | 'bot_escalation';
  createdAt?: string;
}

let seq = 0;
const ticketNo = () => `TKT-${new Date().getFullYear()}-${String(++seq).padStart(5, '0')}`;

/** Support tickets + AI bot with human-escalation rules (doc 13 §13.13). */
export class SupportService {
  constructor(private store: DataStore, private audit: AuditService, private bookings: BookingService, private sm: StateMachine) {}

  async createTicket(input: Partial<Ticket> & { customerName: string; subject: string; body?: string }): Promise<Ticket> {
    const t = await this.store.insert<Ticket>('supportTickets', {
      number: ticketNo(), priority: input.priority || 'normal', status: 'open',
      category: input.category || 'general', channel: input.channel || 'app', ...input,
    });
    if (input.body) await this.reply(t.id, 'customer', input.customerId || 'customer', input.body);
    await this.audit.log({ actorType: 'customer', action: 'support_ticket_created', bookingId: input.bookingId, entityType: 'ticket', entityId: t.id, data: { category: t.category } });
    return t;
  }

  async tickets(filter: Record<string, any> = {}) {
    const rows = await this.store.find<Ticket>('supportTickets', filter);
    return rows.sort((a: any, b: any) => (a.createdAt < b.createdAt ? 1 : -1));
  }
  async messages(ticketId: string) {
    const rows = await this.store.find<any>('ticketMessages', { ticketId });
    return rows.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  }
  async reply(ticketId: string, senderType: 'customer' | 'staff' | 'bot', senderId: string, body: string, internal = false) {
    const msg = await this.store.insert('ticketMessages', { ticketId, senderType, senderId, body, internal });
    await this.store.update('supportTickets', ticketId, { status: senderType === 'customer' ? 'pending_staff' : 'pending_customer' });
    if (senderType === 'staff') await this.audit.log({ actorType: 'staff', actorId: senderId, action: 'ticket_reply', entityType: 'ticket', entityId: ticketId });
    return msg;
  }
  async setStatus(ticketId: string, status: Ticket['status'], staffId?: string) {
    const t = await this.store.update<Ticket>('supportTickets', ticketId, { status, ...(staffId ? { assignedTo: staffId } : {}) });
    await this.audit.log({ actorType: 'staff', actorId: staffId, action: `ticket_${status}`, entityType: 'ticket', entityId: ticketId });
    return t;
  }

  /** AI support bot (mock NLU): answers safe intents, escalates sensitive ones silently. */
  async botReply(user: { id: string; name: string; phone?: string }, message: string, bookingId?: string): Promise<{ reply: string; replyAr: string; escalated: boolean; ticketId?: string }> {
    const m = message.toLowerCase();
    const has = (...ws: string[]) => ws.some((w) => m.includes(w) || message.includes(w));

    // escalation rules (doc 13 §13.13): anger, refund, medical, visa uncertainty, payment conflict, legal, human request
    if (has('angry', 'terrible', 'unacceptable', 'complaint', 'غاضب', 'سيء', 'غير مقبول', 'شكوى', 'زعلان') ||
        has('refund', 'استرجاع', 'استرداد') || has('medical emergency', 'طوارئ') ||
        has('legal', 'قانوني') || has('human', 'agent', 'staff', 'موظف', 'انسان', 'بشري')) {
      const ticket = await this.createTicket({
        customerId: user.id, customerName: user.name, customerPhone: user.phone, bookingId,
        category: has('refund', 'استرجاع', 'استرداد') ? 'refund' : 'general',
        subject: `Bot escalation: ${message.slice(0, 60)}`, body: message,
        priority: has('angry', 'غاضب', 'غير مقبول') ? 'urgent' : 'high', channel: 'bot_escalation',
      });
      if (bookingId && has('angry', 'unacceptable', 'غير مقبول', 'سيء', 'زعلان'))
        await this.bookings.registerComplaint(bookingId, message, 'angry').catch(() => undefined);
      return {
        escalated: true, ticketId: ticket.id,
        reply: `I've connected you with our human support team (ticket ${ticket.number}). A specialist will reply shortly.`,
        replyAr: `تم تحويلك لفريق الدعم البشري (تذكرة ${ticket.number}). سيتواصل معك مختص خلال وقت قصير إن شاء الله.`,
      };
    }
    // booking status intent — answered from live data
    if (has('status', 'booking', 'حالة', 'حجز', 'وين', 'أين')) {
      if (bookingId) {
        const b = await this.sm.getBooking(bookingId);
        return { escalated: false, reply: `Your booking ${b.reference} is currently: ${b.state.replaceAll('_', ' ')}.`, replyAr: `حجزك ${b.reference} حالياً في مرحلة: ${b.state.replaceAll('_', ' ')}.` };
      }
      return { escalated: false, reply: 'Open "My Trips" to see live status for each booking, or send me the booking reference.', replyAr: 'افتح «رحلاتي» لمتابعة حالة كل حجز مباشرة، أو أرسل لي رقم الحجز.' };
    }
    if (has('visa', 'تأشيرة', 'فيزا')) {
      return { escalated: false, reply: 'You can see your visa checklist and readiness score in the Visa section. For case-specific advice our visa officer will assist you — reply "agent" anytime.', replyAr: 'تجد قائمة مستندات التأشيرة ودرجة الجاهزية في قسم التأشيرات. وللحالات الخاصة موظف التأشيرات جاهز لمساعدتك — اكتب «موظف» في أي وقت.' };
    }
    if (has('payment', 'pay', 'دفع', 'تحويل')) {
      return { escalated: false, reply: 'Pay by bank transfer using YOUR unique reference (shown on the payment screen) — matching is automatic. Cash at office and wallet are also available.', replyAr: 'ادفع بالتحويل المصرفي مع كتابة رقمك المرجعي الخاص (يظهر في شاشة الدفع) — والمطابقة تتم تلقائياً. متوفر أيضاً الدفع كاش في المكتب أو من المحفظة.' };
    }
    return {
      escalated: false,
      reply: 'I can help with booking status, payments, visa documents, eSIM, and trip details. Type "agent" for human support anytime.',
      replyAr: 'أقدر أساعدك في: حالة الحجز، الدفع، مستندات التأشيرة، شرائح eSIM، وتفاصيل الرحلة. اكتب «موظف» للتحويل للدعم البشري في أي وقت.',
    };
  }
}
