import { Request, Response, NextFunction } from 'express';
import zlib from 'zlib';

export function compressionMiddleware(req: Request, res: Response, next: NextFunction) {
  const acceptEncoding = req.headers['accept-encoding'] || '';
  
  // 劫持 res.json 来压缩响应
  const originalJson = res.json.bind(res);
  
  res.json = function (data: any) {
    const jsonString = JSON.stringify(data);
    
    // 只压缩大于1KB的响应
    if (jsonString.length < 1024) {
      return originalJson(data);
    }
    
    // 支持 gzip
    if (acceptEncoding.includes('gzip')) {
      const compressed = zlib.gzipSync(jsonString);
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Content-Type', 'application/json');
      return res.send(compressed);
    }
    
    // 支持 deflate
    if (acceptEncoding.includes('deflate')) {
      const compressed = zlib.deflateSync(jsonString);
      res.setHeader('Content-Encoding', 'deflate');
      res.setHeader('Content-Type', 'application/json');
      return res.send(compressed);
    }
    
    return originalJson(data);
  };
  
  next();
}
