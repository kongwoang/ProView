import { BadRequestException, Injectable } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import type { Response } from 'express';
import { loadEnvironment } from '../../infrastructure/environment';

export interface StoredFile {
  displayName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  storageKey: string;
}

@Injectable()
export class StorageService {
  private readonly environment = loadEnvironment();
  private readonly root = resolve(this.environment.STORAGE_LOCAL_PATH);
  private readonly s3 =
    this.environment.STORAGE_DRIVER === 's3'
      ? new S3Client({
          endpoint: this.environment.S3_ENDPOINT,
          region: this.environment.S3_REGION,
          forcePathStyle: this.environment.S3_FORCE_PATH_STYLE,
          credentials: {
            accessKeyId: this.environment.S3_ACCESS_KEY_ID!,
            secretAccessKey: this.environment.S3_SECRET_ACCESS_KEY!,
          },
        })
      : undefined;

  validatePdf(file: Express.Multer.File): Omit<StoredFile, 'storageKey'> {
    if (!file?.buffer?.length) throw new BadRequestException('A PDF file is required');
    if (
      file.size > this.environment.MAX_UPLOAD_BYTES ||
      file.buffer.length > this.environment.MAX_UPLOAD_BYTES
    )
      throw new BadRequestException('PDF exceeds configured upload size');
    if (
      file.mimetype !== 'application/pdf' ||
      extname(file.originalname).toLowerCase() !== '.pdf' ||
      !file.buffer.subarray(0, 5).equals(Buffer.from('%PDF-')) ||
      !file.buffer.subarray(Math.max(0, file.buffer.length - 2048)).includes(Buffer.from('%%EOF'))
    )
      throw new BadRequestException(
        'File must be a valid PDF with application/pdf MIME type and .pdf extension',
      );
    const displayName =
      [...file.originalname]
        .map((character) =>
          character.charCodeAt(0) < 32 ||
          character.charCodeAt(0) === 127 ||
          '/\\'.includes(character)
            ? '_'
            : character,
        )
        .join('')
        .slice(-240) || 'document.pdf';
    return {
      displayName,
      mimeType: 'application/pdf',
      sizeBytes: file.buffer.length,
      sha256: createHash('sha256').update(file.buffer).digest('hex'),
    };
  }

  private localPath(key: string): string {
    if (!/^[a-z0-9/-]+\.pdf$/.test(key)) throw new Error('Invalid storage key');
    const path = resolve(this.root, key);
    if (!path.startsWith(`${this.root}${sep}`)) throw new Error('Invalid storage key');
    return path;
  }

  async put(file: Express.Multer.File, prefix = 'submissions'): Promise<StoredFile> {
    const metadata = this.validatePdf(file);
    if (!/^[a-z-]+$/.test(prefix)) throw new Error('Invalid storage prefix');
    const storageKey = `${prefix}/${randomUUID()}.pdf`;
    if (this.s3)
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.environment.S3_BUCKET,
          Key: storageKey,
          Body: file.buffer,
          ContentType: 'application/pdf',
          Metadata: { sha256: metadata.sha256 },
          IfNoneMatch: '*',
        }),
      );
    else {
      const path = this.localPath(storageKey);
      await mkdir(dirname(path), { recursive: true, mode: 0o700 });
      await writeFile(path, file.buffer, { flag: 'wx', mode: 0o600 });
    }
    return { ...metadata, storageKey };
  }

  async read(storageKey: string): Promise<Buffer> {
    if (this.s3) {
      const response = await this.s3.send(
        new GetObjectCommand({ Bucket: this.environment.S3_BUCKET, Key: storageKey }),
      );
      if (!response.Body) throw new Error('Storage object unavailable');
      return Buffer.from(await response.Body.transformToByteArray());
    }
    return readFile(this.localPath(storageKey));
  }

  async delete(storageKey: string): Promise<void> {
    if (this.s3)
      await this.s3.send(
        new DeleteObjectCommand({ Bucket: this.environment.S3_BUCKET, Key: storageKey }),
      );
    else
      await unlink(this.localPath(storageKey)).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') throw error;
      });
  }
}

export function servePdf(
  response: Response,
  file: { displayName: string; sha256: string },
  data: Buffer,
  range?: string,
): void {
  response.set({
    'Content-Type': 'application/pdf',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
    'Accept-Ranges': 'bytes',
    ETag: `"${file.sha256}"`,
    'Content-Disposition': `inline; filename="document.pdf"; filename*=UTF-8''${encodeURIComponent(file.displayName).replace(/'/g, '%27')}`,
  });
  if (!range) {
    response.setHeader('Content-Length', data.length);
    response.send(data);
    return;
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  let start = 0;
  let end = data.length - 1;
  if (match?.[1]) start = Number(match[1]);
  if (match?.[2]) {
    if (match[1]) end = Math.min(Number(match[2]), end);
    else start = Math.max(0, data.length - Number(match[2]));
  }
  if (
    !match ||
    (!match[1] && !match[2]) ||
    start < 0 ||
    end < start ||
    start >= data.length ||
    (!match[1] && Number(match[2]) === 0)
  ) {
    response.status(416).setHeader('Content-Range', `bytes */${data.length}`);
    response.end();
    return;
  }
  response
    .status(206)
    .set({
      'Content-Range': `bytes ${start}-${end}/${data.length}`,
      'Content-Length': end - start + 1,
    })
    .send(data.subarray(start, end + 1));
}
