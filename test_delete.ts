import Database from 'better-sqlite3';

const db = new Database('game.db');

// 与 server.ts 一致：级联删除一个用户
const deleteUserCascade = db.transaction((userId: number) => {
  db.prepare('DELETE FROM user_inventory WHERE userId = ?').run(userId);
  db.prepare('DELETE FROM user_skills WHERE userId = ?').run(userId);
  db.prepare('DELETE FROM spirit_status WHERE userId = ?').run(userId);

  db.prepare('DELETE FROM rescue_requests WHERE patientId = ? OR healerId = ?').run(userId, userId);
  db.prepare('DELETE FROM roleplay_messages WHERE senderId = ? OR receiverId = ?').run(userId, userId);
  db.prepare('DELETE FROM commissions WHERE publisherId = ? OR acceptedById = ?').run(userId, userId);
  db.prepare('DELETE FROM auction_items WHERE sellerId = ? OR highestBidderId = ?').run(userId, userId);

  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
});

function main() {
  const users = db.prepare('SELECT id, name FROM users ORDER BY id ASC').all() as Array<{ id: number; name: string }>;
  console.log('Users before:', users.length);

  if (users.length === 0) {
    console.log('No users to delete.');
    return;
  }

  // 默认删第一位；你也可以改成固定 ID
  const target = users[0];
  console.log(`Deleting user: id=${target.id}, name=${target.name}`);

  deleteUserCascade(target.id);

  const usersAfter = db.prepare('SELECT id, name FROM users ORDER BY id ASC').all() as Array<{ id: number; name: string }>;
  console.log('Users after:', usersAfter.length);

  // 额外验证（可选）
  const invCount = db.prepare('SELECT COUNT(*) as c FROM user_inventory WHERE userId = ?').get(target.id) as { c: number };
  const skillCount = db.prepare('SELECT COUNT(*) as c FROM user_skills WHERE userId = ?').get(target.id) as { c: number };
  const spiritCount = db.prepare('SELECT COUNT(*) as c FROM spirit_status WHERE userId = ?').get(target.id) as { c: number };
  console.log(`Cascade check -> inventory:${invCount.c}, skills:${skillCount.c}, spirit:${spiritCount.c}`);
}

main();
