import { Router } from 'express';
import { pingDatabase, supportsTransactions } from '../../lib/database';
import { sendOk } from '../../common/envelope';

export function healthRoutes(version: string): Router {
  const router = Router();

  /** Liveness: is the process up at all. */
  router.get('/live', (_req, res) => {
    sendOk(res, { status: 'ok', version, uptimeSeconds: Math.round(process.uptime()) });
  });

  /**
   * Readiness: can this instance actually serve traffic.
   *
   * MongoDB is the only external dependency. A standalone mongod is reported
   * as degraded rather than down: everything works except the atomicity of
   * booking and payment, which need a replica set for transactions.
   */
  router.get('/ready', async (_req, res) => {
    const mongo = await pingDatabase();
    const transactions = mongo ? await supportsTransactions() : false;
    res.status(mongo ? 200 : 503);
    sendOk(res, {
      status: !mongo ? 'down' : transactions ? 'ready' : 'degraded',
      checks: {
        mongo: mongo ? 'up' : 'down',
        mongoReplicaSet: transactions ? 'up' : 'missing',
      },
    });
  });

  return router;
}
