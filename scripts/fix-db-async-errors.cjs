const fs = require('fs');
const path = require('path');
const root = process.cwd();

function patch(relPath, replacements) {
  const file = path.join(root, relPath);
  let text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  for (const [from, to] of replacements) {
    if (!text.includes(from)) {
      throw new Error(`Pattern not found in ${relPath}: ${from.slice(0, 100)}`);
    }
    text = text.replace(from, to);
  }
  fs.writeFileSync(file, text, 'utf8');
}

patch('server/routes/announcements.routes.ts', [
  ['      `).all(limit).reverse();', '      `).all(limit) as any[]).reverse();'],
  ['      rows = await db.prepare(`', '      rows = (await db.prepare(`'],
]);

patch('server/routes/city.routes.ts', [
  [
`      const residentCount = await db.prepare(\`
        SELECT COUNT(*) as count FROM users 
        WHERE homeLocation = ? AND status = 'approved'
      \`).get(cityId).count || 0;
`,
`      const residentCountRow = await db.prepare(\`
        SELECT COUNT(*) as count FROM users 
        WHERE homeLocation = ? AND status = 'approved'
      \`).get(cityId) as { count?: number } | undefined;
      const residentCount = Number(residentCountRow?.count || 0);
`
  ],
  [
`        const residentCount = await db.prepare(\`
          SELECT COUNT(*) as count FROM users 
          WHERE homeLocation = ? AND status = 'approved'
        \`).get(cityId).count || 0;

        const shopCount = await db.prepare(\`
          SELECT COUNT(*) as count FROM city_shops 
          WHERE cityId = ? AND status = 'active'
        \`).get(cityId).count || 0;
`,
`        const residentCountRow = await db.prepare(\`
          SELECT COUNT(*) as count FROM users 
          WHERE homeLocation = ? AND status = 'approved'
        \`).get(cityId) as { count?: number } | undefined;
        const residentCount = Number(residentCountRow?.count || 0);

        const shopCountRow = await db.prepare(\`
          SELECT COUNT(*) as count FROM city_shops 
          WHERE cityId = ? AND status = 'active'
        \`).get(cityId) as { count?: number } | undefined;
        const shopCount = Number(shopCountRow?.count || 0);
`
  ],
]);

patch('server/routes/faction.routes.ts', [
  ["  return String(await getDelegationRow(db)?.status || '') === 'approved';", "  return String((await getDelegationRow(db))?.status || '') === 'approved';"],
  ["          customRoles: await getActiveCustomRoles(db, locationId).map((role) => customRolePayload(db, role)),", "          customRoles: await Promise.all((await getActiveCustomRoles(db, locationId)).map((role) => customRolePayload(db, role))),"],
]);

patch('server/routes/gameplay.routes.ts', [
  [
`      const inventory = invRows.map((x) => {
        const unitPrice = estimateInventoryUnitPrice(db, x);
        return {
          id: Number(x.id || 0),
          name: String(x.name || ''),
          description: String(x.description || ''),
          qty: Math.max(1, Number(x.qty || 1)),
          itemType: String(x.itemType || ''),
          effectValue: Number(x.effectValue || 0),
          estimateUnitPrice: unitPrice,
          pledgeValuePerUnit: Math.max(1, Math.floor(unitPrice * 0.8))
        };
      });
`,
`      const inventory = await Promise.all(invRows.map(async (x) => {
        const unitPrice = await estimateInventoryUnitPrice(db, x);
        return {
          id: Number(x.id || 0),
          name: String(x.name || ''),
          description: String(x.description || ''),
          qty: Math.max(1, Number(x.qty || 1)),
          itemType: String(x.itemType || ''),
          effectValue: Number(x.effectValue || 0),
          estimateUnitPrice: unitPrice,
          pledgeValuePerUnit: Math.max(1, Math.floor(unitPrice * 0.8))
        };
      }));
`
  ],
  ["        const others = await getPartyMembers(db, myPartyId).filter((m) => Number(m.id) !== userId);", "        const others = (await getPartyMembers(db, myPartyId)).filter((m) => Number(m.id) !== userId);"],
]);

patch('server/routes/guild.routes.ts', [
  ["  const sellerName = sellerId > 0 ? String((await getUser(db, sellerId)?.name || '')) : '';", "  const sellerName = sellerId > 0 ? String((await getUser(db, sellerId))?.name || '') : '';"],
]);

patch('server/routes/legacy.routes.ts', [
  ["  const isDelegationActive = async () => String(await getDelegationRow()?.status || '') === 'approved';", "  const isDelegationActive = async () => String((await getDelegationRow())?.status || '') === 'approved';"],
]);

patch('server/rp.routes.ts', [
  [
`    return rows.map((row) => {
      const members = loadSessionMembers(row.id);
      return {
        ...mapSessionShape(row, members),
        lastMessageAt: row.lastMessageAt || null,
      };
    });
`,
`    return Promise.all(rows.map(async (row) => {
      const members = await loadSessionMembers(row.id);
      return {
        ...mapSessionShape(row, members),
        lastMessageAt: row.lastMessageAt || null,
      };
    }));
`
  ],
  [
`    const userIds = await loadSessionMembers(sessionId)
      .map((member) => Number(member.userId || 0))
      .filter((value) => Number.isFinite(value) && value > 0);
`,
`    const userIds = (await loadSessionMembers(sessionId))
      .map((member) => Number(member.userId || 0))
      .filter((value) => Number.isFinite(value) && value > 0);
`
  ],
]);

patch('server/routes/army.routes.ts', [
  [
`      const arbitrations = rows.map((x) => {
        const votes = db.prepare(\`
          SELECT voterUserId, voterName, vote, comment, createdAt
          FROM army_arbitration_votes
          WHERE arbitrationId = ?
          ORDER BY createdAt ASC
        \`).all(Number(x.id || 0)) as AnyRow[];

        return {
          id: Number(x.id || 0),
          plaintiffUserId: Number(x.plaintiffUserId || 0),
          plaintiffName: String(x.plaintiffName || ''),
          defendantUserId: Number(x.defendantUserId || 0),
          defendantName: String(x.defendantName || ''),
          reason: String(x.reason || ''),
          evidence: String(x.evidence || ''),
          status: String(x.status || 'pending'),
          judgeUserId: Number(x.judgeUserId || 0),
          judgeName: String(x.judgeName || ''),
          verdict: String(x.verdict || ''),
          penalty: String(x.penalty || ''),
          createdAt: String(x.createdAt || ''),
          updatedAt: String(x.updatedAt || ''),
          votes: votes.map((v) => ({
            voterUserId: Number(v.voterUserId || 0),
            voterName: String(v.voterName || ''),
            vote: String(v.vote || ''),
            comment: String(v.comment || ''),
            createdAt: String(v.createdAt || '')
          })),
          canVote: userId > 0 && isArmyMember(getUser(db, userId)?.job) && !votes.some((v) => Number(v.voterUserId) === userId)
        };
      });
`,
`      const currentUser = userId > 0 ? await getUser(db, userId) : undefined;
      const arbitrations = await Promise.all(rows.map(async (x) => {
        const votes = await db.prepare(\`
          SELECT voterUserId, voterName, vote, comment, createdAt
          FROM army_arbitration_votes
          WHERE arbitrationId = ?
          ORDER BY createdAt ASC
        \`).all(Number(x.id || 0)) as AnyRow[];

        return {
          id: Number(x.id || 0),
          plaintiffUserId: Number(x.plaintiffUserId || 0),
          plaintiffName: String(x.plaintiffName || ''),
          defendantUserId: Number(x.defendantUserId || 0),
          defendantName: String(x.defendantName || ''),
          reason: String(x.reason || ''),
          evidence: String(x.evidence || ''),
          status: String(x.status || 'pending'),
          judgeUserId: Number(x.judgeUserId || 0),
          judgeName: String(x.judgeName || ''),
          verdict: String(x.verdict || ''),
          penalty: String(x.penalty || ''),
          createdAt: String(x.createdAt || ''),
          updatedAt: String(x.updatedAt || ''),
          votes: votes.map((v) => ({
            voterUserId: Number(v.voterUserId || 0),
            voterName: String(v.voterName || ''),
            vote: String(v.vote || ''),
            comment: String(v.comment || ''),
            createdAt: String(v.createdAt || '')
          })),
          canVote: userId > 0 && isArmyMember(currentUser?.job) && !votes.some((v) => Number(v.voterUserId) === userId)
        };
      }));
`
  ],
]);