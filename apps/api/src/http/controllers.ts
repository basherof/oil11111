import { BadRequestException, Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { getCore } from '../engine/core';
import { Simulator } from '../simulator/simulator';
import { AuthGuard, login, otpRequest, otpVerify } from './auth';

/** Engine rule violations (illegal transitions, A1 locks, role routing) → HTTP 400, not 500. */
async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e: any) {
    throw new BadRequestException(e.message);
  }
}

@Controller()
export class PublicController {
  @Get('health')
  async health() {
    return (await getCore()).health();
  }
  @Post('auth/login')
  async login(@Body() body: { email: string; password: string }) {
    return login(body.email, body.password);
  }
  @Post('auth/otp/request')
  async otpReq(@Body() body: { phone: string }) {
    return otpRequest(body.phone);
  }
  @Post('auth/otp/verify')
  async otpVer(@Body() body: { phone: string; code: string; name?: string }) {
    return otpVerify(body.phone, body.code, body.name);
  }
}

@Controller('api')
@UseGuards(AuthGuard)
export class AdminController {
  // ---- Exception Queue (docs/14 §E) ----
  @Get('exceptions')
  async exceptions(@Query('role') role?: string, @Query('type') type?: string) {
    return (await getCore()).exceptions.open({ role: role as any, type: type as any });
  }
  @Post('exceptions/:id/resolve')
  async resolve(@Param('id') id: string, @Body() body: { action: string; note?: string }, @Req() req: any) {
    return guard(async () => {
      const core = await getCore();
      const res = await core.exceptions.resolve(id, body.action as any, { id: req.user.id, role: req.user.role }, body.note);
      // post-resolution automation: one click takes the booking all the way (doc 13 §13.3)
      const bookingId = (res.exception as any).bookingId;
      try {
        if (body.action === 'confirm_payment_manually') {
          await core.payments.confirmManually(bookingId, req.user.id);
          const b = await core.stateMachine.getBooking(bookingId);
          if (b.state === 'awaiting_payment') await core.stateMachine.transition(bookingId, 'payment_received', 'staff', { actorId: req.user.id });
          await core.bookings.fulfil(bookingId);
        }
        if (body.action === 'retry_supplier' || body.action === 'switch_supplier') await core.bookings.fulfil(bookingId);
      } catch { /* pipeline continues via queue if a later step raises */ }
      return { ...res, bookingState: (await core.stateMachine.getBooking(bookingId)).state };
    });
  }
  @Post('exceptions/:id/note')
  async note(@Param('id') id: string, @Body() body: { note: string }, @Req() req: any) {
    return (await getCore()).exceptions.addNote(id, req.user.id, body.note);
  }

  // ---- Bookings ----
  @Get('bookings')
  async bookings() {
    return (await getCore()).bookings.list();
  }
  @Get('bookings/:id')
  async booking(@Param('id') id: string) {
    const core = await getCore();
    const booking = await core.stateMachine.getBooking(id);
    return {
      booking,
      audit: await core.audit.forBooking(id),
      messages: await core.notifications.messagesFor(id),
      wallet: await core.documents.wallet(id),
      exceptions: (await core.store.find('exceptions', { bookingId: id })),
      payments: await core.store.find('payments', { bookingId: id }),
      confirmations: await core.store.find('customerConfirmations', { bookingId: id }),
    };
  }

  // ---- Automation settings, kill switches (docs/14 §C) ----
  @Get('automation')
  async automation() {
    return (await getCore()).automation.all();
  }
  @Put('automation/:key/level')
  async setLevel(@Param('key') key: string, @Body() body: { level: string }, @Req() req: any) {
    return guard(async () => (await getCore()).automation.setLevel(key as any, body.level as any, req.user.id));
  }
  @Put('automation/:key/thresholds')
  async setThresholds(@Param('key') key: string, @Body() body: { high: number; medium: number }, @Req() req: any) {
    return guard(async () => (await getCore()).automation.setThresholds(key as any, body, req.user.id));
  }
  @Put('automation/:key/kill-switch')
  async killSwitch(@Param('key') key: string, @Body() body: { active: boolean; reason?: string }, @Req() req: any) {
    return guard(async () => (await getCore()).automation.setKillSwitch(key as any, body.active, body.reason || '', req.user.id));
  }

  // ---- Payment matching board ----
  @Get('payments/board')
  async paymentsBoard() {
    return (await getCore()).payments.board();
  }
  @Post('payments/incoming')
  async incoming(@Body() body: any) {
    return guard(async () => (await getCore()).payments.processIncoming(body));
  }

  // ---- OCR & documents ----
  @Get('documents/ocr')
  async ocrResults() {
    const core = await getCore();
    return (await core.store.find<any>('artifacts')).filter((a) => a.kind === 'ocr_extraction');
  }
  @Get('visa-applications')
  async visaApps() {
    return (await getCore()).store.find('visaApplications');
  }

  // ---- Audit + KPIs ----
  @Get('audit')
  async audit(@Query('bookingId') bookingId?: string) {
    const core = await getCore();
    return bookingId ? core.audit.forBooking(bookingId) : core.audit.recent(200);
  }
  @Get('kpi')
  async kpi() {
    return (await getCore()).kpi.snapshot();
  }
  @Get('kpi/backlog')
  async backlog() {
    return (await getCore()).kpi.weeklyAutomationBacklog();
  }

  // ---- Support tickets (staff console) ----
  @Get('support/tickets')
  async tickets(@Query('status') status?: string) {
    return (await getCore()).support.tickets(status ? { status } : {});
  }
  @Get('support/tickets/:id')
  async ticketDetail(@Param('id') id: string) {
    const core = await getCore();
    const ticket: any = await core.store.get('supportTickets', id);
    let bookingContext: any = null;
    if (ticket?.bookingId) {
      const b = await core.stateMachine.getBooking(ticket.bookingId).catch(() => null);
      if (b) bookingContext = {
        booking: b,
        payments: await core.store.find('payments', { bookingId: b.id }),
        exceptions: await core.store.find('exceptions', { bookingId: b.id }),
        wallet: await core.documents.wallet(b.id),
      };
    }
    return { ticket, messages: await core.support.messages(id), bookingContext };
  }
  @Post('support/tickets/:id/reply')
  async staffReply(@Param('id') id: string, @Body() body: { body: string; internal?: boolean }, @Req() req: any) {
    return guard(async () => (await getCore()).support.reply(id, 'staff', req.user.id, body.body, body.internal));
  }
  @Post('support/tickets/:id/status')
  async ticketStatus(@Param('id') id: string, @Body() body: { status: string }, @Req() req: any) {
    return guard(async () => (await getCore()).support.setStatus(id, body.status as any, req.user.id));
  }

  // ---- Simulator (isolated cores; does not touch live data) ----
  @Post('simulator/run/:id')
  async simulate(@Param('id') id: string) {
    return new Simulator().run(parseInt(id, 10));
  }
  @Post('simulator/run-all')
  async simulateAll() {
    return new Simulator().runAll();
  }
}
