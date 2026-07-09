import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { getCore, hashPassword } from '../engine/core';

export interface AuthUser { id: string; email: string; name: string; role: string; }

export async function login(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
  const core = await getCore();
  const users = await core.store.find<any>('users', { email });
  const u = users[0];
  if (!u || u.passwordHash !== hashPassword(password)) throw new UnauthorizedException('Invalid credentials');
  const user: AuthUser = { id: u.id, email: u.email, name: u.name, role: u.role };
  const token = jwt.sign(user, core.config.jwtSecret, { expiresIn: '12h' });
  await core.audit.log({ actorType: 'staff', actorId: u.id, action: 'login', data: { email } });
  return { token, user };
}

/** Customer phone-OTP login (MOCK mode: code is always 123456; live SMS/WA OTP lands with integrations). */
const otpStore = new Map<string, string>();

export async function otpRequest(phone: string) {
  if (!phone || phone.length < 8) throw new UnauthorizedException('Invalid phone number');
  otpStore.set(phone, '123456'); // mock code
  const core = await getCore();
  await core.audit.log({ actorType: 'system', action: 'otp_requested', data: { phone } });
  return { sent: true, channel: 'whatsapp(mock)', hint: 'Mock mode: the code is 123456' };
}

export async function otpVerify(phone: string, code: string, name?: string): Promise<{ token: string; user: AuthUser }> {
  if (otpStore.get(phone) !== code) throw new UnauthorizedException('Wrong or expired code');
  otpStore.delete(phone);
  const core = await getCore();
  let u = (await core.store.find<any>('users', { phone }))[0];
  if (!u) {
    u = await core.store.insert('users', { email: `${phone.replace(/\D/g, '')}@customer.rihlati.test`, phone, passwordHash: '-', name: name || 'عميل رحلتي', role: 'customer' });
  }
  const user: AuthUser = { id: u.id, email: u.email, name: u.name, role: 'customer' };
  const token = jwt.sign({ ...user, phone }, core.config.jwtSecret, { expiresIn: '30d' });
  await core.audit.log({ actorType: 'customer', actorId: u.id, action: 'otp_login', data: { phone } });
  return { token, user };
}

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const header = req.headers['authorization'] || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new UnauthorizedException('Missing bearer token');
    try {
      const core = await getCore();
      req.user = jwt.verify(token, core.config.jwtSecret) as AuthUser;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
