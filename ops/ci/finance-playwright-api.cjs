'use strict';

require('../..//api/node_modules/reflect-metadata');
const path = require('node:path');
const { createRequire } = require('node:module');
const apiRequire = createRequire(path.resolve('api/package.json'));
const { Module, Controller, Get } = apiRequire('@nestjs/common');
const { NestFactory } = apiRequire('@nestjs/core');

const { DatabaseService } = require('../../api/dist/database/database.service.js');
let AuthModule;
try {
  ({ AuthModule } = require('../../api/dist/auth/auth.module.js'));
} catch (error) {
  const detail = String(error.message || '')
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[DATABASE_URL_REDACTED]')
    .replace(/(?:password|token|secret)=?[^\s&]+/gi, '[REDACTED]')
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 240);
  process.stderr.write(`FINANCE_PLAYWRIGHT_AUTH_MODULE_LOAD_FAILED=${error.code || error.name || 'Error'}:${detail}\n`);
  process.exit(1);
}
const { ServicePricingController } = require('../../api/dist/finance-billing/service-pricing.controller.js');
const { GeneralFinanceWorkflowController } = require('../../api/dist/finance-billing/general-finance-workflow.controller.js');
const { GeneralFinanceWorkflowService } = require('../../api/dist/finance-billing/general-finance-workflow.service.js');
const { ProductionAuthMiddleware } = require('../../api/dist/security/production-auth.middleware.js');

class CiHealthController {
  ready() { return { ready: true, environment: 'synthetic-disposable' }; }
}
// Reuse the production middleware's explicitly exempt readiness path.
Controller('api/health')(CiHealthController);
Get('ready')(CiHealthController.prototype, 'ready', Object.getOwnPropertyDescriptor(CiHealthController.prototype, 'ready'));

class FinancePlaywrightModule {}
Module({
  imports: [AuthModule],
  controllers: [CiHealthController, ServicePricingController, GeneralFinanceWorkflowController],
  providers: [DatabaseService, GeneralFinanceWorkflowService],
})(FinancePlaywrightModule);

async function main() {
  process.env.NODE_ENV = 'production';
  const app = await NestFactory.create(FinancePlaywrightModule, { logger: ['log', 'warn', 'error'] });
  const database = app.get(DatabaseService);
  const auth = new ProductionAuthMiddleware(database);
  app.use((request, response, next) => Promise.resolve(auth.use(request, response, next)).catch(next));
  await app.listen(Number(process.env.PORT || 3000), '127.0.0.1');
  process.stdout.write('FINANCE_PLAYWRIGHT_API_READY=1\n');
  const stop = async () => { await app.close(); };
  process.once('SIGTERM', () => void stop());
  process.once('SIGINT', () => void stop());
}

main().catch((error) => {
  const category = error.code || error.name || 'Error';
  const detail = String(error.message || '')
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[DATABASE_URL_REDACTED]')
    .replace(/(?:password|token|secret)=?[^\s&]+/gi, '[REDACTED]')
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 240);
  process.stderr.write(`FINANCE_PLAYWRIGHT_API_START_FAILED=${category}${detail ? `:${detail}` : ''}\n`);
  process.exitCode = 1;
});
