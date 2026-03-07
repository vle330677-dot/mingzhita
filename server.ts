import { startServer } from './server/app';

console.log('=== Starting Server ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('DB_PATH:', process.env.DB_PATH);
console.log('ADMIN_ENTRY_CODE:', process.env.ADMIN_ENTRY_CODE ? '✓ Set' : '✗ Missing');

startServer().catch((err) => {
  console.error('❌ Failed to start server:', err);
  console.error('Stack trace:', err.stack);
  process.exit(1);
});
