import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JobManager } from './jobs/jobManager.js';
import { registerJobRoutes } from './routes/jobs.js';

const PROJECT_ROOT = fileURLToPath(new URL('../..', import.meta.url));

export async function buildServer(options = {}) {
  const app = Fastify({
    logger: options.logger ?? false,
  });

  app.addHook('onRequest', async (request, reply) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Accept');

    if (request.method === 'OPTIONS') {
      reply.code(204).send();
    }
  });

  const jobManager = options.jobManager || new JobManager({
    tempRoot: options.tempRoot,
    workerPath: options.workerPath,
  });

  app.decorate('jobManager', jobManager);
  await app.register(multipart, {
    limits: {
      files: 1,
      fileSize: 50 * 1024 * 1024,
    },
  });

  await registerJobRoutes(app);

  if (options.serveFrontend !== false) {
    await app.register(fastifyStatic, {
      root: resolve(PROJECT_ROOT),
      wildcard: false,
      index: ['index.html'],
    });
  }

  app.setErrorHandler((error, request, reply) => {
    reply.code(error.statusCode || 500).send({
      error: error.message,
    });
  });

  app.addHook('onClose', async instance => {
    await instance.jobManager.close();
  });

  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = await buildServer();
  await server.listen({
    host: '127.0.0.1',
    port: Number(process.env.PORT || 8787),
  });
}
