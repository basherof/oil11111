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
