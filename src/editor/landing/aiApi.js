// The editor's ✨ calls (server/landingBuild.js).

async function post(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Something went wrong (${res.status}).`);
  return data;
}

// action: shorter | friendlier | persuasive | formal | fix | to-zh | to-en  -> { en, zh }
export const rewriteText = (args) => post('/api/landing/rewrite', args);

// Writes a section from the documents, or changes it per `request`. -> { content }
export const writeSection = (args) => post('/api/landing/section', args);

export async function buildPage(args) {
  const { page } = await post('/api/landing/build', args);
  return page;
}
