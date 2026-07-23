import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import './types/express'; // applies the Request augmentation (req.auth / req.tenantId)
import { env, isProd } from './config/env';
import { logger } from './config/logger';
import { healthRouter } from './modules/health/health.routes';
import { authRouter } from './modules/auth/auth.routes';
import { organizationRouter } from './modules/organization/organization.routes';
import { employeeRouter } from './modules/employees/employee.routes';
import { attendanceRouter } from './modules/attendance/attendance.routes';
import { leaveRouter } from './modules/leave/leave.routes';
import { payrollRouter } from './modules/payroll/payroll.routes';
import { performanceRouter } from './modules/performance/performance.routes';
import { recruitmentRouter } from './modules/recruitment/recruitment.routes';
import { assetRouter } from './modules/assets/asset.routes';
import { engagementRouter } from './modules/engagement/engagement.routes';
import { reportsRouter } from './modules/reports/reports.routes';
import {
  corsMiddleware,
  globalRateLimit,
  securityHelmet,
} from './common/middleware/security';
import { resolveTenant } from './common/middleware/tenant';
import { errorHandler, notFoundHandler } from './common/middleware/error';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1); // behind Plesk nginx

  // --- core middleware ---
  app.use(securityHelmet);
  app.use(corsMiddleware);
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url?.includes('/health') === true } }));

  // --- tenant resolution (best-effort, before routes) ---
  app.use(resolveTenant);

  // --- rate limiting (after tenant, before routes) ---
  app.use(globalRateLimit);

  // --- routes ---
  app.get('/', (_req, res) => {
    res.json({ name: 'HRMS API', version: '0.1.0', docs: `${env.API_BASE_URL}/docs` });
  });

  app.use(env.API_PREFIX, healthRouter);
  app.use(`${env.API_PREFIX}/auth`, authRouter);
  app.use(`${env.API_PREFIX}/organization`, organizationRouter);
  app.use(`${env.API_PREFIX}/employees`, employeeRouter);
  app.use(`${env.API_PREFIX}/attendance`, attendanceRouter);
  app.use(`${env.API_PREFIX}/leave`, leaveRouter);
  app.use(`${env.API_PREFIX}/payroll`, payrollRouter);
  app.use(`${env.API_PREFIX}/performance`, performanceRouter);
  app.use(`${env.API_PREFIX}/recruitment`, recruitmentRouter);
  app.use(`${env.API_PREFIX}/assets`, assetRouter);
  app.use(`${env.API_PREFIX}/engagement`, engagementRouter);
  app.use(`${env.API_PREFIX}/reports`, reportsRouter);

  // --- fallback + error handling ---
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export type App = ReturnType<typeof createApp>;
export { isProd };
