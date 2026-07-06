import { BadRequestException, Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { getCore } from '../engine/core';
import { Simulator } from '../simulator/simulator';
import { AuthGuard, login } from './auth';

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
    return guard(async () => (await getCore()).exceptions.resolve(id, body.action as any, { id: req.user.id, role: req.user.role }, body.note));
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
