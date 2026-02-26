import Database from 'better-sqlite3';
const db = new Database('game.db');
const users = db.prepare('SELECT * FROM users').all();
console.log("Users before:", users.length);
if (users.length > 0) {
  const id = users[0].id;
  console.log("Deleting user:", id);
  db.prepare('DELETE FROM items WHERE userId = ?').run(id);
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  const usersAfter = db.prepare('SELECT * FROM users').all();
  console.log("Users after:", usersAfter.length);
}
