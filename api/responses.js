// 관리자용: Vercel Blob에 저장된 응답 조회 (비밀번호 필요)
const { list, get } = require('@vercel/blob');
const crypto = require('crypto');
const ADMIN_HASH = 'f60e07fc2e9aeaec05f061f6fff3a56caa006221484f7c032ee229d8d669ae05';

async function readJson(pathname) {
  const r = await get(pathname, { access: 'private', useCache: false });
  if (!r || r.statusCode !== 200 || !r.stream) return null;
  const text = await new Response(r.stream).text();
  try { return JSON.parse(text); } catch (e) { return null; }
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const pw = String(req.headers['x-admin-key'] || '');
  if (crypto.createHash('sha256').update(pw).digest('hex') !== ADMIN_HASH) { res.status(401).json({ ok: false, error: 'unauthorized' }); return; }
  const sid = String((req.query && req.query.surveyId) || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
  try {
    if (!sid) {
      // 설문별 저장 건수
      const counts = {}; let cursor;
      do {
        const r = await list({ prefix: 'responses/', cursor, limit: 1000 });
        r.blobs.forEach(b => { const s = b.pathname.split('/')[1]; counts[s] = (counts[s] || 0) + 1; });
        cursor = r.hasMore ? r.cursor : undefined;
      } while (cursor);
      res.status(200).json({ ok: true, counts }); return;
    }
    const paths = []; let cursor;
    do {
      const r = await list({ prefix: 'responses/' + sid + '/', cursor, limit: 1000 });
      r.blobs.forEach(b => paths.push(b.pathname));
      cursor = r.hasMore ? r.cursor : undefined;
    } while (cursor);
    paths.sort();
    const out = [];
    for (let i = 0; i < paths.length; i += 20) {
      const chunk = await Promise.all(paths.slice(i, i + 20).map(readJson));
      chunk.forEach(x => { if (x) out.push(x); });
    }
    res.status(200).json({ ok: true, responses: out });
  } catch (e) {
    console.error('responses failed', e && e.message);
    res.status(500).json({ ok: false, error: 'storage error' });
  }
};
