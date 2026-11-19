import express, { type NextFunction, type Request, type Response } from 'express';
import { api } from './api.js';
import { health } from './health.js';
import { initInfra } from './infra.js';
import { pages } from './pages.js';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(health);
app.use(api);
app.use(pages);

// Express 5 forwards rejected async handlers here; surface them as 500 responses.
app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
});

await initInfra();
const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`app listening on ${port}`));
