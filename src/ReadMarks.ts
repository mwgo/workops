import * as SDK from "azure-devops-extension-sdk";
import { CommonServiceIds, IExtensionDataManager, IExtensionDataService } from "azure-devops-extension-api";

export interface IReadMark {
    readAt: string;
    markedAt: string;
}

export type ReadMarksMap = { [key: string]: IReadMark };

interface IReadMarksDocument {
    id: string;
    items: ReadMarksMap;
    __etag?: number;
}

export class ReadMarks {

    private static readonly collection = "ReadMarks";
    private static readonly keepDays = 90;

    private manager?: Promise<IExtensionDataManager>;

    private getManager(): Promise<IExtensionDataManager> {
        if (!this.manager) {
            this.manager = (async () => {
                const token = await SDK.getAccessToken();
                const service = await SDK.getService<IExtensionDataService>(CommonServiceIds.ExtensionDataService);
                return service.getExtensionDataManager(SDK.getExtensionContext().id, token);
            })();
        }
        return this.manager;
    }

    private async getDocument(userId: string): Promise<IReadMarksDocument> {
        const manager = await this.getManager();
        try {
            const doc = await manager.getDocument(ReadMarks.collection, userId) as IReadMarksDocument;
            if (!doc.items) doc.items = {};
            return doc;
        }
        catch (e) {
            if (!ReadMarks.isNotFound(e)) throw e;
            return { id: userId, items: {} };
        }
    }

    private static isNotFound(e: any): boolean {
        return !!e && (e.status==404 || /does not exist|not found/i.test(String(e.message || e)));
    }

    async load(userId: string): Promise<ReadMarksMap> {
        if (!userId) return {};
        try {
            return (await this.getDocument(userId)).items;
        }
        catch {
            return {};
        }
    }

    async markRead(userId: string, key: string, readAt: string): Promise<ReadMarksMap> {
        const manager = await this.getManager();
        for (let attempt = 0; ; attempt++) {
            const doc = await this.getDocument(userId);
            doc.items[key] = { readAt: readAt, markedAt: new Date().toISOString() };
            ReadMarks.removeOld(doc.items);
            try {
                return (await manager.setDocument(ReadMarks.collection, doc) as IReadMarksDocument).items;
            }
            catch (e) {
                if (attempt>0) throw e;
            }
        }
    }

    private static removeOld(items: ReadMarksMap) {
        const limit = Date.now() - ReadMarks.keepDays*24*60*60*1000;
        for (const key of Object.keys(items)) {
            if (new Date(items[key].markedAt).getTime()<limit) delete items[key];
        }
    }
}
