import Dexie, { type Table } from 'dexie';
import type { ProjectDocument } from '../shared/types.ts';

export class DeviceStudioDatabase extends Dexie {
  projects!: Table<ProjectDocument, string>;

  constructor() {
    super('DeviceStudioDB');
    this.version(1).stores({
      projects: 'id, name, updatedAt, createdAt',
    });
  }
}

export const studioDb = new DeviceStudioDatabase();

export async function saveProjectToDb(project: ProjectDocument): Promise<void> {
  try {
    await studioDb.projects.put({
      ...project,
      updatedAt: Date.now(),
    });
  } catch (err) {
    console.warn('IndexedDB save fallback warning:', err);
  }
}

export async function listProjectsFromDb(): Promise<ProjectDocument[]> {
  try {
    return await studioDb.projects.orderBy('updatedAt').reverse().toArray();
  } catch {
    return [];
  }
}

export async function loadProjectFromDb(id: string): Promise<ProjectDocument | undefined> {
  try {
    return await studioDb.projects.get(id);
  } catch {
    return undefined;
  }
}

export async function deleteProjectFromDb(id: string): Promise<void> {
  try {
    await studioDb.projects.delete(id);
  } catch {
    // ignore
  }
}
