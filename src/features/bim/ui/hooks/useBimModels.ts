import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BimModel, BimModelObject, BimSelectedObjectSnapshot } from '../../types';
import { validateBimModelFileForUpload } from '../../services/bimModelUploadValidation';
import { inferBimModelFormat } from '../../services/bimModelFormatRegistry';
import {
  createModel,
  deleteBimModel,
  getModel,
  insertObjects,
  listModelObjects,
  listModels,
} from '../../services/bimModelService';
import {
  deleteBimModelFile,
  getBimModelSignedUrl,
  uploadBimModel,
} from '../../services/bimModelStorageService';

interface UseBimModelsOptions {
  projectId: string | null | undefined;
  estimateId: string | null | undefined;
  userId: string | null | undefined;
}

export function useBimModels({ projectId, estimateId, userId }: UseBimModelsOptions) {
  const [models, setModels] = useState<BimModel[]>([]);
  const [activeModelId, setActiveModelId] = useState<string | null>(null);
  const [objects, setObjects] = useState<BimModelObject[]>([]);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<BimSelectedObjectSnapshot | null>(null);
  const uploadingRef = useRef(false);

  const activeModel = useMemo(
    () => models.find((model) => model.id === activeModelId) ?? null,
    [models, activeModelId],
  );

  const objectIdByExternal = useMemo(() => {
    const map = new Map<string, string>();
    for (const object of objects) {
      map.set(object.externalObjectId, object.id);
    }
    return map;
  }, [objects]);

  const reloadModels = useCallback(async () => {
    if (!projectId) {
      setModels([]);
      return;
    }
    setLoading(true);
    const result = await listModels(projectId);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setModels(result.data ?? []);
    setError(null);
  }, [projectId]);

  useEffect(() => {
    void reloadModels();
  }, [reloadModels]);

  const loadActiveModel = useCallback(async (modelId: string) => {
    setLoading(true);
    const modelResult = await getModel(modelId);
    if (modelResult.error || !modelResult.data) {
      setLoading(false);
      setError(modelResult.error ?? 'Model not found.');
      return;
    }
    const objectsResult = await listModelObjects(modelId);
    setLoading(false);
    if (objectsResult.error) {
      setError(objectsResult.error);
      return;
    }
    setObjects(objectsResult.data ?? []);
    try {
      const url = await getBimModelSignedUrl(modelResult.data.storagePath);
      setSignedUrl(url);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load model URL.');
      setSignedUrl(null);
    }
  }, []);

  useEffect(() => {
    if (!activeModelId) {
      setSignedUrl(null);
      setObjects([]);
      return;
    }
    void loadActiveModel(activeModelId);
  }, [activeModelId, loadActiveModel]);

  const uploadModel = useCallback(
    async (file: File) => {
      if (uploadingRef.current) return;
      if (!projectId || !userId) {
        setError('Sign in and open a project before uploading a model.');
        return;
      }
      uploadingRef.current = true;
      setUploading(true);
      setError(null);
      try {
        const validation = await validateBimModelFileForUpload(file);
        if (!validation.ok) {
          throw new Error(validation.error ?? 'Invalid model file.');
        }

        const modelId = crypto.randomUUID();
        const { storagePath, fileSize } = await uploadBimModel({
          file,
          userId,
          projectId,
          modelId,
        });
        const createResult = await createModel({
          id: modelId,
          projectId,
          estimateId,
          uploadedBy: userId,
          fileName: file.name,
          fileType: 'glb',
          originalFileName: file.name,
          originalFileType: inferBimModelFormat(file.name),
          viewerFileType: 'glb',
          storagePath,
          fileSize,
          status: 'ready',
          processingStatus: 'ready',
          metadata: {
            importPipeline: 'glb_mvp',
            supportedFormat: true,
          },
        });
        if (createResult.error || !createResult.data) {
          throw new Error(createResult.error ?? 'Could not save model metadata.');
        }
        setModels((prev) => [createResult.data!, ...prev]);
        setActiveModelId(createResult.data.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed.');
      } finally {
        uploadingRef.current = false;
        setUploading(false);
      }
    },
    [projectId, estimateId, userId],
  );

  const persistParsedObjects = useCallback(
    async (snapshots: BimSelectedObjectSnapshot[]) => {
      if (!activeModel || snapshots.length === 0) return;
      const result = await insertObjects(
        snapshots.map((snapshot) => ({
          modelId: activeModel.id,
          projectId: activeModel.projectId,
          externalObjectId: snapshot.externalObjectId,
          name: snapshot.name,
          objectType: snapshot.objectType,
          category: snapshot.category,
          material: snapshot.material,
          level: snapshot.level,
          properties: snapshot.properties,
          geometryMetrics: snapshot.geometryMetrics,
        })),
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      setObjects(result.data ?? []);
    },
    [activeModel],
  );

  const markObjectAdded = useCallback((externalObjectId: string) => {
    setObjects((prev) =>
      prev.map((object) =>
        object.externalObjectId === externalObjectId
          ? { ...object, takeoffStatus: 'mapped' as const }
          : object,
      ),
    );
  }, []);

  const removeModelFromState = useCallback((modelId: string) => {
    setModels((prev) => prev.filter((model) => model.id !== modelId));
    setActiveModelId((current) => (current === modelId ? null : current));
    setObjects((current) => (activeModelId === modelId ? [] : current));
    setSignedUrl((current) => (activeModelId === modelId ? null : current));
    setSelected((current) => (activeModelId === modelId ? null : current));
  }, [activeModelId]);

  const deleteModel = useCallback(async (modelId: string) => {
    setError(null);
    const result = await deleteBimModel(modelId);
    if (result.error || !result.data) {
      setError(result.error ?? 'Could not delete model.');
      return { ok: false, error: result.error ?? 'Could not delete model.' };
    }

    removeModelFromState(modelId);
    let storageWarning: string | null = null;
    if (result.data.storagePath) {
      try {
        await deleteBimModelFile(result.data.storagePath);
      } catch {
        storageWarning = 'Model removed from project, but storage cleanup failed.';
      }
    }

    return { ok: true, warning: storageWarning };
  }, [removeModelFromState]);

  return {
    models,
    activeModel,
    activeModelId,
    setActiveModelId,
    objects,
    objectIdByExternal,
    signedUrl,
    loading,
    uploading,
    error,
    selected,
    setSelected,
    uploadModel,
    deleteModel,
    persistParsedObjects,
    markObjectAdded,
    reloadModels,
  };
}
