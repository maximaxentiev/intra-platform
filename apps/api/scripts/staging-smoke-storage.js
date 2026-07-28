const { StorageService } = require('./dist/storage/storage.service');
const { ConfigService } = require('@nestjs/config');

async function main() {
  const storage = new StorageService(new ConfigService(process.env));
  if (!storage.isConfigured()) {
    console.log(JSON.stringify({ ok: false, reason: 'not_configured' }));
    process.exit(1);
  }
  await storage.checkConnectivity();
  const key =
    'applications/00000000-0000-4000-8000-000000000099/00000000-0000-4000-8000-000000000098/staging-smoke.txt';
  const body = Buffer.from('staging smoke no pii');
  await storage.uploadObject({ key, body, contentType: 'text/plain' });
  const stream = await storage.getObjectStream(key);
  const chunks = [];
  for await (const chunk of stream.body) chunks.push(chunk);
  await storage.deleteObject(key);
  console.log(
    JSON.stringify({
      ok: true,
      configured: true,
      connectivity: true,
      writeReadDelete: true,
      bucket: storage.getConfigSummary().bucket,
    }),
  );
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }));
  process.exit(1);
});
