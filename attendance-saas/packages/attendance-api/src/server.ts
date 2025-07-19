import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { featureFlagMiddleware } from './middleware/feature-flag-middleware';
import { errorHandler } from './middleware/error-handler';
import { attendanceRouter } from './routes/attendance';
import { leaveRouter } from './routes/leave';
import { dashboardRouter } from './routes/dashboard';
import { authRouter } from './routes/auth';
import { tenantRouter } from './routes/tenant';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// セキュリティ設定
app.use(helmet());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 100, // 100リクエスト/IP
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// ミドルウェア設定
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// フィーチャーフラグミドルウェア
app.use(featureFlagMiddleware);

// ルーティング
app.use('/api/auth', authRouter);
app.use('/api/tenant', tenantRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/leave', leaveRouter);
app.use('/api/dashboard', dashboardRouter);

// ヘルスチェック
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// エラーハンドリング
app.use(errorHandler);

// 404ハンドリング
app.use('*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

const server = app.listen(PORT, () => {
  logger.info(`Attendance API server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

export default app;