const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'server/routes/announcements.routes.ts');
let text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const start = text.indexOf("    if (sinceId > 0) {");
const end = text.indexOf("\n\n    res.set('Cache-Control'", start);
if (start === -1 || end === -1) throw new Error('announcements block not found');
const replacement = `    if (sinceId > 0) {
      rows = await db.prepare(\`
        SELECT id, type, title, content, extraJson, payload, createdAt, created_at
        FROM announcements
        WHERE id > ?
        ORDER BY id ASC
        LIMIT ?
      \`).all(sinceId, limit);
    } else {
      rows = (await db.prepare(\`
        SELECT id, type, title, content, extraJson, payload, createdAt, created_at
        FROM announcements
        ORDER BY id DESC
        LIMIT ?
      \`).all(limit) as any[]).reverse();
    }`;
text = text.slice(0, start) + replacement + text.slice(end);
fs.writeFileSync(file, text, 'utf8');