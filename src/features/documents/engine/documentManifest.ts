import type { DocumentInput, DocumentManifest } from '../types';
import { assembleDocument } from './documentAssembly';

/**
 * Generate the document manifest standalone. Delegates to the assembly engine so
 * the manifest (versions, input snapshot, recommendation decisions, output hash)
 * is always consistent with the document that would actually be produced.
 */
export function generateDocumentManifest(input: DocumentInput): DocumentManifest {
  return assembleDocument(input).manifest;
}
