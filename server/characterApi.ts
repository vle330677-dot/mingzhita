export async function getRuntime(userId: number) {
  const r = await fetch(`/api/characters/${userId}/runtime`, { cache: 'no-store' });
  return r.json();
}

export async function setLocation(userId: number, locationId: string) {
  const r = await fetch(`/api/characters/${userId}/location`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locationId })
  });
  return r.json();
}

export async function getLocationPlayers(locationId: string, excludeId?: number) {
  const q = excludeId ? `?excludeId=${excludeId}` : '';
  const r = await fetch(`/api/locations/${locationId}/players${q}`, { cache: 'no-store' });
  return r.json();
}
