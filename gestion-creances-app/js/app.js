let currentPage = 'dashboard';
let currentFilter = 'TOUS';

// Initialisation
document.addEventListener('DOMContentLoaded', async () => {
    await db.init();
    initNavigation();
    loadDashboard();
    checkRetards();
    setDefaultDates();
    
    // Cacher le splash screen
    setTimeout(() => {
        document.getElementById('splashScreen').classList.add('hide');
    }, 1500);
});

// Navigation
function initNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function() {
            navigateTo(this.dataset.page);
            if (window.innerWidth < 768) toggleSidebar();
        });
    });

    // Gestes de swipe pour mobile
    let touchStartX = 0;
    document.addEventListener('touchstart', e => {
        touchStartX = e.touches[0].clientX;
    });
    
    document.addEventListener('touchend', e => {
        const diff = e.changedTouches[0].clientX - touchStartX;
        if (diff > 100) toggleSidebar(true);
        if (diff < -100) toggleSidebar(false);
    });
}

function navigateTo(page) {
    currentPage = page;
    
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector(`[data-page="${page}"]`)?.classList.add('active');
    
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(page)?.classList.add('active');
    
    document.querySelector('.header-title').textContent = getPageTitle(page);
    
    switch(page) {
        case 'dashboard': loadDashboard(); break;
        case 'clients': loadClients(); break;
        case 'creances': loadCreances(); break;
        case 'paiements': loadPaiements(); break;
        case 'rapports': loadRapports(); break;
    }
}

function getPageTitle(page) {
    const titles = {
        'dashboard': 'Tableau de bord',
        'clients': 'Clients',
        'creances': 'Créances',
        'paiements': 'Paiements',
        'rapports': 'Rapports'
    };
    return titles[page] || 'GesCréances';
}

function toggleSidebar(force) {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (force !== undefined) {
        sidebar.classList.toggle('active', force);
        overlay.classList.toggle('active', force);
    } else {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
    }
}

function refreshCurrentPage() {
    navigateTo(currentPage);
    showToast('Page actualisée');
}

// Dashboard
async function loadDashboard() {
    try {
        const [clients, creances] = await Promise.all([
            db.getAllClients(),
            db.getAllCreances()
        ]);
        
        document.getElementById('totalClients').textContent = clients.length;
        
        const enCours = creances.filter(c => c.statut === 'EN_COURS');
        document.getElementById('creancesEnCours').textContent = enCours.length;
        
        const enRetard = creances.filter(c => c.statut === 'EN_RETARD');
        document.getElementById('creancesRetard').textContent = enRetard.length;
        
        const totalDu = creances
            .filter(c => c.statut !== 'PAYEE')
            .reduce((sum, c) => sum + (c.montantTotal - (c.montantPaye || 0)), 0);
        document.getElementById('montantTotal').textContent = totalDu.toFixed(2) + ' €';
        
        // Activité récente
        const paiements = await db.getAllPaiements();
        const recentActivity = document.getElementById('recentActivity');
        
        if (paiements.length > 0) {
            const recent = paiements.slice(-5).reverse();
            recentActivity.innerHTML = recent.map(p => `
                <div class="activity-item">
                    <i class="fas fa-check-circle"></i>
                    <div>
                        <strong>${p.montant.toFixed(2)} €</strong>
                        <small>${new Date(p.datePaiement).toLocaleDateString('fr-FR')} - ${p.modePaiement}</small>
                    </div>
                </div>
            `).join('');
        } else {
            recentActivity.innerHTML = '<div class="empty-state"><i class="fas fa-clock"></i><p>Aucune activité</p></div>';
        }
    } catch (error) {
        console.error('Erreur dashboard:', error);
    }
}

// Clients
async function loadClients() {
    const clients = await db.getAllClients();
    const container = document.getElementById('clientsList');
    
    if (clients.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><h3>Aucun client</h3><p>Ajoutez votre premier client</p></div>';
        return;
    }
    
    let html = '';
    for (const client of clients) {
        const creances = await db.getCreancesByClient(client.id);
        const totalDu = creances
            .filter(c => c.statut !== 'PAYEE')
            .reduce((sum, c) => sum + (c.montantTotal - (c.montantPaye || 0)), 0);
        
        html += `
            <div class="list-card">
                <div class="list-card-header">
                    <div class="list-card-title">${client.prenom} ${client.nom}</div>
                    ${totalDu > 0 ? `<span class="badge badge-danger">${totalDu.toFixed(2)} €</span>` : '<span class="badge badge-success">Payé</span>'}
                </div>
                <div class="list-card-subtitle">
                    <i class="fas fa-phone"></i> ${client.telephone}
                    ${client.email ? ` | <i class="fas fa-envelope"></i> ${client.email}` : ''}
                </div>
                <div class="list-card-actions">
                    <button class="btn btn-primary btn-sm" onclick="editClient(${client.id})">
                        <i class="fas fa-edit"></i> Modifier
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteClient(${client.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
}

function searchClients() {
    const query = document.getElementById('searchClient').value.toLowerCase();
    const cards = document.querySelectorAll('#clientsList .list-card');
    
    cards.forEach(card => {
        card.style.display = card.textContent.toLowerCase().includes(query) ? '' : 'none';
    });
}

function showClientForm(clientId = null) {
    document.getElementById('clientModal').style.display = 'block';
    
    if (clientId) {
        document.getElementById('clientModalTitle').textContent = 'Modifier le client';
        loadClientData(clientId);
    } else {
        document.getElementById('clientModalTitle').textContent = 'Nouveau Client';
        document.getElementById('clientForm').reset();
        document.getElementById('clientId').value = '';
    }
}

async function loadClientData(id) {
    const client = await db.getClientById(id);
    if (client) {
        document.getElementById('clientId').value = client.id;
        document.getElementById('clientNom').value = client.nom;
        document.getElementById('clientPrenom').value = client.prenom;
        document.getElementById('clientTel').value = client.telephone;
        document.getElementById('clientEmail').value = client.email || '';
        document.getElementById('clientAdresse').value = client.adresse || '';
    }
}

function editClient(id) {
    showClientForm(id);
}

document.getElementById('clientForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const client = {
        nom: document.getElementById('clientNom').value,
        prenom: document.getElementById('clientPrenom').value,
        telephone: document.getElementById('clientTel').value,
        email: document.getElementById('clientEmail').value,
        adresse: document.getElementById('clientAdresse').value
    };
    
    const id = document.getElementById('clientId').value;
    
    if (id) {
        client.id = parseInt(id);
        await db.updateClient(client);
        showToast('Client modifié');
    } else {
        await db.addClient(client);
        showToast('Client ajouté');
    }
    
    closeModal('clientModal');
    loadClients();
    loadDashboard();
});

async function deleteClient(id) {
    if (confirm('Supprimer ce client et toutes ses créances ?')) {
        await db.deleteClient(id);
        showToast('Client supprimé');
        loadClients();
        loadDashboard();
    }
}

// Créances
async function loadCreances(filter = 'TOUS') {
    currentFilter = filter;
    const [creances, clients] = await Promise.all([
        db.getAllCreances(),
        db.getAllClients()
    ]);
    
    const filtered = filter === 'TOUS' ? creances : creances.filter(c => c.statut === filter);
    const container = document.getElementById('creancesList');
    
    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-file-invoice"></i><h3>Aucune créance</h3></div>';
        return;
    }
    
    let html = '';
    for (const creance of filtered) {
        const client = clients.find(c => c.id === creance.clientId);
        const reste = creance.montantTotal - (creance.montantPaye || 0);
        
        let badgeClass = 'badge-info';
        let statutText = 'En cours';
        if (creance.statut === 'PAYEE') { badgeClass = 'badge-success'; statutText = 'Payée'; }
        if (creance.statut === 'EN_RETARD') { badgeClass = 'badge-danger'; statutText = 'En retard'; }
        
        html += `
            <div class="list-card">
                <div class="list-card-header">
                    <div class="list-card-title">${client ? client.prenom + ' ' + client.nom : 'N/A'}</div>
                    <span class="badge ${badgeClass}">${statutText}</span>
                </div>
                <div class="list-card-details">
                    <div>
                        <small>Total</small>
                        <strong>${creance.montantTotal.toFixed(2)} €</strong>
                    </div>
                    <div>
                        <small>Payé</small>
                        <strong>${(creance.montantPaye || 0).toFixed(2)} €</strong>
                    </div>
                    <div>
                        <small>Reste</small>
                        <strong style="color: ${reste > 0 ? 'var(--danger)' : 'var(--success)'}">${reste.toFixed(2)} €</strong>
                    </div>
                </div>
                <div class="list-card-subtitle">
                    Échéance: ${new Date(creance.dateEcheance).toLocaleDateString('fr-FR')}
                </div>
                <div class="list-card-actions">
                    ${creance.statut !== 'PAYEE' ? `
                        <button class="btn btn-success btn-sm" onclick="showPaiementForm(${creance.id})">
                            <i class="fas fa-money-bill"></i> Payer
                        </button>
                    ` : ''}
                    <button class="btn btn-danger btn-sm" onclick="deleteCreance(${creance.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
    
    // Mise à jour des chips
    document.querySelectorAll('.chip').forEach(chip => {
        chip.classList.toggle('active', chip.textContent.includes(
            filter === 'TOUS' ? 'Tous' : 
            filter === 'EN_COURS' ? 'cours' : 
            filter === 'PAYEE' ? 'Payées' : 'retard'
        ));
    });
}

function filterCreances(filter) {
    navigateTo('creances');
    loadCreances(filter);
}

function showCreanceForm() {
    loadClientsForSelect('creanceClient');
    document.getElementById('creanceForm').reset();
    document.getElementById('creanceModal').style.display = 'block';
}

async function loadClientsForSelect(selectId) {
    const clients = await db.getAllClients();
    const select = document.getElementById(selectId);
    select.innerHTML = '<option value="">Sélectionnez un client</option>';
    clients.forEach(c => {
        select.innerHTML += `<option value="${c.id}">${c.prenom} ${c.nom}</option>`;
    });
}

document.getElementById('creanceForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    await db.addCreance({
        clientId: parseInt(document.getElementById('creanceClient').value),
        montantTotal: parseFloat(document.getElementById('creanceMontant').value),
        montantPaye: 0,
        dateEcheance: new Date(document.getElementById('creanceDate').value).getTime(),
        statut: 'EN_COURS',
        description: document.getElementById('creanceDescription').value
    });
    
    closeModal('creanceModal');
    showToast('Créance ajoutée');
    loadCreances(currentFilter);
    loadDashboard();
});

async function deleteCreance(id) {
    if (confirm('Supprimer cette créance ?')) {
        await db.deleteCreance(id);
        showToast('Créance supprimée');
        loadCreances(currentFilter);
        loadDashboard();
    }
}

// Paiements
async function loadPaiements() {
    const [paiements, creances, clients] = await Promise.all([
        db.getAllPaiements(),
        db.getAllCreances(),
        db.getAllClients()
    ]);
    
    const container = document.getElementById('paiementsList');
    
    if (paiements.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-hand-holding-usd"></i><h3>Aucun paiement</h3></div>';
        return;
    }
    
    let html = '';
    for (const p of paiements.reverse()) {
        const creance = creances.find(c => c.id === p.creanceId);
        const client = creance ? clients.find(c => c.id === creance.clientId) : null;
        
        html += `
            <div class="list-card">
                <div class="list-card-header">
                    <div class="list-card-title">${client ? client.prenom + ' ' + client.nom : 'N/A'}</div>
                    <strong>${p.montant.toFixed(2)} €</strong>
                </div>
                <div class="list-card-subtitle">
                    ${new Date(p.datePaiement).toLocaleDateString('fr-FR')} - ${p.modePaiement}
                </div>
                <div class="list-card-actions">
                    <button class="btn btn-danger btn-sm" onclick="deletePaiement(${p.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
}

function showPaiementForm(creanceId = null) {
    loadCreancesForPaiement('paiementCreance');
    document.getElementById('paiementForm').reset();
    document.getElementById('paiementDate').value = new Date().toISOString().split('T')[0];
    if (creanceId) document.getElementById('paiementCreance').value = creanceId;
    document.getElementById('paiementModal').style.display = 'block';
}

async function loadCreancesForPaiement(selectId) {
    const [creances, clients] = await Promise.all([
        db.getAllCreances(),
        db.getAllClients()
    ]);
    
    const select = document.getElementById(selectId);
    select.innerHTML = '<option value="">Sélectionnez une créance</option>';
    
    creances
        .filter(c => c.statut !== 'PAYEE')
        .forEach(c => {
            const client = clients.find(cl => cl.id === c.clientId);
            const reste = c.montantTotal - (c.montantPaye || 0);
            select.innerHTML += `<option value="${c.id}">${client ? client.prenom + ' ' + client.nom : 'N/A'} - Reste: ${reste.toFixed(2)} €</option>`;
        });
}

document.getElementById('paiementForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    await db.addPaiement({
        creanceId: parseInt(document.getElementById('paiementCreance').value),
        montant: parseFloat(document.getElementById('paiementMontant').value),
        datePaiement: new Date(document.getElementById('paiementDate').value).getTime(),
        modePaiement: document.getElementById('paiementMode').value,
        reference: document.getElementById('paiementRef').value
    });
    
    closeModal('paiementModal');
    showToast('Paiement enregistré');
    loadCreances(currentFilter);
    loadPaiements();
    loadDashboard();
});

async function deletePaiement(id) {
    if (confirm('Supprimer ce paiement ?')) {
        await db.deletePaiement(id);
        showToast('Paiement supprimé');
        loadPaiements();
        loadDashboard();
    }
}

// Rapports
async function loadRapports() {
    const [creances, clients] = await Promise.all([
        db.getAllCreances(),
        db.getAllClients()
    ]);
    
    const totalGeneral = creances.reduce((sum, c) => sum + c.montantTotal, 0);
    const totalPaye = creances.reduce((sum, c) => sum + (c.montantPaye || 0), 0);
    const totalDu = totalGeneral - totalPaye;
    const nbPayees = creances.filter(c => c.statut === 'PAYEE').length;
    const nbRetard = creances.filter(c => c.statut === 'EN_RETARD').length;
    
    let html = `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon" style="background: var(--info);"><i class="fas fa-chart-pie"></i></div>
                <div class="stat-info">
                    <h3>Total Créances</h3>
                    <p>${creances.length}</p>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background: var(--success);"><i class="fas fa-check-circle"></i></div>
                <div class="stat-info">
                    <h3>Payées</h3>
                    <p>${nbPayees}</p>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background: var(--danger);"><i class="fas fa-exclamation-triangle"></i></div>
                <div class="stat-info">
                    <h3>En retard</h3>
                    <p>${nbRetard}</p>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background: var(--warning);"><i class="fas fa-percentage"></i></div>
                <div class="stat-info">
                    <h3>Taux recouvrement</h3>
                    <p>${totalGeneral > 0 ? ((totalPaye / totalGeneral) * 100).toFixed(1) : 0}%</p>
                </div>
            </div>
        </div>
        
        <div style="margin-top: 20px;">
            <h3>Montants</h3>
            <div class="list-card">
                <div class="list-card-details">
                    <div><small>Total général</small><strong>${totalGeneral.toFixed(2)} €</strong></div>
                    <div><small>Total payé</small><strong style="color: var(--success)">${totalPaye.toFixed(2)} €</strong></div>
                    <div><small>Reste à payer</small><strong style="color: var(--danger)">${totalDu.toFixed(2)} €</strong></div>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('rapportsContent').innerHTML = html;
}

// Utilitaires
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function setDefaultDates() {
    document.getElementById('creanceDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('paiementDate').value = new Date().toISOString().split('T')[0];
}

async function checkRetards() {
    const creances = await db.getAllCreances();
    const now = Date.now();
    
    for (const c of creances) {
        if (c.statut === 'EN_COURS' && c.dateEcheance < now) {
            c.statut = 'EN_RETARD';
            await db.updateCreance(c);
        }
    }
}

// Export/Import
async function exportData() {
    const [clients, creances, paiements] = await Promise.all([
        db.getAllClients(),
        db.getAllCreances(),
        db.getAllPaiements()
    ]);
    
    const data = { clients, creances, paiements, exportDate: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gescreances-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Données exportées');
}

function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        const text = await file.text();
        const data = JSON.parse(text);
        
        if (confirm(`Importer ${data.clients.length} clients, ${data.creances.length} créances et ${data.paiements.length} paiements ?`)) {
            for (const client of data.clients) await db.addClient(client);
            for (const creance of data.creances) await db.addCreance(creance);
            for (const paiement of data.paiements) await db.addPaiement(paiement);
            showToast('Données importées');
            loadDashboard();
        }
    };
    input.click();
}

// Fermer les modals en cliquant dehors
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}