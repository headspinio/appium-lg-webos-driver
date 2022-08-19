import {LGWsClient} from './remote/lg-socket-client';

async function main() {
  const ws = new LGWsClient({url: 'ws://127.0.0.1:3000', clientKey: undefined});
  await ws.connect();
  try {
    console.log(await ws.authenticate());
    console.log(await ws.pointerInput());
  } finally {
    await ws.disconnect();
  }
}

main().catch(console.error);
