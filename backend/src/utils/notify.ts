/** Push a short message to NOTIFY_URL (an ntfy topic or any webhook accepting a POST body). No-op when unset. */
export async function notify(title: string, body: string): Promise<boolean> {
  const url = process.env.NOTIFY_URL;
  if (!url) return false;
  try {
    const res = await fetch(url, { method: 'POST', body, headers: { Title: title, Tags: 'school', 'User-Agent': 'paschools-notify' } });
    return res.ok;
  } catch {
    return false;
  }
}
