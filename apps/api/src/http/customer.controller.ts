import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { getCore } from '../engine/core';
import { AuthGuard } from './auth';

const guard = async <T>(fn: () => Promise<T>): Promise<T> => {
  try { return await fn(); } catch (e: any) { throw new BadRequestException(e.message); }
};

/** Customer-facing API — powers the customer portal (and later the Flutter app 1:1). */
@Controller('customer')
@UseGuards(AuthGuard)
export class CustomerController {
  private async myBooking(req: any, id: string) {
    const core = await getCore();
    const b = await core.stateMachine.getBooking(id);
    if ((b as any).customerId !== req.user.id && req.user.role === 'customer') throw new ForbiddenException('Not your booking');
    return b;
  }

  /** Create a booking request → AI plan → quotation → awaiting confirmation, in one call. */
  @Post('bookings')
  async create(@Body() body: any, @Req() req: any) {
    return guard(async () => {
      const core = await getCore();
      const draft = await core.bookings.createDraft({
        customerId: req.user.id,
        customerName: req.user.name,
        customerPhone: (req.user as any).phone || body.phone || '',
        serviceType: body.serviceType || 'flight',
        totalAmount: body.totalAmount || 4860,
        currency: body.currency || 'LYD',
        channel: 'web',
        details: body.details || {},
      });
      if (draft.state === 'draft') await core.bookings.planAndQuote(draft.id);
      const booking = await core.stateMachine.getBooking(draft.id);
      const quotations = await core.store.find('quotations', { bookingId: draft.id });
      return { booking, quotations };
    });
  }

  @Get('bookings')
  async mine(@Req() req: any) {
    const core = await getCore();
    const rows = await core.store.find<any>('bookings', { customerId: req.user.id });
    return rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  @Get('bookings/:id')
  async detail(@Param('id') id: string, @Req() req: any) {
    const core = await getCore();
    const booking = await this.myBooking(req, id);
    return {
      booking,
      quotations: await core.store.find('quotations', { bookingId: id }),
      wallet: await core.documents.wallet(id),
      messages: await core.notifications.messagesFor(id),
      timeline: (await core.store.find<any>('statusHistory', { bookingId: id })).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
      visaApplications: await core.store.find('visaApplications', { bookingId: id }),
      paymentRefs: await core.store.find('paymentReferences', { bookingId: id }),
    };
  }

  /** Passport scan (mock OCR). Pass forced:{...} in the portal's demo controls to test edge cases. */
  @Post('bookings/:id/scan-passport')
  async scan(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    await this.myBooking(req, id);
    return guard(async () => (await getCore()).ocr.scanPassport(id, { ref: body.imageRef || 'img://upload.jpg', forced: body.forced }));
  }

  /** Mandatory confirmation of details (doc 13 §13.11) → payment reference issued. */
  @Post('bookings/:id/confirm')
  async confirm(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    await this.myBooking(req, id);
    return guard(async () => {
      const core = await getCore();
      await core.ocr.customerConfirms(id, body.confirmedFields || {}, { ip: req.ip, userAgent: req.headers['user-agent'] });
      return core.bookings.customerConfirmsQuote(id);
    });
  }

  /** "I paid" — receipt details go through real auto-matching (per current A-level). */
  @Post('bookings/:id/pay')
  async pay(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const b: any = await this.myBooking(req, id);
    return guard(async () =>
      (await getCore()).payments.processIncoming({
        reference: body.reference || b.paymentReference,
        amount: body.amount, payerName: req.user.name, method: body.method || 'bank_transfer', receiptRef: body.receiptRef,
      }),
    );
  }

  @Post('bookings/:id/refund')
  async refund(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    await this.myBooking(req, id);
    return guard(async () => (await getCore()).bookings.requestRefund(id, body.reason || 'customer request'));
  }

  // ---- Visa ----
  @Post('bookings/:id/visa')
  async openVisa(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    await this.myBooking(req, id);
    return guard(async () => (await getCore()).visa.openApplication(id, body.country || 'DE', body.visaType || 'schengen'));
  }
  @Post('visa/:appId/upload')
  async uploadDoc(@Param('appId') appId: string, @Body() body: any) {
    return guard(async () => (await getCore()).visa.uploadDocument(appId, body.key, { ref: body.ref || 'doc://upload', forcedPrecheck: body.forcedPrecheck }));
  }

  // ---- Support: AI bot + tickets ----
  @Post('chat')
  async chat(@Body() body: { message: string; bookingId?: string }, @Req() req: any) {
    return guard(async () => (await getCore()).support.botReply({ id: req.user.id, name: req.user.name, phone: (req.user as any).phone }, body.message, body.bookingId));
  }
  @Post('tickets')
  async ticket(@Body() body: any, @Req() req: any) {
    return guard(async () => (await getCore()).support.createTicket({
      customerId: req.user.id, customerName: req.user.name, customerPhone: (req.user as any).phone,
      bookingId: body.bookingId, category: body.category, subject: body.subject, body: body.body, channel: 'web',
    }));
  }
  @Get('tickets')
  async myTickets(@Req() req: any) {
    return (await getCore()).support.tickets({ customerId: req.user.id });
  }
  @Get('tickets/:id/messages')
  async ticketMessages(@Param('id') id: string) {
    const msgs = await (await getCore()).support.messages(id);
    return msgs.filter((m: any) => !m.internal);
  }
  @Post('tickets/:id/reply')
  async ticketReply(@Param('id') id: string, @Body() body: { body: string }, @Req() req: any) {
    return guard(async () => (await getCore()).support.reply(id, 'customer', req.user.id, body.body));
  }
}
