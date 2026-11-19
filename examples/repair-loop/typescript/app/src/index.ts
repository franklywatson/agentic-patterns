import express, { type NextFunction, type Request, type Response } from 'express';
import { auth } from './auth.js';
import { health } from './health.js';
import { initInfra } from './infra.js';
import { users } from './routes/users.js';

const app = express();
app.use(express.json());
app.use(health);
app.use(auth);
app.use(users);

// Express 5 forwards rejected async handlers here. Log one structured line per
// unhandled error, then answer 500.
app.use((error: Error & { code?: string }, req: Request, res: Response, _next: NextFunction) => {
  const errorClass = error.code ? `pg:${error.code}` : error.name;
  console.error(
    JSON.stringify({
      level: 'error',
      event: 'unhandled_error',
      route: `${req.method} ${req.route?.path ?? req.path}`,
      status: 500,
      errorClass,
    }),
  );
  res.status(500).json({ error: 'Internal server error' });
});

await initInfra();
const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`app listening on ${port}`));
