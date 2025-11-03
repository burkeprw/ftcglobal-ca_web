export async function onRequest({ env }) {
  return new Response(JSON.stringify({
    hasDB: !!env.DB,
    envKeys: Object.keys(env),
    dbType: typeof env.DB
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}