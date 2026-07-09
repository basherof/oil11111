import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { getCore } from './engine/core';
import { AdminController, PublicController } from './http/controllers';
import { CustomerController } from './http/customer.controller';

@Module({ controllers: [PublicController, AdminController, CustomerController] })
class AppModule {}

async function bootstrap() {
  const core = await getCore();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['error', 'warn', 'log'] });
  app.useStaticAssets(join(__dirname, '..', 'public'), { prefix: '/admin' });
  app.enableCors();
  await app.listen(core.config.apiPort);

  const h = core.health();
  console.log('──────────────────────────────────────────────');
  console.log('  Rihlati Smart Core — automation-first engine');
  console.log(`  API:            http://localhost:${core.config.apiPort}`);
  console.log(`  Customer portal: http://localhost:${core.config.apiPort}/admin/portal.html`);
  console.log(`  Ops console:     http://localhost:${core.config.apiPort}/admin/admin.html`);
  console.log(`  Support console: http://localhost:${core.config.apiPort}/admin/support.html`);
  console.log(`  Persistence:    ${h.persistence}${h.persistence === 'memory' ? ' (mock mode — zero setup)' : ''}`);
  console.log(`  System mode:    ${h.systemMode}`);
  console.log('  Test login:     admin@rihlati.test / Admin@12345');
  console.log('──────────────────────────────────────────────');

  // periodic sweeps: SLA escalation (doc 13 §13.3)
  setInterval(() => core.exceptions.slaSweep().catch(() => undefined), 60_000);
}

bootstrap();
