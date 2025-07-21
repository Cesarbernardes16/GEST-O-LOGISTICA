// --- 1. CONFIGURAÇÃO ---
const SUPABASE_URL = 'https://nbaoripzckjnqwpsnxnz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5iYW9yaXB6Y2tqbnF3cHNueG56Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MjMxNzc4NSwiZXhwIjoyMDU3ODkzNzg1fQ.fEw0YukWwXTv4wCNBwNFLsUarVYMOMW9wYmXWLNiOnQ'; // <-- Use a chave 'anon' (pública) aqui!
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- 2. ELEMENTOS DA PÁGINA ---
const summaryCardsContainer = document.getElementById('summary-cards');
const toursTableBody = document.getElementById('tours-table-body');
const visaoMestraContainer = document.getElementById('visao-mestra');
const visaoDetalheContainer = document.getElementById('visao-detalhe');
const stopsListElement = document.getElementById('stops-list');
const stopsTitleElement = document.getElementById('stops-title');
const btnVoltar = document.getElementById('btn-voltar');
const filtroGeralInput = document.getElementById('filtro-geral');
const tabAndamento = document.getElementById('tab-andamento');
const tabFinalizadas = document.getElementById('tab-finalizadas');

// --- 3. ESTADO DA APLICAÇÃO ---
let todosOsTours = [];
let todasAsParadas = [];
let abaAtiva = 'andamento';
// Opcional: Adicionar um mapa de clientes se for carregar os nomes
let clientesMap = {}; 

// --- 4. FUNÇÕES DE RENDERIZAÇÃO E LÓGICA ---

function renderizarCartoesDeResumo(tours, paradas) {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const limiteAtraso = new Date(); limiteAtraso.setDate(hoje.getDate() - 2);

    const totalMapas = tours.length;
    const mapasFinalizados = tours.filter(t => t.total_stops > 0 && t.completed_stops === t.total_stops).length;
    const rotasAtrasadas = tours.filter(t => {
        const dataDaRota = new Date(t.tour_date);
        const rotaFinalizada = t.total_stops > 0 && t.completed_stops === t.total_stops;
        return dataDaRota <= limiteAtraso && !rotaFinalizada;
    }).length;
    const totalDevolvido = paradas.filter(p => p.status === 'RESCHEDULED').length;
    const totalEntregasValidas = paradas.filter(p => p.status !== 'RESCHEDULED').length;
    const sucessoEntregas = paradas.filter(p => p.finished_time).length;
    const performance = totalEntregasValidas > 0 ? ((sucessoEntregas / totalEntregasValidas) * 100).toFixed(1) : 0;
    
    summaryCardsContainer.innerHTML = `<div class="summary-card"><h3>Rotas do Dia</h3><div class="card-content"><div class="metric"><span class="value">${totalMapas}</span><span class="label">Total</span></div><div class="metric"><span class="value">${mapasFinalizados}</span><span class="label">Finalizadas</span></div></div></div><div class="summary-card"><h3>Rotas Atrasadas (D-2)</h3><div class="card-content"><div class="metric"><span class="value">${rotasAtrasadas}</span><span class="label">Total</span></div><div class="metric"><span class="value">0</span><span class="label">Finalizadas</span></div></div></div><div class="summary-card single-value"><h3>Devoluções</h3><div class="card-content"><div class="metric"><span class="value">${totalDevolvido}</span><span class="label">Entregas</span></div></div></div><div class="summary-card single-value"><h3>Performance</h3><div class="card-content"><div class="metric"><span class="value">${performance}%</span><span class="label">Sucesso</span></div></div></div>`;
}

function renderizarTabelaDeTours() {
    toursTableBody.innerHTML = ''; 
    const termoBusca = filtroGeralInput.value.toLowerCase().trim();

    // ===== INÍCIO DA MODIFICAÇÃO =====
    let toursParaExibir = todosOsTours.filter(tour => {
        // 1. Pesquisa por nome do motorista e ID do mapa
        const textoTour = `${tour.driver_name.toLowerCase()} ${tour.id}`;
        if (textoTour.includes(termoBusca)) {
            return true; // Se encontrar, já retorna true e inclui a rota
        }

        // 2. Pesquisa por códigos de cliente dentro das paradas da rota
        const paradasDoTour = todasAsParadas.filter(p => p.tour_id === tour.id);
        const clienteEncontrado = paradasDoTour.some(parada => 
            parada.customer_id && String(parada.customer_id).toLowerCase().includes(termoBusca)
        );

        return clienteEncontrado;
    });
    // ===== FIM DA MODIFICAÇÃO =====

    toursParaExibir = toursParaExibir.filter(tour => {
        const paradasDoTour = todasAsParadas.filter(p => p.tour_id === tour.id);
        const concluidas = paradasDoTour.filter(p => p.finished_time).length;
        const devolucoes = paradasDoTour.filter(p => p.status === 'RESCHEDULED').length;
        const totalParadas = tour.total_stops;
        const isFinalizada = totalParadas > 0 && (concluidas + devolucoes === totalParadas);

        if (abaAtiva === 'andamento') return !isFinalizada;
        if (abaAtiva === 'finalizadas') return isFinalizada;
        return true;
    });

    toursParaExibir.sort((a, b) => {
        const aTemDevolucao = todasAsParadas.some(p => p.tour_id === a.id && p.status === 'RESCHEDULED');
        const bTemDevolucao = todasAsParadas.some(p => p.tour_id === b.id && p.status === 'RESCHEDULED');
        if (aTemDevolucao && !bTemDevolucao) return -1;
        if (!aTemDevolucao && bTemDevolucao) return 1;
        return new Date(a.tour_date) - new Date(b.tour_date);
    });
    
    if (toursParaExibir.length === 0) {
        toursTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Nenhuma rota encontrada.</td></tr>';
        return;
    }

    for (const tour of toursParaExibir) {
        const paradasDoTour = todasAsParadas.filter(p => p.tour_id === tour.id);
        const concluidas = paradasDoTour.filter(p => p.finished_time).length;
        const total = tour.total_stops;
        const devolucoes = paradasDoTour.filter(p => p.status === 'RESCHEDULED').length;
        let statusClass = 'status-em-rota', statusText = 'Em Rota';
        if (total > 0 && concluidas + devolucoes === total) { statusClass = 'status-finalizado'; statusText = 'Finalizado'; }
        if (devolucoes > 0) { statusClass = 'status-critico'; }
        const dataFormatada = new Date(tour.tour_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
        const barraDeProgressoHTML = criarBarraDeProgresso(concluidas, total);
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${tour.driver_name}</td><td>${tour.id}<br><small>${dataFormatada}</small></td><td><span>${concluidas} de ${total}</span>${barraDeProgressoHTML}</td><td><span class="status-badge ${statusClass}">${statusText}</span></td><td>${devolucoes}</td><td><button class="btn-detalhes" data-tour-id="${tour.id}" data-driver-name="${tour.driver_name}">Ver Detalhes</button></td>`;
        toursTableBody.appendChild(tr);
    }
    
    document.querySelectorAll(".btn-detalhes").forEach(btn => {
        btn.addEventListener("click", e => {
            const tourId = e.target.dataset.tourId;
            const driverName = e.target.dataset.driverName;
            mostrarVisaoDetalhe(tourId, driverName);
        });
    });
}

function criarBarraDeProgresso(concluidas, total) {
    const porcentagem = total > 0 ? (concluidas / total) * 100 : 0;
    let corClasse = 'vermelho';
    if (porcentagem >= 70) { corClasse = 'verde'; } 
    else if (porcentagem >= 40) { corClasse = 'amarelo'; }
    const blocosPreenchidos = Math.round(porcentagem / 10);
    let blocosHTML = '';
    for (let i = 0; i < 10; i++) {
        blocosHTML += i < blocosPreenchidos ? `<span class="progress-segment filled ${corClasse}"></span>` : '<span class="progress-segment empty"></span>';
    }
    return `<div class="progress-bar-container-segmented">${blocosHTML}</div>`;
}

function renderizarDetalhesDasParadas(tourId, driverName) {
    stopsTitleElement.textContent = `Detalhes da Rota: ${driverName} (Mapa: ${tourId})`;
    const paradasDoTour = todasAsParadas.filter(p => p.tour_id == tourId);
    if (paradasDoTour.length === 0) { stopsListElement.innerHTML = "<li>Nenhuma parada encontrada.</li>"; return; }
    stopsListElement.innerHTML = "";
    const paradasConcluidas = paradasDoTour.filter(s => s.finished_time);
    const maiorParadaConcluida = paradasConcluidas.length > 0 ? Math.max(...paradasConcluidas.map(s => s.visit_order)) : 0;
    for (const stop of paradasDoTour) {
        let statusClass = 'pendente', statusText = stop.status, isCritical = false, criticalIcon = '';
        if (stop.finished_time) { statusClass = 'finalizada'; statusText = 'FINALIZADA'; } 
        else if (stop.arrived_time) { statusClass = 'atendimento'; statusText = 'EM ATENDIMENTO'; } 
        else {
            switch (stop.status) {
                case 'IN_TREATMENT': statusClass = 'problema'; statusText = 'EM TRATAMENTO'; isCritical = true; break;
                case 'RESCHEDULED': statusClass = 'problema'; statusText = 'DEVOLUÇÃO'; isCritical = true; break;
                case 'ON_THE_WAY': statusClass = 'caminho'; statusText = 'A CAMINHO'; break;
                case 'NOT_STARTED': statusClass = 'pendente'; statusText = 'NÃO INICIADA'; break;
                default: statusText = stop.status || 'PENDENTE'; break;
            }
        }
        if (!stop.finished_time && stop.visit_order < maiorParadaConcluida) { isCritical = true; statusText = 'ATENÇÃO: PULO DE ROTA'; statusClass = 'problema'; }
        if (isCritical) { criticalIcon = ' ⚠️'; }
        const nomeCliente = clientesMap[stop.customer_id] || `Cliente Desconhecido`;
        const li = document.createElement('li');
        if(isCritical) li.classList.add('parada-critica');
        li.innerHTML = `<div><strong>Parada ${stop.visit_order}:</strong> Cliente: ${nomeCliente}${criticalIcon}<br><small>Código: ${stop.customer_id}</small><br><small>Chegada: ${stop.arrived_time ? new Date(stop.arrived_time).toLocaleTimeString('pt-BR') : '---'} | Finalizado: ${stop.finished_time ? new Date(stop.finished_time).toLocaleTimeString('pt-BR') : '---'}</small></div><span class="status-badge status-${statusClass}">${statusText}</span>`;
        stopsListElement.appendChild(li);
    }
}

function mostrarVisaoMestra() { visaoMestraContainer.classList.remove('hidden'); visaoDetalheContainer.classList.add('hidden'); }
function mostrarVisaoDetalhe(tourId, driverName) { visaoMestraContainer.classList.add('hidden'); visaoDetalheContainer.classList.remove('hidden'); renderizarDetalhesDasParadas(tourId, driverName); }

async function inicializarPainel() {
    toursTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Carregando dados...</td></tr>';
    
    const [toursRes, stopsRes] = await Promise.all([
        supabaseClient.from("tours").select("*"),
        supabaseClient.from("stops").select("*")
    ]);

    if (toursRes.error || stopsRes.error) {
        console.error("ERRO FATAL:", toursRes.error || stopsRes.error);
        toursTableBody.innerHTML = '<tr><td colspan="6">Erro ao carregar dados. Verifique o console.</td></tr>';
        return;
    }
    todosOsTours = toursRes.data;
    todasAsParadas = stopsRes.data;

    renderizarCartoesDeResumo(todosOsTours, todasAsParadas);
    renderizarTabelaDeTours();
}

function ouvirMudancas() {
    const canal = supabaseClient.channel("public-changes");
    canal.on("postgres_changes", { event: "*", schema: "public" }, payload => {
        console.log("Mudança recebida, atualizando painel...", payload);
        inicializarPainel();
    }).subscribe();
}

// --- 6. INICIALIZAÇÃO E EVENTOS ---
document.addEventListener('DOMContentLoaded', () => {
    btnVoltar.addEventListener('click', mostrarVisaoMestra);
    filtroGeralInput.addEventListener('keyup', renderizarTabelaDeTours); 

    tabAndamento.addEventListener('click', () => {
        abaAtiva = 'andamento';
        tabAndamento.classList.add('active');
        tabFinalizadas.classList.remove('active');
        renderizarTabelaDeTours();
    });

    tabFinalizadas.addEventListener('click', () => {
        abaAtiva = 'finalizadas';
        tabFinalizadas.classList.add('active');
        tabAndamento.classList.remove('active');
        renderizarTabelaDeTours();
    });

    inicializarPainel(); // Carga inicial
    ouvirMudancas();   // Escuta em tempo real

    // NOVO: Adiciona um temporizador para atualizar tudo a cada 10 minutos
    setInterval(() => {
        console.log("Executando atualização automática de 10 minutos...");
        inicializarPainel();
    }, 600000); // 10 minutos = 600,000 milissegundos
});