import type { Plugin } from 'vite';
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, normalize, resolve, dirname } from 'node:path';
import {
  ADOBE_REJECTED_RELATIVE_PATH,
  ADOBE_REJECTED_REVIEW_FIXED_RELATIVE_PATH,
  buildRecoveryFixFromSuggestion,
  loadAdobeRejectedFile,
  loadAdobeRejectedReviewFixedFile,
  validateReviewFixedFile,
  type AdobeRejectedReviewFixedFile,
} from '../src/features/estimating/data/productionRates/adobeRejectedProductionRateRecovery';
import { loadAdobeFinalReviewedRows } from '../src/features/estimating/data/productionRates/adobeProductionRateImport';

const STAGES = ['raw', 'ai-reviewed', 'reviewed', 'approved', 'rejected'] as const;
type Stage = (typeof STAGES)[number];

function isStage(value: string): value is Stage {
  return (STAGES as readonly string[]).includes(value);
}

export function productionRateReviewDevServer(repoRoot: string): Plugin {
  const dataRoot = join(repoRoot, 'data/estimating/production-rates');

  return {
    name: 'production-rate-review-dev-server',
    configureServer(server) {
      server.middlewares.use('/dev-api/production-rates', (req, res, next) => {
        if (!req.url) {
          next();
          return;
        }

        const url = new URL(req.url, 'http://localhost');
        const pathname = url.pathname;

        if (req.method === 'GET' && pathname === '/figures') {
          const division = url.searchParams.get('division') ?? '';
          const rawDir = join(dataRoot, 'raw');
          const files = existsSync(rawDir)
            ? readdirSync(rawDir).filter((name) => name.endsWith('.json'))
            : [];
          const figures = files
            .map((name) => {
              try {
                const payload = JSON.parse(readFileSync(join(rawDir, name), 'utf8')) as {
                  batchMeta?: { division?: string; figure?: string; figureTitle?: string };
                };
                const meta = payload.batchMeta ?? {};
                return {
                  stem: name.replace(/\.json$/, ''),
                  division: meta.division ?? '',
                  figure: meta.figure ?? '',
                  figureTitle: meta.figureTitle ?? '',
                };
              } catch {
                return null;
              }
            })
            .filter((item): item is NonNullable<typeof item> => item != null)
            .filter((item) => !division || item.division === division);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ figures }));
          return;
        }

        const fileMatch = pathname.match(/^\/([^/]+)\/([^/]+\.json)$/);
        if (req.method === 'GET' && fileMatch) {
          const stage = fileMatch[1];
          const fileName = fileMatch[2];
          if (!isStage(stage)) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Invalid stage' }));
            return;
          }
          const filePath = join(dataRoot, stage, fileName);
          if (!existsSync(filePath)) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'File not found' }));
            return;
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(readFileSync(filePath, 'utf8'));
          return;
        }

        if (req.method === 'POST' && pathname === '/write') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const payload = JSON.parse(body) as {
                stage: Stage;
                fileName: string;
                content: unknown;
              };
              if (!isStage(payload.stage)) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Invalid stage' }));
                return;
              }
              const dir = join(dataRoot, payload.stage);
              mkdirSync(dir, { recursive: true });
              const target = resolve(dir, payload.fileName);
              if (!target.startsWith(normalize(dir))) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Invalid file path' }));
                return;
              }
              writeFileSync(target, JSON.stringify(payload.content, null, 2), 'utf8');
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: true, path: target }));
            } catch (error) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: String(error) }));
            }
          });
          return;
        }

        next();
      });

      server.middlewares.use('/dev-api/adobe-rejected-recovery', (req, res, next) => {
        if (!req.url) {
          next();
          return;
        }

        const url = new URL(req.url, 'http://localhost');
        const pathname = url.pathname;
        const rejectedPath = join(repoRoot, ADOBE_REJECTED_RELATIVE_PATH);
        const reviewFixedPath = join(repoRoot, ADOBE_REJECTED_REVIEW_FIXED_RELATIVE_PATH);

        const readBody = (): Promise<string> =>
          new Promise((resolveBody, rejectBody) => {
            let body = '';
            req.on('data', (chunk) => {
              body += chunk;
            });
            req.on('end', () => resolveBody(body));
            req.on('error', rejectBody);
          });

        if (req.method === 'GET' && pathname === '/rejected') {
          if (!existsSync(rejectedPath)) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Rejected file not found' }));
            return;
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(readFileSync(rejectedPath, 'utf8'));
          return;
        }

        if (req.method === 'GET' && pathname === '/review-fixed') {
          const payload = loadAdobeRejectedReviewFixedFile(repoRoot);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(payload));
          return;
        }

        if (req.method === 'POST' && pathname === '/review-fixed/validate') {
          void readBody()
            .then((body) => {
              const payload = JSON.parse(body) as AdobeRejectedReviewFixedFile;
              const rejected = loadAdobeRejectedFile(repoRoot);
              const errors = validateReviewFixedFile(payload, rejected.records, repoRoot);
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  ok: errors.length === 0,
                  errors,
                  validatedFixCount: payload.records.length,
                }),
              );
            })
            .catch((error) => {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: String(error) }));
            });
          return;
        }

        if (req.method === 'POST' && pathname === '/review-fixed') {
          void readBody()
            .then((body) => {
              const payload = JSON.parse(body) as AdobeRejectedReviewFixedFile;
              const rejected = loadAdobeRejectedFile(repoRoot);
              const errors = validateReviewFixedFile(payload, rejected.records, repoRoot);
              if (errors.length > 0) {
                res.statusCode = 400;
                res.end(JSON.stringify({ ok: false, errors }));
                return;
              }
              mkdirSync(dirname(reviewFixedPath), { recursive: true });
              writeFileSync(reviewFixedPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: true, path: reviewFixedPath }));
            })
            .catch((error) => {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: String(error) }));
            });
          return;
        }

        if (req.method === 'POST' && pathname === '/suggest-fix') {
          void readBody()
            .then((body) => {
              const payload = JSON.parse(body) as { rejectedId?: string };
              const rejected = loadAdobeRejectedFile(repoRoot);
              const record = rejected.records.find((item) => item.id === payload.rejectedId);
              if (!record) {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: 'Rejected record not found' }));
                return;
              }
              const contextRows = loadAdobeFinalReviewedRows(repoRoot);
              const fix = buildRecoveryFixFromSuggestion(record, contextRows, repoRoot, {
                reviewedBy: 'dev-ui',
              });
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ fix }));
            })
            .catch((error) => {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: String(error) }));
            });
          return;
        }

        next();
      });
    },
  };
}
