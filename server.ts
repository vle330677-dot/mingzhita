import { startServer } from './server/app';
const mysqlHost = process.env.MYSQL_HOST || process.env.MYSQL_PUBLIC_HOST || '';
const mysqlDatabase = process.env.MYSQL_DATABASE || '';
const mysqlConnectionString = process.env.MYSQL_URI || process.env.MYSQL_CONNECTION_STRING || process.env.DATABASE_URL || '';

console.log('=== Starting Server ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('DB_TARGET:', 'mysql');
console.log('MYSQL_HOST:', mysqlHost || (mysqlConnectionString ? '(from connection string)' : '✗ Missing'));
console.log('MYSQL_DATABASE:', mysqlDatabase || (mysqlConnectionString ? '(from connection string)' : '✗ Missing'));
console.log('ADMIN_ENTRY_CODE:', process.env.ADMIN_ENTRY_CODE ? '✓ Set' : '✗ Missing');

startServer().catch((err) => {
  console.error('❌ Failed to start server:', err);
  console.error('Stack trace:', err.stack);
  process.exit(1);
});
