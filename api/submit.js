// 설문 응답 이중 저장 — Apps Script(구글 시트)와 별개로 Vercel Blob(private)에 응답 1건 = 파일 1개로 저장
const { put } = require('@vercel/blob');
const crypto = require('crypto');

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ ok: false }); return; }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  if (!body || typeof body !== 'object' || !body.answers || typeof body.answers !== 'object') {
    res.status(400).json({ ok: false, error: 'bad request' }); return;
  }
  const raw = JSON.stringify(body);
  if (raw.length > 1000000) { res.status(413).json({ ok: false }); return; }
  const now = new Date();
  const sid = String(body.surveyId || 'unknown').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) || 'unknown';
  const key = 'responses/' + sid + '/' + now.toISOString().replace(/[:.]/g, '-') + '_' + crypto.randomBytes(6).toString('hex') + '.json';
  try {
    await put(key, JSON.stringify(Object.assign({ receivedAt: now.toISOString() }, body)), {
      access: 'private', contentType: 'application/json', addRandomSuffix: false
    });
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('blob put failed', e && e.message);
    res.status(500).json({ ok: false });
  }
};
