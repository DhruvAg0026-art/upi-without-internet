import 'dotenv/config';
import { createServerKeyPair } from './crypto.js';
import { connectDatabase } from './db.js';
import { createApp } from './app.js';
import { MeshSimulator } from './mesh.js';

const port = Number(process.env.PORT ?? 8080);
try {
  await connectDatabase();
  const app = createApp({ keys: createServerKeyPair(), mesh: new MeshSimulator() });
  app.listen(port, () => console.log(`UPI Offline Mesh API listening on http://localhost:${port}`));
} catch (error) {
  console.error(`Server startup failed: ${error.message}`);
  process.exitCode = 1;
}