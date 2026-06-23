import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { auth } from './middleware/auth.js';
import { chatRouter } from './routes/chat.js';
import { miscRouter } from './routes/misc.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/healthz', (_req, res) => res.json({ ok: true }));

// All /v1 routes require the gateway bearer token.
app.use('/v1', auth, chatRouter);
app.use('/v1', auth, miscRouter);

const port = process.env.PORT || 8787;
app.listen(port, () => {
  console.log(`AI chat gateway listening on :${port}`);
});
