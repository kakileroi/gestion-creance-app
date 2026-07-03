class Database {
    constructor() {
        this.dbName = 'GesCreancesDB';
        this.dbVersion = 1;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                if (!db.objectStoreNames.contains('clients')) {
                    const clientStore = db.createObjectStore('clients', { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    clientStore.createIndex('nom', 'nom', { unique: false });
                }

                if (!db.objectStoreNames.contains('creances')) {
                    const creanceStore = db.createObjectStore('creances', { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    creanceStore.createIndex('clientId', 'clientId', { unique: false });
                    creanceStore.createIndex('statut', 'statut', { unique: false });
                }

                if (!db.objectStoreNames.contains('paiements')) {
                    const paiementStore = db.createObjectStore('paiements', { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    paiementStore.createIndex('creanceId', 'creanceId', { unique: false });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve();
            };

            request.onerror = (event) => reject(event.target.error);
        });
    }

    async addClient(client) {
        const tx = this.db.transaction('clients', 'readwrite');
        const store = tx.objectStore('clients');
        const id = await new Promise((res, rej) => {
            const req = store.add(client);
            req.onsuccess = () => res(req.result);
            req.onerror = () => rej(req.error);
        });
        return id;
    }

    async getAllClients() {
        const tx = this.db.transaction('clients', 'readonly');
        const store = tx.objectStore('clients');
        return await new Promise((res, rej) => {
            const req = store.getAll();
            req.onsuccess = () => res(req.result);
            req.onerror = () => rej(req.error);
        });
    }

    async getClientById(id) {
        const tx = this.db.transaction('clients', 'readonly');
        const store = tx.objectStore('clients');
        return await new Promise((res, rej) => {
            const req = store.get(id);
            req.onsuccess = () => res(req.result);
            req.onerror = () => rej(req.error);
        });
    }

    async updateClient(client) {
        const tx = this.db.transaction('clients', 'readwrite');
        const store = tx.objectStore('clients');
        await new Promise((res, rej) => {
            const req = store.put(client);
            req.onsuccess = () => res();
            req.onerror = () => rej(req.error);
        });
    }

    async deleteClient(id) {
        const creances = await this.getCreancesByClient(id);
        for (const c of creances) {
            await this.deleteCreance(c.id);
        }
        const tx = this.db.transaction('clients', 'readwrite');
        const store = tx.objectStore('clients');
        await new Promise((res, rej) => {
            const req = store.delete(id);
            req.onsuccess = () => res();
            req.onerror = () => rej(req.error);
        });
    }

    async addCreance(creance) {
        const tx = this.db.transaction('creances', 'readwrite');
        const store = tx.objectStore('creances');
        return await new Promise((res, rej) => {
            const req = store.add(creance);
            req.onsuccess = () => res(req.result);
            req.onerror = () => rej(req.error);
        });
    }

    async getAllCreances() {
        const tx = this.db.transaction('creances', 'readonly');
        const store = tx.objectStore('creances');
        return await new Promise((res, rej) => {
            const req = store.getAll();
            req.onsuccess = () => res(req.result);
            req.onerror = () => rej(req.error);
        });
    }

    async getCreancesByClient(clientId) {
        const tx = this.db.transaction('creances', 'readonly');
        const store = tx.objectStore('creances');
        const index = store.index('clientId');
        return await new Promise((res, rej) => {
            const req = index.getAll(clientId);
            req.onsuccess = () => res(req.result);
            req.onerror = () => rej(req.error);
        });
    }

    async updateCreance(creance) {
        const tx = this.db.transaction('creances', 'readwrite');
        const store = tx.objectStore('creances');
        await new Promise((res, rej) => {
            const req = store.put(creance);
            req.onsuccess = () => res();
            req.onerror = () => rej(req.error);
        });
    }

    async deleteCreance(id) {
        const paiements = await this.getPaiementsByCreance(id);
        for (const p of paiements) {
            await this.deletePaiement(p.id);
        }
        const tx = this.db.transaction('creances', 'readwrite');
        const store = tx.objectStore('creances');
        await new Promise((res, rej) => {
            const req = store.delete(id);
            req.onsuccess = () => res();
            req.onerror = () => rej(req.error);
        });
    }

    async addPaiement(paiement) {
        const tx = this.db.transaction(['paiements', 'creances'], 'readwrite');
        const pStore = tx.objectStore('paiements');
        const cStore = tx.objectStore('creances');
        
        const pid = await new Promise((res, rej) => {
            const req = pStore.add(paiement);
            req.onsuccess = () => res(req.result);
            req.onerror = () => rej(req.error);
        });

        const creance = await new Promise((res, rej) => {
            const req = cStore.get(paiement.creanceId);
            req.onsuccess = () => res(req.result);
            req.onerror = () => rej(req.error);
        });

        if (creance) {
            creance.montantPaye = (creance.montantPaye || 0) + paiement.montant;
            if (creance.montantPaye >= creance.montantTotal) {
                creance.statut = 'PAYEE';
            }
            cStore.put(creance);
        }

        return pid;
    }

    async getAllPaiements() {
        const tx = this.db.transaction('paiements', 'readonly');
        const store = tx.objectStore('paiements');
        return await new Promise((res, rej) => {
            const req = store.getAll();
            req.onsuccess = () => res(req.result);
            req.onerror = () => rej(req.error);
        });
    }

    async getPaiementsByCreance(creanceId) {
        const tx = this.db.transaction('paiements', 'readonly');
        const store = tx.objectStore('paiements');
        const index = store.index('creanceId');
        return await new Promise((res, rej) => {
            const req = index.getAll(creanceId);
            req.onsuccess = () => res(req.result);
            req.onerror = () => rej(req.error);
        });
    }

    async deletePaiement(id) {
        const tx = this.db.transaction('paiements', 'readwrite');
        const store = tx.objectStore('paiements');
        await new Promise((res, rej) => {
            const req = store.delete(id);
            req.onsuccess = () => res();
            req.onerror = () => rej(req.error);
        });
    }
}

const db = new Database();